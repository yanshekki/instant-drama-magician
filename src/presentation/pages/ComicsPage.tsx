import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import {
  coerceComicPageLayout,
  comicLayoutsByGroup,
  comicPanelCentroid,
  comicPanelSvgPath,
  getComicPageLayout,
  type ComicPageLayoutDef,
  type ComicPageLayoutId,
  type ComicVideoScheme
} from '../../domain/comicPageLayouts'
import {
  COMIC_PAGE_FORMATS,
  aspectForComicFormat,
  comicFormatLabelKey,
  effectiveComicPageFormat,
  videoAspectForComicFormat,
  type ComicPageFormat
} from '../../domain/comicPageFormat'
import {
  readComicVideoScheme,
  writeComicVideoScheme
} from '../lib/comicVideoSchemePref'
import {
  emptyPanelSlot,
  normalizePanelSlots,
  parsePanelScriptJson,
  type ComicPanelSlot
} from '../../domain/comicPanelScript'
import {
  artStylesByGroup,
  DEFAULT_ART_STYLE,
  getArtStyle,
  type ArtStyleId
} from '../../domain/characterArtStyles'
import { getApi } from '../../lib/api'
import { formatUserError } from '../lib/formatUserError'
import { pageRootClass, stickyFooterClass } from '../lib/mobileLayout'
import { useApp } from '../context/AppContext'
import { useToast } from '../context/ToastContext'
import { useDialog } from '../context/DialogContext'
import { useAiJobs } from '../context/AiJobsContext'
import { PageHeader } from '../components/PageHeader'
import { LocalMediaImage } from '../components/LocalMediaImage'
import {
  ComicPageVideoLibrary,
  ComicVideoPlayerDialog
} from '../components/ComicPageVideoLibrary'
import { ExportFinalDialog } from '../components/ExportFinalDialog'
import {
  parseComicPageVideos,
  type ComicPageVideo
} from '../../domain/comicPageVideos'
import { Button, EmptyState, Select, Textarea } from '../components/ui'
import {
  defaultExportFinalOptions,
  type ExportFinalOptions
} from '../../domain/exportOptions'

type ComicBook = {
  id: string
  storyId: string
  title?: string | null
  artStyle?: string | null
  hardRules?: string | null
  pageFormat?: string | null
}

type ComicPageRow = {
  id: string
  comicId: string
  order: number
  panelLayout: string
  pageFormat?: string | null
  artStyle?: string | null
  panelScriptJson?: string | null
  imagePath?: string | null
  videoPath?: string | null
  videoGalleryJson?: string | null
  mediaStatus?: string
  mediaError?: string | null
}

type TimelineBeat = {
  id: string
  order: number
  dialogue?: string | null
}

type StudioTab = 'layout' | 'panels' | 'image'

function artStyleOrDefault(id?: string | null): ArtStyleId {
  return getArtStyle(id ?? undefined).id
}

function glyphInnerClass(
  format: ComicPageFormat,
  compact?: boolean,
  hero?: boolean
): string {
  if (compact) return 'h-full w-full'
  if (hero) {
    if (format === 'tall') return 'h-full w-[5.625rem]'
    if (format === 'square') return 'h-[7.5rem] w-[7.5rem]'
    return 'h-[5.625rem] w-full'
  }
  if (format === 'tall') return 'mx-auto h-14 w-8'
  if (format === 'square') return 'mx-auto h-12 w-12'
  return 'mx-auto h-8 w-14'
}

function LayoutGlyph({
  layoutId,
  compact,
  hero,
  format
}: {
  layoutId: string
  compact?: boolean
  hero?: boolean
  format?: ComicPageFormat
}): JSX.Element {
  const layout = getComicPageLayout(layoutId)
  const pageFormat = format ?? layout.sizeClass
  const svg = (
    <svg
      viewBox="-0.35 -0.35 12.7 12.7"
      className={glyphInnerClass(pageFormat, compact, hero)}
      aria-hidden
    >
      <rect x="0" y="0" width="12" height="12" fill="#0b1220" />
      {layout.cells.map((cell) => {
        const c = comicPanelCentroid(cell)
        return (
          <g key={cell.i}>
            <path
              d={comicPanelSvgPath(cell)}
              fill="#4b5563"
              stroke="#0b1220"
              strokeWidth="0.45"
            />
            <text
              x={c.x}
              y={c.y}
              textAnchor="middle"
              dominantBaseline="central"
              fill="#e5e7eb"
              fontSize="1.7"
              fontWeight="600"
            >
              {cell.i + 1}
            </text>
          </g>
        )
      })}
    </svg>
  )
  if (hero) {
    return (
      <div className="flex h-40 w-40 shrink-0 items-center justify-center">
        {svg}
      </div>
    )
  }
  return svg
}

