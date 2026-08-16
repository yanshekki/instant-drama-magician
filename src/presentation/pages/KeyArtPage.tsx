import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import {
  COMIC_PAGE_FORMATS,
  aspectForComicFormat,
  comicFormatLabelKey,
  effectiveComicPageFormat,
  type ComicPageFormat
} from '../../domain/comicPageFormat'
import {
  KEY_ART_SHOT_TYPES,
  coerceKeyArtShotType,
  getKeyArtShotType,
  type KeyArtShotTypeId
} from '../../domain/keyArtShotTypes'
import {
  KEY_ART_MAKE_METHODS,
  coerceKeyArtMakeMethod,
  type KeyArtMakeMethodId
} from '../../domain/keyArtMakeMethods'
import {
  parseKeyArtShotImages,
  type KeyArtShotImage
} from '../../domain/keyArtShotImages'
import {
  DEFAULT_ART_STYLE,
  artStylesByGroup,
  getArtStyle,
  type ArtStyleId
} from '../../domain/characterArtStyles'
import {
  readKeyArtMakeMethod,
  writeKeyArtMakeMethod
} from '../lib/keyArtMakeMethodPref'
import { getApi } from '../../lib/api'
import { formatUserError } from '../lib/formatUserError'
import { pageRootClass, stickyFooterClass } from '../lib/mobileLayout'
import { useApp } from '../context/AppContext'
import { useToast } from '../context/ToastContext'
import { useDialog } from '../context/DialogContext'
import { useAiJobs } from '../context/AiJobsContext'
import { PageHeader } from '../components/PageHeader'
import { LocalMediaImage } from '../components/LocalMediaImage'
import { KeyArtImageLibrary } from '../components/KeyArtImageLibrary'
import { Button, EmptyState, Select, Textarea } from '../components/ui'

type StudioTab = 'type' | 'materials' | 'image'

type ShotRow = {
  id: string
  keyArtId: string
  order: number
  shotType: string
  makeMethod?: string | null
  pageFormat?: string | null
  artStyle?: string | null
  brief?: string | null
  characterIdsJson?: string | null
  sceneId?: string | null
  timelineEntryId?: string | null
  comicPageId?: string | null
  imagePath?: string | null
  imageGalleryJson?: string | null
  mediaStatus?: string
}

type BeatRow = { id: string; order?: number; dialogue?: string | null }
type CastChar = { id: string; name?: string }
type CastScene = { id: string; name?: string }
type ComicPageOpt = { id: string; order: number }

function parseIds(json?: string | null): string[] {
  if (!json?.trim()) return []
  try {
    const arr = JSON.parse(json) as unknown
    return Array.isArray(arr)
      ? arr.filter((x): x is string => typeof x === 'string' && Boolean(x.trim()))
      : []
  } catch {
    return []
  }
}

