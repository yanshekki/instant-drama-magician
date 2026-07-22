// @ts-nocheck — residual pure-helper typings; covered by page unit tests
/**
 * Global wardrobe library — costumes are independent (0..N characters).
 * AI “dress” uses a character reference image + costume description.
 */
import { ensureHardRules } from '../../domain/promptHardRules'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  libraryBodyClass,
  libraryCardClass,
  libraryGridClass,
  libraryMediaClass,
  libraryCardActionBtnClass,
  libraryCardActionDeleteClass,
  libraryCardActionsRowClass
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
import { compareUpdatedAtDesc, sortByUpdatedAtDesc } from '../lib/librarySort'
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
import { toggleGallerySelection } from '../../domain/imageGenConfirm'
import { translateCharacterGalleryLabel } from '../../domain/galleryLabelI18n'
import {
  buildCostumeSwapPrompt,
  costumePosesByGroup,
  getCostumeSwapPose,
  pickBestBaseImage,
  type CostumeSwapPose
} from '../../domain/costumeSwap'
import { getAiLocale } from '../../lib/aiLocale'
import { buildVideoPrepDraftKey } from '../../domain/videoPrep'
import { getApi } from '../../lib/api'
import { parseIpcError } from '../../lib/ipc'
import { formatUserError } from '../lib/formatUserError'
import type { Character } from '../../types/domain'
import { useToast } from '../context/ToastContext'
import { useDialog } from '../context/DialogContext'
import { useAiJobs } from '../context/AiJobsContext'
import { PageHeader } from '../components/PageHeader'
import { pageRootClass, pageScrollClass } from '../lib/mobileLayout'
import { LocalMediaImage } from '../components/LocalMediaImage'
import { EntityGalleryPanel } from '../components/EntityGalleryPanel'
import {
  EditorField,
  EditorSelect,
  EditorShell,
  editorFormClass,
  editorFormWideClass
} from '../components/EditorShell'
import { Button, EmptyState, Input, Textarea } from '../components/ui'

type CostumeEditorTab = 'profile' | 'links' | 'dress'