function LayoutPickerGroup({
  title,
  layouts,
  layoutId,
  onPick,
  t
}: {
  title: string
  layouts: ComicPageLayoutDef[]
  layoutId: ComicPageLayoutId
  onPick: (id: ComicPageLayoutId) => void
  t: (key: string) => string
}): JSX.Element {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-500">
        {title}
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {layouts.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => onPick(l.id)}
            className={[
              'rounded-lg border p-2 text-left transition',
              l.id === layoutId
                ? 'border-brand-500 bg-brand-950/40 ring-1 ring-brand-500/40'
                : 'border-ink-800 bg-ink-900/50 hover:border-ink-600'
            ].join(' ')}
          >
            <LayoutGlyph layoutId={l.id} format={l.sizeClass} />
            <div className="mt-1.5 text-[11px] font-medium text-ink-200">
              {t(`comics.${l.labelKey}`)}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

function FormatChips({
  value,
  onPick,
  t
}: {
  value: ComicPageFormat
  onPick: (v: ComicPageFormat) => void
  t: (key: string) => string
}): JSX.Element {
  return (
    <div
      role="radiogroup"
      aria-label={t('comics.formatHeading')}
      className="grid grid-cols-3 gap-1.5"
    >
      {COMIC_PAGE_FORMATS.map((id) => {
        const on = value === id
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onPick(id)}
            className={[
              'rounded-lg border px-2 py-2 text-center text-[11px] font-medium leading-tight transition',
              on
                ? 'border-brand-400 bg-brand-950/70 text-brand-100 ring-2 ring-brand-400'
                : 'border-ink-800 bg-ink-900/50 text-ink-300 hover:border-ink-600'
            ].join(' ')}
          >
            {t(`comics.${comicFormatLabelKey(id)}`)}
          </button>
        )
      })}
    </div>
  )
}

function ArtStyleSelect({
  value,
  onChange,
  inheritLabel,
  artGroups,
  t
}: {
  value: string
  onChange: (v: string) => void
  inheritLabel?: string
  artGroups: ReturnType<typeof artStylesByGroup>
  t: (key: string) => string
}): JSX.Element {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)}>
      {inheritLabel ? <option value="">{inheritLabel}</option> : null}
      {(
        [
          'artGroupPhoto',
          'artGroup3d',
          'artGroupAnime',
          'artGroupIllust'
        ] as const
      ).map((gk) => (
        <optgroup key={gk} label={t(`characters.${gk}`)}>
          {artGroups[gk].map((s) => (
            <option key={s.id} value={s.id}>
              {t(`characters.${s.labelKey}`)}
            </option>
          ))}
        </optgroup>
      ))}
    </Select>
  )
}

function ComicVideoSchemePicker({
  scheme,
  onPick,
  t
}: {
  scheme: ComicVideoScheme
  onPick: (id: ComicVideoScheme) => void
  t: (key: string) => string
}): JSX.Element {
  const cards: Array<{
    id: ComicVideoScheme
    title: string
    badge: string
    lock: string
    camera: string
    materials: string
    polish: string
  }> = [
    {
      id: 'page',
      title: t('comics.schemePageTitle'),
      badge: t('comics.schemePageBadge'),
      lock: t('comics.schemePageLock'),
      camera: t('comics.schemePageCamera'),
      materials: t('comics.schemePageMaterials'),
      polish: t('comics.schemePagePolish')
    },
    {
      id: 'drama',
      title: t('comics.schemeDramaTitle'),
      badge: t('comics.schemeDramaBadge'),
      lock: t('comics.schemeDramaLock'),
      camera: t('comics.schemeDramaCamera'),
      materials: t('comics.schemeDramaMaterials'),
      polish: t('comics.schemeDramaPolish')
    }
  ]
  return (
    <section>
      <div className="mb-2">
        <h3 className="text-sm font-semibold text-ink-100">
          {t('comics.schemeHeading')}
        </h3>
        <p className="mt-0.5 text-[11px] leading-relaxed text-ink-500">
          {t('comics.schemeHint')}
        </p>
      </div>
      <div
        role="radiogroup"
        aria-label={t('comics.schemeHeading')}
        className="grid grid-cols-1 gap-2 lg:grid-cols-2"
      >
        {cards.map((card) => {
          const on = scheme === card.id
          return (
            <button
              key={card.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onPick(card.id)}
              className={[
                'rounded-xl border p-3 text-left transition',
                on
                  ? 'border-brand-400 bg-brand-950/70 ring-2 ring-brand-400 shadow-[0_0_0_1px_rgba(96,165,250,0.45)]'
                  : 'border-ink-800 bg-ink-900/40 hover:border-ink-600'
              ].join(' ')}
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={[
                    'inline-block h-3.5 w-3.5 shrink-0 rounded-full border-2',
                    on
                      ? 'border-brand-300 bg-brand-400'
                      : 'border-ink-600 bg-transparent'
                  ].join(' ')}
                  aria-hidden
                />
                <span className="text-sm font-semibold text-ink-50">
                  {card.title}
                </span>
                <span
                  className={[
                    'rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                    on
                      ? 'bg-brand-500/25 text-brand-100'
                      : 'bg-ink-800 text-ink-400'
                  ].join(' ')}
                >
                  {card.badge}
                </span>
                {on ? (
                  <span className="ml-auto rounded-full bg-brand-500 px-1.5 py-0.5 text-[10px] font-semibold text-ink-950">
                    {t('comics.schemeSelected')}
                  </span>
                ) : null}
              </div>
              <dl className="mt-2 space-y-1.5 text-[11px] leading-snug">
                {(
                  [
                    ['comics.schemeLockLabel', card.lock],
                    ['comics.schemeCameraLabel', card.camera],
                    ['comics.schemeMaterialsLabel', card.materials],
                    ['comics.schemePolishLabel', card.polish]
                  ] as const
                ).map(([labelKey, body]) => (
                  <div key={labelKey}>
                    <dt className="font-medium text-ink-300">{t(labelKey)}</dt>
                    <dd className="text-ink-400">{body}</dd>
                  </div>
                ))}
              </dl>
              {on ? (
                <p className="mt-2 text-[11px] font-medium text-brand-200">
                  {t('comics.schemeApplyHint')}
                </p>
              ) : null}
            </button>
          )
        })}
      </div>
    </section>
  )
}

