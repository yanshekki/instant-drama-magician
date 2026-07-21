import { useEffect, useMemo, useState } from 'react'
import { ensureHardRules } from '../../domain/promptHardRules'
import { useTranslation } from 'react-i18next'
import { getAiLocale } from '../../lib/aiLocale'
import { formatUserError } from '../lib/formatUserError'
import {
  appendActionGalleryItem,
  isActionGalleryCoverPath,
  moveActionGalleryItem,
  parseActionGallery,
  primaryActionGalleryPath,
  removeActionGalleryItem,
  serializeActionGallery,
  type ActionGalleryItem
} from '../../domain/actionGallery'
import {
  parseActionCastRefs,
  serializeActionCastRefs,
  type ActionCastRef
} from '../../domain/actionCastRefs'
import {
  ACTION_PANEL_LAYOUTS,
  coerceActionPanelLayout,
  getActionPanelLayout,
  type ActionPanelLayoutId
} from '../../domain/actionPlateVariants'
import {
  artStylesByGroup,
  DEFAULT_ART_STYLE,
  getArtStyle,
  isArtStyleId,
  type ArtStyleId
} from '../../domain/characterArtStyles'
import {
  appendMultiRefNote,
  resolveIdentityPaths,
  toggleGallerySelection
} from '../../domain/imageGenConfirm'
import {
  buildActionPlateEditPrompt,
  buildActionPlateImagePrompt
} from '../../domain/actionMasterPrompt'
import {
  ImageGenConfirmModal,
  type ImageGenConfirmPayload
} from '../components/ImageGenConfirmModal'
import { buildVideoPrepDraftKey } from '../../domain/videoPrep'
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
import { useLibraryBrowse } from '../hooks/useLibraryBrowse'
import { compareUpdatedAtDesc } from '../lib/librarySort'
import { getApi } from '../../lib/api'
import { parseIpcError } from '../../lib/ipc'
import type { Action } from '../../types/domain'
import { useApp } from '../context/AppContext'
import { useToast } from '../context/ToastContext'
import { useDialog } from '../context/DialogContext'
import { useAiJobs } from '../context/AiJobsContext'
import { useActions } from '../hooks/useActions'
import { LocalMediaImage } from '../components/LocalMediaImage'
import { GalleryThumbStrip } from '../components/GalleryThumbStrip'
import { translateActionGalleryLabel } from '../../domain/galleryLabelI18n'
import { ActionCastRefPicker } from '../components/ActionCastRefPicker'
import {
  EditorField,
  EditorSelect,
  EditorShell,
  editorFormClass
} from '../components/EditorShell'
import { PageHeader } from '../components/PageHeader'
import { Button, EmptyState, Input, Textarea } from '../components/ui'

type EditorPanel = 'profile' | 'refs'

interface FormState {
  name: string
  description: string
  hardRules: string
  motionNotes: string
  intention: string
  cameraNotes: string
  visualTags: string
  panelLayout: ActionPanelLayoutId
  artStyle: ArtStyleId
  gallery: ActionGalleryItem[]
  coverPath: string | null
  castRefs: ActionCastRef[]
}

const emptyForm = (): FormState => ({
  name: '',
  description: '',
  hardRules: '',
  motionNotes: '',
  intention: '',
  cameraNotes: '',
  visualTags: '',
  panelLayout: 'grid-2x2',
  artStyle: DEFAULT_ART_STYLE,
  gallery: [],
  coverPath: null,
  castRefs: []
})

function formFromAction(a: Action): FormState {
  const gallery = parseActionGallery(a.refGalleryJson, {
    refImagePath: a.refImagePath
  })
  return {
    name: a.name,
    description: a.description || '',
    hardRules: a.hardRules || '',
    motionNotes: a.motionNotes || '',
    intention: a.intention || '',
    cameraNotes: a.cameraNotes || '',
    visualTags: a.visualTags || '',
    panelLayout: coerceActionPanelLayout(a.panelLayout),
    artStyle: isArtStyleId(a.artStyle) ? a.artStyle : DEFAULT_ART_STYLE,
    gallery,
    coverPath: a.refImagePath || primaryActionGalleryPath(gallery),
    castRefs: parseActionCastRefs(a.castRefsJson)
  }
}