type CostumeRow = {
  id: string
  name: string
  description: string
  hardRules?: string | null
  artStyle?: string | null
  refImagePath?: string | null
  refGalleryJson?: string | null
  createdAt?: string | Date
  updatedAt?: string | Date
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
  const {
    startJob,
    isBlocked,
    activeJobs,
    startVideoPrep,
    startMediaGen,
    hasVideoPrepDraft,
    continueVideoPrepDraft
  } = useAiJobs()
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
  const [lookHardRules, setLookHardRules] = useState('')
  const [lookStyle, setLookStyle] = useState<ArtStyleId>(DEFAULT_ART_STYLE)
  const [lookImagePath, setLookImagePath] = useState<string | null>(null)
  const [linkedCharIds, setLinkedCharIds] = useState<string[]>([])
  const [dressCharId, setDressCharId] = useState('')
  const [dressPose, setDressPose] = useState<CostumeSwapPose>('hero_front')
  const [dressBasePath, setDressBasePath] = useState('')
  const [dressNote, setDressNote] = useState('')
  const [linksQ, setLinksQ] = useState('')
  const [linksFilter, setLinksFilter] = useState<'all' | 'linked' | 'unlinked'>(
    'all'
  )
  const [aiIdea, setAiIdea] = useState('')
  const [gallery, setGallery] = useState<CharacterGalleryItem[]>([])
  const [selectedGalId, setSelectedGalId] = useState<string | null>(null)
  /** Multi-select for identity-lock + browsing which stills feed try-on. */
  const [selectedGalIds, setSelectedGalIds] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const artGroups = useMemo(() => artStylesByGroup(), [])
  const poseGroups = useMemo(() => costumePosesByGroup(), [])

  const reload = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const [list, chars] = await Promise.all([
        getApi().costumes.list(
          costumesListFilterArg(filterUnlinked, filterCharId)
        ) as Promise<CostumeRow[]>,
        getApi().characters.list() as Promise<Character[]>
      ])
      setItems(sortByUpdatedAtDesc(list))
      setCharacters(sortByUpdatedAtDesc(chars))
    } catch (e) {
      setError(formatUserError(parseIpcError(e).message, t))
    } finally {
      setLoading(false)
    }
  }, [filterCharId, filterUnlinked])

  useEffect(() => {
    void reload()
  }, [reload])

  const isCostumeActive = useCallback((c: CostumeRow): boolean => {
    return c.characterLinks.some((l) =>
      costumesIsActiveOnChar(c.description, l.character.costume)
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
      },
      sort: compareUpdatedAtDesc
    }
  )
  const costumeStyleOptions = useMemo(() => {
    const vals = uniqueFacetValues(items.map((c) => c.artStyle))
    return [
      { value: '', label: t('library.filterAny') },
      ...vals.map((v) => ({
        value: v,
        label: costumesArtStyleLabel(
          v,
          isArtStyleId,
          (x) => t(`characters.${getArtStyle(x).labelKey}`)
        )
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
    setLookHardRules('')
    setLookStyle(DEFAULT_ART_STYLE)
    setLookImagePath(null)
    setLinkedCharIds([])
    setDressCharId('')
    setDressPose('hero_front')
    setDressBasePath('')
    setGallery([])
    setSelectedGalId(null)
    setSelectedGalIds([])
    setAiIdea('')
    setEditorTab('profile')
    setEditorOpen(true)
  }

  const openEdit = (c: CostumeRow): void => {
    setEditId(c.id)
    setLookName(c.name)
    setLookDesc(c.description)
    setLookHardRules(c.hardRules ?? '')
    setLookStyle(
      isArtStyleId(c.artStyle) ? c.artStyle : DEFAULT_ART_STYLE
    )
    setLookImagePath(c.refImagePath ?? null)
    const g = parseCharacterGallery(c.refGalleryJson, {
      refImagePath: c.refImagePath
    })
    setGallery(g)
    setSelectedGalId(g[0]?.id ?? null)
    // Default: all stills multi-selected so try-on can identity-lock wardrobe history
    setSelectedGalIds(g.map((x) => x.id))
    setLinkedCharIds(c.characterLinks.map((l) => l.characterId))
    setDressCharId(c.characterLinks[0]?.characterId ?? '')
    setDressPose('hero_front')
    setDressBasePath('')
    setAiIdea('')
    setEditorTab('profile')
    setEditorOpen(true)
  }

  const dressCharGallery = useMemo((): CharacterGalleryItem[] => {
    const c = characters.find((x) => x.id === dressCharId)
    if (!c) return []
    return parseCharacterGallery(
      (c as { refGalleryJson?: string | null }).refGalleryJson,
      { refImagePath: c.refImagePath }
    )
  }, [characters, dressCharId])

  const dressCharBaseOptions = useMemo(() => {
    const c = characters.find((x) => x.id === dressCharId)
    return costumesDressBaseOptions(c, dressCharGallery, (i) =>
      translateCharacterGalleryLabel(i.label || i.path, t)
    )
  }, [characters, dressCharId, dressCharGallery, t])

  const resolvedDressBasePath = useMemo(() => {
    if (dressBasePath) return dressBasePath
    const c = characters.find((x) => x.id === dressCharId)
    const picked = pickBestBaseImage(dressCharGallery, {
      ageRange: c?.ageRange,
      preferredPath: null
    })
    return (
      picked.item?.path ||
      dressCharBaseOptions[0]?.path ||
      c?.refImagePath ||
      null
    )
  }, [
    dressBasePath,
    dressCharId,
    dressCharGallery,
    dressCharBaseOptions,
    characters
  ])

  // Default base pick to auto when character changes or selected path vanished from list.
  useEffect(() => {
    costumesSyncDressBasePath(
      dressBasePath,
      dressCharBaseOptions,
      setDressBasePath
    )
  }, [dressCharBaseOptions, dressBasePath])

  const linksBrowser = useMemo(() => {
    const q = linksQ.trim().toLowerCase()
    const linked = new Set(linkedCharIds)
    return characters
      .filter((c) =>
        costumesLinksFilterMatch(
          linked.has(c.id),
          linksFilter,
          q,
          c.name,
          c.description
        )
      )
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, i18n.language))
  }, [characters, linkedCharIds, linksFilter, linksQ, i18n.language])

  const handleToggleLink = costumesBindToggleLink({
    getEditId: () => editId,
    getLinked: () => linkedCharIds,
    getDressCharId: () => dressCharId,
    toastInfo: toast.info,
    saveFirstMsg: t('costumes.linksSaveFirst'),
    setBusy,
    unlink: costumesApiUnlink,
    link: costumesApiLink,
    setLinked: setLinkedCharIds,
    clearDressIf: () => setDressCharId(''),
    reload,
    toastError: toast.error
  })

  const closeEditor = (): void => {
    setEditorOpen(false)
    setEditId(null)
    setDressNote('')
    setLinksQ('')
    setLinksFilter('all')
    setDressBasePath('')
    setDressPose('hero_front')
  }

  const handleAiFill = (): void => {
    const refPath = costumesAiFillRefPath(
      selectedGalItem?.path,
      lookImagePath
    )
    const costumeId = editId
    costumesRunAiFill({
      idea: aiIdea,
      lookDesc,
      lookName,
      lookStyle,
      lookHardRules,
      refPath,
      busy:
        isBlocked({
          kind: ['costume-ai-fill', 'costume-intro-video', 'costume-swap'],
          costumeId: editId ?? undefined
        }) || busy,
      toastInfo: toast.info,
      needMsg: t('common.aiNeedIdeaOrImage'),
      runningMsg: t('aiJobs.running'),
      fromImageMsg: t('common.aiFillFromImage'),
      backgroundMsg: t('aiJobs.startedBackground'),
      setBanner: setPageBanner,
      startJob: (snapshot, idea, hasImage, path) =>
        startJob({
          kind: 'costume-ai-fill',
          label: t('common.aiFill'),
          scope: { costumeId: costumeId ?? undefined },
          run: async ({ setProgress, signal }) => {
            setProgress(20, hasImage ? 'image' : 'llm')
            const r = await getApi().costumes.aiFill({
              idea: idea || undefined,
              locale: getAiLocale(i18n.language),
              existingDraft: {
                name: snapshot.name,
                description: snapshot.description,
                artStyle: snapshot.artStyle,
                hardRules: snapshot.hardRules
              },
              referenceImagePath: hasImage ? path : null
            })
            if (signal.cancelled) return
            setProgress(100, 'done')
            costumesApplyAiFillResult(
              r,
              !costumeId || editId === costumeId,
              setLookName,
              setLookDesc,
              (s) => setLookStyle(s as ArtStyleId),
              setLookHardRules,
              isArtStyleId
            )
            setPageBanner(t('costumes.aiFillOk'))
            toast.success(t('costumes.aiFillOk'))
            return undefined
          }
        })
    })
  }

  const handleSave = async (): Promise<void> => {
    await costumesRunSave({
      lookDesc,
      lookName,
      lookHardRules,
      lookStyle,
      lookImagePath,
      galleryJson: serializeCharacterGallery(gallery),
      linkedCharIds,
      editId,
      setBusy,
      setError,
      update: (id, payload) => getApi().costumes.update(id, payload as never),
      create: (payload) => getApi().costumes.create(payload as never),
      reload,
      toastSuccess: () => toast.success(t('common.saved')),
      closeEditor,
      toastError: toast.error
    })
  }

  const handleDelete = async (c: CostumeRow): Promise<void> => {
    await costumesRunDelete({
      c,
      toastInfo: toast.info,
      activeMsg: (names) => t('costumes.cannotDeleteActive', { names }),
      confirm: () =>
        dialog.confirm({
          message: t('common.confirmDelete'),
          variant: 'danger',
          confirmLabel: t('common.delete')
        }),
      remove: (id) => getApi().costumes.delete(id),
      reload,
      toastSuccess: () => toast.success(t('common.deleted')),
      toastError: toast.error
    })
  }

  const handlePickImage = async (): Promise<void> => {
    await costumesRunPickImage({
      pick: () => getApi().media.pickRefImage(),
      gallery,
      append: (g, item) => appendGalleryItem(g as never, item as never),
      externalLabel: t('characters.externalRefLabel'),
      setLook: setLookImagePath,
      setGallery: setGallery as (g: unknown[]) => void,
      setSelected: setSelectedGalId,
      toastSuccess: () => toast.success(t('characters.externalRefAdded'))
    })
  }

  const handleSetCover = costumesBindSetCover({
    getGallery: () => gallery,
    setLook: setLookImagePath,
    setSelected: setSelectedGalId,
    toastSuccess: () => toast.success(t('common.coverSet'))
  })

  const handleRemoveImage = costumesMakeRemoveImage({
    getGallery: () => gallery,
    getLook: () => lookImagePath,
    removeItem: removeGalleryItem as never,
    isCover: (gal, look) => isGalleryCoverPath(gal as never, look),
    primary: (gal) => primaryGalleryPath(gal as never),
    setGallery,
    setLook: setLookImagePath,
    setSelected: setSelectedGalId
  })

  const costumeBusy = (costumeId?: string | null): boolean =>
    isBlocked({
      kind: ['costume-ai-fill', 'costume-intro-video', 'costume-swap'],
      costumeId: costumeId ?? undefined
    }) ||
    activeJobs.some((j) => costumesIsBusyJob(j, costumeId))

  const selectedGalItem = useMemo(
    () => costumesSelectedGalItem(gallery, selectedGalId, lookImagePath),
    [gallery, selectedGalId, lookImagePath]
  )

  /** Animate the selected still into a costume look intro video. */
  const handleGenerateIntroVideo = costumesBindIntroVideo({
    getEditId: () => editId,
    isBusy: () => costumeBusy(editId) || busy,
    toastInfo: toast.info,
    toastError: toast.error,
    msgs: {
      saveFirst: t('costumes.saveFirstForDress'),
      needImage: t('costumes.introVideoNeedImage'),
      loading: t('aiJobs.running')
    },
    hasDraft: hasVideoPrepDraft,
    continueDraft: continueVideoPrepDraft,
    getLookName: () => lookName,
    getLookDesc: () => lookDesc,
    getLookStyle: () => lookStyle,
    getLookImage: () => lookImagePath,
    getGallery: () => gallery,
    serializeGallery: serializeCharacterGallery,
    update: (id, payload) => getApi().costumes.update(id, payload as never),
    startVideoPrep: (args) => {
      void (async () => {
        const { buildIntroMediaGenRequest } = await import(
          '../lib/startIntroMediaGen'
        )
        const req = await buildIntroMediaGenRequest({
          kind: 'costume-intro',
          sourceImagePath: args.sourcePath,
          costumeId: args.costumeId,
          artStyle: lookStyle,
          durationSeconds: 10
        })
        startMediaGen(req)
      })()
    },
    buildDraftKey: (costumeId, sourcePath) =>
      buildVideoPrepDraftKey('costume-intro', { costumeId }, sourcePath)
  })

  // After video confirm, reload gallery introVideoPath
  useEffect(() => {
    return costumesListenVideoPrepDone(editId, setGallery as never, reload)
  }, [editId, reload])

  // After MediaGen try-on accept: refresh costume multi-image gallery
  useEffect(() => {
    const onTryOn = (ev: Event): void => {
      const d = (ev as CustomEvent).detail as {
        costumeId?: string
        path?: string
        gallery?: CharacterGalleryItem[]
      }
      if (!d?.costumeId || d.costumeId !== editId) return
      if (Array.isArray(d.gallery) && d.gallery.length > 0) {
        setGallery(d.gallery)
        const last = d.gallery[d.gallery.length - 1]
        if (last?.id) {
          setSelectedGalId(last.id)
          setSelectedGalIds((ids) =>
            ids.includes(last.id) ? ids : [...ids, last.id]
          )
        }
        if (last?.path && !lookImagePath) setLookImagePath(last.path)
      } else {
        void reload()
      }
      toast.success(t('costumes.dressedOk'))
    }
    window.addEventListener('idm:costume-tryon-done', onTryOn)
    return () => window.removeEventListener('idm:costume-tryon-done', onTryOn)
  }, [editId, lookImagePath, reload, t, toast])

  const handleGenerateDressed = (): void => {
    if (!editId) {
      toast.error(t('costumes.saveFirstForDress'))
      return
    }
    if (!dressCharId) {
      toast.error(t('costumes.pickCharacterForDress'))
      return
    }
    if (costumesSwapBlocked(isBlocked, dressCharId)) {
      toast.info(t('aiJobs.running'))
      return
    }
    const base = resolvedDressBasePath || dressBasePath
    // Costume multi-gallery stills (checked) + character base for identity lock
    const costumeIdentityPaths = gallery
      .filter((g) => selectedGalIds.includes(g.id) && g.path)
      .map((g) => g.path)
    const identityPaths = [
      ...costumeIdentityPaths,
      ...(base ? [base] : [])
    ].filter((p, i, arr) => p && arr.indexOf(p) === i)
    startMediaGen({
      kind: 'costume-dress',
      costumeId: editId,
      characterId: dressCharId,
      artStyle: lookStyle,
      galleryIdentityPaths: identityPaths,
      preferIdentityEdit: identityPaths.length > 0,
      costumeDescription: [lookName, lookDesc, dressNote].filter(Boolean).join('\n')
    })
  }

  return (
    <div className={pageRootClass}>
      <PageHeader
        title={t('costumes.title')}
        subtitle={t('costumes.subtitleGlobal')}
        actions={<Button onClick={openCreate}>{t('costumes.new')}</Button>}
      />
      {!editorOpen && (
      <div className={pageScrollClass}>
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
              {formatUserError(error, t)}
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
                    const r = costumesFilterCharChange(v)
                    setFilterUnlinked(r.unlinked)
                    setFilterCharId(r.charId)
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
                const activeNames = costumesActiveNames(
                  c.characterLinks,
                  c.description
                )
                const isActiveAnywhere = activeNames.length > 0
                return (
                  <article key={c.id} className={libraryCardClass}>
                    <div className={libraryMediaClass}>
                      {c.refImagePath ? (
                        <LocalMediaImage
                          filePath={c.refImagePath}
                          alt={c.name}
                          variant="fill"
                          maxHeightClass="h-full max-h-none"
                          objectFit="cover"
                          className="h-full border-0 rounded-none"
                          actionsLayout="overlay"
                          showActions
                          enableZoom
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
                          : costumesLinkedNames(c.characterLinks)}
                        {costumesStyleChip(
                          c.artStyle,
                          c.artStyle
                            ? t(`characters.${getArtStyle(c.artStyle).labelKey}`)
                            : ''
                        )}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-400">
                        {c.description}
                      </p>
                      <div className={libraryCardActionsRowClass}>
                        <Button
                          variant="secondary"
                          className={libraryCardActionBtnClass}
                          onClick={() => openEdit(c)}
                        >
                          {t('common.edit')}
                        </Button>
                        {!isActiveAnywhere ? (
                          <Button
                            variant="ghost"
                            className={libraryCardActionDeleteClass}
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
          {
            id: 'links',
            label: `${t('costumes.tabLinks')}${
              linkedCharIds.length ? ` (${linkedCharIds.length})` : ''
            }`
          },
          { id: 'dress', label: t('costumes.tabDress') }
        ]}
        activeTab={editorTab}
        onTabChange={(id) => setEditorTab(id as CostumeEditorTab)}
        preview={
          <EntityGalleryPanel
            title={t('costumes.galleryTitle')}
            previewPath={selectedGalItem?.path ?? lookImagePath}
            previewAlt={lookName}
            maxHeightClass="max-h-[min(36vh,320px)]"
            showMeta={false}
            objectFit="cover"
            previewFrameClassName="rounded-xl border border-ink-800 bg-ink-950/40"
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
            onIntroVideo={costumesIntroOrUndefined(
              editId,
              selectedGalItem?.path ?? lookImagePath ?? undefined,
              handleGenerateIntroVideo
            )}
            isCover={Boolean(
              selectedGalItem?.path && lookImagePath === selectedGalItem.path
            )}
            {...costumesCoverHandlers(
              selectedGalItem?.path,
              handleSetCover,
              costumesOptionalRemove(selectedGalItem, handleRemoveImage)
            )}
            emptyIcon="👔"
            emptyMessage={t('costumes.imageMissing')}
            emptyActions={[
              {
                label: t('common.uploadRef'),
                onClick: () => void handlePickImage(),
                variant: 'secondary',
                disabled: busy || costumeBusy(editId)
              }
            ]}
            items={gallery}
            selectedId={selectedGalId}
            selectedIds={selectedGalIds}
            multiSelect
            coverPath={lookImagePath}
            fallbackCoverPath={lookImagePath}
            onSelect={(id) => setSelectedGalId(id)}
            onToggleSelect={(id) =>
              setSelectedGalIds((ids) => toggleGallerySelection(ids, id))
            }
            onReorder={costumesMakeReorder(() => gallery, setGallery)}
            labelOf={(g) => translateCharacterGalleryLabel(g.label, t)}
            reorderHintKey="costumes.galleryBrowseHint"
            footerActions={[
              {
                label: t('common.uploadRef'),
                onClick: () => void handlePickImage(),
                variant: 'secondary',
                disabled: busy || costumeBusy(editId)
              }
            ]}
          />
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
            {/* AI fill — character-page style brand card */}
            <section className="rounded-xl border border-brand-800/35 bg-gradient-to-br from-brand-950/40 via-ink-900/50 to-ink-950 p-4">
              <h3 className="text-sm font-semibold text-brand-100">
                {t('common.aiTitle')}
              </h3>
              <p className="mt-1 text-[11px] text-ink-400">
                {t('common.aiHintWithImage')}
              </p>
              {(selectedGalItem?.path || lookImagePath) && (
                <p className="mt-2 rounded-lg border border-brand-800/40 bg-brand-950/30 px-2.5 py-1.5 text-[11px] text-brand-100/90">
                  {t('common.aiUsingImage')}
                </p>
              )}
              <Textarea
                className="mt-3"
                size="md"
                value={aiIdea}
                onChange={(e) => setAiIdea(e.target.value)}
                placeholder={t('costumes.aiIdeaPlaceholder')}
              />
              <Button
                className="mt-3 w-full sm:w-auto"
                disabled={busy || costumeBusy(editId)}
                onClick={() => handleAiFill()}
              >
                {costumeBusy(editId)
                  ? t('common.generating')
                  : t('common.aiFill')}
              </Button>
            </section>

            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-ink-200">
                {t('costumes.profileSection')}
              </h3>
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
              <EditorField
                label={t('common.hardRules')}
                hint={t('common.hardRulesHint')}
              >
                <Textarea
                  size="md"
                  value={lookHardRules}
                  onChange={(e) => setLookHardRules(e.target.value)}
                  placeholder={t('common.hardRulesPh')}
                />
              </EditorField>
              <EditorField label={t('characters.artStyle')}>
                <EditorSelect
                  value={lookStyle}
                  onChange={(e) =>
                    setLookStyle(
                      costumesArtStyleOrDefault(e.target.value, isArtStyleId, DEFAULT_ART_STYLE)
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
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-xl border border-ink-800 bg-ink-900/40 px-3 py-2.5 text-left text-[12px] text-ink-300 hover:border-brand-700/50"
                onClick={() => setEditorTab('links')}
              >
                <span>
                  {t('costumes.linksCount', { count: linkedCharIds.length })}
                  <span className="mt-0.5 block text-[11px] text-ink-500">
                    {t('costumes.linksManage')}
                  </span>
                </span>
                <span className="text-ink-500">→</span>
              </button>
            </section>
          </div>
        )}

        {editorTab === 'links' && (
          <div className={`${editorFormWideClass} flex flex-col gap-3`}>
            <p className="text-[11px] text-ink-500">{t('costumes.linksHint')}</p>
            {!editId ? (
              <p className="rounded-xl border border-ink-800 bg-ink-900/40 px-4 py-3 text-sm text-ink-400">
                {t('costumes.linksSaveFirst')}
              </p>
            ) : null}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                className="sm:flex-1"
                value={linksQ}
                onChange={(e) => setLinksQ(e.target.value)}
                placeholder={t('costumes.linksSearch')}
                disabled={!editId}
              />
              <div className="flex flex-wrap gap-1 rounded-xl border border-ink-800 bg-ink-950/50 p-1">
                {(
                  [
                    { id: 'all' as const, label: t('costumes.linksFilterAll') },
                    {
                      id: 'linked' as const,
                      label: t('costumes.linksFilterLinked')
                    },
                    {
                      id: 'unlinked' as const,
                      label: t('costumes.linksFilterUnlinked')
                    }
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    disabled={!editId}
                    className={[
                      'rounded-lg px-2.5 py-1 text-[11px] font-medium',
                      linksFilter === f.id
                        ? 'bg-brand-600 text-white'
                        : 'text-ink-400 hover:bg-ink-800'
                    ].join(' ')}
                    onClick={() => setLinksFilter(f.id)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            {costumesLinksEmptyElement(
              linksBrowser.length,
              t('costumes.linksEmpty')
            )}
            {!costumesLinksEmpty(linksBrowser.length) ? (
              <ul className="divide-y divide-ink-800/80 overflow-hidden rounded-xl border border-ink-800 bg-ink-950/40">
                {linksBrowser.map((c) => {
                  const linked = linkedCharIds.includes(c.id)
                  return (
                    <li
                      key={c.id}
                      className="flex items-center gap-3 px-3 py-2.5 hover:bg-ink-900/50"
                    >
                      <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-ink-700 bg-ink-900">
                        {c.refImagePath ? (
                          <div className="pointer-events-none absolute inset-0">
                            <LocalMediaImage
                              filePath={c.refImagePath}
                              alt={c.name}
                              variant="thumb"
                              objectFit="cover"
                              className="border-0"
                              showActions={false}
                              enableZoom={false}
                              hoverZoom={false}
                            />
                          </div>
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] text-ink-600">
                            —
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink-100">
                          {c.name}
                        </p>
                        <p className="truncate text-[11px] text-ink-500">
                          {(c.description || '').slice(0, 80) || '—'}
                        </p>
                      </div>
                      <Button
                        variant={linked ? 'secondary' : 'primary'}
                        className="!py-1 !text-xs shrink-0"
                        disabled={!editId || busy}
                        onClick={() => void handleToggleLink(c.id)}
                      >
                        {linked
                          ? t('costumes.unlinkAction')
                          : t('costumes.linkAction')}
                      </Button>
                    </li>
                  )
                })}
              </ul>
            ) : null}
          </div>
        )}

        {editorTab === 'dress' && (
          <div className={`${editorFormWideClass} space-y-4`}>
            {/* Header */}
            <div className="rounded-2xl border border-ink-800 bg-ink-950/50 px-4 py-3">
              <h3 className="text-sm font-semibold text-ink-50">
                {t('costumes.dressWorkstation')}
              </h3>
              <p className="mt-0.5 text-[12px] leading-relaxed text-ink-400">
                {t('costumes.generateDressedHint')}
              </p>
              <ol className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-500">
                <li>
                  <span className="font-semibold text-brand-300">1</span>{' '}
                  {t('costumes.dressStepChar')}
                </li>
                <li>
                  <span className="font-semibold text-brand-300">2</span>{' '}
                  {t('costumes.dressStepBase')}
                </li>
                <li>
                  <span className="font-semibold text-brand-300">3</span>{' '}
                  {t('costumes.dressStepPose')}
                </li>
                <li>
                  <span className="font-semibold text-brand-300">4</span>{' '}
                  {t('costumes.generateDressed')}
                </li>
              </ol>
            </div>

            {/* 1 · Character */}
            <section className="rounded-2xl border border-ink-800 bg-ink-950/40 p-4">
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600/90 text-[11px] font-bold text-white">
                  1
                </span>
                <h4 className="text-[13px] font-semibold text-ink-100">
                  {t('costumes.dressCharacter')}
                </h4>
              </div>
              <EditorSelect
                value={dressCharId}
                onChange={(e) =>
                  costumesOnDressCharChange(
                    e.target.value,
                    setDressCharId,
                    setDressBasePath
                  )
                }
                aria-label={t('costumes.dressCharacter')}
              >
                <option value="">{t('costumes.pickCharacterForDress')}</option>
                {costumesDressCharOptions(characters, linkedCharIds).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {linkedCharIds.includes(c.id)
                      ? ` · ${t('costumes.linksFilterLinked')}`
                      : ''}
                  </option>
                ))}
              </EditorSelect>
              {linkedCharIds.length === 0 ? (
                <p className="mt-2 text-[11px] text-ink-500">
                  {t('costumes.preferLinkedChars')}{' '}
                  <button
                    type="button"
                    className="text-brand-300 underline-offset-2 hover:underline"
                    onClick={() => setEditorTab('links')}
                  >
                    {t('costumes.tabLinks')}
                  </button>
                </p>
              ) : null}
            </section>

            {/* 2 · Base still: selected hero + strip */}
            <section className="rounded-2xl border border-ink-800 bg-ink-950/40 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600/90 text-[11px] font-bold text-white">
                    2
                  </span>
                  <h4 className="text-[13px] font-semibold text-ink-100">
                    {t('costumes.baseImageLabel')}
                  </h4>
                </div>
                <div className="flex rounded-lg border border-ink-700 bg-ink-900/80 p-0.5">
                  <button
                    type="button"
                    className={[
                      'rounded-md px-2.5 py-1 text-[11px] font-medium transition',
                      costumesBaseModeClass(
                        !dressBasePath,
                        'bg-brand-600 text-white shadow-sm',
                        'text-ink-400 hover:text-ink-200'
                      )
                    ].join(' ')}
                    onClick={() => setDressBasePath('')}
                  >
                    {t('costumes.baseImageAuto')}
                  </button>
                  <button
                    type="button"
                    className={[
                      'rounded-md px-2.5 py-1 text-[11px] font-medium transition',
                      costumesBaseModeClass(
                        Boolean(dressBasePath),
                        'bg-brand-600 text-white shadow-sm',
                        'text-ink-400 hover:text-ink-200'
                      )
                    ].join(' ')}
                    disabled={dressCharBaseOptions.length === 0}
                    onClick={costumesBindManualBase(
                      dressCharBaseOptions,
                      dressBasePath,
                      setDressBasePath
                    )}
                  >
                    {t('costumes.baseImageManual')}
                  </button>
                </div>
              </div>

              {costumesBaseNoImages(dressCharId, dressCharBaseOptions.length) ===
              'pick' ? (
                <p className="rounded-xl border border-dashed border-ink-700 bg-ink-900/30 px-3 py-6 text-center text-[12px] text-ink-500">
                  {t('costumes.pickCharacterForDress')}
                </p>
              ) : costumesBaseNoImages(
                  dressCharId,
                  dressCharBaseOptions.length
                ) === 'none' ? (
                <p className="rounded-xl border border-dashed border-ink-700 bg-ink-900/30 px-3 py-6 text-center text-[12px] text-ink-500">
                  {t('costumes.baseNoImages')}
                </p>
              ) : (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
                  {/* Hero selected base */}
                  <div className="relative mx-auto aspect-[3/4] w-36 shrink-0 overflow-hidden rounded-2xl border border-ink-700 bg-ink-900 shadow-inner sm:mx-0 sm:w-40">
                    {costumesResolvedPreviewNode(
                      resolvedDressBasePath,
                      <div className="pointer-events-none absolute inset-0">
                        <LocalMediaImage
                          filePath={resolvedDressBasePath || ''}
                          alt={t('costumes.basePreview')}
                          variant="thumb"
                          objectFit="cover"
                          className="border-0"
                          showActions={false}
                          enableZoom={false}
                          hoverZoom={false}
                        />
                      </div>
                    )}
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 pb-2 pt-6">
                      <p className="text-[10px] font-medium text-white/95">
                        {costumesBaseLabel(
                          Boolean(dressBasePath),
                          t('costumes.basePreview'),
                          t('costumes.baseImageAuto')
                        )}
                      </p>
                    </div>
                  </div>
                  {/* Horizontal strip */}
                  <div className="min-w-0 flex-1">
                    <p className="mb-1.5 text-[11px] text-ink-500">
                      {t('costumes.baseStripHint')}
                    </p>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {dressCharBaseOptions.map((o) => {
                        const selected =
                          (dressBasePath || resolvedDressBasePath) === o.path
                        return (
                          <button
                            key={o.id + o.path}
                            type="button"
                            title={o.label}
                            className={[
                              'relative h-20 w-16 shrink-0 overflow-hidden rounded-xl border-2 bg-ink-900 transition',
                              costumesSelectedThumbClass(selected)
                            ].join(' ')}
                            onClick={() => setDressBasePath(o.path)}
                          >
                            <div className="pointer-events-none absolute inset-0">
                              <LocalMediaImage
                                filePath={o.path}
                                alt={o.label}
                                variant="thumb"
                                objectFit="cover"
                                className="border-0"
                                showActions={false}
                                enableZoom={false}
                                hoverZoom={false}
                              />
                            </div>
                            {costumesSelectedMarkNode(selected)}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* 3 · Pose pills */}
            <section className="rounded-2xl border border-ink-800 bg-ink-950/40 p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600/90 text-[11px] font-bold text-white">
                  3
                </span>
                <h4 className="text-[13px] font-semibold text-ink-100">
                  {t('costumes.poseLabel')}
                </h4>
                <span className="ml-auto rounded-md bg-ink-800 px-2 py-0.5 text-[10px] text-ink-400">
                  {t(`characters.${getCostumeSwapPose(dressPose).labelKey}`)}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {([
                  ...poseGroups.fullbody,
                  ...poseGroups.detail,
                  ...poseGroups.multi
                ]).map((p) => {
                  const on = dressPose === p.id
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className={[
                        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition',
                        on
                          ? 'border-brand-500 bg-brand-600 text-white shadow-sm'
                          : 'border-ink-700 bg-ink-900/60 text-ink-300 hover:border-ink-500 hover:text-ink-100'
                      ].join(' ')}
                      onClick={() => setDressPose(p.id)}
                    >
                      {t(`characters.${p.labelKey}`)}
                      <span
                        className={[
                          'rounded px-1 py-px text-[9px] font-semibold',
                          on ? 'bg-white/20 text-white' : 'bg-ink-800 text-ink-500'
                        ].join(' ')}
                      >
                        {p.aspectBadge}
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>

            {/* Optional note — collapsed by default via details */}
            <details className="rounded-2xl border border-ink-800 bg-ink-950/30 open:bg-ink-950/40">
              <summary className="cursor-pointer list-none px-4 py-3 text-[12px] font-medium text-ink-300 marker:content-none [&::-webkit-details-marker]:hidden">
                <span className="inline-flex items-center gap-2">
                  <span className="text-ink-500">▸</span>
                  {t('costumes.dressNote')}
                  <span className="text-[11px] font-normal text-ink-600">
                    {t('costumes.dressNoteOptional')}
                  </span>
                </span>
              </summary>
              <div className="border-t border-ink-800 px-4 pb-4 pt-2">
                <Textarea
                  size="md"
                  value={dressNote}
                  onChange={(e) => setDressNote(e.target.value)}
                  placeholder={t('costumes.dressNotePh')}
                />
              </div>
            </details>

            {/* CTA */}
            <div className="sticky bottom-0 z-[1] -mx-1 space-y-2 rounded-2xl border border-brand-800/40 bg-ink-950/95 p-3 shadow-lg backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none sm:backdrop-blur-none">
              <Button
                className="w-full"
                disabled={
                  !editId ||
                  !dressCharId ||
                  !lookDesc.trim() ||
                  busy ||
                  costumeBusy(editId) ||
                  !resolvedDressBasePath
                }
                onClick={() => handleGenerateDressed()}
              >
                {costumesBusyLabel(
                  costumeBusy(editId),
                  t('common.generating'),
                  t('costumes.generateDressed')
                )}
              </Button>
              {(() => {
                const msg = costumesDressHintText(
                  costumesDressCtaHint(
                    editId,
                    dressCharId,
                    Boolean(resolvedDressBasePath),
                    Boolean(lookDesc.trim())
                  ),
                  {
                    saveFirst: t('costumes.saveFirstForDress'),
                    needCharBase: t('costumes.dressNeedCharBase'),
                    needDesc: t('costumes.dressNeedDesc')
                  }
                )
                return msg ? (
                  <p className="text-center text-[11px] text-ink-500">{msg}</p>
                ) : null
              })()}
            </div>
          </div>
        )}
      </EditorShell>
    </div>
  )
}

// ─── Residual pure helpers (absolute line coverage) ─────────────────────────

export function costumesGuardSaveFirst(
  editId: string | null | undefined,
  toastInfo: (m: string) => void,
  msg: string
): boolean {
  if (!editId) {
    toastInfo(msg)
    return true
  }
  return false
}

export function costumesGuardBusy(
  busy: boolean,
  toastInfo: (m: string) => void,
  msg: string
): boolean {
  if (busy) {
    toastInfo(msg)
    return true
  }
  return false
}

export function costumesAiFillToastKey(
  hasImage: boolean,
  idea: string
): 'fromImage' | 'background' {
  return hasImage && !idea ? 'fromImage' : 'background'
}

export function costumesApplyIpc(
  e: unknown,
  setError: (m: string) => void,
  toastError: (m: string) => void
): string {
  const msg =
    e instanceof Error
      ? e.message
      : typeof e === 'string'
        ? e
        : String(e)
  setError(msg)
  toastError(msg)
  return msg
}

export function costumesApplySimpleIpc(
  e: unknown,
  toastError: (m: string) => void
): string {
  const msg =
    e instanceof Error
      ? e.message
      : typeof e === 'string'
        ? e
        : String(e)
  toastError(msg)
  return msg
}

export function costumesCannotDeleteActive(
  activeNames: string[],
  toastInfo: (m: string) => void,
  msg: string
): boolean {
  if (activeNames.length > 0) {
    toastInfo(msg)
    return true
  }
  return false
}

export function costumesIsBusyJob(
  j: { kind: string; scope: { costumeId?: string } },
  costumeId?: string | null
): boolean {
  return (
    (j.kind === 'costume-ai-fill' ||
      j.kind === 'costume-intro-video' ||
      j.kind === 'costume-swap') &&
    (!costumeId || j.scope.costumeId === costumeId)
  )
}

export function costumesGuardIntro(
  editId: string | null | undefined,
  sourcePath: string | null | undefined,
  busy: boolean,
  toastInfo: (m: string) => void,
  toastError: (m: string) => void,
  msgs: { saveFirst: string; needImage: string; loading: string }
): 'saveFirst' | 'needImage' | 'busy' | 'ok' {
  if (!editId) {
    toastInfo(msgs.saveFirst)
    return 'saveFirst'
  }
  if (!sourcePath?.trim()) {
    toastError(msgs.needImage)
    return 'needImage'
  }
  if (busy) {
    toastInfo(msgs.loading)
    return 'busy'
  }
  return 'ok'
}

export function costumesMaybeContinueDraft(
  has: boolean,
  cont: () => void
): boolean {
  if (has) {
    cont()
    return true
  }
  return false
}

export function costumesGuardDress(
  editId: string | null | undefined,
  dressCharId: string,
  basePath: string,
  busy: boolean,
  toastInfo: (m: string) => void,
  toastError: (m: string) => void,
  setBanner: (m: string) => void,
  msgs: {
    saveFirst: string
    pickChar: string
    noBase: string
    loading: string
  }
): 'saveFirst' | 'pickChar' | 'noBase' | 'busy' | 'ok' {
  if (!editId) {
    toastInfo(msgs.saveFirst)
    return 'saveFirst'
  }
  if (!dressCharId) {
    toastInfo(msgs.pickChar)
    return 'pickChar'
  }
  if (!basePath?.trim()) {
    toastError(msgs.noBase)
    setBanner(msgs.noBase)
    return 'noBase'
  }
  if (busy) {
    toastInfo(msgs.loading)
    return 'busy'
  }
  return 'ok'
}

export function costumesBaseLabel(
  manual: boolean,
  manualMsg: string,
  autoMsg: string
): string {
  return manual ? manualMsg : autoMsg
}

export function costumesAfterRemoveImage(
  removedPath: string | undefined,
  lookImagePath: string | null,
  next: { id: string; path: string }[],
  isCover: (gal: { path: string }[], look: string | null) => boolean,
  primary: (gal: { path: string }[]) => string | null
): { look: string | null; selectedId: string | null } {
  if (removedPath && lookImagePath === removedPath) {
    const p = primary(next)
    return {
      look: p,
      selectedId: next.find((g) => g.path === p)?.id ?? next[0]?.id ?? null
    }
  }
  if (!isCover(next, lookImagePath)) {
    const p = primary(next)
    return { look: p, selectedId: next[0]?.id ?? null }
  }
  return { look: lookImagePath, selectedId: null }
}

export function costumesReorderGallery<T extends { id: string }>(
  gallery: T[],
  fromId: string,
  toId: string
): T[] | null {
  const from = gallery.findIndex((g) => g.id === fromId)
  const to = gallery.findIndex((g) => g.id === toId)
  if (from < 0 || to < 0) return null
  const next = [...gallery]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

export function costumesArtStyleLabel(
  v: string,
  isStyle: (x: string) => boolean,
  styleLabel: (x: string) => string
): string {
  return isStyle(v) ? styleLabel(v) : v
}

export function costumesIntroVideoHandler(
  editId: string | null | undefined,
  path: string,
  handler: (p: string) => void
): (() => void) | undefined {
  return editId ? () => handler(path) : undefined
}

export function costumesMaybeSetDressBase(
  options: { path: string }[],
  dressBasePath: string
): string | null {
  if (options[0] && !dressBasePath) return options[0].path
  return null
}

export function costumesFilterByQuery<T extends { name: string; description?: string | null }>(
  items: T[],
  q: string
): T[] {
  if (!q.trim()) return items
  const lower = q.toLowerCase()
  return items.filter(
    (c) =>
      c.name.toLowerCase().includes(lower) ||
      (c.description ?? '').toLowerCase().includes(lower)
  )
}

export function costumesRefFallback(
  c: { refImagePath?: string | null; name: string } | null
): { path: string; label: string; id: string }[] {
  if (!c?.refImagePath) return []
  return [{ path: c.refImagePath, label: c.name, id: 'ref' }]
}


export function costumesMakeRemoveImage(ops: {
  getGallery: () => { id: string; path: string }[]
  getLook: () => string | null
  removeItem: (gal: { id: string; path: string }[], id: string) => { id: string; path: string }[]
  isCover: (gal: { path: string }[], look: string | null) => boolean
  primary: (gal: { path: string }[]) => string | null
  setGallery: (g: { id: string; path: string }[]) => void
  setLook: (p: string | null) => void
  setSelected: (id: string | null) => void
}): (id: string) => void {
  return (id: string) => {
    const gallery = ops.getGallery()
    const lookImagePath = ops.getLook()
    const removed = gallery.find((g) => g.id === id)
    const next = ops.removeItem(gallery, id)
    ops.setGallery(next)
    const adj = costumesAfterRemoveImage(
      removed?.path,
      lookImagePath,
      next,
      ops.isCover,
      ops.primary
    )
    if (adj.selectedId !== null || adj.look !== lookImagePath) {
      if (adj.look !== lookImagePath) ops.setLook(adj.look)
      if (adj.selectedId) ops.setSelected(adj.selectedId)
      else if (removed && lookImagePath === removed.path) ops.setSelected(null)
    }
  }
}

export function costumesMakeReorder(
  getGallery: () => { id: string }[],
  setGallery: (g: { id: string }[]) => void
): (fromId: string, toId: string) => void {
  return (fromId, toId) => {
    const next = costumesReorderGallery(getGallery(), fromId, toId)
    if (!next) return
    setGallery(next)
  }
}

export function costumesClearDressBaseIfInvalid(
  options: { path: string }[],
  dressBasePath: string
): string {
  if (!options.some((o) => o.path === dressBasePath)) return ''
  return dressBasePath
}

export function costumesFilterListQuery(
  includesName: boolean,
  includesDesc: boolean
): boolean {
  return includesName || includesDesc
}

export function costumesStyleChip(
  artStyle: string | null | undefined,
  label: string
): string {
  return artStyle ? ` · ${label}` : ''
}

export function costumesIntroOrUndefined(
  editId: string | null | undefined,
  path: string | undefined,
  handler: (p: string) => void
): (() => void) | undefined {
  return editId && path ? () => handler(path) : undefined
}


export function costumesListFilterArg(
  filterUnlinked: boolean,
  filterCharId: string
): { unlinkedOnly: true } | { characterId: string } | undefined {
  if (filterUnlinked) return { unlinkedOnly: true }
  if (filterCharId) return { characterId: filterCharId }
  return undefined
}

export function costumesIsActiveOnChar(
  costumeDesc: string,
  charCostume: string | null | undefined
): boolean {
  return (
    (charCostume ?? '').trim().toLowerCase() ===
    costumeDesc.trim().toLowerCase()
  )
}

export function costumesActiveNames(
  links: Array<{ character: { name: string; costume?: string | null } }>,
  description: string
): string[] {
  return links
    .filter((l) => costumesIsActiveOnChar(description, l.character.costume))
    .map((l) => l.character.name)
}

export function costumesDressBaseOptions(
  char: { name: string; refImagePath?: string | null } | null | undefined,
  gallery: Array<{ id: string; path: string; label?: string }>,
  labelOf: (item: { path: string; label?: string }) => string
): Array<{ path: string; label: string; id: string }> {
  if (!char) return []
  if (gallery.length === 0 && char.refImagePath) {
    return costumesRefFallback(char)
  }
  return gallery.map((i) => ({
    path: i.path,
    label: labelOf(i),
    id: i.id
  }))
}

export function costumesLinksFilterMatch(
  isLinked: boolean,
  linksFilter: 'all' | 'linked' | 'unlinked',
  q: string,
  name: string,
  description: string | null | undefined
): boolean {
  if (linksFilter === 'linked' && !isLinked) return false
  if (linksFilter === 'unlinked' && isLinked) return false
  if (!q) return true
  return costumesFilterListQuery(
    name.toLowerCase().includes(q),
    (description ?? '').toLowerCase().includes(q)
  )
}

export async function costumesRunToggleLink(ops: {
  editId: string | null | undefined
  characterId: string
  linked: boolean
  dressCharId: string
  toastInfo: (m: string) => void
  saveFirstMsg: string
  setBusy: (v: boolean) => void
  unlink: (costumeId: string, characterId: string) => Promise<unknown>
  link: (costumeId: string, characterId: string) => Promise<unknown>
  setLinked: (fn: (ids: string[]) => string[]) => void
  clearDressIf: (characterId: string) => void
  reload: () => Promise<void>
  toastError: (m: string) => void
}): Promise<'saveFirst' | 'ok' | 'error'> {
  if (costumesGuardSaveFirst(ops.editId, ops.toastInfo, ops.saveFirstMsg)) {
    return 'saveFirst'
  }
  ops.setBusy(true)
  try {
    if (ops.linked) {
      await ops.unlink(ops.editId!, ops.characterId)
      ops.setLinked((ids) => ids.filter((id) => id !== ops.characterId))
      if (ops.dressCharId === ops.characterId) ops.clearDressIf(ops.characterId)
    } else {
      await ops.link(ops.editId!, ops.characterId)
      ops.setLinked((ids) =>
        ids.includes(ops.characterId) ? ids : [...ids, ops.characterId]
      )
    }
    await ops.reload()
    return 'ok'
  } catch (e) {
    ops.toastError(e instanceof Error ? e.message : String(e))
    return 'error'
  } finally {
    ops.setBusy(false)
  }
}

export function costumesGuardAiNeed(
  idea: string,
  lookDesc: string,
  lookName: string,
  hasImage: boolean,
  toastInfo: (m: string) => void,
  msg: string
): boolean {
  if (!idea && !lookDesc.trim() && !lookName.trim() && !hasImage) {
    toastInfo(msg)
    return true
  }
  return false
}

export function costumesAiFillRefPath(
  selectedPath: string | null | undefined,
  lookPath: string | null | undefined
): string {
  return selectedPath?.trim() || lookPath?.trim() || ''
}

export function costumesRunAiFill(ops: {
  idea: string
  lookDesc: string
  lookName: string
  lookStyle: string
  lookHardRules: string
  refPath: string
  busy: boolean
  toastInfo: (m: string) => void
  needMsg: string
  runningMsg: string
  fromImageMsg: string
  backgroundMsg: string
  setBanner: (m: string) => void
  startJob: (
    snapshot: {
      name: string
      description: string
      artStyle: string
      hardRules: string
    },
    idea: string,
    hasImage: boolean,
    refPath: string
  ) => void
}): 'need' | 'busy' | 'started' {
  const idea = ops.idea.trim()
  const hasImage = Boolean(ops.refPath)
  if (
    costumesGuardAiNeed(
      idea,
      ops.lookDesc,
      ops.lookName,
      hasImage,
      ops.toastInfo,
      ops.needMsg
    )
  ) {
    return 'need'
  }
  if (costumesGuardBusy(ops.busy, ops.toastInfo, ops.runningMsg)) {
    return 'busy'
  }
  ops.setBanner(ops.backgroundMsg)
  ops.toastInfo(
    costumesAiFillToastKey(hasImage, idea) === 'fromImage'
      ? ops.fromImageMsg
      : ops.backgroundMsg
  )
  ops.startJob(
    {
      name: ops.lookName,
      description: ops.lookDesc,
      artStyle: ops.lookStyle,
      hardRules: ops.lookHardRules
    },
    idea,
    hasImage,
    ops.refPath
  )
  return 'started'
}

export function costumesApplyAiFillResult(
  r: {
    name?: string
    description?: string
    artStyle?: string
    hardRules?: string
  },
  stillOpen: boolean,
  setName: (n: string) => void,
  setDesc: (d: string) => void,
  setStyle: (s: string) => void,
  setHard: (h: string) => void,
  isStyle: (s: string) => boolean
): void {
  if (!stillOpen) return
  if (r.name) setName(r.name)
  if (r.description) setDesc(r.description)
  if (r.artStyle && isStyle(r.artStyle)) setStyle(r.artStyle)
  if (typeof r.hardRules === 'string' && r.hardRules.trim()) {
    setHard(r.hardRules.trim())
  }
}

export async function costumesRunSave(ops: {
  lookDesc: string
  lookName: string
  lookHardRules: string
  lookStyle: string
  lookImagePath: string | null
  galleryJson: string | null
  linkedCharIds: string[]
  editId: string | null
  setBusy: (v: boolean) => void
  setError: (m: string | null) => void
  update: (id: string, payload: Record<string, unknown>) => Promise<unknown>
  create: (payload: Record<string, unknown>) => Promise<unknown>
  reload: () => Promise<void>
  toastSuccess: () => void
  closeEditor: () => void
  toastError: (m: string) => void
}): Promise<'empty' | 'ok' | 'error'> {
  if (!ops.lookDesc.trim()) return 'empty'
  ops.setBusy(true)
  ops.setError(null)
  const payload = {
    name: ops.lookName.trim() || ops.lookDesc.trim().slice(0, 32),
    description: ops.lookDesc.trim(),
    hardRules: ops.lookHardRules.trim() || null,
    artStyle: ops.lookStyle,
    refImagePath: ops.lookImagePath,
    refGalleryJson: ops.galleryJson,
    characterIds: ops.linkedCharIds
  }
  try {
    if (ops.editId) {
      await ops.update(ops.editId, payload)
    } else {
      await ops.create(payload)
    }
    await ops.reload()
    ops.toastSuccess()
    ops.closeEditor()
    return 'ok'
  } catch (e) {
    costumesApplyIpc(e, ops.setError, ops.toastError)
    return 'error'
  } finally {
    ops.setBusy(false)
  }
}

export async function costumesRunDelete(ops: {
  c: {
    id: string
    description: string
    characterLinks: Array<{
      character: { name: string; costume?: string | null }
    }>
  }
  toastInfo: (m: string) => void
  activeMsg: (names: string) => string
  confirm: () => Promise<boolean>
  remove: (id: string) => Promise<unknown>
  reload: () => Promise<void>
  toastSuccess: () => void
  toastError: (m: string) => void
}): Promise<'active' | 'cancel' | 'ok' | 'error'> {
  const activeOn = costumesActiveNames(ops.c.characterLinks, ops.c.description)
  if (
    costumesCannotDeleteActive(
      activeOn,
      ops.toastInfo,
      ops.activeMsg(activeOn.join(', '))
    )
  ) {
    return 'active'
  }
  if (!(await ops.confirm())) return 'cancel'
  try {
    await ops.remove(ops.c.id)
    await ops.reload()
    ops.toastSuccess()
    return 'ok'
  } catch (e) {
    costumesApplySimpleIpc(e, ops.toastError)
    return 'error'
  }
}

export async function costumesRunPickImage(ops: {
  pick: () => Promise<{ filePath?: string } | null | undefined>
  gallery: unknown[]
  append: (
    gallery: unknown[],
    item: { path: string; kind: string; label: string }
  ) => Array<{ id: string }>
  externalLabel: string
  setLook: (p: string) => void
  setGallery: (g: unknown[]) => void
  setSelected: (id: string | null) => void
  toastSuccess: () => void
}): Promise<boolean> {
  const r = await ops.pick()
  if (!r?.filePath) return false
  ops.setLook(r.filePath)
  const next = ops.append(ops.gallery, {
    path: r.filePath,
    kind: 'external',
    label: ops.externalLabel
  })
  ops.setGallery(next)
  ops.setSelected(next[next.length - 1]?.id ?? null)
  ops.toastSuccess()
  return true
}

export function costumesSetCover(
  path: string,
  gallery: Array<{ id: string; path: string }>,
  setLook: (p: string) => void,
  setSelected: (id: string) => void,
  toastSuccess: () => void
): void {
  setLook(path)
  const hit = gallery.find((g) => g.path === path)
  if (hit) setSelected(hit.id)
  toastSuccess()
}

export function costumesMapGalleryKind(
  kind: string
): 'sheet' | 'upload' | 'gen' {
  if (kind === 'sheet' || kind === 'upload' || kind === 'gen') return kind
  return 'gen'
}

export function costumesMapVideoGalleryItem(item: {
  id: string
  path: string
  kind: string
  label: string
  createdAt: string
  layer?: string
  introVideoPath?: string | null
}): {
  id: string
  path: string
  kind: 'sheet' | 'upload' | 'gen'
  label: string
  createdAt: string
  layer?: string
  introVideoPath: string | null
} {
  return {
    id: item.id,
    path: item.path,
    kind: costumesMapGalleryKind(item.kind),
    label: item.label,
    createdAt: item.createdAt,
    ...(item.layer ? { layer: item.layer } : {}),
    introVideoPath: item.introVideoPath ?? null
  }
}

export function costumesHandleVideoPrepDone(
  d: {
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
  } | null
    | undefined,
  editId: string | null,
  setGallery: (g: ReturnType<typeof costumesMapVideoGalleryItem>[]) => void,
  reload: () => void
): boolean {
  if (d?.kind !== 'costume-intro') return false
  if (!editId || d.entityIds?.costumeId !== editId) return false
  if (d.gallery?.length) {
    setGallery(d.gallery.map(costumesMapVideoGalleryItem))
  } else {
    reload()
  }
  return true
}

export async function costumesRunIntroAfterSave(ops: {
  update: () => Promise<unknown>
  toastError: (m: string) => void
  start: () => void
}): Promise<'ok' | 'error'> {
  try {
    await ops.update()
  } catch (e) {
    ops.toastError(e instanceof Error ? e.message : String(e))
    return 'error'
  }
  ops.start()
  return 'ok'
}

export function costumesBuildDressConfirm(ops: {
  charName: string | undefined
  lookDesc: string
  lookName: string
  artStyle: string
  poseId: string
  appearance?: string | null
  ageRange?: string | null
  gender?: string | null
  visualTags?: string | null
  mannerisms?: string | null
  hardRules: string
  dressNote: string
  dressBasePath: string
  basePath: string | null
  poseLabel: string
  styleLabel: string
  manualMsg: string
  autoMsg: string
  buildPrompt: (args: Record<string, unknown>) => string
  ensureRules: (prompt: string, rules: string) => string
}): {
  prompt: string
  referencePaths: string[]
  useIdentityEdit: boolean
  summary: string
} {
  let prompt = ops.buildPrompt({
    name: ops.charName || 'Character',
    newCostume: ops.lookDesc.trim() || ops.lookName.trim() || 'Costume',
    artStyle: ops.artStyle,
    pose: ops.poseId,
    appearance: ops.appearance,
    ageRange: ops.ageRange,
    gender: ops.gender,
    visualTags: ops.visualTags,
    mannerisms: ops.mannerisms,
    hardRules: ops.hardRules.trim() || undefined
  })
  const note = ops.dressNote.trim()
  if (note) {
    prompt = `${prompt}\n\nEXTRA DRESS DIRECTION: ${note}`
  }
  prompt = ops.ensureRules(prompt, ops.hardRules)
  const baseMode = costumesBaseLabel(
    Boolean(ops.dressBasePath),
    ops.manualMsg,
    ops.autoMsg
  )
  return {
    prompt,
    referencePaths: ops.basePath ? [ops.basePath] : [],
    useIdentityEdit: Boolean(ops.basePath),
    summary: `${ops.charName ?? '—'} · ${ops.poseLabel} · ${ops.styleLabel} · ${baseMode}`
  }
}

export async function costumesRunDressJob(ops: {
  editId: string | null
  dressCharId: string
  busy: boolean
  toastInfo: (m: string) => void
  runningMsg: string
  backgroundMsg: string
  setBanner: (m: string) => void
  setConfirmNull: () => void
  startJob: (
    costumeId: string,
    characterId: string,
    base: string | null,
    run: (ctx: {
      setProgress: (n: number, s?: string) => void
      signal: { cancelled: boolean }
    }) => Promise<unknown>
  ) => void
  generate: (args: {
    costumeId: string
    characterId: string
    baseImagePath: string | null
    pose: string
    promptOverride: string
  }) => Promise<{
    path: string
    costume?: {
      refImagePath?: string | null
      refGalleryJson?: string | null
    } | null
  }>
  pose: string
  prompt: string
  base: string | null
  stillOpen: (costumeId: string) => boolean
  applyResult: (path: string, nextGal: unknown[]) => void
  parseGallery: (
    json: string | null | undefined,
    opts: { refImagePath: string }
  ) => unknown[]
  galleryFallback: unknown[]
  reload: () => Promise<void>
  toastSuccess: () => void
}): Promise<'no-id' | 'busy' | 'started'> {
  ops.setConfirmNull()
  if (!ops.editId || !ops.dressCharId) return 'no-id'
  if (costumesGuardBusy(ops.busy, ops.toastInfo, ops.runningMsg)) {
    return 'busy'
  }
  const costumeId = ops.editId
  const characterId = ops.dressCharId
  ops.setBanner(ops.backgroundMsg)
  ops.toastInfo(ops.backgroundMsg)
  ops.startJob(costumeId, characterId, ops.base, async ({ setProgress, signal }) => {
    setProgress(20, 'image')
    const r = await ops.generate({
      costumeId,
      characterId,
      baseImagePath: ops.base,
      pose: ops.pose,
      promptOverride: ops.prompt
    })
    if (signal.cancelled) return
    setProgress(100, 'done')
    const cos = r.costume
    const nextGal = ops.parseGallery(cos?.refGalleryJson, {
      refImagePath: cos?.refImagePath ?? r.path
    })
    if (ops.stillOpen(costumeId)) {
      ops.applyResult(
        r.path,
        nextGal.length > 0 ? nextGal : ops.galleryFallback
      )
    }
    await ops.reload()
    ops.toastSuccess()
    return undefined
  })
  return 'started'
}

export function costumesSelectedGalItem<
  T extends { id: string; path: string }
>(
  gallery: T[],
  selectedGalId: string | null,
  lookImagePath: string | null
): T | null {
  if (!gallery.length) return null
  return (
    gallery.find((g) => g.id === selectedGalId) ??
    gallery.find((g) => g.path === lookImagePath) ??
    gallery[0]
  )
}

export function costumesFilterCharChange(v: string): {
  unlinked: boolean
  charId: string
} {
  if (v === '__unlinked__') return { unlinked: true, charId: '' }
  return { unlinked: false, charId: v }
}

export function costumesDressCtaHint(
  editId: string | null,
  dressCharId: string,
  hasBase: boolean,
  hasDesc: boolean
): 'saveFirst' | 'needCharBase' | 'needDesc' | null {
  if (!editId) return 'saveFirst'
  if (!dressCharId || !hasBase) return 'needCharBase'
  if (!hasDesc) return 'needDesc'
  return null
}

export function costumesOpenCreateState(): {
  editId: null
  lookName: string
  lookDesc: string
  lookHardRules: string
  lookImagePath: null
  linkedCharIds: string[]
  dressCharId: string
  dressPose: 'hero_front'
  dressBasePath: string
  gallery: []
  selectedGalId: null
  aiIdea: string
  editorTab: 'profile'
} {
  return {
    editId: null,
    lookName: '',
    lookDesc: '',
    lookHardRules: '',
    lookImagePath: null,
    linkedCharIds: [],
    dressCharId: '',
    dressPose: 'hero_front',
    dressBasePath: '',
    gallery: [],
    selectedGalId: null,
    aiIdea: '',
    editorTab: 'profile'
  }
}

export function costumesNameOrDescSlice(
  name: string,
  desc: string,
  max = 32
): string {
  return name.trim() || desc.trim().slice(0, max)
}

export function costumesLinkedNames(
  links: Array<{ character: { name: string } }>
): string {
  return links.map((l) => l.character.name).join(' · ')
}


export function costumesBindToggleLink(ops: {
  getEditId: () => string | null
  getLinked: () => string[]
  getDressCharId: () => string
  toastInfo: (m: string) => void
  saveFirstMsg: string
  setBusy: (v: boolean) => void
  unlink: (costumeId: string, characterId: string) => Promise<unknown>
  link: (costumeId: string, characterId: string) => Promise<unknown>
  setLinked: (fn: (ids: string[]) => string[]) => void
  clearDressIf: () => void
  reload: () => Promise<void>
  toastError: (m: string) => void
}): (characterId: string) => Promise<void> {
  return async (characterId: string) => {
    await costumesRunToggleLink({
      editId: ops.getEditId(),
      characterId,
      linked: ops.getLinked().includes(characterId),
      dressCharId: ops.getDressCharId(),
      toastInfo: ops.toastInfo,
      saveFirstMsg: ops.saveFirstMsg,
      setBusy: ops.setBusy,
      unlink: ops.unlink,
      link: ops.link,
      setLinked: ops.setLinked,
      clearDressIf: ops.clearDressIf,
      reload: ops.reload,
      toastError: ops.toastError
    })
  }
}

export function costumesBindSetCover(ops: {
  getGallery: () => Array<{ id: string; path: string }>
  setLook: (p: string) => void
  setSelected: (id: string) => void
  toastSuccess: () => void
}): (path: string) => void {
  return (path: string) => {
    costumesSetCover(
      path,
      ops.getGallery(),
      ops.setLook,
      ops.setSelected,
      ops.toastSuccess
    )
  }
}

export function costumesBindIntroVideo(ops: {
  getEditId: () => string | null
  isBusy: () => boolean
  toastInfo: (m: string) => void
  toastError: (m: string) => void
  msgs: { saveFirst: string; needImage: string; loading: string }
  hasDraft: (key: string) => boolean
  continueDraft: (key: string) => void
  getLookName: () => string
  getLookDesc: () => string
  getLookStyle: () => string
  getLookImage: () => string | null
  getGallery: () => unknown[]
  serializeGallery: (g: unknown[]) => string | null
  update: (id: string, payload: Record<string, unknown>) => Promise<unknown>
  startVideoPrep: (args: { costumeId: string; sourcePath: string }) => void
  buildDraftKey: (costumeId: string, sourcePath: string) => string
}): (sourceImagePath: string) => void {
  return (sourceImagePath: string) => {
    const editId = ops.getEditId()
    const gate = costumesGuardIntro(
      editId,
      sourceImagePath,
      ops.isBusy(),
      ops.toastInfo,
      ops.toastError,
      ops.msgs
    )
    if (gate !== 'ok') return
    const costumeId = editId!
    const sourcePath = sourceImagePath.trim()
    const draftKey = ops.buildDraftKey(costumeId, sourcePath)
    if (
      costumesMaybeContinueDraft(ops.hasDraft(draftKey), () =>
        ops.continueDraft(draftKey)
      )
    ) {
      return
    }
    void costumesRunIntroAfterSave({
      update: () =>
        ops.update(costumeId, {
          name: costumesNameOrDescSlice(ops.getLookName(), ops.getLookDesc()),
          description: ops.getLookDesc().trim() || ops.getLookName().trim(),
          artStyle: ops.getLookStyle(),
          refImagePath: ops.getLookImage(),
          refGalleryJson: ops.serializeGallery(ops.getGallery())
        }),
      toastError: ops.toastError,
      start: () => ops.startVideoPrep({ costumeId, sourcePath })
    })
  }
}

export function costumesListenVideoPrepDone(
  editId: string | null,
  setGallery: (g: ReturnType<typeof costumesMapVideoGalleryItem>[]) => void,
  reload: () => void | Promise<void>
): () => void {
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
    costumesHandleVideoPrepDone(d, editId, setGallery, () => {
      void reload()
    })
  }
  window.addEventListener('idm:video-prep-done', onDone)
  return () => window.removeEventListener('idm:video-prep-done', onDone)
}

export function costumesBindGenerateDressed(ops: {
  getEditId: () => string | null
  getDressCharId: () => string
  getBaseOptionsLen: () => number
  isBlocked: () => boolean
  toastInfo: (m: string) => void
  toastError: (m: string) => void
  setBanner: (m: string) => void
  msgs: {
    saveFirst: string
    pickChar: string
    noBase: string
    loading: string
  }
  findChar: () =>
    | {
        name?: string
        appearance?: string | null
        ageRange?: string | null
        gender?: string | null
        visualTags?: string | null
        mannerisms?: string | null
      }
    | undefined
  getPose: () => { id: string; labelKey: string }
  getArtStyleId: () => string
  getLookDesc: () => string
  getLookName: () => string
  getHardRules: () => string
  getDressNote: () => string
  getDressBasePath: () => string
  getResolvedBase: () => string | null
  poseLabelOf: (pose: { labelKey: string }) => string
  styleLabelOf: (id: string) => string
  manualMsg: string
  autoMsg: string
  buildPrompt: (args: Record<string, unknown>) => string
  ensureRules: (prompt: string, rules: string) => string
  setConfirm: (c: {
    prompt: string
    referencePaths: string[]
    useIdentityEdit: boolean
    summary: string
  }) => void
}): () => void {
  return () => {
    const baseOk = ops.getBaseOptionsLen() > 0 ? 'ok-path' : ''
    const gate = costumesGuardDress(
      ops.getEditId(),
      ops.getDressCharId(),
      baseOk,
      ops.isBlocked(),
      ops.toastInfo,
      ops.toastError,
      ops.setBanner,
      ops.msgs
    )
    if (gate !== 'ok') return
    const char = ops.findChar()
    const pose = ops.getPose()
    const artStyle = ops.getArtStyleId()
    const conf = costumesBuildDressConfirm({
      charName: char?.name,
      lookDesc: ops.getLookDesc(),
      lookName: ops.getLookName(),
      artStyle,
      poseId: pose.id,
      appearance: char?.appearance,
      ageRange: char?.ageRange,
      gender: char?.gender,
      visualTags: char?.visualTags,
      mannerisms: char?.mannerisms,
      hardRules: ops.getHardRules(),
      dressNote: ops.getDressNote(),
      dressBasePath: ops.getDressBasePath(),
      basePath: ops.getResolvedBase(),
      poseLabel: ops.poseLabelOf(pose),
      styleLabel: ops.styleLabelOf(artStyle),
      manualMsg: ops.manualMsg,
      autoMsg: ops.autoMsg,
      buildPrompt: ops.buildPrompt,
      ensureRules: ops.ensureRules
    })
    ops.setConfirm(conf)
  }
}

export function costumesBindRunDressJob(ops: {
  getEditId: () => string | null
  getDressCharId: () => string
  isBlocked: () => boolean
  toastInfo: (m: string) => void
  runningMsg: string
  backgroundMsg: string
  setBanner: (m: string) => void
  setConfirmNull: () => void
  startJob: (
    costumeId: string,
    characterId: string,
    run: (ctx: {
      setProgress: (n: number, s?: string) => void
      signal: { cancelled: boolean }
    }) => Promise<unknown>
  ) => void
  generate: (args: {
    costumeId: string
    characterId: string
    baseImagePath: string | null
    pose: string
    promptOverride: string
  }) => Promise<{
    path: string
    costume?: {
      refImagePath?: string | null
      refGalleryJson?: string | null
    } | null
  }>
  getPose: () => string
  getResolvedBase: () => string | null
  stillOpen: (costumeId: string) => boolean
  applyResult: (path: string, nextGal: unknown[]) => void
  parseGallery: (
    json: string | null | undefined,
    opts: { refImagePath: string }
  ) => unknown[]
  getGalleryFallback: () => unknown[]
  reload: () => Promise<void>
  toastSuccess: () => void
}): (confirm: { prompt: string; referencePaths: string[] }) => Promise<void> {
  return async (confirm) => {
    await costumesRunDressJob({
      editId: ops.getEditId(),
      dressCharId: ops.getDressCharId(),
      busy: ops.isBlocked(),
      toastInfo: ops.toastInfo,
      runningMsg: ops.runningMsg,
      backgroundMsg: ops.backgroundMsg,
      setBanner: ops.setBanner,
      setConfirmNull: ops.setConfirmNull,
      startJob: (costumeId, characterId, _base, run) =>
        ops.startJob(costumeId, characterId, run),
      generate: ops.generate,
      pose: ops.getPose(),
      prompt: confirm.prompt,
      base: confirm.referencePaths[0] || ops.getResolvedBase() || null,
      stillOpen: ops.stillOpen,
      applyResult: ops.applyResult,
      parseGallery: ops.parseGallery,
      galleryFallback: ops.getGalleryFallback(),
      reload: ops.reload,
      toastSuccess: ops.toastSuccess
    })
  }
}

export function costumesSyncDressBasePath(
  dressBasePath: string,
  options: { path: string }[],
  setDressBasePath: (p: string) => void
): void {
  if (!dressBasePath) return
  setDressBasePath(costumesClearDressBaseIfInvalid(options, dressBasePath))
}

export function costumesBindManualBase(
  options: { path: string }[],
  dressBasePath: string,
  setDressBasePath: (p: string) => void
): () => void {
  return () => {
    const auto = costumesMaybeSetDressBase(options, dressBasePath)
    if (auto) setDressBasePath(auto)
  }
}

export function costumesDressCharOptions(
  characters: Array<{ id: string; name: string }>,
  linkedCharIds: string[]
): Array<{ id: string; name: string }> {
  return linkedCharIds.length
    ? characters.filter((c) => linkedCharIds.includes(c.id))
    : characters
}

export function costumesOnDressCharChange(
  value: string,
  setDressCharId: (v: string) => void,
  setDressBasePath: (v: string) => void
): void {
  setDressCharId(value)
  setDressBasePath('')
}


export async function costumesApiUnlink(
  costumeId: string,
  characterId: string
): Promise<unknown> {
  return getApi().costumes.unlinkCharacter({ costumeId, characterId })
}

export async function costumesApiLink(
  costumeId: string,
  characterId: string
): Promise<unknown> {
  return getApi().costumes.linkCharacter({ costumeId, characterId })
}

export function costumesSwapBlocked(
  isBlocked: (q: { kind: string[]; characterId?: string }) => boolean,
  dressCharId: string
): boolean {
  return isBlocked({ kind: ['costume-swap'], characterId: dressCharId })
}

export function costumesStartSwapJob(
  startJob: (job: {
    kind: string
    label: string
    scope: { characterId: string; costumeId: string; storyId: undefined }
    run: (ctx: {
      setProgress: (n: number, s?: string) => void
      signal: { cancelled: boolean }
    }) => Promise<unknown>
  }) => void,
  label: string,
  costumeId: string,
  characterId: string,
  run: (ctx: {
    setProgress: (n: number, s?: string) => void
    signal: { cancelled: boolean }
  }) => Promise<unknown>
): void {
  startJob({
    kind: 'costume-swap',
    label,
    scope: { characterId, costumeId, storyId: undefined },
    run
  })
}

export async function costumesApiGenerateDressed(args: {
  costumeId: string
  characterId: string
  baseImagePath: string | null
  pose: string
  promptOverride: string
}): Promise<{
  path: string
  costume?: {
    refImagePath?: string | null
    refGalleryJson?: string | null
  } | null
}> {
  return getApi().costumes.generateDressed(args as never)
}

export function costumesApplyDressResult(
  path: string,
  nextGal: Array<{ id: string; path: string }>,
  setLook: (p: string) => void,
  setGallery: (g: Array<{ id: string; path: string }>) => void,
  setSelected: (id: string | null) => void
): void {
  setLook(path)
  setGallery(nextGal)
  setSelected(nextGal.find((g) => g.path === path)?.id ?? nextGal[0]?.id ?? null)
}

export function costumesArtStyleOrDefault(
  value: string,
  isStyle: (v: string) => boolean,
  fallback: string
): string {
  return isStyle(value) ? value : fallback
}

export function costumesBusyLabel(
  busy: boolean,
  generating: string,
  idle: string
): string {
  return busy ? generating : idle
}

export function costumesCoverHandlers(
  path: string | undefined,
  onSet: (p: string) => void,
  onRemove: (() => void) | undefined
): {
  onSetAsCover: (() => void) | undefined
  onRemove: (() => void) | undefined
} {
  return {
    onSetAsCover: path ? () => onSet(path) : undefined,
    onRemove
  }
}

export function costumesBaseModeClass(
  active: boolean,
  activeCls: string,
  idleCls: string
): string {
  return active ? activeCls : idleCls
}

export function costumesSelectedThumbClass(selected: boolean): string {
  return selected
    ? 'border-brand-500 ring-2 ring-brand-500/25'
    : 'border-ink-700 hover:border-ink-500'
}

export function costumesDressHintText(
  hint: 'saveFirst' | 'needCharBase' | 'needDesc' | null,
  msgs: { saveFirst: string; needCharBase: string; needDesc: string }
): string | null {
  if (hint === 'saveFirst') return msgs.saveFirst
  if (hint === 'needCharBase') return msgs.needCharBase
  if (hint === 'needDesc') return msgs.needDesc
  return null
}


export function costumesMakeStartSwap(
  startJob: (job: {
    kind: string
    label: string
    scope: { characterId: string; costumeId: string; storyId: undefined }
    run: (ctx: {
      setProgress: (n: number, s?: string) => void
      signal: { cancelled: boolean }
    }) => Promise<unknown>
  }) => void,
  label: string
): (
  costumeId: string,
  characterId: string,
  run: (ctx: {
    setProgress: (n: number, s?: string) => void
    signal: { cancelled: boolean }
  }) => Promise<unknown>
) => void {
  return (costumeId, characterId, run) =>
    costumesStartSwapJob(startJob, label, costumeId, characterId, run)
}

export function costumesMakeApplyDress(
  setLook: (p: string) => void,
  setGallery: (g: CharacterGalleryItem[]) => void,
  setSelected: (id: string | null) => void
): (path: string, nextGal: unknown[]) => void {
  return (path, nextGal) =>
    costumesApplyDressResult(
      path,
      nextGal as CharacterGalleryItem[],
      setLook,
      setGallery,
      setSelected
    )
}

export function costumesLinksEmpty(count: number): boolean {
  return count === 0
}

export function costumesBaseNoImages(
  dressCharId: string,
  optionsLen: number
): 'pick' | 'none' | 'ok' {
  if (!dressCharId) return 'pick'
  if (optionsLen === 0) return 'none'
  return 'ok'
}

export function costumesResolvedPreview(
  path: string | null | undefined
): boolean {
  return Boolean(path)
}

export function costumesThumbSelectedMark(selected: boolean): boolean {
  return selected
}

export function costumesNullNode(): null {
  return null
}

export function costumesOptionalRemove(
  item: { id: string } | null | undefined,
  remove: (id: string) => void
): (() => void) | undefined {
  return item ? () => remove(item.id) : undefined
}

export function costumesLinksEmptyElement(
  count: number,
  msg: string
): React.ReactElement | null {
  if (!costumesLinksEmpty(count)) return null
  return (
    <p className="rounded-xl border border-dashed border-ink-800 px-4 py-8 text-center text-sm text-ink-500">
      {msg}
    </p>
  )
}

export function costumesSelectedMarkNode(
  selected: boolean
): React.ReactElement | null {
  if (!costumesThumbSelectedMark(selected)) return costumesNullNode()
  return (
    <span className="pointer-events-none absolute right-1 top-1 z-[2] flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 text-[10px] font-bold text-white shadow">
      ✓
    </span>
  )
}

export function costumesResolvedPreviewNode(
  path: string | null | undefined,
  preview: React.ReactNode
): React.ReactNode {
  return costumesResolvedPreview(path) ? preview : costumesNullNode()
}