export function KeyArtPage(): JSX.Element {
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
  const [shots, setShots] = useState<ShotRow[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [bookArtStyle, setBookArtStyle] = useState<ArtStyleId>(DEFAULT_ART_STYLE)
  const [bookHardRules, setBookHardRules] = useState('')
  const [bookPageFormat, setBookPageFormat] = useState<ComicPageFormat>('wide')
  const [shotType, setShotType] = useState<KeyArtShotTypeId>('cover')
  const [pageFormat, setPageFormat] = useState<ComicPageFormat>('wide')
  const [shotArtStyle, setShotArtStyle] = useState('')
  const [brief, setBrief] = useState('')
  const [characterIds, setCharacterIds] = useState<string[]>([])
  const [sceneId, setSceneId] = useState('')
  const [timelineEntryId, setTimelineEntryId] = useState('')
  const [comicPageId, setComicPageId] = useState('')
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<StudioTab>('type')
  const [bookOpen, setBookOpen] = useState(false)
  const [method, setMethod] = useState<KeyArtMakeMethodId>(() =>
    readKeyArtMakeMethod()
  )
  const [beats, setBeats] = useState<BeatRow[]>([])
  const [chars, setChars] = useState<CastChar[]>([])
  const [scenes, setScenes] = useState<CastScene[]>([])
  const [comicPages, setComicPages] = useState<ComicPageOpt[]>([])
  const userChoseTab = useRef(false)
  const tabPrimed = useRef(false)
  const lastStillFormat = useRef<ComicPageFormat | null>(null)

  const artGroups = useMemo(() => artStylesByGroup(), [])
  const selected = shots.find((p) => p.id === selectedId) ?? null
  const selectedImages = parseKeyArtShotImages(selected?.imageGalleryJson, {
    imagePath: selected?.imagePath
  })
  const typeDef = getKeyArtShotType(shotType)

  const load = useCallback(async (): Promise<void> => {
    if (!activeStoryId) {
      setShots([])
      setSelectedId(null)
      return
    }
    setLoading(true)
    try {
      const pack = await getApi().keyArt.get(activeStoryId)
      setShots(pack.shots)
      setBookArtStyle(getArtStyle(pack.book.artStyle ?? undefined).id)
      setBookHardRules(pack.book.hardRules || '')
      setBookPageFormat(
        effectiveComicPageFormat({
          pageFormat: null,
          bookFormat: pack.book.pageFormat ?? 'wide',
          layout: { sizeClass: 'wide' }
        })
      )
      const [tl, cast, comics] = await Promise.all([
        getApi().timeline.list(activeStoryId).catch(() => []),
        getApi().stories.listCast(activeStoryId).catch(() => ({
          characters: [],
          scenes: []
        })),
        getApi().comics.get(activeStoryId).catch(() => ({ pages: [] }))
      ])
      setBeats(Array.isArray(tl) ? (tl as BeatRow[]) : [])
      const c = cast as { characters?: CastChar[]; scenes?: CastScene[] }
      setChars(Array.isArray(c.characters) ? c.characters : [])
      setScenes(Array.isArray(c.scenes) ? c.scenes : [])
      setComicPages(
        Array.isArray((comics as { pages?: ComicPageOpt[] }).pages)
          ? (comics as { pages: ComicPageOpt[] }).pages
          : []
      )
      setSelectedId((prev) => {
        if (prev && pack.shots.some((p) => p.id === prev)) return prev
        return pack.shots[0]?.id ?? null
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
    if (!selected) return
    const nextType = coerceKeyArtShotType(selected.shotType)
    setShotType(nextType)
    const fmt = effectiveComicPageFormat({
      pageFormat: selected.pageFormat,
      bookFormat: bookPageFormat,
      layout: { sizeClass: getKeyArtShotType(nextType).sizeClass }
    })
    setPageFormat(fmt)
    if (selected.imagePath?.trim()) lastStillFormat.current = fmt
    setShotArtStyle(selected.artStyle || '')
    setBrief(selected.brief || '')
    setCharacterIds(parseIds(selected.characterIdsJson))
    setSceneId(selected.sceneId || '')
    setTimelineEntryId(selected.timelineEntryId || '')
    setComicPageId(selected.comicPageId || '')
    setMethod(coerceKeyArtMakeMethod(selected.makeMethod || readKeyArtMakeMethod()))
    if (!userChoseTab.current && !tabPrimed.current) {
      tabPrimed.current = true
      const hasImage = Boolean(selected.imagePath?.trim())
      const hasMats =
        Boolean(selected.brief?.trim()) ||
        parseIds(selected.characterIdsJson).length > 0
      setTab(hasImage ? 'image' : hasMats ? 'materials' : 'type')
    }
  }, [selected?.id, selected?.shotType, selected?.pageFormat, selected?.artStyle])

  useEffect(() => {
    const onDone = (): void => {
      void load()
    }
    window.addEventListener('idm:key-art-done', onDone)
    return () => window.removeEventListener('idm:key-art-done', onDone)
  }, [load])

  const persistShot = async (
    shotId: string,
    next: Record<string, unknown>
  ): Promise<void> => {
    setSaving(true)
    try {
      await getApi().keyArt.updateShot(shotId, next)
    } catch (e) {
      toast.error(formatUserError(e instanceof Error ? e.message : String(e), t))
    } finally {
      setSaving(false)
    }
  }

  const pickType = (id: KeyArtShotTypeId): void => {
    const def = getKeyArtShotType(id)
    setShotType(id)
    setPageFormat(def.sizeClass)
    if (selected) {
      void persistShot(selected.id, {
        shotType: id,
        pageFormat: def.sizeClass
      })
    }
  }

  const pickMethod = (id: KeyArtMakeMethodId): void => {
    setMethod(id)
    writeKeyArtMakeMethod(id)
    if (selected) void persistShot(selected.id, { makeMethod: id })
  }

  const handleAdd = async (): Promise<void> => {
    if (!activeStoryId) return
    setSaving(true)
    try {
      const row = await getApi().keyArt.addShot(activeStoryId, {
        shotType,
        pageFormat
      })
      toast.success(t('keyArt.saved'))
      await load()
      setSelectedId(row.id)
    } catch (e) {
      toast.error(formatUserError(e instanceof Error ? e.message : String(e), t))
    } finally {
      setSaving(false)
    }
  }

  const handleSaveBook = async (): Promise<void> => {
    if (!activeStoryId) return
    try {
      await getApi().keyArt.update(activeStoryId, {
        artStyle: bookArtStyle,
        hardRules: bookHardRules,
        pageFormat: bookPageFormat
      })
      toast.success(t('keyArt.savedBook'))
    } catch (e) {
      toast.error(formatUserError(e instanceof Error ? e.message : String(e), t))
    }
  }

  const handleDelete = async (): Promise<void> => {
    if (!selected) return
    const ok = await dialog.confirm({
      title: t('keyArt.deleteShot'),
      message: t('keyArt.confirmDelete', { n: selected.order + 1 }),
      confirmLabel: t('keyArt.deleteShot')
    })
    if (!ok) return
    await getApi().keyArt.deleteShot(selected.id)
    toast.success(t('keyArt.deleted'))
    setSelectedId(null)
    await load()
  }

  const handleGenerate = async (): Promise<void> => {
    if (!selected || !activeStoryId) return
    await persistShot(selected.id, {
      shotType,
      makeMethod: method,
      pageFormat,
      artStyle: shotArtStyle || null,
      brief,
      characterIds,
      sceneId: sceneId || null,
      timelineEntryId: timelineEntryId || null,
      comicPageId: comicPageId || null
    })
    const own = selected.imagePath?.trim() || ''
    const allowOwn = method === 'edit' && Boolean(own)
    startMediaGen({
      kind: 'key-art',
      storyId: activeStoryId,
      pageId: selected.id,
      shotType,
      keyArtMakeMethod: method,
      pageFormat,
      artStyle: shotArtStyle || bookArtStyle,
      preferIdentityEdit: allowOwn && lastStillFormat.current === pageFormat,
      aspectRatio: aspectForComicFormat(pageFormat),
      galleryIdentityPaths: allowOwn ? [own] : []
    })
  }

  const handleSetPrimary = async (image: KeyArtShotImage): Promise<void> => {
    if (!selected) return
    await getApi().keyArt.setShotImagePrimary(selected.id, image.id)
    toast.success(t('keyArt.saved'))
    await load()
  }

  const handleDeleteImage = async (
    image: KeyArtShotImage,
    versionN: number
  ): Promise<void> => {
    if (!selected) return
    const ok = await dialog.confirm({
      title: t('keyArt.deleteVersion'),
      message: t('keyArt.confirmDeleteVersion', { n: versionN }),
      confirmLabel: t('keyArt.deleteVersion')
    })
    if (!ok) return
    await getApi().keyArt.deleteShotImage(selected.id, image.id)
    toast.success(t('keyArt.deletedVersion'))
    await load()
  }

  const handleSetCover = async (): Promise<void> => {
    if (!selected) return
    if (!selected.imagePath) {
      toast.error(t('keyArt.needImage'))
      return
    }
    await getApi().keyArt.setAsStoryCover(selected.id)
    toast.success(t('keyArt.setAsCoverOk'))
  }

  const chooseTab = (id: StudioTab): void => {
    userChoseTab.current = true
    setTab(id)
  }

  if (!stories.length) {
    return (
      <div className={pageRootClass}>
        <PageHeader title={t('keyArt.title')} subtitle={t('keyArt.subtitle')} />
        <EmptyState message={t('keyArt.noStories')} />
        <Button onClick={() => navigate('/')}>{t('keyArt.goStories')}</Button>
      </div>
    )
  }

  return (
    <div className={pageRootClass}>
      <header className="flex shrink-0 flex-col gap-2 border-b border-ink-800 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <PageHeader title={t('keyArt.title')} subtitle={t('keyArt.subtitle')} />
        <div className="flex flex-wrap items-center gap-2">
          <Select
            aria-label={t('keyArt.story')}
            className="!w-[12rem]"
            value={activeStoryId || ''}
            onChange={(e) => setActiveStoryId(e.target.value || null)}
          >
            {stories.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </Select>
          <Button onClick={() => void handleAdd()}>{t('keyArt.addShot')}</Button>
        </div>
      </header>
      {loadError ? (
        <p className="px-6 py-2 text-sm text-rose-300">{loadError}</p>
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="min-h-0 shrink-0 overflow-y-auto border-b border-ink-800 px-3 py-3 lg:w-64 lg:border-b-0 lg:border-r">
          <button
            type="button"
            aria-expanded={bookOpen}
            className="mb-3 flex w-full items-center justify-between rounded-lg border border-ink-800 bg-ink-900/70 px-3 py-2 text-left text-xs font-medium text-ink-200"
            onClick={() => setBookOpen((v) => !v)}
          >
            {t('keyArt.bookSettings')}
            <span className="text-ink-500">{bookOpen ? '▴' : '▾'}</span>
          </button>
          {bookOpen ? (
            <div className="mb-3 space-y-2">
              <label className="block text-[11px] text-ink-400">
                {t('keyArt.bookStyle')}
                <Select
                  className="mt-1"
                  value={bookArtStyle}
                  onChange={(e) =>
                    setBookArtStyle(getArtStyle(e.target.value).id)
                  }
                >
                  {Object.values(artGroups)
                    .flat()
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {t(`characters.${s.labelKey}`)}
                      </option>
                    ))}
                </Select>
              </label>
              <p className="text-[11px] text-ink-400">
                {t('keyArt.formatBookDefault')}
              </p>
              <div className="flex gap-1">
                {COMIC_PAGE_FORMATS.map((id) => (
                  <button
                    key={id}
                    type="button"
                    className={[
                      'rounded-md border px-2 py-1 text-[10px]',
                      bookPageFormat === id
                        ? 'border-brand-500 text-brand-100'
                        : 'border-ink-700 text-ink-400'
                    ].join(' ')}
                    onClick={() => setBookPageFormat(id)}
                  >
                    {t(`keyArt.${comicFormatLabelKey(id)}`)}
                  </button>
                ))}
              </div>
              <label className="block text-[11px] text-ink-400">
                {t('keyArt.hardRules')}
                <Textarea
                  className="mt-1"
                  rows={3}
                  value={bookHardRules}
                  placeholder={t('keyArt.hardRulesPh')}
                  onChange={(e) => setBookHardRules(e.target.value)}
                />
              </label>
              <Button variant="secondary" onClick={() => void handleSaveBook()}>
                {t('keyArt.saved')}
              </Button>
            </div>
          ) : null}
          <div className="space-y-2">
            {shots.length === 0 ? (
              <EmptyState message={t('keyArt.empty')} />
            ) : (
              shots.map((p) => {
                const n = parseKeyArtShotImages(p.imageGalleryJson, {
                  imagePath: p.imagePath
                }).length
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={[
                      'flex w-full items-center gap-2 rounded-xl border p-2 text-left',
                      p.id === selectedId
                        ? 'border-brand-500 bg-brand-950/50'
                        : 'border-ink-800 bg-ink-900/40'
                    ].join(' ')}
                    onClick={() => setSelectedId(p.id)}
                  >
                    <div className="relative h-12 w-10 shrink-0 overflow-hidden rounded bg-ink-950">
                      {p.imagePath ? (
                        <LocalMediaImage
                          filePath={p.imagePath}
                          alt=""
                          className="h-full w-full object-cover"
                          showActions={false}
                        />
                      ) : (
                        <span className="flex h-full items-center justify-center text-[10px] text-ink-500">
                          {p.order + 1}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-ink-100">
                        {t('keyArt.shotN', { n: p.order + 1 })}
                      </div>
                      <div className="truncate text-[11px] text-ink-500">
                        {t(`keyArt.${getKeyArtShotType(p.shotType).labelKey}`)}
                        {n
                          ? ` · ${n === 1 ? t('keyArt.hasImage') : t('keyArt.hasImages', { n })}`
                          : ''}
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </aside>
        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          {!selected ? (
            <div className="p-6">
              <EmptyState message={t('keyArt.empty')} />
            </div>
          ) : (
            <>
              <div className="shrink-0 border-b border-ink-800 px-3 pt-3 sm:px-6">
                <h2 className="text-sm font-semibold text-ink-100">
                  {t('keyArt.shotN', { n: selected.order + 1 })}
                </h2>
                <div
                  className="mt-2 flex gap-1"
                  role="tablist"
                  aria-label={t('keyArt.title')}
                >
                  {(
                    [
                      ['type', 'keyArt.tabType'],
                      ['materials', 'keyArt.tabMaterials'],
                      ['image', 'keyArt.tabImage']
                    ] as const
                  ).map(([id, key]) => (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      id={`keyart-tab-${id}`}
                      aria-selected={tab === id}
                      className={[
                        'rounded-t-lg px-3 py-1.5 text-xs font-medium',
                        tab === id
                          ? 'bg-ink-800 text-ink-50'
                          : 'text-ink-400 hover:text-ink-200'
                      ].join(' ')}
                      onClick={() => chooseTab(id)}
                    >
                      {t(key)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6">
                {tab === 'type' ? (
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs font-medium text-ink-400">
                        {t('keyArt.formatHeading')}
                      </p>
                      <div
                        className="mt-2 flex flex-wrap gap-2"
                        role="radiogroup"
                        aria-label={t('keyArt.formatHeading')}
                      >
                        {COMIC_PAGE_FORMATS.map((id) => (
                          <button
                            key={id}
                            type="button"
                            role="radio"
                            aria-checked={pageFormat === id}
                            className={[
                              'rounded-lg border px-3 py-1.5 text-xs',
                              pageFormat === id
                                ? 'border-brand-500 bg-brand-950/40 text-brand-100'
                                : 'border-ink-700 text-ink-300'
                            ].join(' ')}
                            onClick={() => {
                              setPageFormat(id)
                              void persistShot(selected.id, { pageFormat: id })
                            }}
                          >
                            {t(`keyArt.${comicFormatLabelKey(id)}`)}
                          </button>
                        ))}
                      </div>
                      {pageFormat !== typeDef.sizeClass ? (
                        <p className="mt-1.5 flex h-5 items-center text-[11px] text-ink-500">
                          {t('keyArt.formatBetterFor', {
                            format: t(
                              `keyArt.${comicFormatLabelKey(typeDef.sizeClass)}`
                            )
                          })}
                          <button
                            type="button"
                            className="ml-2 text-brand-200"
                            onClick={() => {
                              setPageFormat(typeDef.sizeClass)
                              void persistShot(selected.id, {
                                pageFormat: typeDef.sizeClass
                              })
                            }}
                          >
                            {t('keyArt.formatFollowsTemplate')}
                          </button>
                        </p>
                      ) : (
                        <p className="mt-1.5 flex h-5 items-center text-[11px] text-ink-500">
                          {t('keyArt.formatFollowsTemplate')}
                        </p>
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                      {KEY_ART_SHOT_TYPES.map((tp) => (
                        <button
                          key={tp.id}
                          type="button"
                          className={[
                            'rounded-xl border p-3 text-left text-xs',
                            shotType === tp.id
                              ? 'border-brand-500 bg-brand-950/40'
                              : 'border-ink-800 bg-ink-900/40'
                          ].join(' ')}
                          onClick={() => pickType(tp.id)}
                        >
                          <div className="font-medium text-ink-100">
                            {t(`keyArt.${tp.labelKey}`)}
                          </div>
                          <div className="mt-1 text-[11px] text-ink-500">
                            {t(`keyArt.${tp.hintKey}`)}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                {tab === 'materials' ? (
                  <div className="max-w-xl space-y-3">
                    <label className="block text-xs text-ink-400">
                      {t('keyArt.brief')}
                      <Textarea
                        className="mt-1"
                        rows={3}
                        value={brief}
                        placeholder={t('keyArt.briefPh')}
                        onChange={(e) => setBrief(e.target.value)}
                        onBlur={() =>
                          void persistShot(selected.id, { brief })
                        }
                      />
                    </label>
                    <label className="block text-xs text-ink-400">
                      {t('keyArt.shotStyle')}
                      <Select
                        className="mt-1"
                        value={shotArtStyle}
                        onChange={(e) => {
                          const next = e.target.value
                          setShotArtStyle(next)
                          void persistShot(selected.id, {
                            artStyle: next || null
                          })
                        }}
                      >
                        <option value="">{t('keyArt.shotStyleBook')}</option>
                        {Object.values(artGroups)
                          .flat()
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              {t(`characters.${s.labelKey}`)}
                            </option>
                          ))}
                      </Select>
                    </label>
                    <div>
                      <p className="text-xs text-ink-400">
                        {t('keyArt.bindCharacters')}
                      </p>
                      {chars.length === 0 ? (
                        <p className="mt-1 text-[11px] text-ink-500">
                          {t('keyArt.noCharacters')}
                        </p>
                      ) : (
                        <div className="mt-1 max-h-40 space-y-1 overflow-y-auto rounded-lg border border-ink-800 p-2">
                          {chars.map((c) => {
                            const on = characterIds.includes(c.id)
                            return (
                              <label
                                key={c.id}
                                className="flex items-center gap-2 text-xs text-ink-200"
                              >
                                <input
                                  type="checkbox"
                                  checked={on}
                                  onChange={() => {
                                    const next = on
                                      ? characterIds.filter((id) => id !== c.id)
                                      : [...characterIds, c.id]
                                    setCharacterIds(next)
                                    void persistShot(selected.id, {
                                      characterIds: next
                                    })
                                  }}
                                />
                                {c.name || c.id}
                              </label>
                            )
                          })}
                        </div>
                      )}
                    </div>
                    <label className="block text-xs text-ink-400">
                      {t('keyArt.bindScene')}
                      <Select
                        className="mt-1"
                        value={sceneId}
                        onChange={(e) => {
                          setSceneId(e.target.value)
                          void persistShot(selected.id, {
                            sceneId: e.target.value || null
                          })
                        }}
                      >
                        <option value="">{t('keyArt.noScene')}</option>
                        {scenes.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name || s.id}
                          </option>
                        ))}
                      </Select>
                    </label>
                    <label className="block text-xs text-ink-400">
                      {t('keyArt.bindBeat')}
                      <Select
                        className="mt-1"
                        value={timelineEntryId}
                        onChange={(e) => {
                          setTimelineEntryId(e.target.value)
                          void persistShot(selected.id, {
                            timelineEntryId: e.target.value || null
                          })
                        }}
                      >
                        <option value="">{t('keyArt.unbind')}</option>
                        {beats.map((b, idx) => (
                          <option key={b.id} value={b.id}>
                            {t('keyArt.beatN', { n: idx + 1 })}
                            {b.dialogue ? ` — ${b.dialogue.slice(0, 24)}` : ''}
                          </option>
                        ))}
                      </Select>
                    </label>
                    {beats.length === 0 ? (
                      <p className="text-[11px] text-ink-500">{t('keyArt.noBeats')}</p>
                    ) : null}
                    <label className="block text-xs text-ink-400">
                      {t('keyArt.bindComic')}
                      <Select
                        className="mt-1"
                        value={comicPageId}
                        onChange={(e) => {
                          setComicPageId(e.target.value)
                          void persistShot(selected.id, {
                            comicPageId: e.target.value || null
                          })
                        }}
                      >
                        <option value="">{t('keyArt.unbind')}</option>
                        {comicPages.map((p) => (
                          <option key={p.id} value={p.id}>
                            {t('keyArt.pageN', { n: p.order + 1 })}
                          </option>
                        ))}
                      </Select>
                    </label>
                    {comicPages.length === 0 ? (
                      <p className="text-[11px] text-ink-500">
                        {t('keyArt.noComics')}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {tab === 'image' ? (
                  <div className="space-y-4">
                    <section>
                      <h3 className="text-sm font-semibold text-ink-100">
                        {t('keyArt.methodHeading')}
                      </h3>
                      <p className="mt-0.5 text-[11px] text-ink-500">
                        {t('keyArt.methodHint')}
                      </p>
                      <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-2">
                        {KEY_ART_MAKE_METHODS.map((m) => {
                          const disabled =
                            m.usesOwnEditBase && !selected.imagePath
                          const on = method === m.id
                          return (
                            <button
                              key={m.id}
                              type="button"
                              role="radio"
                              aria-checked={on}
                              disabled={disabled}
                              className={[
                                'rounded-xl border p-3 text-left text-xs',
                                on
                                  ? 'border-brand-500 bg-brand-950/40'
                                  : 'border-ink-800 bg-ink-900/40',
                                disabled ? 'opacity-50' : ''
                              ].join(' ')}
                              onClick={() => pickMethod(m.id)}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-ink-100">
                                  {t(`keyArt.${m.titleKey}`)}
                                </span>
                                <span className="text-[10px] text-ink-500">
                                  {t(`keyArt.${m.badgeKey}`)}
                                </span>
                              </div>
                              {on ? (
                                <p className="mt-1 text-[11px] text-brand-200">
                                  {t('keyArt.methodSelected')}
                                </p>
                              ) : null}
                              <p className="mt-2 text-[11px] text-ink-400">
                                {t(`keyArt.${m.lockKey}`)}
                              </p>
                              {on ? (
                                <>
                                  <p className="mt-1 text-[11px] text-ink-500">
                                    {t(`keyArt.${m.cameraKey}`)}
                                  </p>
                                  <p className="mt-1 text-[11px] text-ink-500">
                                    {t(`keyArt.${m.materialsKey}`)}
                                  </p>
                                </>
                              ) : null}
                            </button>
                          )
                        })}
                      </div>
                    </section>
                    {selected.imagePath ? (
                      <div className="overflow-hidden rounded-xl border border-ink-800 bg-ink-950">
                        <LocalMediaImage
                          filePath={selected.imagePath}
                          alt={t('keyArt.shotN', { n: selected.order + 1 })}
                          className="max-h-[32rem] w-full object-contain"
                          objectFit="contain"
                        />
                      </div>
                    ) : (
                      <EmptyState message={t('keyArt.emptyImage')} />
                    )}
                    <KeyArtImageLibrary
                      images={selectedImages}
                      primaryPath={selected.imagePath}
                      canGenerate
                      generateBusy={saving || loading}
                      onGenerate={() => void handleGenerate()}
                      onSetPrimary={(v) => void handleSetPrimary(v)}
                      onDelete={(v, n) => void handleDeleteImage(v, n)}
                    />
                  </div>
                ) : null}
              </div>
              <div className={stickyFooterClass}>
                <Button
                  variant="danger"
                  className="sm:mr-auto"
                  onClick={() => void handleDelete()}
                >
                  {t('keyArt.deleteShot')}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => void handleSetCover()}
                  disabled={!selected.imagePath}
                >
                  {t('keyArt.setAsCover')}
                </Button>
                <Button
                  onClick={() => void handleGenerate()}
                  disabled={saving}
                >
                  {selectedImages.length > 0
                    ? t('keyArt.newVersion')
                    : t('keyArt.generate')}
                </Button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
