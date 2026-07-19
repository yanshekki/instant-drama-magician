/**
 * Global wardrobe library — costumes are independent (0..N characters).
 * AI “dress” uses a character reference image + costume description.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  libraryBodyClass,
  libraryCardClass,
  libraryGridClass,
  libraryMediaClass
} from '../components/libraryCard'
import {
  LibraryBrowseBar,
  LibraryPageBody,
  LibraryPagination
} from '../components/LibraryBrowseBar'
import {
  LibraryFilterSelect,
  uniqueFacetValues
} from '../components/LibraryFilterSelect'
import { useLibraryBrowse } from '../hooks/useLibraryBrowse'
import {
  artStylesByGroup,
  DEFAULT_ART_STYLE,
  getArtStyle,
  isArtStyleId,
  type ArtStyleId
} from '../../domain/characterArtStyles'
import {
  appendGalleryItem,
  isGalleryCoverPath,
  parseCharacterGallery,
  primaryGalleryPath,
  removeGalleryItem,
  serializeCharacterGallery,
  type CharacterGalleryItem
} from '../../domain/characterGallery'
import { translateCharacterGalleryLabel } from '../../domain/galleryLabelI18n'
import {
  COSTUME_SWAP_POSES,
  type CostumeSwapPose
} from '../../domain/costumeSwap'
import { getAiLocale } from '../../lib/aiLocale'
import { buildVideoPrepDraftKey } from '../../domain/videoPrep'
import { getApi } from '../../lib/api'
import { parseIpcError } from '../../lib/ipc'
import type { Character } from '../../types/domain'
import { useToast } from '../context/ToastContext'
import { useDialog } from '../context/DialogContext'
import { useAiJobs } from '../context/AiJobsContext'
import { PageHeader } from '../components/PageHeader'
import { LocalMediaImage } from '../components/LocalMediaImage'
import { GalleryThumbStrip } from '../components/GalleryThumbStrip'
import { MultiIdPick } from '../components/MultiIdPick'
import {
  EditorField,
  EditorSelect,
  EditorShell,
  editorFormClass
} from '../components/EditorShell'
import { Button, EmptyState, Input, Textarea } from '../components/ui'

type CostumeEditorTab = 'profile' | 'dress'

type CostumeRow = {
  id: string
  name: string
  description: string
  artStyle?: string | null
  refImagePath?: string | null
  refGalleryJson?: string | null
  characterLinks: Array<{
    characterId: string
    dressedImagePath?: string | null
    character: {
      id: string
      name: string
      costume?: string | null
      refImagePath?: string | null
      refGalleryJson?: string | null
    }
  }>
}

export function CostumesPage(): JSX.Element {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const dialog = useDialog()
  const { startJob, isBlocked, activeJobs, startVideoPrep, hasVideoPrepDraft, continueVideoPrepDraft } = useAiJobs()
  const [items, setItems] = useState<CostumeRow[]>([])
  const [characters, setCharacters] = useState<Character[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pageBanner, setPageBanner] = useState<string | null>(null)
  const [filterCharId, setFilterCharId] = useState('')
  const [filterUnlinked, setFilterUnlinked] = useState(false)
  const [filterStyle, setFilterStyle] = useState('')
  const [filterImage, setFilterImage] = useState('') // '' | has | none
  const [filterActive, setFilterActive] = useState('') // '' | active | inactive

  const [editorOpen, setEditorOpen] = useState(false)
  const [editorTab, setEditorTab] = useState<CostumeEditorTab>('profile')
  const [editId, setEditId] = useState<string | null>(null)
  const [lookName, setLookName] = useState('')
  const [lookDesc, setLookDesc] = useState('')
  const [lookStyle, setLookStyle] = useState<ArtStyleId>(DEFAULT_ART_STYLE)
  const [lookImagePath, setLookImagePath] = useState<string | null>(null)
  const [linkedCharIds, setLinkedCharIds] = useState<string[]>([])
  const [dressCharId, setDressCharId] = useState('')
  const [dressPose, setDressPose] = useState<CostumeSwapPose>('hero_front')
  const [dressBasePath, setDressBasePath] = useState('')
  const [aiIdea, setAiIdea] = useState('')
  const [gallery, setGallery] = useState<CharacterGalleryItem[]>([])
  const [selectedGalId, setSelectedGalId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const artGroups = useMemo(() => artStylesByGroup(), [])

  const reload = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const [list, chars] = await Promise.all([
        getApi().costumes.list(
          filterUnlinked
            ? { unlinkedOnly: true }
            : filterCharId
              ? { characterId: filterCharId }
              : undefined
        ) as Promise<CostumeRow[]>,
        getApi().characters.list() as Promise<Character[]>
      ])
      setItems(list)
      setCharacters(chars)
    } catch (e) {
      setError(parseIpcError(e).message)
    } finally {
      setLoading(false)
    }
  }, [filterCharId, filterUnlinked])

  useEffect(() => {
    void reload()
  }, [reload])

  const isCostumeActive = useCallback((c: CostumeRow): boolean => {
    return c.characterLinks.some(
      (l) =>
        (l.character.costume ?? '').trim().toLowerCase() ===
        c.description.trim().toLowerCase()
    )
  }, [])

  const browse = useLibraryBrowse(
    items,
    (c) =>
      [
        c.name,
        c.description,
        c.artStyle ?? '',
        ...c.characterLinks.map((l) => l.character.name)
      ].join(' '),
    {
      extraKey: `${filterCharId}:${filterUnlinked}:${filterStyle}:${filterImage}:${filterActive}`,
      matchesExtra: (c) => {
        if (filterStyle && (c.artStyle ?? '') !== filterStyle) return false
        if (filterImage === 'has' && !c.refImagePath) return false
        if (filterImage === 'none' && c.refImagePath) return false
        if (filterActive === 'active' && !isCostumeActive(c)) return false
        if (filterActive === 'inactive' && isCostumeActive(c)) return false
        return true
      }
    }
  )
  const costumeStyleOptions = useMemo(() => {
    const vals = uniqueFacetValues(items.map((c) => c.artStyle))
    return [
      { value: '', label: t('library.filterAny') },
      ...vals.map((v) => ({
        value: v,
        label: isArtStyleId(v)
          ? t(`characters.${getArtStyle(v).labelKey}`)
          : v
      }))
    ]
  }, [items, t])
  const clearCostumeFilters = (): void => {
    browse.setQ('')
    setFilterCharId('')
    setFilterUnlinked(false)
    setFilterStyle('')
    setFilterImage('')
    setFilterActive('')
  }
  const costumeHasFilters =
    browse.hasSearch ||
    Boolean(filterCharId) ||
    filterUnlinked ||
    Boolean(filterStyle) ||
    Boolean(filterImage) ||
    Boolean(filterActive)

  const openCreate = (): void => {
    setEditId(null)
    setLookName('')
    setLookDesc('')
    setLookStyle(DEFAULT_ART_STYLE)
    setLookImagePath(null)
    setLinkedCharIds([])
    setDressCharId('')
    setDressPose('hero_front')
    setDressBasePath('')
    setGallery([])
    setSelectedGalId(null)
    setAiIdea('')
    setEditorTab('profile')
    setEditorOpen(true)
  }

  const openEdit = (c: CostumeRow): void => {
    setEditId(c.id)
    setLookName(c.name)
    setLookDesc(c.description)
    setLookStyle(
      isArtStyleId(c.artStyle) ? c.artStyle : DEFAULT_ART_STYLE
    )
    setLookImagePath(c.refImagePath ?? null)
    const g = parseCharacterGallery(c.refGalleryJson, {
      refImagePath: c.refImagePath
    })
    setGallery(g)
    setSelectedGalId(g[0]?.id ?? null)
    setLinkedCharIds(c.characterLinks.map((l) => l.characterId))
    setDressCharId(c.characterLinks[0]?.characterId ?? '')
    setDressPose('hero_front')
    setDressBasePath('')
    setAiIdea('')
    setEditorTab('profile')
    setEditorOpen(true)
  }

  const dressCharBaseOptions = useMemo(() => {
    const c = characters.find((x) => x.id === dressCharId)
    if (!c) return [] as Array<{ path: string; label: string }>
    const g = parseCharacterGallery(
      (c as { refGalleryJson?: string | null }).refGalleryJson,
      { refImagePath: c.refImagePath }
    )
    if (g.length === 0 && c.refImagePath) {
      return [{ path: c.refImagePath, label: c.name }]
    }
    // Prefer identity sheets over old costume-swap gens (stale dress paths
    // are filtered on main; labels still help user pick a real bible sheet).
    return g.map((i) => ({
      path: i.path,
      label: translateCharacterGalleryLabel(i.label || i.path, t)
    }))
  }, [characters, dressCharId, t])

  // Default base pick to auto when character changes or selected path vanished from list.
  useEffect(() => {
    if (!dressBasePath) return
    if (!dressCharBaseOptions.some((o) => o.path === dressBasePath)) {
      setDressBasePath('')
    }
  }, [dressCharBaseOptions, dressBasePath])

  const closeEditor = (): void => {
    setEditorOpen(false)
    setEditId(null)
  }

  const handleAiFill = (): void => {
    if (!aiIdea.trim() && !lookDesc.trim() && !lookName.trim()) {
      toast.info(t('costumes.aiNeedIdea'))
      return
    }
    if (
      isBlocked({
        kind: ['costume-ai-fill', 'costume-intro-video', 'costume-swap'],
        costumeId: editId ?? undefined
      }) ||
      busy
    ) {
      toast.info(t('aiJobs.running'))
      return
    }
    setPageBanner(t('aiJobs.startedBackground'))
    toast.info(t('aiJobs.startedBackground'))
    const idea = aiIdea.trim()
    const snapshot = {
      name: lookName,
      description: lookDesc,
      artStyle: lookStyle
    }
    const costumeId = editId
    startJob({
      kind: 'costume-ai-fill',
      label: t('costumes.aiFill'),
      scope: { costumeId: costumeId ?? undefined },
      run: async ({ setProgress, signal }) => {
        setProgress(20, 'llm')
        const r = await getApi().costumes.aiFill({
          idea: idea || undefined,
          locale: getAiLocale(i18n.language),
          existingDraft: {
            name: snapshot.name,
            description: snapshot.description,
            artStyle: snapshot.artStyle
          }
        })
        if (signal.cancelled) return
        setProgress(100, 'done')
        // Apply into open editor (same costume / new draft)
        if (!costumeId || editId === costumeId) {
          if (r.name) setLookName(r.name)
          if (r.description) setLookDesc(r.description)
          if (r.artStyle && isArtStyleId(r.artStyle)) setLookStyle(r.artStyle)
        }
        setPageBanner(t('costumes.aiFillOk'))
        toast.success(t('costumes.aiFillOk'))
        return undefined
      }
    })
  }

  const handleSave = async (): Promise<void> => {
    if (!lookDesc.trim()) return
    setBusy(true)
    setError(null)
    try {
      const galJson = serializeCharacterGallery(gallery)
      if (editId) {
        await getApi().costumes.update(editId, {
          name: lookName.trim() || lookDesc.trim().slice(0, 32),
          description: lookDesc.trim(),
          artStyle: lookStyle,
          refImagePath: lookImagePath,
          refGalleryJson: galJson,
          characterIds: linkedCharIds
        })
      } else {
        await getApi().costumes.create({
          name: lookName.trim() || lookDesc.trim().slice(0, 32),
          description: lookDesc.trim(),
          artStyle: lookStyle,
          refImagePath: lookImagePath,
          refGalleryJson: galJson,
          characterIds: linkedCharIds
        })
      }
      await reload()
      toast.success(t('common.saved'))
      closeEditor()
    } catch (e) {
      const msg = parseIpcError(e).message
      setError(msg)
      toast.error(msg)
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (c: CostumeRow): Promise<void> => {
    // Block if any linked character has this as active costume text
    const activeOn = c.characterLinks.filter(
      (l) =>
        (l.character.costume ?? '').trim().toLowerCase() ===
        c.description.trim().toLowerCase()
    )
    if (activeOn.length > 0) {
      toast.info(
        t('costumes.cannotDeleteActive', {
          names: activeOn.map((a) => a.character.name).join(', ')
        })
      )
      return
    }
    const ok = await dialog.confirm({
      message: t('common.confirmDelete'),
      variant: 'danger',
      confirmLabel: t('common.delete')
    })
    if (!ok) return
    try {
      await getApi().costumes.delete(c.id)
      await reload()
      toast.success(t('common.deleted'))
    } catch (e) {
      toast.error(parseIpcError(e).message)
    }
  }

  const handlePickImage = async (): Promise<void> => {
    const r = await getApi().media.pickRefImage()
    if (!r?.filePath) return
    setLookImagePath(r.filePath)
    const next = appendGalleryItem(gallery, {
      path: r.filePath,
      kind: 'upload',
      label: t('characters.externalRefLabel')
    })
    setGallery(next)
    setSelectedGalId(next[next.length - 1]?.id ?? null)
    toast.success(t('characters.externalRefAdded'))
  }

  const handleSetCover = (path: string): void => {
    setLookImagePath(path)
    const hit = gallery.find((g) => g.path === path)
    if (hit) setSelectedGalId(hit.id)
    toast.success(t('common.coverSet'))
  }

  const handleRemoveImage = (id: string): void => {
    const removed = gallery.find((g) => g.id === id)
    const next = removeGalleryItem(gallery, id)
    setGallery(next)
    if (removed && lookImagePath === removed.path) {
      const primary = primaryGalleryPath(next)
      setLookImagePath(primary)
      setSelectedGalId(next.find((g) => g.path === primary)?.id ?? next[0]?.id ?? null)
    } else if (!isGalleryCoverPath(next, lookImagePath)) {
      const primary = primaryGalleryPath(next)
      setLookImagePath(primary)
      setSelectedGalId(next[0]?.id ?? null)
    }
  }

  const costumeBusy = (costumeId?: string | null): boolean =>
    isBlocked({
      kind: ['costume-ai-fill', 'costume-intro-video', 'costume-swap'],
      costumeId: costumeId ?? undefined
    }) ||
    activeJobs.some(
      (j) =>
        (j.kind === 'costume-ai-fill' ||
          j.kind === 'costume-intro-video' ||
          j.kind === 'costume-swap') &&
        (!costumeId || j.scope.costumeId === costumeId)
    )

  const selectedGalItem = useMemo(() => {
    if (!gallery.length) return null
    return (
      gallery.find((g) => g.id === selectedGalId) ??
      gallery.find((g) => g.path === lookImagePath) ??
      gallery[0] ??
      null
    )
  }, [gallery, selectedGalId, lookImagePath])

  /** Animate the selected still into a costume look intro video. */
  const handleGenerateIntroVideo = (sourceImagePath: string): void => {
    if (!editId) {
      toast.info(t('costumes.saveFirstForDress'))
      return
    }
    if (!sourceImagePath?.trim()) {
      toast.error(t('costumes.introVideoNeedImage'))
      return
    }
    if (costumeBusy(editId) || busy) return
    const costumeId = editId
    const sourcePath = sourceImagePath.trim()
    const draftKey = buildVideoPrepDraftKey(
      'costume-intro',
      { costumeId },
      sourcePath
    )
    if (hasVideoPrepDraft(draftKey)) {
      continueVideoPrepDraft(draftKey)
      return
    }
    void (async () => {
      try {
        await getApi().costumes.update(costumeId, {
          name: lookName.trim() || lookDesc.trim().slice(0, 32),
          description: lookDesc.trim() || lookName.trim(),
          artStyle: lookStyle,
          refImagePath: lookImagePath,
          refGalleryJson: serializeCharacterGallery(gallery)
        })
      } catch (e) {
        toast.error(parseIpcError(e).message)
        return
      }
      startVideoPrep({
        kind: 'costume-intro',
        entityIds: { costumeId },
        sourceImagePath: sourcePath,
        durationSeconds: 10,
        locale: getAiLocale(i18n.language)
      })
    })()
  }

  // After video confirm, reload gallery introVideoPath
  useEffect(() => {
    const onDone = (ev: Event): void => {
      const d = (ev as CustomEvent).detail as {
        kind?: string
        entityIds?: { costumeId?: string }
        gallery?: Array<{
          id: string
          path: string
          kind: string
          label: string
          createdAt: string
          layer?: string
          introVideoPath?: string | null
        }>
      }
      if (d?.kind !== 'costume-intro') return
      if (!editId || d.entityIds?.costumeId !== editId) return
      if (d.gallery?.length) {
        setGallery(
          d.gallery.map((item) => ({
            id: item.id,
            path: item.path,
            kind: (item.kind === 'sheet' ||
            item.kind === 'upload' ||
            item.kind === 'gen'
              ? item.kind
              : 'gen') as 'sheet' | 'upload' | 'gen',
            label: item.label,
            createdAt: item.createdAt,
            ...(item.layer ? { layer: item.layer } : {}),
            introVideoPath: item.introVideoPath ?? null
          }))
        )
      } else {
        void reload()
      }
    }
    window.addEventListener('idm:video-prep-done', onDone)
    return () => window.removeEventListener('idm:video-prep-done', onDone)
  }, [editId, reload])

  const handleGenerateDressed = (): void => {
    if (!editId) {
      toast.info(t('costumes.saveFirstForDress'))
      return
    }
    if (!dressCharId) {
      toast.info(t('costumes.pickCharacterForDress'))
      return
    }
    // UI pre-check: character must have at least one gallery still (paths may still be stale on disk).
    if (dressCharBaseOptions.length === 0) {
      toast.error(t('errors.costumeNoBaseImage'))
      setPageBanner(t('errors.costumeNoBaseImage'))
      return
    }
    if (isBlocked({ kind: ['costume-swap'], characterId: dressCharId })) {
      toast.info(t('aiJobs.running'))
      return
    }
    const costumeId = editId
    const characterId = dressCharId
    const base = dressBasePath || null
    const pose = dressPose
    setPageBanner(t('aiJobs.startedBackground'))
    toast.info(t('aiJobs.startedBackground'))
    startJob({
      kind: 'costume-swap',
      label: t('costumes.generateDressed'),
      scope: { characterId, costumeId, storyId: undefined },
      run: async ({ setProgress, signal }) => {
        setProgress(20, 'image')
        const r = await getApi().costumes.generateDressed({
          costumeId,
          characterId,
          baseImagePath: base,
          pose
        })
        if (signal.cancelled) return
        setProgress(100, 'done')
        // Already committed on main (costume + character galleries).
        // Do NOT return a character-sheet draft — acceptDraft would
        // promoteTmp and delete the permanent file, breaking costume paths.
        const cos = r.costume as {
          refImagePath?: string | null
          refGalleryJson?: string | null
        } | null
        const nextGal = parseCharacterGallery(cos?.refGalleryJson, {
          refImagePath: cos?.refImagePath ?? r.path
        })
        if (editId === costumeId) {
          setLookImagePath(r.path)
          setGallery(nextGal.length > 0 ? nextGal : gallery)
          setSelectedGalId(
            nextGal.find((g) => g.path === r.path)?.id ??
              nextGal[0]?.id ??
              null
          )
        }
        await reload()
        toast.success(t('costumes.dressedOk'))
        return undefined
      }
    })
  }

  const charOptions = useMemo(
    () => characters.map((c) => ({ id: c.id, label: c.name })),
    [characters]
  )

  return (
    <div className="flex h-full flex-col overflow-hidden bg-gradient-to-b from-ink-950 via-ink-950 to-ink-900">
      <PageHeader
        title={t('costumes.title')}
        subtitle={t('costumes.subtitleGlobal')}
        actions={<Button onClick={openCreate}>{t('costumes.new')}</Button>}
      />
      {!editorOpen && (
      <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
        <LibraryPageBody
          footer={
            !loading && browse.totalCount > 0 ? (
              <LibraryPagination
                page={browse.page}
                totalPages={browse.totalPages}
                onPageChange={browse.setPage}
                filteredCount={browse.filteredCount}
                totalCount={browse.totalCount}
              />
            ) : undefined
          }
        >
          {error && (
            <div className="mb-4 rounded-xl border border-rose-900/50 bg-rose-950/40 px-4 py-3 text-sm text-rose-100">
              {error}
            </div>
          )}
          {pageBanner && (
            <div className="mb-4 rounded-xl border border-brand-800/40 bg-brand-950/50 px-4 py-3 text-sm text-brand-100">
              {pageBanner}
              <button
                type="button"
                className="ml-3 text-xs underline"
                onClick={() => setPageBanner(null)}
              >
                {t('aiJobs.dismiss')}
              </button>
            </div>
          )}

          <LibraryBrowseBar
            q={browse.q}
            onQueryChange={browse.setQ}
            placeholder={t('costumes.search')}
            hasActiveFilters={costumeHasFilters}
            onClearFilters={clearCostumeFilters}
            filters={
              <>
                <LibraryFilterSelect
                  label={t('costumes.linkedCharacters')}
                  ariaLabel={t('costumes.linkedCharacters')}
                  value={filterUnlinked ? '__unlinked__' : filterCharId}
                  onChange={(v) => {
                    if (v === '__unlinked__') {
                      setFilterUnlinked(true)
                      setFilterCharId('')
                    } else {
                      setFilterUnlinked(false)
                      setFilterCharId(v)
                    }
                  }}
                  options={[
                    { value: '', label: t('library.filterAny') },
                    {
                      value: '__unlinked__',
                      label: t('costumes.filterUnlinked')
                    },
                    ...characters.map((c) => ({
                      value: c.id,
                      label: c.name
                    }))
                  ]}
                />
                <LibraryFilterSelect
                  label={t('library.filterArtStyle')}
                  ariaLabel={t('library.filterArtStyle')}
                  value={filterStyle}
                  onChange={setFilterStyle}
                  options={costumeStyleOptions}
                />
                <LibraryFilterSelect
                  label={t('library.filterImage')}
                  ariaLabel={t('library.filterImage')}
                  value={filterImage}
                  onChange={setFilterImage}
                  options={[
                    { value: '', label: t('library.filterAny') },
                    { value: 'has', label: t('library.filterHasImage') },
                    { value: 'none', label: t('library.filterNoImage') }
                  ]}
                />
                <LibraryFilterSelect
                  label={t('library.filterActive')}
                  ariaLabel={t('library.filterActive')}
                  value={filterActive}
                  onChange={setFilterActive}
                  options={[
                    { value: '', label: t('library.filterAny') },
                    {
                      value: 'active',
                      label: t('library.filterActiveOnly')
                    },
                    {
                      value: 'inactive',
                      label: t('library.filterInactiveOnly')
                    }
                  ]}
                />
              </>
            }
          />

          {loading ? (
            <p className="text-sm text-ink-400">{t('common.loading')}</p>
          ) : browse.totalCount === 0 ? (
            <div className="mx-auto max-w-md py-16 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-ink-800 text-2xl">
                👔
              </div>
              <p className="text-ink-300">{t('costumes.emptyGlobal')}</p>
              <div className="mt-6 flex justify-center">
                <Button onClick={openCreate}>{t('costumes.new')}</Button>
              </div>
            </div>
          ) : browse.filteredCount === 0 ? (
            <EmptyState message={t('library.noMatch')} />
          ) : (
            <div className={libraryGridClass}>
              {browse.pageItems.map((c) => {
                const activeNames = c.characterLinks
                  .filter(
                    (l) =>
                      (l.character.costume ?? '').trim().toLowerCase() ===
                      c.description.trim().toLowerCase()
                  )
                  .map((l) => l.character.name)
                const isActiveAnywhere = activeNames.length > 0
                return (
                  <article key={c.id} className={libraryCardClass}>
                    <div className={libraryMediaClass}>
                      {c.refImagePath ? (
                        <LocalMediaImage
                          filePath={c.refImagePath}
                          alt={c.name}
                          maxHeightClass="h-full max-h-none"
                          objectFit="cover"
                          className="h-full border-0 rounded-none"
                          actionsLayout="overlay"
                          showActions={false}
                          onImageClick={() => openEdit(c)}
                        />
                      ) : (
                        <button
                          type="button"
                          className="flex h-full w-full flex-col items-center justify-center gap-1 text-ink-600"
                          onClick={() => openEdit(c)}
                        >
                          <span className="text-3xl opacity-40">👔</span>
                          <span className="text-[11px]">
                            {t('costumes.imageMissing')}
                          </span>
                        </button>
                      )}
                      {isActiveAnywhere && (
                        <span className="absolute left-2 top-2 rounded bg-brand-600/95 px-2 py-0.5 text-[10px] font-medium text-white">
                          {t('characters.costumeLibActive')}
                        </span>
                      )}
                    </div>
                    <div className={libraryBodyClass}>
                      <h2 className="truncate text-base font-semibold tracking-tight text-ink-50">
                        {c.name}
                      </h2>
                      <p className="mt-0.5 text-[11px] text-ink-500">
                        {c.characterLinks.length === 0
                          ? t('costumes.noLinkedCharacters')
                          : c.characterLinks
                              .map((l) => l.character.name)
                              .join(' · ')}
                        {c.artStyle
                          ? ` · ${t(`characters.${getArtStyle(c.artStyle).labelKey}`)}`
                          : ''}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-400">
                        {c.description}
                      </p>
                      <div className="mt-auto flex items-center gap-2 pt-4">
                        <Button
                          variant="secondary"
                          className="min-w-0 flex-1 !py-1.5 text-xs"
                          onClick={() => openEdit(c)}
                        >
                          {t('common.edit')}
                        </Button>
                        {!isActiveAnywhere ? (
                          <Button
                            variant="ghost"
                            className="min-w-0 flex-1 !py-1.5 text-xs text-rose-300"
                            onClick={() => void handleDelete(c)}
                          >
                            {t('common.delete')}
                          </Button>
                        ) : (
                          <span className="min-w-0 flex-1 text-center text-[10px] text-ink-500">
                            {t('costumes.activeNoDelete')}
                          </span>
                        )}
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </LibraryPageBody>
      </div>
      )}

      <EditorShell
        open={editorOpen}
        title={editId ? t('common.edit') : t('costumes.new')}
        subtitle={lookName || t('costumes.editorHintGlobal')}
        onClose={closeEditor}
        onSave={() => void handleSave()}
        saveDisabled={!lookDesc.trim()}
        saveLabel={busy ? t('common.loading') : t('common.save')}
        cancelLabel={t('common.cancel')}
        busy={busy}
        tabs={[
          { id: 'profile', label: t('costumes.tabProfile') },
          { id: 'dress', label: t('costumes.tabDress') }
        ]}
        activeTab={editorTab}
        onTabChange={(id) => setEditorTab(id as CostumeEditorTab)}
        preview={
          <div className="flex h-full flex-col gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-400">
              {t('costumes.galleryTitle')}
            </h3>
            <div className="rounded-xl border border-ink-800 bg-ink-950/40">
              {(selectedGalItem?.path ?? lookImagePath) ? (
                <LocalMediaImage
                  filePath={selectedGalItem?.path ?? lookImagePath}
                  alt={lookName}
                  maxHeightClass="max-h-[min(36vh,320px)]"
                  objectFit="cover"
                  className="border-0 rounded-xl"
                  actionsLayout="bar"
                  introVideoBusy={busy || costumeBusy(editId)}
                  introVideoPath={selectedGalItem?.introVideoPath}
                  introVideoHasDraft={
                    Boolean(editId) &&
                    Boolean(selectedGalItem?.path ?? lookImagePath) &&
                    hasVideoPrepDraft(
                      buildVideoPrepDraftKey(
                        'costume-intro',
                        { costumeId: editId! },
                        selectedGalItem?.path ?? lookImagePath
                      )
                    )
                  }
                  onIntroVideo={
                    editId && (selectedGalItem?.path ?? lookImagePath)
                      ? () =>
                          handleGenerateIntroVideo(
                            (selectedGalItem?.path ?? lookImagePath)!
                          )
                      : undefined
                  }
                />
              ) : (
                <div className="flex h-40 flex-col items-center justify-center gap-2 text-xs text-ink-600">
                  <span className="text-2xl opacity-40">👔</span>
                  <p>{t('costumes.imageMissing')}</p>
                  <Button
                    variant="secondary"
                    className="!text-xs"
                    onClick={() => void handlePickImage()}
                  >
                    {t('scenes.pickImage')}
                  </Button>
                </div>
              )}
            </div>
            {gallery.length > 0 ? (
              <GalleryThumbStrip
                items={gallery}
                selectedId={selectedGalId}
                coverPath={lookImagePath}
                onSelect={(id) => setSelectedGalId(id)}
                onReorder={(fromId, toId) => {
                  const from = gallery.findIndex((g) => g.id === fromId)
                  const to = gallery.findIndex((g) => g.id === toId)
                  if (from < 0 || to < 0) return
                  const next = [...gallery]
                  const [item] = next.splice(from, 1)
                  next.splice(to, 0, item)
                  setGallery(next)
                }}
                labelOf={(g) => translateCharacterGalleryLabel(g.label, t)}
              />
            ) : null}
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button
                variant="secondary"
                className="sm:flex-1"
                disabled={busy || costumeBusy(editId)}
                onClick={() => void handlePickImage()}
              >
                {t('scenes.pickImage')}
              </Button>
              {selectedGalItem && lookImagePath !== selectedGalItem.path && (
                <Button
                  variant="secondary"
                  onClick={() => handleSetCover(selectedGalItem.path)}
                >
                  {t('common.setAsCover')}
                </Button>
              )}
              {selectedGalItem && lookImagePath === selectedGalItem.path && (
                <span className="inline-flex items-center rounded-lg border border-amber-700/50 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
                  {t('common.isCover')}
                </span>
              )}
              {selectedGalItem && (
                <Button
                  variant="ghost"
                  className="text-rose-300"
                  onClick={() => handleRemoveImage(selectedGalItem.id)}
                >
                  {t('characters.removePhoto')}
                </Button>
              )}
            </div>
            <p className="text-[11px] text-ink-500">{t('common.galleryReorderHint')}</p>
          </div>
        }
      >
        {pageBanner && (
          <div className="mb-4 rounded-xl border border-brand-800/40 bg-brand-950/50 px-4 py-3 text-sm text-brand-100">
            {pageBanner}
            <button
              type="button"
              className="ml-3 text-xs underline"
              onClick={() => setPageBanner(null)}
            >
              {t('aiJobs.dismiss')}
            </button>
          </div>
        )}
        {editorTab === 'profile' && (
          <div className={editorFormClass}>
            <section className="rounded-xl border border-brand-800/35 bg-brand-950/20 p-4">
              <h3 className="text-sm font-semibold text-brand-100">
                {t('costumes.aiTitle')}
              </h3>
              <p className="mt-1 text-[11px] text-ink-500">
                {t('costumes.aiHint')}
              </p>
              <Textarea
                className="mt-2"
                size="md"
                value={aiIdea}
                onChange={(e) => setAiIdea(e.target.value)}
                placeholder={t('costumes.aiIdeaPlaceholder')}
              />
              <div className="mt-3">
                <Button
                  disabled={busy || costumeBusy(editId)}
                  onClick={() => handleAiFill()}
                >
                  {costumeBusy(editId)
                    ? t('common.generating')
                    : t('costumes.aiFill')}
                </Button>
              </div>
            </section>
            <EditorField label={t('costumes.linkedCharacters')}>
              <MultiIdPick
                options={charOptions}
                value={linkedCharIds}
                onChange={setLinkedCharIds}
                max={50}
                emptyLabel={t('costumes.noLinkedCharacters')}
              />
              <p className="mt-1 text-[10px] text-ink-500">
                {t('costumes.linkedCharactersHint')}
              </p>
            </EditorField>
            <EditorField label={t('characters.costumeLibName')}>
              <Input
                value={lookName}
                onChange={(e) => setLookName(e.target.value)}
                placeholder={t('characters.costumeLibNamePh')}
              />
            </EditorField>
            <EditorField label={t('characters.swapCostumeDesc')}>
              <Textarea
                size="lg"
                value={lookDesc}
                onChange={(e) => setLookDesc(e.target.value)}
                placeholder={t('characters.swapCostumePlaceholder')}
              />
            </EditorField>
            <EditorField label={t('characters.artStyle')}>
              <EditorSelect
                value={lookStyle}
                onChange={(e) =>
                  setLookStyle(
                    isArtStyleId(e.target.value)
                      ? e.target.value
                      : DEFAULT_ART_STYLE
                  )
                }
              >
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
              </EditorSelect>
            </EditorField>
          </div>
        )}
        {editorTab === 'dress' && (
          <div className={editorFormClass}>
            <section className="space-y-3 rounded-xl border border-brand-800/35 bg-brand-950/15 p-4">
              <div>
                <h3 className="text-sm font-semibold text-ink-100">
                  {t('costumes.generateDressed')}
                </h3>
                <p className="mt-0.5 text-[11px] text-ink-500">
                  {t('costumes.generateDressedHint')}
                </p>
              </div>
              <EditorField label={t('costumes.dressCharacter')}>
                <EditorSelect
                  value={dressCharId}
                  onChange={(e) => {
                    setDressCharId(e.target.value)
                    setDressBasePath('')
                  }}
                >
                  <option value="">{t('costumes.pickCharacterForDress')}</option>
                  {(linkedCharIds.length
                    ? characters.filter((c) => linkedCharIds.includes(c.id))
                    : characters
                  ).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </EditorSelect>
              </EditorField>
              <EditorField label={t('costumes.baseImageLabel')}>
                <EditorSelect
                  value={dressBasePath}
                  onChange={(e) => setDressBasePath(e.target.value)}
                >
                  <option value="">{t('costumes.baseImageAuto')}</option>
                  {dressCharBaseOptions.map((o) => (
                    <option key={o.path} value={o.path}>
                      {o.label}
                    </option>
                  ))}
                </EditorSelect>
              </EditorField>
              <EditorField label={t('costumes.poseLabel')}>
                <EditorSelect
                  value={dressPose}
                  onChange={(e) =>
                    setDressPose(e.target.value as CostumeSwapPose)
                  }
                >
                  {COSTUME_SWAP_POSES.map((p) => (
                    <option key={p.id} value={p.id}>
                      {t(`characters.${p.labelKey}`)}
                    </option>
                  ))}
                </EditorSelect>
              </EditorField>
              <Button
                disabled={
                  !editId ||
                  !dressCharId ||
                  !lookDesc.trim() ||
                  busy ||
                  costumeBusy(editId)
                }
                onClick={() => handleGenerateDressed()}
              >
                {costumeBusy(editId)
                  ? t('common.generating')
                  : t('costumes.generateDressed')}
              </Button>
              {!editId && (
                <p className="text-[10px] text-ink-500">
                  {t('costumes.saveFirstForDress')}
                </p>
              )}
            </section>
          </div>
        )}
      </EditorShell>
    </div>
  )
}