export function ActionsPage(): JSX.Element {
  const { t, i18n } = useTranslation()
  const { activeStoryId } = useApp()
  const toast = useToast()
  const dialog = useDialog()
  const {
    startJob,
    isBlocked,
    activeJobs,
    startVideoPrep,
    hasVideoPrepDraft,
    continueVideoPrepDraft,
    onActionProfileApply,
    onActionPlateCommitted
  } = useAiJobs()
  const { items, loading, error, update, remove, reload } =
    useActions(activeStoryId)

  const actionBusy = (actionId?: string | null): boolean =>
    isBlocked({
      kind: ['action-ai-fill', 'action-plate', 'action-intro-video'],
      ...(actionId ? { actionId } : {})
    }) ||
    activeJobs.some(
      (j) =>
        (j.kind === 'action-ai-fill' ||
          j.kind === 'action-plate' ||
          j.kind === 'action-intro-video') &&
        (!actionId || j.scope.actionId === actionId)
    )

  const [editorOpen, setEditorOpen] = useState(false)
  const [editorPanel, setEditorPanel] = useState<EditorPanel>('profile')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [aiIdea, setAiIdea] = useState('')
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null)
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([])
  const [useIdentityRef, setUseIdentityRef] = useState(false)
  const [imageGenConfirm, setImageGenConfirm] =
    useState<ImageGenConfirmPayload | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)


  const browse = useLibraryBrowse(
    items,
    (a) =>
      [
        a.name,
        a.description,
        a.motionNotes ?? '',
        a.intention ?? '',
        a.visualTags ?? ''
      ].join(' '),
    { sort: compareUpdatedAtDesc }
  )

  const selectedImage =
    form.gallery.find((g) => g.id === selectedImageId) ??
    form.gallery[0] ??
    null

  useEffect(() => {
    if (!selectedImageId && form.gallery[0]) {
      setSelectedImageId(form.gallery[0].id)
    }
  }, [form.gallery, selectedImageId])

  useEffect(() => {
    const onDone = (ev: Event): void => {
      const d = (ev as CustomEvent).detail as {
        kind?: string
        entityIds?: { actionId?: string }
        gallery?: ActionGalleryItem[]
      }
      if (d?.kind !== 'action-intro') return
      if (!editingId || d.entityIds?.actionId !== editingId) return
      if (d.gallery?.length) {
        setForm((f) => ({
          ...f,
          gallery: d.gallery as ActionGalleryItem[]
        }))
      } else {
        void reload()
      }
    }
    window.addEventListener('idm:video-prep-done', onDone)
    return () => window.removeEventListener('idm:video-prep-done', onDone)
  }, [editingId, reload])

  useEffect(() => {
    return onActionProfileApply((draft) => {
      if (draft.actionId && editingId && draft.actionId !== editingId) {
        void reload()
        return
      }
      const p = draft.profile
      setForm((f) => ({
        ...f,
        name: p.name || f.name,
        description: p.description || f.description,
        motionNotes: p.motionNotes ?? f.motionNotes,
        intention: p.intention ?? f.intention,
        cameraNotes: p.cameraNotes ?? f.cameraNotes,
        visualTags:
          typeof p.visualTags === 'string' && p.visualTags.trim()
            ? p.visualTags.trim()
            : f.visualTags,
        hardRules:
          typeof (p as { hardRules?: string }).hardRules === 'string' &&
          (p as { hardRules?: string }).hardRules!.trim()
            ? (p as { hardRules: string }).hardRules.trim()
            : f.hardRules,
        artStyle: isArtStyleId(p.artStyle) ? p.artStyle : f.artStyle
      }))
      if (draft.actionId) setEditingId(draft.actionId)
      setEditorOpen(true)
      toast.success(t('actions.aiFillOk'))
      void reload()
    })
  }, [onActionProfileApply, editingId, reload, t, toast])

  useEffect(() => {
    return onActionPlateCommitted(({ actionId, path, gallery }) => {
      if (editingId === actionId) {
        if (gallery && gallery.length > 0) {
          const g = gallery as ActionGalleryItem[]
          // Append result is full gallery from server — keep existing cover if still present
          setForm((f) => ({
            ...f,
            gallery: g,
            coverPath: isActionGalleryCoverPath(g, f.coverPath)
              ? f.coverPath
              : primaryActionGalleryPath(g)
          }))
          // Select the newly committed still (multi-gallery accumulate)
          const newest =
            g.find((item) => item.path === path) ?? g[g.length - 1] ?? null
          setSelectedImageId(newest?.id ?? null)
          setEditorPanel('refs')
        } else {
          void reload()
        }
      }
      void reload()
      toast.success(t('actions.generatePlateOk'))
    })
  }, [onActionPlateCommitted, editingId, reload, t, toast])

  const openNew = (): void => {
    setEditingId(null)
    setForm(emptyForm())
    setAiIdea('')
    setActionError(null)
    setUseIdentityRef(false)
    setEditorPanel('profile')
    setSelectedImageId(null)
    setEditorOpen(true)
  }

  const openEdit = (a: Action): void => {
    const next = formFromAction(a)
    setEditingId(a.id)
    setForm(next)
    setAiIdea('')
    setActionError(null)
    setEditorPanel(next.gallery.length > 0 ? 'refs' : 'profile')
    setSelectedImageId(null)
    setEditorOpen(true)
  }

  const closeEditor = (): void => {
    setEditorOpen(false)
    setEditingId(null)
    setForm(emptyForm())
    setActionError(null)
  }

  const persistPayload = () => ({
    name: form.name.trim(),
    description: form.description.trim(),
    motionNotes: form.motionNotes.trim() || null,
    intention: form.intention.trim() || null,
    cameraNotes: form.cameraNotes.trim() || null,
    visualTags: form.visualTags.trim() || null,
    hardRules: form.hardRules.trim() || null,
    panelLayout: form.panelLayout,
    artStyle: form.artStyle,
    refImagePath: form.coverPath,
    refGalleryJson: serializeActionGallery(form.gallery),
    castRefsJson: serializeActionCastRefs(form.castRefs)
  })

  const ensureSavedId = async (): Promise<string | null> => {
    if (editingId) {
      const ok = await update(editingId, persistPayload())
      if (!ok) {
        toast.error(t('common.actionFailed'))
        return null
      }
      return editingId
    }
    if (!form.name.trim()) {
      const msg = t('actions.saveFirst')
      setActionError(msg)
      toast.error(msg)
      return null
    }
    try {
      const row = (await getApi().actions.create({
        ...persistPayload(),
        linkStoryId: activeStoryId ?? undefined
      })) as Action
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

  const handleSave = async (): Promise<void> => {
    if (!form.name.trim()) {
      toast.error(t('actions.nameRequired'))
      return
    }
    setActionError(null)
    try {
      if (editingId) {
        const ok = await update(editingId, persistPayload())
        if (ok) {
          toast.success(t('common.saved'))
          await reload()
          closeEditor()
        } else {
          toast.error(t('common.actionFailed'))
        }
        return
      }
      await getApi().actions.create({
        ...persistPayload(),
        linkStoryId: activeStoryId ?? undefined
      })
      await reload()
      toast.success(t('common.saved'))
      closeEditor()
    } catch (e) {
      const msg = parseIpcError(e).message
      setActionError(msg)
      toast.error(msg)
    }
  }

  const handleAiFill = (): void => {
    if (actionBusy(editingId)) {
      toast.info(t('common.loading'))
      return
    }
    const idea = aiIdea.trim()
    const snapshot = {
      name: form.name.trim() || undefined,
      description: form.description.trim() || undefined,
      motionNotes: form.motionNotes.trim() || undefined,
      intention: form.intention.trim() || undefined,
      cameraNotes: form.cameraNotes.trim() || undefined,
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
      form.castRefs[0]?.imagePath?.trim() ||
      ''
    const hasImage = Boolean(refPath)
    if (!idea && !hasDraft && !hasImage) {
      setActionError(t('common.aiNeedIdeaOrImage'))
      toast.error(t('common.aiNeedIdeaOrImage'))
      return
    }
    setActionError(null)
    toast.info(
      hasImage && !idea && !hasDraft
        ? t('common.aiFillFromImage')
        : t('aiJobs.startedBackground')
    )
    startJob({
      kind: 'action-ai-fill',
      label: t('common.aiFill'),
      scope: {
        actionId: editingId ?? undefined,
        storyId: activeStoryId ?? undefined
      },
      run: async ({ setProgress, signal }) => {
        setProgress(20, hasImage ? 'image' : 'llm')
        const r = await getApi().actions.aiFill({
          idea: idea || undefined,
          storyId: activeStoryId ?? undefined,
          locale: getAiLocale(i18n.language),
          existingDraft: hasDraft ? snapshot : undefined,
          referenceImagePath: hasImage ? refPath : null
        })
        if (signal.cancelled) return
        setProgress(100, 'done')
        return {
          type: 'action-profile' as const,
          actionId: editingId,
          storyId: activeStoryId,
          profile: r.profile as {
            name: string
            description: string
            motionNotes?: string
            intention?: string
            cameraNotes?: string
            visualTags?: string
            artStyle?: string
          },
          profileJson: r.profileJson,
          isNew: !editingId
        }
      }
    })
  }

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

  const handleGeneratePlate = async (opts?: {
    referenceImagePath?: string | null
    useIdentityEdit?: boolean
  }): Promise<void> => {
    setActionError(null)
    try {
      const id = await ensureSavedId()
      if (!id) return
      if (actionBusy(id)) {
        toast.info(t('common.loading'))
        return
      }
      const wantIdentity =
        opts?.useIdentityEdit !== undefined
          ? opts.useIdentityEdit === true
          : useIdentityRef
      // Gallery multi-select (指示圖庫) + cast stills (參考素材：角色／戲服／場景／道具)
      const galleryPaths = opts?.referenceImagePath?.trim()
        ? [opts.referenceImagePath.trim()]
        : selectedPathsForIdentity
      const castPaths = form.castRefs
        .map((r) => r.imagePath?.trim())
        .filter((p): p is string => Boolean(p))
      const mergedPaths: string[] = []
      for (const p of [...galleryPaths, ...castPaths]) {
        if (p && !mergedPaths.includes(p)) mergedPaths.push(p)
      }
      // Identity lock: any gallery or cast still enables edit + shows in confirm.
      // Pure generate: still pass cast into text prompt via buildActionPlateImagePrompt.
      const idRes = resolveIdentityPaths({
        useIdentityRef: wantIdentity,
        selectedPaths: mergedPaths
      })
      const profile = {
        name: form.name.trim() || 'Action',
        description: form.description.trim() || form.name.trim() || 'Action',
        motionNotes: form.motionNotes.trim() || undefined,
        intention: form.intention.trim() || undefined,
        cameraNotes: form.cameraNotes.trim() || undefined,
        visualTags: form.visualTags.trim() || undefined,
        hardRules: form.hardRules.trim() || undefined
      }
      let prompt = idRes.useEdit
        ? buildActionPlateEditPrompt(profile, form.panelLayout, form.artStyle)
        : buildActionPlateImagePrompt(
            profile,
            form.panelLayout,
            form.artStyle,
            form.castRefs
          )
      if (idRes.paths.length > 1) {
        prompt = appendMultiRefNote(
          prompt,
          idRes.paths,
          getAiLocale(i18n.language)
        )
      }
      prompt = ensureHardRules(prompt, form.hardRules)
      // When editing from gallery only, still remind cast identities in prompt text
      if (idRes.useEdit && castPaths.length > 0) {
        const castNote =
          getAiLocale(i18n.language) === 'en'
            ? `Cast identity stills (${castPaths.length}): match face/body of attached cast references in every panel.`
            : `已附 ${castPaths.length} 張參考素材（角色／道具等）：每格人物身份須與參考素材一致。`
        if (!prompt.includes(castNote)) {
          prompt = `${prompt}\n\n${castNote}`
        }
      }
      const layoutLabel = t(
        `actions.${getActionPanelLayout(form.panelLayout).labelKey}`
      )
      const styleLabel = t(
        `characters.${getArtStyle(form.artStyle).labelKey}`
      )
      const modeLabel = idRes.useEdit
        ? t('common.imageGenConfirmModeIdentity')
        : t('common.imageGenConfirmModePure')
      const castHint =
        castPaths.length > 0
          ? ` · ${t('actions.castRefsCount', { count: castPaths.length })}`
          : ''
      setImageGenConfirm({
        prompt,
        // Always surface cast stills in confirm thumbs when present, even if
        // identity lock is off (pure gen still benefits from visual context).
        referencePaths:
          idRes.paths.length > 0
            ? idRes.paths
            : wantIdentity
              ? mergedPaths
              : castPaths,
        useIdentityEdit: idRes.useEdit,
        summary: `${t('actions.panelLayout')}: ${layoutLabel} · ${t('characters.artStyle')}: ${styleLabel} · ${modeLabel}${castHint}`
      })
    } catch (e) {
      const err = parseIpcError(e)
      const msg = `${err.message}${err.details ? ` — ${err.details}` : ''}`
      setActionError(msg)
      toast.error(msg)
    }
  }

  const runActionPlateJob = async (
    confirm: ImageGenConfirmPayload
  ): Promise<void> => {
    setImageGenConfirm(null)
    try {
      const id = await ensureSavedId()
      if (!id) return
      if (actionBusy(id)) {
        toast.info(t('common.loading'))
        return
      }
      toast.info(t('aiJobs.startedBackground'))
      startJob({
        kind: 'action-plate',
        label: t('actions.generatePlate'),
        scope: { actionId: id, storyId: activeStoryId ?? undefined },
        run: async ({ setProgress, signal }) => {
          setProgress(10, 'image')
          const r = await getApi().actions.generatePlate({
            actionId: id,
            panelLayout: form.panelLayout,
            artStyle: form.artStyle,
            persist: false,
            referenceImagePath: confirm.referencePaths[0] ?? null,
            referenceImagePaths: confirm.referencePaths,
            useIdentityEdit: confirm.useIdentityEdit,
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
            type: 'action-plate' as const,
            actionId: id,
            storyId: activeStoryId ?? '',
            path: r.path,
            panelLayout: r.panelLayout ?? form.panelLayout,
            label: r.label ?? t('actions.generatePlate'),
            enhance: (r as { enhance?: unknown }).enhance
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

  /** Append a local still into the unified gallery list. */
  const handlePickExternalRef = async (): Promise<void> => {
    const result = await getApi().media.pickRefImage()
    if (!result) return
    const next = appendActionGalleryItem(form.gallery, {
      path: result.filePath,
      kind: 'upload',
      label: t('common.uploadRef')
    })
    const added = next[next.length - 1]
    setForm((f) => ({
      ...f,
      gallery: next,
      // First still becomes cover; later uploads keep existing cover
      coverPath: f.coverPath ?? added?.path ?? null
    }))
    setSelectedImageId(added?.id ?? null)
    toast.success(t('characters.externalRefAdded'))
  }

  const handleRemoveSelectedImage = (): void => {
    if (!selectedImage) return
    const removedId = selectedImage.id
    const removedPath = selectedImage.path
    setForm((f) => {
      const next = removeActionGalleryItem(f.gallery, removedId)
      const coverPath =
        f.coverPath === removedPath
          ? primaryActionGalleryPath(next)
          : f.coverPath
      return { ...f, gallery: next, coverPath }
    })
    setSelectedImageIds((ids) => ids.filter((x) => x !== removedId))
    setSelectedImageId((cur) => {
      if (cur !== removedId) return cur
      // Prefer neighbor after removal
      const idx = form.gallery.findIndex((g) => g.id === removedId)
      const remaining = form.gallery.filter((g) => g.id !== removedId)
      return (
        remaining[Math.min(idx, remaining.length - 1)]?.id ??
        remaining[0]?.id ??
        null
      )
    })
  }

  const handleIntroVideo = (sourcePath: string): void => {
    void (async () => {
      const id = await ensureSavedId()
      if (!id) return
      if (actionBusy(id)) {
        toast.info(t('common.loading'))
        return
      }
      const key = buildVideoPrepDraftKey(
        'action-intro',
        { actionId: id },
        sourcePath
      )
      if (hasVideoPrepDraft(key)) {
        continueVideoPrepDraft(key)
        return
      }
      startVideoPrep({
        kind: 'action-intro',
        entityIds: { actionId: id },
        sourceImagePath: sourcePath,
        durationSeconds: 10,
        locale: getAiLocale(i18n.language)
      })
    })()
  }

  const handleDelete = async (a: Action): Promise<void> => {
    const ok = await dialog.confirm({
      message: t('actions.confirmDelete', { name: a.name }),
      variant: 'danger',
      confirmLabel: t('common.delete')
    })
    if (!ok) return
    if (await remove(a.id)) {
      toast.success(t('common.deleted'))
      if (editingId === a.id) closeEditor()
    }
  }

  const handleReorderGallery = (fromId: string, toId: string): void => {
    setForm((f) => ({
      ...f,
      gallery: moveActionGalleryItem(f.gallery, fromId, toId)
    }))
  }

  const artGroups = useMemo(() => artStylesByGroup(), [])
  const panelLayoutDef = useMemo(
    () => getActionPanelLayout(form.panelLayout),
    [form.panelLayout]
  )

  const editorBusy = actionBusy(editingId)

  return (
    <div className="flex h-full flex-col overflow-hidden bg-gradient-to-b from-ink-950 via-ink-950 to-ink-900">
      <PageHeader
        title={t('actions.title')}
        subtitle={t('actions.subtitle')}
        actions={<Button onClick={openNew}>{t('actions.new')}</Button>}
      />
      {!editorOpen && (
        <div className="relative min-h-0 flex-1 overflow-y-auto px-8 py-6">
          <LibraryPageBody
            footer={
              !loading && items.length > 0 ? (
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
                {error.message}
              </div>
            )}
            {loading ? (
              <p className="text-sm text-ink-400">{t('common.loading')}</p>
            ) : items.length === 0 ? (
              <div className="mx-auto max-w-md py-16 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-ink-800 text-2xl">
                  🎬
                </div>
                <p className="text-ink-300">{t('actions.empty')}</p>
                <div className="mt-6 flex justify-center">
                  <Button onClick={openNew}>{t('actions.new')}</Button>
                </div>
              </div>
            ) : (
              <>
                <LibraryBrowseBar
                  q={browse.q}
                  onQueryChange={browse.setQ}
                  placeholder={t('library.searchPlaceholder')}
                  hasActiveFilters={browse.hasSearch}
                  onClearFilters={() => browse.setQ('')}
                />
                {browse.filteredCount === 0 ? (
                  <EmptyState message={t('library.noMatch')} />
                ) : (
                  <div className={libraryGridClass}>
                    {browse.pageItems.map((a) => {
                      const g = parseActionGallery(a.refGalleryJson, {
                        refImagePath: a.refImagePath
                      })
                      const cover =
                        primaryActionGalleryPath(g, a.refImagePath) ??
                        a.refImagePath
                      const count = g.length
                      return (
                        <article key={a.id} className={libraryCardClass}>
                          <div className={libraryMediaClass}>
                            {cover ? (
                              <LocalMediaImage
                                filePath={cover}
                                alt={a.name}
                                variant="fill"
                                maxHeightClass="h-full max-h-none"
                                objectFit="cover"
                                className="h-full border-0 rounded-none"
                                actionsLayout="overlay"
                                showActions
                                enableZoom
                                onImageClick={() => openEdit(a)}
                              />
                            ) : (
                              <button
                                type="button"
                                className="flex h-full w-full flex-col items-center justify-center gap-2 text-ink-600"
                                onClick={() => openEdit(a)}
                              >
                                <span className="text-3xl opacity-40">🎬</span>
                                <span className="text-xs">
                                  {t('actions.noPhotos')}
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
                              {a.name}
                            </h2>
                            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-400">
                              {a.description || t('actions.noDescription')}
                            </p>
                            <div className="mt-3 flex min-h-[1.5rem] flex-wrap gap-1">
                              {a.motionNotes ? (
                                <span className="rounded-full bg-ink-800 px-2 py-0.5 text-[10px] text-ink-400">
                                  {a.motionNotes.slice(0, 24)}
                                  {a.motionNotes.length > 24 ? '…' : ''}
                                </span>
                              ) : null}
                            </div>
                            <div className={libraryCardActionsRowClass}>
                              <Button
                                variant="secondary"
                                className={libraryCardActionBtnClass}
                                onClick={() => openEdit(a)}
                              >
                                {t('common.edit')}
                              </Button>
                              <Button
                                variant="ghost"
                                className={libraryCardActionDeleteClass}
                                onClick={() => void handleDelete(a)}
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

      <EditorShell
        open={editorOpen}
        title={editingId ? t('common.edit') : t('actions.new')}
        subtitle={form.name.trim() || t('actions.editorHint')}
        onClose={closeEditor}
        onSave={() => void handleSave()}
        saveDisabled={!form.name.trim() || editorBusy}
        saveLabel={editorBusy ? t('common.saving') : t('common.save')}
        cancelLabel={t('common.cancel')}
        busy={editorBusy}
        tabs={[
          { id: 'profile', label: t('actions.tabProfile') },
          { id: 'refs', label: t('actions.tabRefs') }
        ]}
        activeTab={editorPanel}
        onTabChange={(id) => setEditorPanel(id as EditorPanel)}
        preview={
          <div className="flex h-full flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-400">
                {t('actions.gallery')}
              </h3>
              {form.gallery.length > 0 ? (
                <span className="text-[11px] text-ink-500">
                  {form.gallery.length}
                </span>
              ) : null}
            </div>
            <div className="rounded-xl border border-ink-800 bg-ink-900/60">
              {selectedImage ? (
                <LocalMediaImage
                  filePath={selectedImage.path}
                  alt={selectedImage.label}
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
                        'action-intro',
                        { actionId: editingId! },
                        selectedImage.path
                      )
                    )
                  }
                  onIntroVideo={
                    editingId
                      ? () => handleIntroVideo(selectedImage.path)
                      : undefined
                  }
                  isCover={form.coverPath === selectedImage.path}
                  onSetAsCover={() =>
                    setForm((f) => ({
                      ...f,
                      coverPath: selectedImage.path
                    }))
                  }
                  onRemove={handleRemoveSelectedImage}
                />
              ) : (
                <div className="flex h-48 flex-col items-center justify-center gap-2 px-4 text-center text-ink-500">
                  <span className="text-3xl opacity-30">🎬</span>
                  <p className="text-xs">{t('actions.noPhotos')}</p>
                  <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
                    <Button
                      variant="secondary"
                      disabled={editorBusy}
                      onClick={() => void handlePickExternalRef()}
                    >
                      {t('common.uploadRef')}
                    </Button>
                    <Button
                      disabled={editorBusy}
                      onClick={() => {
                        setEditorPanel('refs')
                        void handleGeneratePlate()
                      }}
                    >
                      {t('actions.generatePlate')}
                    </Button>
                  </div>
                </div>
              )}
            </div>
            {form.gallery.length > 0 ? (
              <GalleryThumbStrip
                items={form.gallery}
                selectedId={selectedImageId}
                selectedIds={selectedImageIds}
                multiSelect
                coverPath={form.coverPath}
                fallbackCoverPath={primaryActionGalleryPath(form.gallery)}
                onSelect={setSelectedImageId}
                onToggleSelect={(id) =>
                  setSelectedImageIds((ids) =>
                    toggleGallerySelection(ids, id)
                  )
                }
                onReorder={handleReorderGallery}
                labelOf={(g) => translateActionGalleryLabel(g.label, t)}
              />
            ) : null}
            <p className="text-[11px] text-ink-500">
              {t('common.galleryReorderHint')}
            </p>
          </div>
        }
      >
        {editorPanel === 'profile' && (
          <div className={editorFormClass}>
            {actionError && (
              <div className="rounded-xl border border-rose-900/50 bg-rose-950/40 px-3 py-2 text-sm text-rose-100">
                {formatUserError(actionError, t)}
              </div>
            )}
            <section className="rounded-xl border border-brand-800/35 bg-gradient-to-br from-brand-950/40 via-ink-900/50 to-ink-950 p-4">
              <h3 className="text-sm font-semibold text-brand-100">
                {t('common.aiFill')}
              </h3>
              <p className="mt-1 text-[11px] text-ink-400">
                {t('common.aiHintWithImage')}
              </p>
              {(selectedImage?.path || form.coverPath) && (
                <p className="mt-2 rounded-lg border border-brand-800/40 bg-brand-950/30 px-2.5 py-1.5 text-[11px] text-brand-100/90">
                  {t('common.aiUsingImage')}
                </p>
              )}
              <Textarea
                className="mt-3"
                value={aiIdea}
                onChange={(e) => setAiIdea(e.target.value)}
                placeholder={t('actions.aiIdeaPh')}
                rows={3}
              />
              <Button
                className="mt-2"
                disabled={editorBusy}
                onClick={() => handleAiFill()}
              >
                {t('common.aiFill')}
              </Button>
            </section>

            <EditorField label={t('actions.name')}>
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </EditorField>
            <EditorField label={t('actions.description')}>
              <Textarea
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                rows={3}
              />
            </EditorField>
            <EditorField
              label={t('common.hardRules')}
              hint={t('common.hardRulesHint')}
            >
              <Textarea
                value={form.hardRules}
                onChange={(e) =>
                  setForm((f) => ({ ...f, hardRules: e.target.value }))
                }
                rows={4}
                placeholder={t('common.hardRulesPh')}
              />
            </EditorField>
            <EditorField label={t('actions.motionNotes')}>
              <Textarea
                value={form.motionNotes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, motionNotes: e.target.value }))
                }
                rows={2}
              />
            </EditorField>
            <EditorField label={t('actions.intention')}>
              <Textarea
                value={form.intention}
                onChange={(e) =>
                  setForm((f) => ({ ...f, intention: e.target.value }))
                }
                rows={2}
              />
            </EditorField>
            <EditorField label={t('actions.cameraNotes')}>
              <Textarea
                value={form.cameraNotes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, cameraNotes: e.target.value }))
                }
                rows={2}
              />
            </EditorField>
            <EditorField label={t('actions.visualTags')}>
              <Input
                value={form.visualTags}
                onChange={(e) =>
                  setForm((f) => ({ ...f, visualTags: e.target.value }))
                }
              />
            </EditorField>
          </div>
        )}

        {editorPanel === 'refs' && (
          <div className={editorFormClass}>
            {actionError && (
              <div className="rounded-xl border border-rose-900/50 bg-rose-950/40 px-3 py-2 text-sm text-rose-100">
                {formatUserError(actionError, t)}
              </div>
            )}
            <div>
              <h3 className="text-sm font-semibold text-ink-100">
                {t('actions.tabRefs')}
              </h3>
              <p className="mt-1 text-[11px] text-ink-500">
                {t('actions.plateHintShort')}
              </p>
            </div>
            {/* 出圖方案 + 藝術風格 — same row pattern as props/characters */}
            <div className="grid gap-4 sm:grid-cols-2">
              <EditorField label={t('actions.plateVariant')}>
                <EditorSelect
                  value={form.panelLayout}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      panelLayout: coerceActionPanelLayout(e.target.value)
                    }))
                  }
                >
                  {ACTION_PANEL_LAYOUTS.map((l) => (
                    <option key={l.id} value={l.id}>
                      {t(`actions.${l.labelKey}`)}
                    </option>
                  ))}
                </EditorSelect>
                <p className="mt-1.5 text-[11px] leading-snug text-ink-500">
                  {t('actions.panelOrderHint', {
                    count: panelLayoutDef.panelCount,
                    beats: panelLayoutDef.beatLabels.join(' → ')
                  })}
                </p>
              </EditorField>
              <EditorField label={t('characters.artStyle')}>
                <EditorSelect
                  value={form.artStyle}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      artStyle: isArtStyleId(e.target.value)
                        ? e.target.value
                        : DEFAULT_ART_STYLE
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
            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-ink-800 bg-ink-950/40 px-3 py-2.5">
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
            <ActionCastRefPicker
              value={form.castRefs}
              disabled={editorBusy}
              onChange={(castRefs) => setForm((f) => ({ ...f, castRefs }))}
            />
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button
                className="sm:flex-1"
                disabled={editorBusy}
                onClick={() => void handleGeneratePlate()}
              >
                {t('actions.generatePlate')}
              </Button>
              <Button
                variant="secondary"
                disabled={editorBusy}
                onClick={() => void handlePickExternalRef()}
              >
                {t('common.uploadRef')}
              </Button>
            </div>
          </div>
        )}
      </EditorShell>
      <ImageGenConfirmModal
        open={Boolean(imageGenConfirm)}
        payload={imageGenConfirm}
        busy={editorBusy}
        onCancel={() => setImageGenConfirm(null)}
        onConfirm={(p) => void runActionPlateJob(p)}
      />
    </div>
  )
}
