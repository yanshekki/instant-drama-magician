/**
 * Global wardrobe library — costumes are independent (0..N characters).
 * AI “dress” uses a character reference image + costume description.
 */
import { ensureHardRules } from '../../domain/promptHardRules'
import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { translateCharacterGalleryLabel } from '../../domain/galleryLabelI18n'
import {
  buildCostumeSwapPrompt,
  costumePosesByGroup,
  getCostumeSwapPose,
  pickBestBaseImage,
  type CostumeSwapPose
} from '../../domain/costumeSwap'
import {
  ImageGenConfirmModal,
  type ImageGenConfirmPayload
} from '../components/ImageGenConfirmModal'
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
import { LocalMediaImage } from '../components/LocalMediaImage'
import { GalleryThumbStrip } from '../components/GalleryThumbStrip'
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
  const [imageGenConfirm, setImageGenConfirm] =
    useState<ImageGenConfirmPayload | null>(null)
  const [busy, setBusy] = useState(false)
  const artGroups = useMemo(() => artStylesByGroup(), [])
  const poseGroups = useMemo(() => costumePosesByGroup(), [])

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
      setItems(sortByUpdatedAtDesc(list))
      setCharacters(sortByUpdatedAtDesc(chars))
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
    if (!c) return [] as Array<{ path: string; label: string; id: string }>
    if (dressCharGallery.length === 0 && c.refImagePath) {
      return [
        {
          path: c.refImagePath,
          label: c.name,
          id: 'ref'
        }
      ]
    }
    return dressCharGallery.map((i) => ({
      path: i.path,
      label: translateCharacterGalleryLabel(i.label || i.path, t),
      id: i.id
    }))
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
    if (!dressBasePath) return
    setDressBasePath(
      costumesClearDressBaseIfInvalid(dressCharBaseOptions, dressBasePath)
    )
  }, [dressCharBaseOptions, dressBasePath])

  const linksBrowser = useMemo(() => {
    const q = linksQ.trim().toLowerCase()
    const linked = new Set(linkedCharIds)
    return characters
      .filter((c) => {
        const isLinked = linked.has(c.id)
        if (linksFilter === 'linked' && !isLinked) return false
        if (linksFilter === 'unlinked' && isLinked) return false
        if (!q) return true
        return (
          c.name.toLowerCase().includes(q) ||
          (c.description ?? '').toLowerCase().includes(q)
        )
      })
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, i18n.language))
  }, [characters, linkedCharIds, linksFilter, linksQ, i18n.language])

  const handleToggleLink = async (characterId: string): Promise<void> => {
    if (
      costumesGuardSaveFirst(editId, toast.info, t('costumes.linksSaveFirst'))
    ) {
      return
    }
    const linked = linkedCharIds.includes(characterId)
    setBusy(true)
    try {
      if (linked) {
        await getApi().costumes.unlinkCharacter({
          costumeId: editId,
          characterId
        })
        setLinkedCharIds((ids) => ids.filter((id) => id !== characterId))
        if (dressCharId === characterId) setDressCharId('')
      } else {
        await getApi().costumes.linkCharacter({
          costumeId: editId,
          characterId
        })
        setLinkedCharIds((ids) =>
          ids.includes(characterId) ? ids : [...ids, characterId]
        )
      }
      await reload()
    } catch (e) {
      toast.error(parseIpcError(e).message)
    } finally {
      setBusy(false)
    }
  }

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
    const idea = aiIdea.trim()
    const refPath =
      selectedGalItem?.path?.trim() || lookImagePath?.trim() || ''
    const hasImage = Boolean(refPath)
    if (!idea && !lookDesc.trim() && !lookName.trim() && !hasImage) {
      toast.info(t('common.aiNeedIdeaOrImage'))
      return
    }
    if (
      costumesGuardBusy(
        isBlocked({
          kind: ['costume-ai-fill', 'costume-intro-video', 'costume-swap'],
          costumeId: editId ?? undefined
        }) || busy,
        toast.info,
        t('aiJobs.running')
      )
    ) {
      return
    }
    setPageBanner(t('aiJobs.startedBackground'))
    toast.info(
      costumesAiFillToastKey(hasImage, idea) === 'fromImage'
        ? t('common.aiFillFromImage')
        : t('aiJobs.startedBackground')
    )
    const snapshot = {
      name: lookName,
      description: lookDesc,
      artStyle: lookStyle,
      hardRules: lookHardRules
    }
    const costumeId = editId
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
          referenceImagePath: hasImage ? refPath : null
        })
        if (signal.cancelled) return
        setProgress(100, 'done')
        // Apply into open editor (same costume / new draft)
        if (!costumeId || editId === costumeId) {
          if (r.name) setLookName(r.name)
          if (r.description) setLookDesc(r.description)
          if (r.artStyle && isArtStyleId(r.artStyle)) setLookStyle(r.artStyle)
          if (typeof r.hardRules === 'string' && r.hardRules.trim()) {
            setLookHardRules(r.hardRules.trim())
          }
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
          hardRules: lookHardRules.trim() || null,
          artStyle: lookStyle,
          refImagePath: lookImagePath,
          refGalleryJson: galJson,
          characterIds: linkedCharIds
        })
      } else {
        await getApi().costumes.create({
          name: lookName.trim() || lookDesc.trim().slice(0, 32),
          description: lookDesc.trim(),
          hardRules: lookHardRules.trim() || null,
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
      costumesApplyIpc(e, setError, toast.error)
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
    if (
      costumesCannotDeleteActive(
        activeOn.map((a) => a.character.name),
        toast.info,
        t('costumes.cannotDeleteActive', {
          names: activeOn.map((a) => a.character.name).join(', ')
        })
      )
    ) {
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
      costumesApplySimpleIpc(e, toast.error)
    }
  }

  const handlePickImage = async (): Promise<void> => {
    const r = await getApi().media.pickRefImage()
    if (!r?.filePath) return
    setLookImagePath(r.filePath)
    const next = appendGalleryItem(gallery, {
      path: r.filePath,
      kind: 'external',
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
    const gate = costumesGuardIntro(
      editId,
      sourceImagePath,
      costumeBusy(editId) || busy,
      toast.info,
      toast.error,
      {
        saveFirst: t('costumes.saveFirstForDress'),
        needImage: t('costumes.introVideoNeedImage'),
        loading: t('aiJobs.running')
      }
    )
    if (gate !== 'ok') return
    const costumeId = editId!
    const sourcePath = sourceImagePath.trim()
    const draftKey = buildVideoPrepDraftKey(
      'costume-intro',
      { costumeId },
      sourcePath
    )
    if (
      costumesMaybeContinueDraft(hasVideoPrepDraft(draftKey), () =>
        continueVideoPrepDraft(draftKey)
      )
    ) {
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
            ...(item.layer
              ? {
                  layer:
                    item.layer as import('../../domain/characterSheetVariants').WardrobeLayer
                }
              : {}),
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
    // UI pre-check: character must have at least one gallery still (paths may still be stale on disk).
    const baseOk = dressCharBaseOptions.length > 0 ? 'ok-path' : ''
    const gate = costumesGuardDress(
      editId,
      dressCharId,
      baseOk,
      isBlocked({ kind: ['costume-swap'], characterId: dressCharId }),
      toast.info,
      toast.error,
      setPageBanner,
      {
        saveFirst: t('costumes.saveFirstForDress'),
        pickChar: t('costumes.pickCharacterForDress'),
        noBase: t('errors.costumeNoBaseImage'),
        loading: t('aiJobs.running')
      }
    )
    if (gate !== 'ok') return
    const char = characters.find((x) => x.id === dressCharId)
    const pose = getCostumeSwapPose(dressPose)
    const artStyle = getArtStyle(lookStyle).id
    const base = resolvedDressBasePath
    let prompt = buildCostumeSwapPrompt({
      name: char?.name || 'Character',
      newCostume: lookDesc.trim() || lookName.trim() || 'Costume',
      artStyle,
      pose: pose.id,
      appearance: char?.appearance,
      ageRange: char?.ageRange,
      gender: char?.gender,
      visualTags: char?.visualTags,
      mannerisms: char?.mannerisms,
      hardRules: lookHardRules.trim() || undefined
    })
    const note = dressNote.trim()
    if (note) {
      prompt = `${prompt}\n\nEXTRA DRESS DIRECTION: ${note}`
    }
    prompt = ensureHardRules(prompt, lookHardRules)
    const poseLabel = t(`characters.${pose.labelKey}`)
    const styleLabel = t(`characters.${getArtStyle(artStyle).labelKey}`)
    const baseMode = costumesBaseLabel(
      Boolean(dressBasePath),
      t('costumes.baseImageManual'),
      t('costumes.baseImageAuto')
    )
    setImageGenConfirm({
      prompt,
      referencePaths: base ? [base] : [],
      useIdentityEdit: Boolean(base),
      summary: `${char?.name ?? '—'} · ${poseLabel} · ${styleLabel} · ${baseMode}`
    })
  }

  const runCostumeDressJob = async (
    confirm: ImageGenConfirmPayload
  ): Promise<void> => {
    setImageGenConfirm(null)
    if (!editId || !dressCharId) return
    if (
      costumesGuardBusy(
        isBlocked({ kind: ['costume-swap'], characterId: dressCharId }),
        toast.info,
        t('aiJobs.running')
      )
    ) {
      return
    }
    const costumeId = editId
    const characterId = dressCharId
    const base =
      confirm.referencePaths[0] || resolvedDressBasePath || null
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
          pose,
          promptOverride: confirm.prompt
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
                  isCover={
                    Boolean(
                      selectedGalItem?.path &&
                        lookImagePath === selectedGalItem.path
                    )
                  }
                  onSetAsCover={
                    selectedGalItem?.path
                      ? () => handleSetCover(selectedGalItem.path)
                      : undefined
                  }
                  onRemove={
                    selectedGalItem
                      ? () => handleRemoveImage(selectedGalItem.id)
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
                    {t('common.uploadRef')}
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
                  costumesMakeReorder(() => gallery, setGallery)(fromId, toId)
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
                {t('common.uploadRef')}
              </Button>
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
            {linksBrowser.length === 0 ? (
              <p className="rounded-xl border border-dashed border-ink-800 px-4 py-8 text-center text-sm text-ink-500">
                {t('costumes.linksEmpty')}
              </p>
            ) : (
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
            )}
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
                onChange={(e) => {
                  setDressCharId(e.target.value)
                  setDressBasePath('')
                }}
                aria-label={t('costumes.dressCharacter')}
              >
                <option value="">{t('costumes.pickCharacterForDress')}</option>
                {(linkedCharIds.length
                  ? characters.filter((c) => linkedCharIds.includes(c.id))
                  : characters
                ).map((c) => (
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
                      !dressBasePath
                        ? 'bg-brand-600 text-white shadow-sm'
                        : 'text-ink-400 hover:text-ink-200'
                    ].join(' ')}
                    onClick={() => setDressBasePath('')}
                  >
                    {t('costumes.baseImageAuto')}
                  </button>
                  <button
                    type="button"
                    className={[
                      'rounded-md px-2.5 py-1 text-[11px] font-medium transition',
                      dressBasePath
                        ? 'bg-brand-600 text-white shadow-sm'
                        : 'text-ink-400 hover:text-ink-200'
                    ].join(' ')}
                    disabled={dressCharBaseOptions.length === 0}
                    onClick={() => {
                      const auto = costumesMaybeSetDressBase(
                        dressCharBaseOptions,
                        dressBasePath
                      )
                      if (auto) setDressBasePath(auto)
                    }}
                  >
                    {t('costumes.baseImageManual')}
                  </button>
                </div>
              </div>

              {!dressCharId ? (
                <p className="rounded-xl border border-dashed border-ink-700 bg-ink-900/30 px-3 py-6 text-center text-[12px] text-ink-500">
                  {t('costumes.pickCharacterForDress')}
                </p>
              ) : dressCharBaseOptions.length === 0 ? (
                <p className="rounded-xl border border-dashed border-ink-700 bg-ink-900/30 px-3 py-6 text-center text-[12px] text-ink-500">
                  {t('costumes.baseNoImages')}
                </p>
              ) : (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
                  {/* Hero selected base */}
                  <div className="relative mx-auto aspect-[3/4] w-36 shrink-0 overflow-hidden rounded-2xl border border-ink-700 bg-ink-900 shadow-inner sm:mx-0 sm:w-40">
                    {resolvedDressBasePath ? (
                      <div className="pointer-events-none absolute inset-0">
                        <LocalMediaImage
                          filePath={resolvedDressBasePath}
                          alt={t('costumes.basePreview')}
                          variant="thumb"
                          objectFit="cover"
                          className="border-0"
                          showActions={false}
                          enableZoom={false}
                          hoverZoom={false}
                        />
                      </div>
                    ) : null}
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 pb-2 pt-6">
                      <p className="text-[10px] font-medium text-white/95">
                        {!dressBasePath
                          ? t('costumes.baseImageAuto')
                          : t('costumes.basePreview')}
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
                              selected
                                ? 'border-brand-500 ring-2 ring-brand-500/25'
                                : 'border-ink-700 hover:border-ink-500'
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
                            {selected ? (
                              <span className="pointer-events-none absolute right-1 top-1 z-[2] flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 text-[10px] font-bold text-white shadow">
                                ✓
                              </span>
                            ) : null}
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
                {costumeBusy(editId)
                  ? t('common.generating')
                  : t('costumes.generateDressed')}
              </Button>
              {!editId ? (
                <p className="text-center text-[11px] text-ink-500">
                  {t('costumes.saveFirstForDress')}
                </p>
              ) : !dressCharId || !resolvedDressBasePath ? (
                <p className="text-center text-[11px] text-ink-500">
                  {t('costumes.dressNeedCharBase')}
                </p>
              ) : !lookDesc.trim() ? (
                <p className="text-center text-[11px] text-ink-500">
                  {t('costumes.dressNeedDesc')}
                </p>
              ) : null}
            </div>
          </div>
        )}
      </EditorShell>
      <ImageGenConfirmModal
        open={Boolean(imageGenConfirm)}
        payload={imageGenConfirm}
        busy={busy || costumeBusy(editId)}
        onCancel={() => setImageGenConfirm(null)}
        onConfirm={(p) => void runCostumeDressJob(p)}
      />
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
