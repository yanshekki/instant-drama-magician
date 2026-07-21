import { useEffect, useMemo, useState } from 'react'
import { ensureHardRules } from '../../domain/promptHardRules'
import { useTranslation } from 'react-i18next'
import { getAiLocale } from '../../lib/aiLocale'
import {
  appendSceneGalleryItem,
  isSceneGalleryCoverPath,
  moveSceneGalleryItem,
  parseSceneGallery,
  primarySceneGalleryPath,
  removeSceneGalleryItem,
  serializeSceneGallery,
  type SceneGalleryItem
} from '../../domain/sceneGallery'
import {
  appendMultiRefNote,
  resolveIdentityPaths,
  toggleGallerySelection
} from '../../domain/imageGenConfirm'
import {
  buildPropPlateEditPrompt,
  buildPropPlateImagePrompt
} from '../../domain/propPlateVariants'
import {
  ImageGenConfirmModal,
  type ImageGenConfirmPayload
} from '../components/ImageGenConfirmModal'
import { PlotContextPicker } from '../components/PlotContextPicker'
import type { StoryWithCounts } from '../../types/domain'
import {
  libraryBodyClass,
  libraryCardClass,
  libraryGridClass,
  libraryMediaBadgeClass,
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
import { LibraryFilterSelect } from '../components/LibraryFilterSelect'
import { useLibraryBrowse } from '../hooks/useLibraryBrowse'
import { compareUpdatedAtDesc } from '../lib/librarySort'
import {
  DEFAULT_PROP_PLATE,
  getPropPlateVariant,
  PROP_PLATE_VARIANTS,
  type PropPlateVariantId
} from '../../domain/propPlateVariants'
import {
  artStylesByGroup,
  DEFAULT_ART_STYLE,
  getArtStyle,
  isArtStyleId,
  type ArtStyleId
} from '../../domain/characterArtStyles'
import { buildVideoPrepDraftKey } from '../../domain/videoPrep'
import { getApi } from '../../lib/api'
import { parseIpcError } from '../../lib/ipc'
import { formatUserError } from '../lib/formatUserError'
import type { CreatePropInput, Prop } from '../../types/domain'
import { useApp } from '../context/AppContext'
import { useToast } from '../context/ToastContext'
import { useDialog } from '../context/DialogContext'
import { useAiJobs } from '../context/AiJobsContext'
import { useProps } from '../hooks/useProps'
import { LocalMediaImage } from '../components/LocalMediaImage'
import { GalleryThumbStrip } from '../components/GalleryThumbStrip'
import {
  EditorField,
  EditorSelect,
  EditorShell,
  editorFormClass
} from '../components/EditorShell'
import { PageHeader } from '../components/PageHeader'
import { Button, EmptyState, Input, Label, Textarea } from '../components/ui'
import { translatePropGalleryLabel } from '../../domain/galleryLabelI18n'

type EditorPanel = 'profile' | 'refs'

interface FormState {
  name: string
  description: string
  hardRules: string
  material: string
  sizeNotes: string
  condition: string
  visualTags: string
  artStyle: ArtStyleId
  gallery: SceneGalleryItem[]
  coverPath: string | null
}

const emptyForm = (): FormState => ({
  name: '',
  description: '',
  hardRules: '',
  material: '',
  sizeNotes: '',
  condition: '',
  visualTags: '',
  artStyle: DEFAULT_ART_STYLE,
  gallery: [],
  coverPath: null
})

function galleryFromProp(p: Prop): SceneGalleryItem[] {
  return parseSceneGallery(p.refGalleryJson, { refImagePath: p.refImagePath })
}

export function PropsPage(): JSX.Element {
  const { t, i18n } = useTranslation()
  const { activeStoryId } = useApp()
  const toast = useToast()
  const dialog = useDialog()
  const {
    startJob,
    isBlocked,
    onPropProfileApply,
    onPropPlateCommitted,
    activeJobs,
    startVideoPrep,
    hasVideoPrepDraft,
    continueVideoPrepDraft
  } = useAiJobs()
  const {
    items,
    loading,
    error,
    update,
    remove,
    reload
  } = useProps(activeStoryId)

  const [propImage, setPropImage] = useState('') // '' | has | none
  const propBrowse = useLibraryBrowse(
    items,
    (p) =>
      [
        p.name,
        p.description,
        p.material ?? '',
        p.sizeNotes ?? '',
        p.condition ?? '',
        p.visualTags ?? ''
      ].join(' '),
    {
      extraKey: propImage,
      matchesExtra: (p) => {
        const hasImg = Boolean(p.refImagePath)
        if (propImage === 'has' && !hasImg) return false
        if (propImage === 'none' && hasImg) return false
        return true
      },
      sort: compareUpdatedAtDesc
    }
  )
  const clearPropFilters = (): void => {
    propBrowse.setQ('')
    setPropImage('')
  }
  const propHasFilters =
    propBrowse.hasSearch || Boolean(propImage)

  const removeWithFeedback = async (id: string): Promise<void> => {
    try {
      await remove(id)
      toast.success(t('common.deleted'))
    } catch (e) {
      toast.error(parseIpcError(e).message)
    }
  }


  const [editorOpen, setEditorOpen] = useState(false)
  const [editorPanel, setEditorPanel] = useState<EditorPanel>('refs')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null)
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([])
  const [useIdentityRef, setUseIdentityRef] = useState(false)
  const [imageGenConfirm, setImageGenConfirm] =
    useState<ImageGenConfirmPayload | null>(null)
  const [plateVariant, setPlateVariant] =
    useState<PropPlateVariantId>(DEFAULT_PROP_PLATE)
  const [plotSuggestOpen, setPlotSuggestOpen] = useState(false)
  const [plotStoryId, setPlotStoryId] = useState('')
  const [plotSegmentKey, setPlotSegmentKey] = useState('all')
  const [stories, setStories] = useState<StoryWithCounts[]>([])
  const [aiIdea, setAiIdea] = useState('')
  const [pageBanner, setPageBanner] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const artGroups = useMemo(() => artStylesByGroup(), [])

  useEffect(() => {
    void getApi()
      .stories.list()
      .then((list) => setStories(list as StoryWithCounts[]))
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    if (plotSuggestOpen && activeStoryId && !plotStoryId) {
      setPlotStoryId(activeStoryId)
    }
  }, [plotSuggestOpen, activeStoryId, plotStoryId])

  const propLayerOptions = useMemo(() => {
    const layers = new Set<string>()
    for (const g of form.gallery) {
      if (g.layer) layers.add(String(g.layer))
    }
    return ['all', ...[...layers].sort()]
  }, [form.gallery])

  const [propLayerFilter, setPropLayerFilter] = useState('all')
  const filteredPropGallery = useMemo(() => {
    if (propLayerFilter === 'all') return form.gallery
    return form.gallery.filter((g) => String(g.layer ?? '') === propLayerFilter)
  }, [form.gallery, propLayerFilter])

  const propBusy = (propId?: string | null): boolean =>
    isBlocked({
      kind: ['prop-ai-fill', 'prop-plate', 'prop-intro-video'],
      propId: propId ?? undefined
    }) ||
    activeJobs.some(
      (j) =>
        (j.kind === 'prop-ai-fill' ||
          j.kind === 'prop-plate' ||
          j.kind === 'prop-intro-video') &&
        (!propId || j.scope.propId === propId)
    )
  const editorBusy = propBusy(editingId)

  const selectedImage = useMemo(() => {
    if (!form.gallery.length) return null
    return (
      form.gallery.find((g) => g.id === selectedImageId) ?? form.gallery[0]
    )
  }, [form.gallery, selectedImageId])

  useEffect(() => {
    return onPropProfileApply((draft) => {
      if (draft.propId && editingId && draft.propId !== editingId) {
        void reload()
        return
      }
      const p = draft.profile
      setForm((f) => ({
        ...f,
        name: p.name || f.name,
        description: p.description || f.description,
        material: p.material?.trim() ? p.material : f.material,
        sizeNotes: p.sizeNotes?.trim() ? p.sizeNotes : f.sizeNotes,
        condition: p.condition?.trim() ? p.condition : f.condition,
        // Prefer AI visualTags even when previously empty; never keep blank if AI sent tags
        visualTags:
          typeof p.visualTags === 'string' && p.visualTags.trim()
            ? p.visualTags.trim()
            : f.visualTags,
        hardRules:
          typeof p.hardRules === 'string' && p.hardRules.trim()
            ? p.hardRules.trim()
            : f.hardRules,
        artStyle: isArtStyleId(p.artStyle) ? p.artStyle : f.artStyle
      }))
      setEditorOpen(true)
      setEditorPanel('profile')
      setPageBanner(t('props.aiFillOk')); toast.success(t('props.aiFillOk'))
      // Do not reload list immediately — it can race and leave form looking stale.
      void reload()
    })
  }, [onPropProfileApply, editingId, reload, t])

  useEffect(() => {
    return onPropPlateCommitted(({ propId, path, gallery }) => {
      if (editingId === propId) {
        if (gallery && gallery.length > 0) {
          const g = gallery.map((item) => ({
            id: item.id,
            path: item.path,
            kind: (item.kind === 'sheet' ||
            item.kind === 'upload' ||
            item.kind === 'gen'
              ? item.kind
              : 'sheet') as 'sheet' | 'upload' | 'gen',
            label: item.label,
            createdAt: item.createdAt,
            ...(item.layer ? { layer: item.layer } : {}),
            ...((item as { introVideoPath?: string | null }).introVideoPath
              ? {
                  introVideoPath: (item as { introVideoPath?: string | null })
                    .introVideoPath
                }
              : {})
          }))
          setForm((f) => ({ ...f, gallery: g }))
          const newest =
            g.find((item) => item.path === path) ?? g[0] ?? null
          setSelectedImageId(newest?.id ?? null)
        } else {
          void getApi()
            .props.list()
            .then((list) => {
              const p = (list as Prop[]).find((x) => x.id === propId)
              if (!p) return
              const g = galleryFromProp(p)
              setForm((f) => ({
                ...f,
                gallery: g,
                coverPath: primarySceneGalleryPath(g, p.refImagePath)
              }))
              const newest =
                g.find((item) => item.path === path) ?? g[0] ?? null
              setSelectedImageId(newest?.id ?? null)
            })
        }
      }
      void reload()
      toast.success(t('props.plateOkShort'))
    })
  }, [onPropPlateCommitted, editingId, reload, t])

  const closeEditor = (): void => {
    setEditorOpen(false)
    setEditingId(null)
    setForm(emptyForm())
    setSelectedImageId(null)
    setAiIdea('')
  }

  const openCreate = (): void => {
    setEditorPanel('profile')
    setEditingId(null)
    setForm(emptyForm())
    setSelectedImageId(null)
    setEditorOpen(true)
  }

  const openEdit = (p: Prop): void => {
    const gallery = galleryFromProp(p)
    setEditingId(p.id)
    setForm({
      name: p.name,
      description: p.description,
      hardRules: p.hardRules ?? '',
      material: p.material ?? '',
      sizeNotes: p.sizeNotes ?? '',
      condition: p.condition ?? '',
      visualTags: p.visualTags ?? '',
      artStyle: isArtStyleId(p.artStyle) ? p.artStyle : DEFAULT_ART_STYLE,
      gallery,
      coverPath: primarySceneGalleryPath(gallery, p.refImagePath)
    })
    setSelectedImageId(
      gallery.find((g) => g.path === p.refImagePath)?.id ??
        gallery[0]?.id ??
        null
    )
    setAiIdea(p.seedPrompt ?? '')
    setEditorPanel(gallery.length > 0 ? 'refs' : 'profile')
    setEditorOpen(true)
  }

  const payload = (): Omit<CreatePropInput, 'storyId'> => {
    const primary = primarySceneGalleryPath(form.gallery, form.coverPath)
    return {
      name: form.name.trim(),
      description: form.description.trim() || form.name.trim(),
      material: form.material || null,
      sizeNotes: form.sizeNotes || null,
      condition: form.condition || null,
      visualTags: form.visualTags || null,
      artStyle: form.artStyle,
      refImagePath: primary,
      refGalleryJson: form.gallery.length
        ? serializeSceneGallery(form.gallery)
        : null,
      seedPrompt: form.description || null,
      hardRules: form.hardRules || null
    }
  }

  const handleSave = async (): Promise<void> => {
    if (!form.name.trim()) {
      toast.error(t('props.saveFirstForPlate'))
      return
    }
    setActionError(null)
    try {
      if (editingId) {
        // Always update existing — never create again
        const ok = await update(editingId, payload())
        if (ok) {
          toast.success(t('common.saved'))
          setPageBanner(t('props.saved'))
          await reload()
          closeEditor()
        } else {
          toast.error(t('common.actionFailed'))
        }
        return
      }
      // First save: create, then return to list
      await getApi().props.create({
        ...payload(),
        linkStoryId: activeStoryId ?? undefined
      })
      await reload()
      toast.success(t('common.saved'))
      setPageBanner(t('props.saved'))
      closeEditor()
    } catch (e) {
      const msg = parseIpcError(e).message
      setActionError(msg)
      toast.error(msg)
    }
  }

  /**
   * Ensure prop exists in DB before generate (same idea as characters.ensureSavedId).
   * Global library: does NOT require activeStoryId. Returns created id from API.
   */
  const ensureSavedId = async (): Promise<string | null> => {
    if (editingId) {
      const ok = await update(editingId, payload())
      if (!ok) {
        toast.error(t('common.actionFailed'))
        return null
      }
      return editingId
    }
    if (!form.name.trim()) {
      const msg = t('props.saveFirstForPlate')
      setActionError(msg)
      toast.error(msg)
      return null
    }
    try {
      const row = (await getApi().props.create({
        ...payload(),
        linkStoryId: activeStoryId ?? undefined
      })) as Prop
      await reload()
      setEditingId(row.id)
      return row.id
    } catch (e) {
      const msg = parseIpcError(e).message
      setActionError(msg)
      toast.error(msg)
      return null
    }
  }

  const handleAiFill = (): void => {
    if (editorBusy) return
    const idea = aiIdea.trim()
    const snapshot = {
      name: form.name.trim() || undefined,
      description: form.description.trim() || undefined,
      material: form.material.trim() || undefined,
      sizeNotes: form.sizeNotes.trim() || undefined,
      condition: form.condition.trim() || undefined,
      visualTags: form.visualTags.trim() || undefined,
      artStyle: form.artStyle || undefined
    }
    const hasDraft = Object.values(snapshot).some(
      (v) => typeof v === 'string' && v.length > 0
    )
    const refPath =
      selectedImage?.path?.trim() ||
      form.coverPath?.trim() ||
      form.gallery[0]?.path?.trim() ||
      ''
    const hasImage = Boolean(refPath)
    if (!idea && !hasDraft && !hasImage) {
      setActionError(t('common.aiNeedIdeaOrImage'))
      return
    }
    setPageBanner(t('aiJobs.startedBackground'))
    toast.info(
      hasImage && !idea && !hasDraft
        ? t('common.aiFillFromImage')
        : t('aiJobs.startedBackground')
    )
    startJob({
      kind: 'prop-ai-fill',
      label: t('common.aiFill'),
      scope: {
        propId: editingId ?? undefined,
        storyId: activeStoryId ?? undefined
      },
      run: async ({ setProgress, signal }) => {
        setProgress(20, hasImage ? 'image' : 'llm')
        const r = await getApi().props.aiFill({
          idea: idea || undefined,
          storyId: activeStoryId ?? undefined,
          locale: getAiLocale(i18n.language),
          existingDraft: hasDraft ? snapshot : undefined,
          referenceImagePath: hasImage ? refPath : null
        })
        if (signal.cancelled) return
        setProgress(100, 'done')
        return {
          type: 'prop-profile' as const,
          propId: editingId,
          storyId: activeStoryId,
          profile: r.profile,
          profileJson: r.profileJson,
          isNew: !editingId
        }
      }
    })
  }

  /** Animate the selected still into a prop intro video using prop bible. */
  const handleGenerateIntroVideo = (sourceImagePath: string): void => {
    if (!editingId) {
      setActionError(t('props.saveFirstForPlate'))
      toast.error(t('props.saveFirstForPlate'))
      return
    }
    if (!sourceImagePath?.trim()) {
      setActionError(t('props.introVideoNeedImage'))
      toast.error(t('props.introVideoNeedImage'))
      return
    }
    if (propBusy(editingId)) {
      toast.info(t('common.loading'))
      return
    }
    setActionError(null)
    const propId = editingId
    const sourcePath = sourceImagePath.trim()
    const draftKey = buildVideoPrepDraftKey(
      'prop-intro',
      { propId },
      sourcePath
    )
    if (hasVideoPrepDraft(draftKey)) {
      continueVideoPrepDraft(draftKey)
      return
    }
    void (async () => {
      try {
        await update(propId, payload())
      } catch (e) {
        toast.error(parseIpcError(e).message)
        return
      }
      startVideoPrep({
        kind: 'prop-intro',
        entityIds: { propId, storyId: activeStoryId ?? undefined },
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
        entityIds?: { propId?: string }
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
      if (d?.kind !== 'prop-intro') return
      if (!editingId || d.entityIds?.propId !== editingId) return
      if (d.gallery?.length) {
        setForm((f) => ({
          ...f,
          gallery: d.gallery!.map((item) => ({
            id: item.id,
            path: item.path,
            kind: (item.kind === 'sheet' ||
            item.kind === 'upload' ||
            item.kind === 'gen'
              ? item.kind
              : 'sheet') as 'sheet' | 'upload' | 'gen',
            label: item.label,
            createdAt: item.createdAt,
            ...(item.layer ? { layer: item.layer } : {}),
            ...(item.introVideoPath
              ? { introVideoPath: item.introVideoPath }
              : {})
          }))
        }))
      } else {
        void reload()
      }
    }
    window.addEventListener('idm:video-prep-done', onDone)
    return () => window.removeEventListener('idm:video-prep-done', onDone)
  }, [editingId, reload])

  const selectedPathsForIdentity = useMemo(() => {
    const ids =
      selectedImageIds.length > 0
        ? selectedImageIds
        : selectedImageId
          ? [selectedImageId]
          : []
    return ids
      .map((id) => form.gallery.find((g) => g.id === id)?.path)
      .filter((p): p is string => Boolean(p?.trim()))
  }, [selectedImageIds, selectedImageId, form.gallery])

  /** Open confirm modal, then generate on confirm. */
  const handleGeneratePlate = async (opts?: {
    useIdentityEdit?: boolean
    referenceImagePath?: string | null
  }): Promise<void> => {
    setActionError(null)
    try {
      const id = await ensureSavedId()
      if (!id) return
      if (propBusy(id)) {
        toast.info(t('common.loading'))
        return
      }
      const wantIdentity =
        opts?.useIdentityEdit !== undefined
          ? opts.useIdentityEdit === true
          : useIdentityRef
      const paths =
        opts?.referenceImagePath?.trim()
          ? [opts.referenceImagePath.trim()]
          : selectedPathsForIdentity
      const idRes = resolveIdentityPaths({
        useIdentityRef: wantIdentity,
        selectedPaths: paths
      })
      const profile = {
        name: form.name.trim() || 'Prop',
        description: form.description.trim() || form.name.trim() || 'Prop',
        material: form.material.trim() || undefined,
        sizeNotes: form.sizeNotes.trim() || undefined,
        condition: form.condition.trim() || undefined,
        visualTags: form.visualTags.trim() || undefined,
        hardRules: form.hardRules.trim() || undefined
      }
      let prompt = idRes.useEdit
        ? buildPropPlateEditPrompt(profile, plateVariant, form.artStyle)
        : buildPropPlateImagePrompt(profile, plateVariant, form.artStyle)
      if (idRes.paths.length > 1) {
        prompt = appendMultiRefNote(
          prompt,
          idRes.paths,
          getAiLocale(i18n.language)
        )
      }
      prompt = ensureHardRules(prompt, form.hardRules)
      const variantLabel = t(
        `props.${getPropPlateVariant(plateVariant).labelKey}`
      )
      const styleLabel = t(
        `characters.${getArtStyle(form.artStyle).labelKey}`
      )
      const modeLabel = idRes.useEdit
        ? t('common.imageGenConfirmModeIdentity')
        : t('common.imageGenConfirmModePure')
      setImageGenConfirm({
        prompt,
        referencePaths: idRes.paths,
        useIdentityEdit: idRes.useEdit,
        summary: `${t('props.plateVariant')}: ${variantLabel} · ${t('props.artStyle')}: ${styleLabel} · ${modeLabel}`
      })
    } catch (e) {
      const err = parseIpcError(e)
      const msg = `${err.message}${err.details ? ` — ${err.details}` : ''}`
      setActionError(msg)
      toast.error(msg)
    }
  }

  const runPropPlateJob = async (
    confirm: ImageGenConfirmPayload
  ): Promise<void> => {
    setImageGenConfirm(null)
    try {
      const id = await ensureSavedId()
      if (!id) return
      if (propBusy(id)) {
        toast.info(t('common.loading'))
        return
      }
      toast.info(t('aiJobs.startedBackground'))
      startJob({
        kind: 'prop-plate',
        label: t('props.generatePlate'),
        scope: { propId: id, storyId: activeStoryId ?? undefined },
        run: async ({ setProgress, signal }) => {
          setProgress(10, 'image')
          const r = await getApi().props.generatePlate({
            propId: id,
            variant: plateVariant,
            referenceImagePath: confirm.referencePaths[0] ?? null,
            referenceImagePaths: confirm.referencePaths,
            useIdentityEdit: confirm.useIdentityEdit,
            persist: false,
            artStyle: form.artStyle,
            promptOverride: confirm.prompt
          })
          if (signal.cancelled) {
            try {
              await getApi().media.discardSheetDraft(r.path)
            } catch {
              /* ignore */
            }
            return
          }
          setProgress(100, 'done')
          return {
            type: 'prop-plate' as const,
            propId: id,
            storyId: activeStoryId ?? '',
            path: r.path,
            variant: r.variant ?? plateVariant,
            label: r.label ?? plateVariant,
            enhance: r.enhance
          }
        }
      })
    } catch (e) {
      const err = parseIpcError(e)
      const msg = `${err.message}${err.details ? ` — ${err.details}` : ''}`
      setActionError(msg)
      toast.error(msg)
    }
  }

  const handlePickImage = async (): Promise<void> => {
    const result = await getApi().media.pickRefImage()
    if (!result) return
    const next = appendSceneGalleryItem(form.gallery, {
      path: result.filePath,
      kind: 'upload',
      label: t('common.uploadRef')
    })
    const newId = next[next.length - 1]?.id ?? null
    setForm((f) => ({
      ...f,
      gallery: next,
      coverPath: f.coverPath ?? next[0]?.path ?? null
    }))
    if (newId) {
      setSelectedImageId(newId)
      setSelectedImageIds((ids) =>
        ids.includes(newId) ? ids : [...ids, newId]
      )
    }
    toast.success(t('characters.externalRefAdded'))
  }

  const handleReorderGallery = (fromId: string, toId: string): void => {
    if (!fromId || !toId || fromId === toId) return
    setForm((f) => ({
      ...f,
      gallery: moveSceneGalleryItem(f.gallery, fromId, toId)
    }))
  }

  const handleSetCover = (path: string): void => {
    setForm((f) => ({ ...f, coverPath: path }))
    toast.success(t('common.coverSet'))
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-gradient-to-b from-ink-950 via-ink-950 to-ink-900">
      <PageHeader
        title={t('props.title')}
        subtitle={t('props.subtitle')}
        actions={<Button onClick={openCreate}>{t('props.new')}</Button>}
      />
      {!editorOpen && (
      <div className="relative min-h-0 flex-1 overflow-y-auto px-8 py-6">
        <LibraryPageBody
          footer={
            !loading && items.length > 0 ? (
              <LibraryPagination
                page={propBrowse.page}
                totalPages={propBrowse.totalPages}
                onPageChange={propBrowse.setPage}
                filteredCount={propBrowse.filteredCount}
                totalCount={propBrowse.totalCount}
              />
            ) : undefined
          }
        >
          {(error || actionError) && (
            <div className="mb-4 rounded-xl border border-rose-900/50 bg-rose-950/40 px-4 py-3 text-sm text-rose-100">
              {formatUserError(actionError || error?.message, t)}
            </div>
          )}
          {pageBanner && (
            <div className="mb-4 rounded-xl border border-brand-800/40 bg-brand-950/50 px-4 py-3 text-sm text-brand-100">
              {pageBanner}
              <button
                type="button"
                className="ml-3 text-xs text-brand-300 underline"
                onClick={() => setPageBanner(null)}
              >
                {t('common.dismissOk')}
              </button>
            </div>
          )}
          {loading ? (
            <p className="text-sm text-ink-400">{t('common.loading')}</p>
          ) : items.length === 0 ? (
            <div className="mx-auto max-w-md py-16 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-ink-800 text-2xl">
                📦
              </div>
              <p className="text-ink-300">{t('props.noProps')}</p>
              <div className="mt-6 flex justify-center">
                <Button onClick={openCreate}>{t('props.new')}</Button>
              </div>
            </div>
          ) : (
            <>
              <LibraryBrowseBar
                q={propBrowse.q}
                onQueryChange={propBrowse.setQ}
                placeholder={t('library.searchPlaceholder')}
                hasActiveFilters={propHasFilters}
                onClearFilters={clearPropFilters}
                filters={
                  <LibraryFilterSelect
                    label={t('library.filterImage')}
                    ariaLabel={t('library.filterImage')}
                    value={propImage}
                    onChange={setPropImage}
                    options={[
                      { value: '', label: t('library.filterAny') },
                      {
                        value: 'has',
                        label: t('library.filterHasImage')
                      },
                      {
                        value: 'none',
                        label: t('library.filterNoImage')
                      }
                    ]}
                  />
                }
              />
              {propBrowse.filteredCount === 0 ? (
                <EmptyState message={t('library.noMatch')} />
              ) : (
                <div className={libraryGridClass}>
                  {propBrowse.pageItems.map((p) => {
                    const g = galleryFromProp(p)
                    const cover =
                      primarySceneGalleryPath(g, p.refImagePath) ??
                      p.refImagePath
                    const count = g.length
                    return (
                      <article key={p.id} className={libraryCardClass}>
                        <div className={libraryMediaClass}>
                          {cover ? (
                            <LocalMediaImage
                              filePath={cover}
                              alt={p.name}
                              variant="fill"
                              maxHeightClass="h-full max-h-none"
                              objectFit="cover"
                              className="h-full border-0 rounded-none"
                              actionsLayout="overlay"
                              onImageClick={() => openEdit(p)}
                            />
                          ) : (
                            <button
                              type="button"
                              className="flex h-full w-full flex-col items-center justify-center gap-2 text-ink-600"
                              onClick={() => openEdit(p)}
                            >
                              <span className="text-3xl opacity-40">📦</span>
                              <span className="text-xs">
                                {t('props.noPhotos')}
                              </span>
                            </button>
                          )}
                          {count > 0 && (
                            <span className={libraryMediaBadgeClass}>
                              {count} {t('characters.photos')}
                            </span>
                          )}
                        </div>
                        <div className={libraryBodyClass}>
                          <h2 className="truncate text-base font-semibold tracking-tight text-ink-50">
                            {p.name}
                          </h2>
                          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-400">
                            {p.description}
                          </p>
                          <div className="mt-3 flex min-h-[1.5rem] flex-wrap gap-1">
                            {p.material && (
                              <span className="rounded-full bg-ink-800 px-2 py-0.5 text-[10px] text-ink-400">
                                {p.material}
                              </span>
                            )}
                          </div>
                          <div className={libraryCardActionsRowClass}>
                            <Button
                              variant="secondary"
                              className={libraryCardActionBtnClass}
                              onClick={() => openEdit(p)}
                            >
                              {t('common.edit')}
                            </Button>
                            <Button
                              variant="ghost"
                              className={libraryCardActionDeleteClass}
                              onClick={() => {
                                void (async () => {
                                  const ok = await dialog.confirm({
                                    message: t('common.confirmDelete'),
                                    variant: 'danger'
                                  })
                                  if (ok) void removeWithFeedback(p.id)
                                })()
                              }}
                            >
                              {t('common.delete')}
                            </Button>
                          </div>
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </LibraryPageBody>
      </div>
      )}

      {editorOpen && (
        <EditorShell
          open={editorOpen}
          title={editingId ? t('common.edit') : t('props.new')}
          subtitle={
            form.name.trim() || t('props.editorHintShort')
          }
          onClose={closeEditor}
          onSave={() => void handleSave()}
          saveDisabled={!form.name.trim()}
          saveLabel={editorBusy ? t('common.saving') : t('common.save')}
          cancelLabel={t('common.cancel')}
          busy={editorBusy}
          tabs={[
            { id: 'profile', label: t('props.tabProfile') },
            { id: 'refs', label: t('props.tabRefs') }
          ]}
          activeTab={editorPanel}
          onTabChange={(id) => setEditorPanel(id as EditorPanel)}
          preview={
            <div className="flex h-full flex-col gap-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-400">
                {t('props.gallery')}
              </h3>
              <div className="rounded-xl border border-ink-800">
                {selectedImage ? (
                  <LocalMediaImage
                    filePath={selectedImage.path}
                    alt={translatePropGalleryLabel(selectedImage.label, t)}
                    maxHeightClass="max-h-[min(36vh,360px)] lg:max-h-[min(48vh,440px)]"
                    showMeta
                    className="border-0 rounded-xl"
                    actionsLayout="bar"
                    introVideoBusy={editorBusy}
                    introVideoPath={selectedImage.introVideoPath}
                    introVideoHasDraft={
                      Boolean(editingId) &&
                      hasVideoPrepDraft(
                        buildVideoPrepDraftKey(
                          'prop-intro',
                          { propId: editingId! },
                          selectedImage.path
                        )
                      )
                    }
                    onIntroVideo={
                      editingId
                        ? () => handleGenerateIntroVideo(selectedImage.path)
                        : undefined
                    }
                    isCover={form.coverPath === selectedImage.path}
                    onSetAsCover={() => handleSetCover(selectedImage.path)}
                    onRemove={() => {
                      const next = removeSceneGalleryItem(
                        form.gallery,
                        selectedImage.id
                      )
                      setForm((f) => ({
                        ...f,
                        gallery: next,
                        coverPath:
                          f.coverPath === selectedImage.path
                            ? primarySceneGalleryPath(next)
                            : isSceneGalleryCoverPath(next, f.coverPath)
                              ? f.coverPath
                              : primarySceneGalleryPath(next)
                      }))
                      setSelectedImageId(next[0]?.id ?? null)
                      setSelectedImageIds((ids) =>
                        ids.filter((x) => x !== selectedImage.id)
                      )
                    }}
                  />
                ) : (
                  <div className="flex h-32 flex-col items-center justify-center gap-2 px-3 text-xs text-ink-600">
                    <p>{t('props.noPhotos')}</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      <Button
                        disabled={editorBusy}
                        onClick={() => {
                          setEditorPanel('refs')
                          void handleGeneratePlate()
                        }}
                      >
                        {t('props.generatePlate')}
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={editorBusy}
                        onClick={() => {
                          setEditorPanel('refs')
                          void handlePickImage()
                        }}
                      >
                        {t('common.uploadRef')}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              {propLayerOptions.length > 1 ? (
                <div className="flex flex-wrap gap-1">
                  {propLayerOptions.map((layer) => (
                    <button
                      key={layer}
                      type="button"
                      className={[
                        'rounded-full px-2 py-0.5 text-[10px] font-medium',
                        propLayerFilter === layer
                          ? 'bg-brand-600 text-white'
                          : 'bg-ink-800 text-ink-400'
                      ].join(' ')}
                      onClick={() => setPropLayerFilter(layer)}
                    >
                      {layer === 'all' ? t('library.filterAny') : layer}
                    </button>
                  ))}
                </div>
              ) : null}
              <GalleryThumbStrip
                items={filteredPropGallery}
                selectedId={selectedImageId}
                selectedIds={selectedImageIds}
                multiSelect
                coverPath={form.coverPath}
                fallbackCoverPath={primarySceneGalleryPath(form.gallery)}
                onSelect={setSelectedImageId}
                onToggleSelect={(id) =>
                  setSelectedImageIds((ids) =>
                    toggleGallerySelection(ids, id)
                  )
                }
                onReorder={handleReorderGallery}
                labelOf={(g) => translatePropGalleryLabel(g.label, t)}
              />
            </div>
          }
        >
          {editorPanel === 'profile' && (
            <div className={editorFormClass}>
              {actionError && (
                <div className="rounded-xl border border-rose-900/50 bg-rose-950/40 px-3 py-2 text-sm text-rose-100">
                  {actionError}
                </div>
              )}
              <section className="rounded-xl border border-brand-800/35 bg-brand-950/20 p-4">
                <h3 className="text-sm font-semibold">{t('common.aiTitle')}</h3>
                <p className="mt-1 text-[11px] text-ink-500">
                  {t('common.aiHintWithImage')}
                </p>
                {(selectedImage?.path || form.coverPath) && (
                  <p className="mt-2 rounded-lg border border-brand-800/40 bg-brand-950/30 px-2.5 py-1.5 text-[11px] text-brand-100/90">
                    {t('common.aiUsingImage')}
                  </p>
                )}
                <Textarea
                  className="mt-2"
                  size="md"
                  value={aiIdea}
                  onChange={(e) => setAiIdea(e.target.value)}
                  placeholder={t('props.ideaPlaceholder')}
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button disabled={editorBusy} onClick={handleAiFill}>
                    {t('common.aiFill')}
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={editorBusy}
                    onClick={() => setPlotSuggestOpen(true)}
                  >
                    {t('props.suggestFromStory')}
                  </Button>
                </div>
              </section>
              <section className="space-y-3">
                <div>
                  <Label>{t('props.name')}</Label>
                  <Input
                    value={form.name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, name: e.target.value }))
                    }
                    placeholder={t('props.namePlaceholder')}
                  />
                </div>
                <div>
                  <Label>{t('props.description')}</Label>
                  <Textarea
                    size="lg"
                    value={form.description}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, description: e.target.value }))
                    }
                    placeholder={t('props.descriptionPlaceholder')}
                  />
                </div>
                <div>
                  <Label>{t('common.hardRules')}</Label>
                  <p className="mb-1.5 text-[11px] leading-relaxed text-ink-500">
                    {t('common.hardRulesHint')}
                  </p>
                  <Textarea
                    size="md"
                    value={form.hardRules}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, hardRules: e.target.value }))
                    }
                    placeholder={t('common.hardRulesPh')}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>{t('props.material')}</Label>
                    <Input
                      value={form.material}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, material: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <Label>{t('props.sizeNotes')}</Label>
                    <Input
                      value={form.sizeNotes}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, sizeNotes: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <Label>{t('props.condition')}</Label>
                    <Input
                      value={form.condition}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, condition: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <Label>{t('props.visualTags')}</Label>
                    <Input
                      value={form.visualTags}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, visualTags: e.target.value }))
                      }
                    />
                  </div>
                </div>
              </section>
            </div>
          )}

          {editorPanel === 'refs' && (
            <div className={editorFormClass}>
              {actionError && (
                <div className="rounded-xl border border-rose-900/50 bg-rose-950/40 px-3 py-2 text-sm text-rose-100">
                  {actionError}
                </div>
              )}
              <div>
                <h3 className="text-sm font-semibold text-ink-100">
                  {t('props.tabRefs')}
                </h3>
                <p className="mt-1 text-[11px] text-ink-500">
                  {t('props.plateHintShort')}
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <EditorField label={t('props.plateVariant')}>
                  <EditorSelect
                    value={plateVariant}
                    onChange={(e) =>
                      setPlateVariant(e.target.value as PropPlateVariantId)
                    }
                  >
                    {PROP_PLATE_VARIANTS.map((v) => (
                      <option key={v.id} value={v.id}>
                        {t(`props.${v.labelKey}`)}
                      </option>
                    ))}
                  </EditorSelect>
                </EditorField>
                <EditorField label={t('props.artStyle')}>
                  <EditorSelect
                    value={form.artStyle}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        artStyle: e.target.value as ArtStyleId
                      }))
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
              <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-ink-800 bg-ink-900/40 px-3 py-2.5">
                <input
                  type="checkbox"
                  className="mt-0.5 rounded border-ink-600"
                  checked={useIdentityRef}
                  onChange={(e) => setUseIdentityRef(e.target.checked)}
                />
                <span className="text-[12px] leading-snug text-ink-300">
                  <span className="font-medium text-ink-100">
                    {t('common.useIdentityRef')}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-ink-500">
                    {t('common.useIdentityRefHint')}
                  </span>
                </span>
              </label>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Button
                  className="sm:flex-1"
                  disabled={editorBusy}
                  onClick={() => void handleGeneratePlate()}
                >
                  {t('props.generatePlate')}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => void handlePickImage()}
                >
                  {t('common.uploadRef')}
                </Button>
              </div>
            </div>
          )}
        </EditorShell>
      )}

      {plotSuggestOpen && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-overlay/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPlotSuggestOpen(false)
          }}
        >
          <div className="w-full max-w-lg rounded-2xl border border-ink-700 bg-ink-900 p-5 shadow-theme-md">
            <h2 className="text-base font-semibold text-ink-50">
              {t('props.suggestFromStory')}
            </h2>
            <p className="mt-1 text-[12px] text-ink-400">
              {t('props.suggestPlotPickerHint')}
            </p>
            <div className="mt-4">
              <PlotContextPicker
                stories={stories}
                storyId={plotStoryId}
                segmentKey={plotSegmentKey}
                onStoryChange={(id) => {
                  setPlotStoryId(id)
                  setPlotSegmentKey('all')
                }}
                onSegmentChange={setPlotSegmentKey}
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setPlotSuggestOpen(false)}
              >
                {t('common.cancel')}
              </Button>
              <Button
                disabled={!plotStoryId || editorBusy}
                onClick={() => {
                  setPlotSuggestOpen(false)
                  const ideaBase =
                    plotSegmentKey && plotSegmentKey !== 'all'
                      ? t('props.suggestIdeaFromSegment', {
                          segment: plotSegmentKey
                        })
                      : t('props.suggestIdeaFromStory')
                  setAiIdea((prev) => prev.trim() || ideaBase)
                  // Run fill with story context
                  setTimeout(() => {
                    if (editorBusy) return
                    const idea = (
                      aiIdea.trim() || ideaBase
                    ).trim()
                    const snapshot = {
                      name: form.name.trim() || undefined,
                      description: form.description.trim() || undefined,
                      material: form.material.trim() || undefined,
                      sizeNotes: form.sizeNotes.trim() || undefined,
                      condition: form.condition.trim() || undefined,
                      visualTags: form.visualTags.trim() || undefined,
                      artStyle: form.artStyle || undefined
                    }
                    const hasDraft = Object.values(snapshot).some(
                      (v) => typeof v === 'string' && v.length > 0
                    )
                    toast.info(t('aiJobs.startedBackground'))
                    startJob({
                      kind: 'prop-ai-fill',
                      label: t('props.suggestFromStory'),
                      scope: {
                        propId: editingId ?? undefined,
                        storyId: plotStoryId
                      },
                      run: async ({ setProgress, signal }) => {
                        setProgress(20, 'llm')
                        const r = await getApi().props.aiFill({
                          idea,
                          storyId: plotStoryId,
                          locale: getAiLocale(i18n.language),
                          existingDraft: hasDraft ? snapshot : undefined
                        })
                        if (signal.cancelled) return
                        setProgress(100, 'done')
                        return {
                          type: 'prop-profile' as const,
                          propId: editingId,
                          storyId: plotStoryId,
                          profile: r.profile,
                          profileJson: r.profileJson,
                          isNew: !editingId
                        }
                      }
                    })
                  }, 0)
                }}
              >
                {t('common.aiFill')}
              </Button>
            </div>
          </div>
        </div>
      )}
      <ImageGenConfirmModal
        open={Boolean(imageGenConfirm)}
        payload={imageGenConfirm}
        busy={editorBusy}
        onCancel={() => setImageGenConfirm(null)}
        onConfirm={(p) => void runPropPlateJob(p)}
      />
    </div>
  )
}