export function ComicsPage(): JSX.Element {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { stories, activeStoryId, setActiveStoryId } = useApp()
  const toast = useToast()
  const toastRef = useRef(toast)
  toastRef.current = toast
  const dialog = useDialog()
  const { startMediaGen } = useAiJobs()

  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [, setComic] = useState<ComicBook | null>(null)
  const [pages, setPages] = useState<ComicPageRow[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [beats, setBeats] = useState<TimelineBeat[]>([])
  const [bookArtStyle, setBookArtStyle] = useState<ArtStyleId>(DEFAULT_ART_STYLE)
  const [bookHardRules, setBookHardRules] = useState('')
  const [bookPageFormat, setBookPageFormat] = useState<ComicPageFormat>('tall')
  const [pageFormat, setPageFormat] = useState<ComicPageFormat>('tall')
  const lastStillFormat = useRef<ComicPageFormat | null>(null)
  const pageFormatRef = useRef<ComicPageFormat>('tall')
  pageFormatRef.current = pageFormat
  const [layoutId, setLayoutId] = useState<ComicPageLayoutId>('grid-2x2')
  const [pageArtStyle, setPageArtStyle] = useState<string>('')
  const [slots, setSlots] = useState<ComicPanelSlot[]>(
    normalizePanelSlots([], 4)
  )
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<StudioTab>('layout')
  const [bookOpen, setBookOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [videoScheme, setVideoScheme] = useState<ComicVideoScheme>(() =>
    readComicVideoScheme()
  )
  const [playingVideo, setPlayingVideo] = useState<ComicPageVideo | null>(null)
  const userChoseTab = useRef(false)
  const tabPrimed = useRef(false)

  const artGroups = useMemo(() => artStylesByGroup(), [])
  const selected = pages.find((p) => p.id === selectedId) ?? null
  const layout = getComicPageLayout(layoutId)
  const selectedVideos = parseComicPageVideos(selected?.videoGalleryJson, {
    videoPath: selected?.videoPath
  })
  const videoCount = pages.filter(
    (p) =>
      parseComicPageVideos(p.videoGalleryJson, { videoPath: p.videoPath })
        .length > 0
  ).length

  const load = useCallback(async (): Promise<void> => {
    if (!activeStoryId) {
      setComic(null)
      setPages([])
      setSelectedId(null)
      setBeats([])
      return
    }
    setLoading(true)
    try {
      const pack = await getApi().comics.get(activeStoryId)
      setComic(pack.comic)
      setPages(pack.pages)
      setBookArtStyle(artStyleOrDefault(pack.comic.artStyle))
      setBookHardRules(pack.comic.hardRules || '')
      setBookPageFormat(
        effectiveComicPageFormat({
          pageFormat: null,
          bookFormat: pack.comic.pageFormat ?? 'tall',
          layout: getComicPageLayout('yonkoma')
        })
      )
      const list = (await getApi().timeline.list(activeStoryId)) as TimelineBeat[]
      setBeats(Array.isArray(list) ? list : [])
      setSelectedId((prev) => {
        if (prev && pack.pages.some((p) => p.id === prev)) return prev
        return pack.pages[0]?.id ?? null
      })
      setLoadError(null)
    } catch (e) {
      const msg = formatUserError(e instanceof Error ? e.message : String(e), t)
      setLoadError(msg)
      toastRef.current.error(msg)
    } finally {
      setLoading(false)
    }
  }, [activeStoryId, t])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!selected) {
      setLayoutId('grid-2x2')
      setPageArtStyle('')
      setSlots(normalizePanelSlots([], 4))
      return
    }
    const nextLayout = coerceComicPageLayout(selected.panelLayout)
    setLayoutId(nextLayout)
    const fmt = effectiveComicPageFormat({
      pageFormat: selected.pageFormat,
      bookFormat: bookPageFormat,
      layout: getComicPageLayout(nextLayout)
    })
    setPageFormat(fmt)
    if (selected.imagePath?.trim()) lastStillFormat.current = fmt
    setPageArtStyle(selected.artStyle || '')
    setSlots(parsePanelScriptJson(selected.panelScriptJson, nextLayout))
    if (!userChoseTab.current && !tabPrimed.current) {
      tabPrimed.current = true
      const parsed = parsePanelScriptJson(selected.panelScriptJson, nextLayout)
      const hasImage = Boolean(selected.imagePath?.trim())
      const hasCopy = parsed.some((s) => s.caption.trim())
      setTab(hasImage ? 'image' : hasCopy ? 'panels' : 'layout')
    }
  }, [selected?.id, selected?.panelLayout, selected?.panelScriptJson, selected?.artStyle])

  useEffect(() => {
    const onDone = (): void => {
      void load()
    }
    const onVideo = (ev: Event): void => {
      const kind = (ev as CustomEvent).detail?.kind
      if (kind === 'comic-intro') void load()
      if (kind === 'comic-page')
        lastStillFormat.current = pageFormatRef.current
    }
    window.addEventListener('idm:comic-page-done', onDone)
    window.addEventListener('idm:video-prep-done', onVideo)
    return () => {
      window.removeEventListener('idm:comic-page-done', onDone)
      window.removeEventListener('idm:video-prep-done', onVideo)
    }
  }, [load])

  const persistPage = async (
    pageId: string,
    next: {
      layout?: ComicPageLayoutId
      pageFormat?: ComicPageFormat
      artStyle?: string
      slots?: ComicPanelSlot[]
    }
  ): Promise<void> => {
    setSaving(true)
    try {
      await getApi().comics.updatePage(pageId, {
        panelLayout: next.layout ?? layoutId,
        pageFormat: next.pageFormat ?? pageFormat,
        artStyle:
          next.artStyle === ''
            ? null
            : (next.artStyle ?? pageArtStyle) || null,
        panelScript: next.slots ?? slots
      })
      await load()
    } catch (e) {
      toast.error(formatUserError(e instanceof Error ? e.message : String(e), t))
    } finally {
      setSaving(false)
    }
  }

  const pickLayout = (id: ComicPageLayoutId): void => {
    if (!selected) return
    const next = coerceComicPageLayout(id)
    const rec = getComicPageLayout(next).sizeClass
    setLayoutId(next)
    setPageFormat(rec)
    setSlots((prev) =>
      normalizePanelSlots(prev, getComicPageLayout(next).panelCount)
    )
    void persistPage(selected.id, {
      layout: next,
      pageFormat: rec,
      slots: normalizePanelSlots(slots, getComicPageLayout(next).panelCount)
    })
  }

  const pickPageFormat = (next: ComicPageFormat): void => {
    setPageFormat(next)
    if (selected) void persistPage(selected.id, { pageFormat: next })
  }

  const handleAddPage = async (): Promise<void> => {
    if (!activeStoryId) return
    try {
      const row = await getApi().comics.addPage(activeStoryId, {
        panelLayout: layoutId,
        artStyle: bookArtStyle
      })
      toast.success(t('comics.addPageOk'))
      await load()
      setSelectedId(row.id)
      if (!userChoseTab.current) setTab('layout')
    } catch (e) {
      toast.error(formatUserError(e instanceof Error ? e.message : String(e), t))
    }
  }

  const handleAutoPaginate = async (): Promise<void> => {
    if (!activeStoryId) return
    try {
      const r = await getApi().comics.autoPaginate(activeStoryId, layoutId)
      toast.success(t('comics.autoPaginateOk', { count: r.created }))
      await load()
    } catch (e) {
      toast.error(formatUserError(e instanceof Error ? e.message : String(e), t))
    }
  }

  const handleSaveBook = async (): Promise<void> => {
    if (!activeStoryId) return
    try {
      await getApi().comics.update(activeStoryId, {
        artStyle: bookArtStyle,
        hardRules: bookHardRules,
        pageFormat: bookPageFormat
      })
      toast.success(t('comics.saved'))
      await load()
    } catch (e) {
      toast.error(formatUserError(e instanceof Error ? e.message : String(e), t))
    }
  }

  const handleDelete = async (): Promise<void> => {
    if (!selected) return
    const ok = await dialog.confirm({
      title: t('comics.deletePage'),
      message: t('comics.confirmDelete', { n: selected.order + 1 }),
      confirmLabel: t('comics.deletePage')
    })
    if (!ok) return
    try {
      await getApi().comics.deletePage(selected.id)
      toast.success(t('comics.deleted'))
      setSelectedId(null)
      await load()
    } catch (e) {
      toast.error(formatUserError(e instanceof Error ? e.message : String(e), t))
    }
  }

  const handleGenerate = async (): Promise<void> => {
    if (!selected || !activeStoryId) return
    await persistPage(selected.id, {})
    startMediaGen({
      kind: 'comic-page',
      storyId: activeStoryId,
      pageId: selected.id,
      panelLayout: layoutId,
      pageFormat,
      artStyle: pageArtStyle || bookArtStyle,
      preferIdentityEdit: lastStillFormat.current === pageFormat,
      aspectRatio: aspectForComicFormat(pageFormat)
    })
  }

  const handleGenerateVideo = async (): Promise<void> => {
    if (!selected || !activeStoryId) return
    const src = selected.imagePath?.trim()
    if (!src) {
      toast.error(t('comics.generateVideoNeedImage'))
      chooseTab('image')
      return
    }
    await persistPage(selected.id, {})
    const { buildIntroMediaGenRequest } = await import(
      '../lib/startIntroMediaGen'
    )
    const req = await buildIntroMediaGenRequest({
      kind: 'comic-intro',
      sourceImagePath: src,
      storyId: activeStoryId,
      pageId: selected.id,
      artStyle: pageArtStyle || bookArtStyle,
      durationSeconds: 10,
      skipStillIfExists: true,
      comicVideoScheme: videoScheme,
      aspectRatio: videoAspectForComicFormat(pageFormat)
    })
    startMediaGen(req)
  }

  const pickVideoScheme = (next: ComicVideoScheme): void => {
    setVideoScheme(next)
    writeComicVideoScheme(next)
  }

  const handleSetPrimaryVideo = async (video: ComicPageVideo): Promise<void> => {
    if (!selected) return
    try {
      await getApi().comics.setPageVideoPrimary(selected.id, video.id)
      await load()
    } catch (e) {
      toast.error(formatUserError(e instanceof Error ? e.message : String(e), t))
    }
  }

  const handleDeleteVideo = async (
    video: ComicPageVideo,
    versionN: number
  ): Promise<void> => {
    if (!selected) return
    const ok = await dialog.confirm({
      title: t('comics.deleteVersion'),
      message: t('comics.confirmDeleteVersion', { n: versionN }),
      confirmLabel: t('comics.deleteVersion')
    })
    if (!ok) return
    try {
      await getApi().comics.deletePageVideo(selected.id, video.id)
      if (playingVideo?.id === video.id) setPlayingVideo(null)
      toast.success(t('comics.deletedVersion'))
      await load()
    } catch (e) {
      toast.error(formatUserError(e instanceof Error ? e.message : String(e), t))
    }
  }

  const handleExportFinal = async (
    opts: ExportFinalOptions
  ): Promise<void> => {
    if (!activeStoryId) return
    if (videoCount === 0) {
      toast.error(t('comics.exportNeedVideos'))
      return
    }
    setExporting(true)
    try {
      const pre = await getApi().media.exportPreflight(activeStoryId)
      if (!pre.canExport) {
        toast.error(pre.ffmpegMessage || t('pipeline.needFfmpeg'))
        return
      }
      const r = await getApi().media.exportFinal(activeStoryId, {
        ...defaultExportFinalOptions(opts),
        clipSource: 'comics'
      })
      setExportOpen(false)
      toast.success(t('comics.exportOk', { path: r.outputPath }))
      if (opts.openExportFolder && r.outputPath) {
        await getApi().shell.showItemInFolder(r.outputPath)
      }
    } catch (e) {
      toast.error(formatUserError(e instanceof Error ? e.message : String(e), t))
    } finally {
      setExporting(false)
    }
  }

  const handleImport = async (): Promise<void> => {
    if (!selected) return
    if (!selected.imagePath) {
      toast.error(t('comics.importNeedImage'))
      return
    }
    try {
      const r = await getApi().comics.importToTimeline(selected.id)
      toast.success(t('comics.importOk', { count: r.imported }))
    } catch (e) {
      toast.error(formatUserError(e instanceof Error ? e.message : String(e), t))
    }
  }

  const chooseTab = (next: StudioTab): void => {
    userChoseTab.current = true
    setTab(next)
  }

  const storyPicker = (
    <Select
      aria-label={t('comics.story')}
      className="!w-[12rem]"
      value={activeStoryId ?? ''}
      onChange={(e) => setActiveStoryId(e.target.value || null)}
      disabled={stories.length === 0}
    >
      {stories.length === 0 ? (
        <option value="">{t('comics.noStories')}</option>
      ) : (
        stories.map((s) => (
          <option key={s.id} value={s.id}>
            {s.title}
          </option>
        ))
      )}
    </Select>
  )

  if (!activeStoryId) {
    return (
      <div className={pageRootClass}>
        <PageHeader
          title={t('comics.title')}
          subtitle={t('comics.subtitle')}
          actions={storyPicker}
        />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 overflow-y-auto p-6">
          <EmptyState message={t('comics.pickStoryHint')} />
          {stories.length === 0 && (
            <Button variant="secondary" onClick={() => navigate('/')}>
              {t('comics.goStories')}
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={pageRootClass}>
      <PageHeader
        title={t('comics.title')}
        subtitle={t('comics.subtitle')}
        actions={
          <>
            {storyPicker}
            <Button variant="secondary" onClick={() => void handleAutoPaginate()}>
              {t('comics.autoPaginate')}
            </Button>
            <Button
              variant="secondary"
              disabled={videoCount === 0 || exporting}
              title={
                videoCount === 0 ? t('comics.exportNeedVideos') : undefined
              }
              onClick={() => setExportOpen(true)}
            >
              {exporting
                ? t('common.exporting')
                : `${t('comics.exportFinal')}${videoCount ? `（${videoCount}）` : ''}`}
            </Button>
            <Button onClick={() => void handleAddPage()}>{t('comics.addPage')}</Button>
          </>
        }
      />
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="min-h-0 shrink-0 overflow-y-auto overscroll-y-contain border-b border-ink-800 px-3 py-3 sm:px-4 lg:w-64 lg:border-b-0 lg:border-r [-webkit-overflow-scrolling:touch]">
          <button
            type="button"
            className="mb-3 flex w-full items-center justify-between rounded-lg border border-ink-800 bg-ink-900/70 px-3 py-2 text-left text-xs font-medium text-ink-200"
            aria-expanded={bookOpen}
            onClick={() => setBookOpen((v) => !v)}
          >
            {t('comics.bookSettings')}
            <span className="text-ink-500">{bookOpen ? '▴' : '▾'}</span>
          </button>
          {bookOpen ? (
            <section className="mb-3 rounded-xl border border-ink-800 bg-ink-900/70 p-3">
              <label className="mb-1 block text-xs font-medium text-ink-400">
                {t('comics.bookStyle')}
              </label>
              <ArtStyleSelect
                value={bookArtStyle}
                onChange={(v) => setBookArtStyle(artStyleOrDefault(v))}
                artGroups={artGroups}
                t={t}
              />
              <label className="mb-1 mt-3 block text-xs font-medium text-ink-400">
                {t('comics.formatBookDefault')}
              </label>
              <FormatChips
                value={bookPageFormat}
                onPick={setBookPageFormat}
                t={t}
              />
              <label className="mb-1 mt-3 block text-xs font-medium text-ink-400">
                {t('comics.hardRules')}
              </label>
              <Textarea
                size="sm"
                value={bookHardRules}
                placeholder={t('comics.hardRulesPh')}
                onChange={(e) => setBookHardRules(e.target.value)}
              />
              <Button
                variant="secondary"
                className="mt-2 w-full"
                onClick={() => void handleSaveBook()}
              >
                {t('common.save')}
              </Button>
            </section>
          ) : null}
          <div className="space-y-2">
            {loadError && (
              <p className="rounded-lg border border-rose-800/60 bg-rose-950/40 px-3 py-2 text-xs text-rose-200">
                {loadError}
              </p>
            )}
            {pages.length === 0 && !loading && !loadError && (
              <EmptyState message={t('comics.empty')} />
            )}
            {pages.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedId(p.id)}
                className={[
                  'flex w-full items-center gap-2 rounded-xl border p-2 text-left transition',
                  p.id === selectedId
                    ? 'border-brand-500 bg-brand-950/50'
                    : 'border-ink-800 bg-ink-900/60 hover:border-ink-600'
                ].join(' ')}
              >
                <div className="relative h-12 w-10 shrink-0 overflow-hidden rounded bg-ink-950">
                  {p.imagePath ? (
                    <LocalMediaImage
                      filePath={p.imagePath}
                      alt=""
                      className="h-full w-full object-cover"
                      variant="fill"
                      showActions={false}
                    />
                  ) : p.videoPath ? (
                    <div className="flex h-full w-full items-center justify-center bg-ink-900 text-ink-300">
                      ▶
                    </div>
                  ) : (
                    <LayoutGlyph layoutId={p.panelLayout} compact />
                  )}
                  {parseComicPageVideos(p.videoGalleryJson, {
                    videoPath: p.videoPath
                  }).length > 0 ? (
                    <span className="absolute bottom-0.5 right-0.5 rounded bg-black/75 px-1 text-[9px] font-semibold leading-4 text-white">
                      ▶
                    </span>
                  ) : null}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-ink-100">
                    {t('comics.pageN', { n: p.order + 1 })}
                  </div>
                  <div className="truncate text-[11px] text-ink-500">
                    {t(`comics.${getComicPageLayout(p.panelLayout).labelKey}`)}
                    {(() => {
                      const n = parseComicPageVideos(p.videoGalleryJson, {
                        videoPath: p.videoPath
                      }).length
                      if (n === 0) return ''
                      return n === 1
                        ? ` · ${t('comics.hasVideo')}`
                        : ` · ${t('comics.hasVideos', { n })}`
                    })()}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          {!selected ? (
            <div className="flex flex-1 items-center justify-center p-6">
              <EmptyState message={t('comics.empty')} />
            </div>
          ) : (
            <>
              <div className="shrink-0 border-b border-ink-800 px-3 pt-3 sm:px-6">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold text-ink-100">
                      {t('comics.pageN', { n: selected.order + 1 })}
                    </h2>
                    <p className="mt-0.5 text-[11px] text-ink-500">
                      {t(`comics.${layout.labelKey}`)}
                    </p>
                  </div>
                </div>
                <nav
                  role="tablist"
                  aria-label={t('comics.title')}
                  className="mt-2 flex gap-0.5"
                  onKeyDown={(e) => {
                    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
                    e.preventDefault()
                    const order: StudioTab[] = ['layout', 'panels', 'image']
                    const i = order.indexOf(tab)
                    const next =
                      e.key === 'ArrowRight'
                        ? order[(i + 1) % order.length]
                        : order[(i + 2) % order.length]
                    chooseTab(next)
                  }}
                >
                  {(
                    [
                      ['layout', 'comics.tabLayout'],
                      ['panels', 'comics.tabPanels'],
                      ['image', 'comics.tabImage']
                    ] as const
                  ).map(([id, key]) => {
                    const active = tab === id
                    return (
                      <button
                        key={id}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        id={`comics-tab-${id}`}
                        className={[
                          'relative min-h-11 shrink-0 px-3 py-2.5 text-sm font-medium transition',
                          active
                            ? 'text-brand-200'
                            : 'text-ink-400 hover:text-ink-200'
                        ].join(' ')}
                        onClick={() => chooseTab(id)}
                      >
                        {t(key)}
                        {active ? (
                          <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-brand-500" />
                        ) : null}
                      </button>
                    )
                  })}
                </nav>
              </div>

              <div
                role="tabpanel"
                aria-labelledby={`comics-tab-${tab}`}
                className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 py-4 sm:px-6 [-webkit-overflow-scrolling:touch]"
              >
                {tab === 'layout' ? (
                  <div className="space-y-5">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-ink-400">
                        {t('comics.formatHeading')}
                      </label>
                      <FormatChips
                        value={pageFormat}
                        onPick={pickPageFormat}
                        t={t}
                      />
                      <p className="mt-1.5 flex h-5 items-center gap-1.5 overflow-hidden text-[11px] leading-5 text-ink-500">
                        {pageFormat !== layout.sizeClass ? (
                          <>
                            <span className="min-w-0 truncate">
                              {t('comics.formatBetterFor', {
                                format: t(
                                  `comics.${comicFormatLabelKey(layout.sizeClass)}`
                                )
                              })}
                            </span>
                            <button
                              type="button"
                              className="shrink-0 font-medium text-brand-300 hover:underline"
                              onClick={() => pickPageFormat(layout.sizeClass)}
                            >
                              {t('comics.formatFollowsTemplate')}
                            </button>
                          </>
                        ) : (
                          <span>{t('comics.formatFollowsTemplate')}</span>
                        )}
                      </p>
                    </div>
                    <div className="flex flex-col gap-4 rounded-xl border border-ink-800 bg-ink-900/50 p-4 sm:flex-row sm:items-center">
                      <LayoutGlyph
                        layoutId={layoutId}
                        hero
                        format={pageFormat}
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-medium uppercase tracking-wide text-ink-500">
                          {t('comics.pagePreview')}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-ink-100">
                          {t(`comics.${layout.labelKey}`)}
                          <span className="ml-2 text-[11px] font-medium text-ink-400">
                            {t(`comics.${comicFormatLabelKey(pageFormat)}`)}
                          </span>
                        </p>
                        <p className="mt-1 text-[12px] leading-relaxed text-ink-400">
                          {t('comics.layoutHint')}
                        </p>
                        <Button
                          variant="secondary"
                          className="mt-3"
                          onClick={() => chooseTab('panels')}
                        >
                          {t('comics.switchToPanels')}
                        </Button>
                      </div>
                    </div>
                    <div className="max-w-sm">
                      <label className="mb-1 block text-xs font-medium text-ink-400">
                        {t('comics.pageStyle')}
                      </label>
                      <ArtStyleSelect
                        value={pageArtStyle}
                        onChange={(v) => {
                          setPageArtStyle(v)
                          void persistPage(selected.id, { artStyle: v })
                        }}
                        inheritLabel={t('comics.pageStyleInherit')}
                        artGroups={artGroups}
                        t={t}
                      />
                    </div>
                    {(
                      [
                        ['even', 'comics.groupEven'],
                        ['manga', 'comics.groupManga']
                      ] as const
                    ).map(([group, titleKey]) => (
                      <LayoutPickerGroup
                        key={group}
                        title={t(titleKey)}
                        layouts={comicLayoutsByGroup(group)}
                        layoutId={layoutId}
                        t={t}
                        onPick={pickLayout}
                      />
                    ))}
                  </div>
                ) : tab === 'panels' ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 rounded-xl border border-ink-800 bg-ink-900/40 px-3 py-2">
                      <div className="h-14 w-10 shrink-0">
                        <LayoutGlyph layoutId={layoutId} compact />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-ink-200">
                          {t(`comics.${layout.labelKey}`)}
                        </p>
                        <p className="text-[11px] text-ink-500">
                          {t('comics.readingOrder', {
                            count: layout.panelCount
                          })}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        onClick={() => chooseTab('layout')}
                      >
                        {t('comics.switchToLayout')}
                      </Button>
                    </div>
                    {slots.map((slot, i) => (
                      <div
                        key={i}
                        className="rounded-xl border border-ink-800 bg-ink-900/50 p-3"
                      >
                        <div className="mb-2 text-xs font-medium text-ink-300">
                          {t('comics.panelN', { n: i + 1 })}
                        </div>
                        <Textarea
                          size="sm"
                          value={slot.caption}
                          placeholder={t('comics.captionPh')}
                          onChange={(e) => {
                            const next = slots.map((s, idx) =>
                              idx === i ? { ...s, caption: e.target.value } : s
                            )
                            setSlots(next)
                          }}
                          onBlur={() => void persistPage(selected.id, { slots })}
                        />
                        <label className="mb-1 mt-2 block text-[11px] text-ink-500">
                          {t('comics.bindBeat')}
                        </label>
                        <Select
                          value={slot.timelineEntryId || ''}
                          onChange={(e) => {
                            const next = slots.map((s, idx) =>
                              idx === i
                                ? {
                                    ...emptyPanelSlot(),
                                    ...s,
                                    timelineEntryId: e.target.value || null
                                  }
                                : s
                            )
                            setSlots(next)
                            void persistPage(selected.id, { slots: next })
                          }}
                        >
                          <option value="">{t('comics.unbindBeat')}</option>
                          {beats.map((b, idx) => (
                            <option key={b.id} value={b.id}>
                              {t('comics.beatN', { n: idx + 1 })}
                              {b.dialogue ? ` — ${b.dialogue.slice(0, 24)}` : ''}
                            </option>
                          ))}
                        </Select>
                      </div>
                    ))}
                    {beats.length === 0 && (
                      <p className="text-[11px] text-ink-500">{t('comics.noBeats')}</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <ComicVideoSchemePicker
                      scheme={videoScheme}
                      onPick={pickVideoScheme}
                      t={t}
                    />
                    {selected.imagePath ? (
                      <div className="overflow-hidden rounded-xl border border-ink-800 bg-ink-950">
                        <LocalMediaImage
                          filePath={selected.imagePath}
                          alt={t('comics.pageN', { n: selected.order + 1 })}
                          className="max-h-[32rem] w-full object-contain"
                          objectFit="contain"
                        />
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-ink-700 bg-ink-900/40 px-6 py-16">
                        <EmptyState message={t('comics.emptyImage')} />
                        <Button
                          onClick={() => void handleGenerate()}
                          disabled={saving}
                        >
                          {t('comics.generate')}
                        </Button>
                      </div>
                    )}
                    <ComicPageVideoLibrary
                      videos={selectedVideos}
                      primaryPath={selected.videoPath}
                      stillPath={selected.imagePath}
                      canGenerate={Boolean(selected.imagePath)}
                      generateBusy={saving}
                      onGenerate={() => void handleGenerateVideo()}
                      onPlay={(v) => setPlayingVideo(v)}
                      onSetPrimary={(v) => void handleSetPrimaryVideo(v)}
                      onDelete={(v, n) => void handleDeleteVideo(v, n)}
                    />
                  </div>
                )}
              </div>

              <div className={stickyFooterClass}>
                <Button
                  variant="danger"
                  className="sm:mr-auto"
                  onClick={() => void handleDelete()}
                >
                  {t('comics.deletePage')}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => void handleImport()}
                >
                  {t('comics.importToTimeline')}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => void handleGenerateVideo()}
                  disabled={saving || !selected.imagePath}
                >
                  {selectedVideos.length > 0
                    ? t('comics.newVersion')
                    : t('comics.pageVideo')}
                </Button>
                <Button
                  onClick={() => void handleGenerate()}
                  disabled={saving}
                >
                  {t('comics.generate')}
                </Button>
              </div>
            </>
          )}
        </section>
      </div>
      <ExportFinalDialog
        open={exportOpen}
        busy={exporting}
        onCancel={() => setExportOpen(false)}
        onConfirm={(opts) => void handleExportFinal(opts)}
      />
      <ComicVideoPlayerDialog
        path={playingVideo?.path ?? null}
        title={t('comics.playPageVideo')}
        onClose={() => setPlayingVideo(null)}
      />
    </div>
  )
}
