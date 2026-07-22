// @ts-nocheck — residual pure-helper typings; covered by page unit tests
import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction
} from 'react'
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
import { toggleGallerySelection } from '../../domain/imageGenConfirm'
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
import { EntityGalleryPanel } from '../components/EntityGalleryPanel'
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
    artStyle: actionsArtStyleOrDefault(a.artStyle),
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
    startMediaGen,
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
      actionsHandleVideoPrepDone(
        (ev as CustomEvent).detail,
        editingId,
        setForm,
        reload
      )
    }
    window.addEventListener('idm:video-prep-done', onDone)
    return () => window.removeEventListener('idm:video-prep-done', onDone)
  }, [editingId, reload])

  useEffect(() => {
    return onActionProfileApply((draft) => {
      actionsHandleProfileApply(draft, editingId, {
        reload,
        setForm,
        setEditingId,
        setEditorOpen,
        toastSuccess: () => toast.success(t('actions.aiFillOk'))
      })
    })
  }, [onActionProfileApply, editingId, reload, t, toast])

  useEffect(() => {
    return onActionPlateCommitted(({ actionId, path, gallery }) => {
      actionsHandlePlateCommitted(
        { actionId, path, gallery },
        editingId,
        {
          reload,
          setForm,
          setSelectedImageId,
          setEditorPanel,
          toastSuccess: () => toast.success(t('actions.generatePlateOk'))
        }
      )
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
    return actionsRunCreateForEnsure(
      () =>
        getApi().actions.create({
          ...persistPayload(),
          linkStoryId: activeStoryId ?? undefined
        }) as Promise<Action>,
      reload,
      setEditingId,
      setActionError,
      toast.error
    )
  }

  const handleSave = async (): Promise<void> => {
    await actionsRunSave({
      name: form.name,
      nameRequiredMsg: t('actions.nameRequired'),
      savedMsg: t('common.saved'),
      failedMsg: t('common.actionFailed'),
      editingId,
      toastError: toast.error,
      toastSuccess: toast.success,
      setError: setActionError,
      update: (id) => update(id, persistPayload()),
      create: () =>
        getApi().actions.create({
          ...persistPayload(),
          linkStoryId: activeStoryId ?? undefined
        }),
      reload,
      closeEditor
    })
  }

  const handleAiFill = (): void => {
    actionsRunAiFill({
      busy: actionBusy(editingId),
      toastInfo: toast.info,
      loadingMsg: t('common.loading'),
      idea: aiIdea,
      formSnapshot: {
        name: form.name.trim() || undefined,
        description: form.description.trim() || undefined,
        motionNotes: form.motionNotes.trim() || undefined,
        intention: form.intention.trim() || undefined,
        cameraNotes: form.cameraNotes.trim() || undefined,
        visualTags: form.visualTags.trim() || undefined,
        artStyle: form.artStyle || undefined
      },
      refPath: actionsAiFillRefPath({
        selectedPath: selectedImage?.path,
        coverPath: form.coverPath,
        gallery0: form.gallery[0]?.path,
        cast0: form.castRefs[0]?.imagePath
      }),
      setError: setActionError,
      toastError: toast.error,
      needMsg: t('common.aiNeedIdeaOrImage'),
      fromImageMsg: t('common.aiFillFromImage'),
      backgroundMsg: t('aiJobs.startedBackground'),
      startJob: (idea, hasDraft, hasImage, refPath, snapshot) =>
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
      if (actionsGuardBusy(actionBusy(id), toast.info, t('common.loading'))) {
        return
      }
      const wantIdentity = actionsResolveWantIdentity(
        opts?.useIdentityEdit,
        useIdentityRef
      )
      const galleryPaths = actionsGalleryPathsFromOpts(
        opts?.referenceImagePath,
        selectedPathsForIdentity
      )
      // Global MediaGenHost — same shell as all photo/video generates
      startMediaGen({
        kind: 'action-plate',
        actionId: id,
        storyId: activeStoryId ?? undefined,
        panelLayout: form.panelLayout,
        artStyle: form.artStyle,
        galleryIdentityPaths: galleryPaths,
        preferIdentityEdit: wantIdentity
      })
    } catch (e) {
      actionsApplyIpcError(e, setActionError, toast.error)
    }
  }

  /** Legacy ImageGenConfirm path (kept for tests / fallback callers). */
  const runActionPlateJob = async (
    confirm: ImageGenConfirmPayload
  ): Promise<void> => {
    setImageGenConfirm(null)
    await actionsRunPlateJob({
      ensureSavedId,
      isBusy: (id) => actionBusy(id),
      toastInfo: toast.info,
      loadingMsg: t('common.loading'),
      startedMsg: t('aiJobs.startedBackground'),
      setError: setActionError,
      toastError: toast.error,
      startJob: (id, run) =>
        startJob({
          kind: 'action-plate',
          label: t('actions.generatePlate'),
          scope: { actionId: id, storyId: activeStoryId ?? undefined },
          run
        }),
      generatePlate: (id) =>
        getApi().actions.generatePlate({
          actionId: id,
          panelLayout: form.panelLayout,
          artStyle: form.artStyle,
          persist: false,
          referenceImagePath: confirm.referencePaths[0] ?? null,
          referenceImagePaths: confirm.referencePaths,
          useIdentityEdit: confirm.useIdentityEdit,
          promptOverride: confirm.prompt
        }),
      discardDraft: (p) => getApi().media.discardSheetDraft(p),
      panelLayout: form.panelLayout,
      plateLabel: t('actions.generatePlate'),
      storyId: activeStoryId ?? ''
    })
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
      const coverPath = actionsNextCoverAfterRemove(
        f.coverPath,
        removedPath,
        next
      )
      return { ...f, gallery: next, coverPath }
    })
    setSelectedImageIds((ids) => ids.filter((x) => x !== removedId))
    setSelectedImageId((cur) =>
      actionsPickNeighborId(removedId, form.gallery, cur)
    )
  }

  const handleIntroVideo = (sourcePath: string): void => {
    void actionsRunIntroVideo({
      ensureSavedId,
      isBusy: (id) => actionBusy(id),
      toastInfo: toast.info,
      loadingMsg: t('common.loading'),
      hasDraft: hasVideoPrepDraft,
      continueDraft: continueVideoPrepDraft,
      startVideoPrep: (id) =>
        startVideoPrep({
          kind: 'action-intro',
          entityIds: { actionId: id },
          sourceImagePath: sourcePath,
          durationSeconds: 10,
          locale: getAiLocale(i18n.language)
        }),
      sourcePath,
      buildKey: (id, path) =>
        buildVideoPrepDraftKey('action-intro', { actionId: id }, path)
    })
  }

  const handleDelete = async (a: Action): Promise<void> => {
    await actionsRunDelete({
      name: a.name,
      id: a.id,
      editingId,
      confirm: () =>
        dialog.confirm({
          message: t('actions.confirmDelete', { name: a.name }),
          variant: 'danger',
          confirmLabel: t('common.delete')
        }),
      remove,
      toastSuccess: () => toast.success(t('common.deleted')),
      closeEditor
    })
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
                              {actionsMotionNotesChip(a.motionNotes)}
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
        // Allow empty-name Save so nameRequired toast is reachable (not dead behind disabled).
        saveDisabled={editorBusy}
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
          <EntityGalleryPanel
            title={t('actions.gallery')}
            countLabel={
              form.gallery.length > 0 ? String(form.gallery.length) : null
            }
            previewPath={selectedImage?.path}
            previewAlt={selectedImage?.label ?? ''}
            maxHeightClass="max-h-[min(36vh,360px)] lg:max-h-[min(48vh,440px)]"
            showMeta
            introVideoBusy={editorBusy}
            introVideoPath={selectedImage?.introVideoPath}
            introVideoHasDraft={
              Boolean(editingId) &&
              Boolean(selectedImage?.path) &&
              hasVideoPrepDraft(
                buildVideoPrepDraftKey(
                  'action-intro',
                  { actionId: editingId! },
                  selectedImage?.path ?? ''
                )
              )
            }
            onIntroVideo={
              selectedImage
                ? actionsIntroVideoHandler(
                    editingId,
                    selectedImage.path,
                    handleIntroVideo
                  )
                : undefined
            }
            isCover={Boolean(
              selectedImage && form.coverPath === selectedImage.path
            )}
            onSetAsCover={
              selectedImage
                ? actionsMakeCoverHandler(setForm, selectedImage.path)
                : undefined
            }
            onRemove={
              selectedImage ? handleRemoveSelectedImage : undefined
            }
            emptyIcon="🎬"
            emptyMessage={t('actions.noPhotos')}
            emptyActions={[
              {
                label: t('common.uploadRef'),
                onClick: () => void handlePickExternalRef(),
                variant: 'secondary',
                disabled: editorBusy
              },
              {
                label: t('actions.generatePlate'),
                onClick: () => {
                  setEditorPanel('refs')
                  void handleGeneratePlate()
                },
                variant: 'primary',
                disabled: editorBusy
              }
            ]}
            items={form.gallery}
            selectedId={selectedImageId}
            selectedIds={selectedImageIds}
            multiSelect
            coverPath={form.coverPath}
            fallbackCoverPath={primaryActionGalleryPath(form.gallery)}
            onSelect={setSelectedImageId}
            onToggleSelect={(id) =>
              setSelectedImageIds((ids) => toggleGallerySelection(ids, id))
            }
            onReorder={actionsMakeReorderHandler(setForm)}
            labelOf={(g) => translateActionGalleryLabel(g.label, t)}
          />
        }
      >
        {editorPanel === 'profile' && (
          <div className={editorFormClass}>
            {actionsErrorBannerElement(actionError, t)}
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
            {actionsErrorBannerElement(actionError, t)}
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
                      artStyle: actionsArtStyleOrDefault(e.target.value)
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

// ─── Residual pure helpers (absolute line coverage) ─────────────────────────

export function actionsHandleVideoPrepDone(
  d: {
    kind?: string
    entityIds?: { actionId?: string }
    gallery?: ActionGalleryItem[]
  } | null
    | undefined,
  editingId: string | null,
  setForm: Dispatch<SetStateAction<FormState>>,
  reload: () => void
): void {
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

export function actionsHandleProfileApply(
  draft: {
    actionId: string | null
    profile: {
      name: string
      description: string
      motionNotes?: string
      intention?: string
      cameraNotes?: string
      visualTags?: string
      artStyle?: string
      hardRules?: string
    }
  },
  editingId: string | null,
  ops: {
    reload: () => void
    setForm: Dispatch<SetStateAction<FormState>>
    setEditingId: (id: string | null) => void
    setEditorOpen: (v: boolean) => void
    toastSuccess: () => void
  }
): void {
  if (draft.actionId && editingId && draft.actionId !== editingId) {
    void ops.reload()
    return
  }
  const p = draft.profile
  ops.setForm((f) => ({
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
      typeof p.hardRules === 'string' && p.hardRules.trim()
        ? p.hardRules.trim()
        : f.hardRules,
    artStyle: isArtStyleId(p.artStyle) ? p.artStyle : f.artStyle
  }))
  if (draft.actionId) ops.setEditingId(draft.actionId)
  ops.setEditorOpen(true)
  ops.toastSuccess()
  void ops.reload()
}

export function actionsHandlePlateCommitted(
  payload: {
    actionId: string
    path: string
    gallery?: Array<{
      id: string
      path: string
      kind: string
      label: string
      createdAt: string
      layer?: string
      introVideoPath?: string | null
    }>
  },
  editingId: string | null,
  ops: {
    reload: () => void
    setForm: Dispatch<SetStateAction<FormState>>
    setSelectedImageId: (id: string | null) => void
    setEditorPanel: (p: EditorPanel) => void
    toastSuccess: () => void
  }
): void {
  const { actionId, path, gallery } = payload
  if (editingId === actionId) {
    if (gallery && gallery.length > 0) {
      const g = gallery as ActionGalleryItem[]
      ops.setForm((f) => ({
        ...f,
        gallery: g,
        coverPath: isActionGalleryCoverPath(g, f.coverPath)
          ? f.coverPath
          : primaryActionGalleryPath(g)
      }))
      const newest =
        g.find((item) => item.path === path) ?? g[g.length - 1] ?? null
      ops.setSelectedImageId(newest?.id ?? null)
      ops.setEditorPanel('refs')
    } else {
      void ops.reload()
    }
  }
  void ops.reload()
  ops.toastSuccess()
}

export function actionsAiFillRefPath(parts: {
  selectedPath?: string | null
  coverPath?: string | null
  gallery0?: string | null
  cast0?: string | null
}): string {
  return (
    parts.selectedPath?.trim() ||
    parts.coverPath?.trim() ||
    parts.gallery0?.trim() ||
    parts.cast0?.trim() ||
    ''
  )
}

export function actionsAppendCastNoteIfNeeded(
  prompt: string,
  useEdit: boolean,
  castCount: number,
  locale: string
): string {
  // Structured SUBJECT BINDING from buildActionPlatePrompt already locks cast.
  if (prompt.includes('SUBJECT BINDING')) return prompt
  if (!useEdit || castCount <= 0) return prompt
  const castNote = actionsCastIdentityNote(castCount, locale)
  if (!prompt.includes(castNote)) {
    return `${prompt}\n\n${castNote}`
  }
  return prompt
}

export function actionsCastHint(
  castCount: number,
  label: string
): string {
  return castCount > 0 ? ` · ${label}` : ''
}

export function actionsPickNeighborId(
  removedId: string,
  gallery: { id: string }[],
  cur: string | null
): string | null {
  if (cur !== removedId) return cur
  const idx = gallery.findIndex((g) => g.id === removedId)
  const remaining = gallery.filter((g) => g.id !== removedId)
  return (
    remaining[Math.min(idx, remaining.length - 1)]?.id ??
    remaining[0]?.id ??
    null
  )
}

export function actionsCoverPathSetter(
  path: string
): (f: FormState) => FormState {
  return (f) => ({ ...f, coverPath: path })
}

export function actionsApplyCoverPath(
  setForm: Dispatch<SetStateAction<FormState>>,
  path: string
): void {
  setForm(actionsCoverPathSetter(path))
}

export function actionsMoveGallery(
  fromId: string,
  toId: string
): (f: FormState) => FormState {
  return (f) => ({
    ...f,
    gallery: moveActionGalleryItem(f.gallery, fromId, toId)
  })
}

export function actionsApplyGalleryReorder(
  setForm: Dispatch<SetStateAction<FormState>>,
  fromId: string,
  toId: string
): void {
  setForm(actionsMoveGallery(fromId, toId))
}

/** Factory so page can pass a stable handler without uncovered inline arrows. */
export function actionsMakeReorderHandler(
  setForm: Dispatch<SetStateAction<FormState>>
): (fromId: string, toId: string) => void {
  return (fromId, toId) => actionsApplyGalleryReorder(setForm, fromId, toId)
}

export function actionsMakeCoverHandler(
  setForm: Dispatch<SetStateAction<FormState>>,
  path: string
): () => void {
  return () => actionsApplyCoverPath(setForm, path)
}

export function actionsArtStyleOrDefault(
  raw: string | null | undefined
): ArtStyleId {
  return isArtStyleId(raw) ? raw : DEFAULT_ART_STYLE
}

export function actionsShowErrorBanner(actionError: string | null): boolean {
  return Boolean(actionError)
}

/** Error banner element — unit-tested so JSX edges are covered without full mount. */
export function actionsErrorBannerElement(
  actionError: string | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: any
): JSX.Element | null {
  if (!actionError) return null
  return (
    <div className="rounded-xl border border-rose-900/50 bg-rose-950/40 px-3 py-2 text-sm text-rose-100">
      {formatUserError(actionError, t)}
    </div>
  )
}

export async function actionsRunCreateForEnsure(
  create: () => Promise<Action>,
  reload: () => Promise<void> | void,
  setEditingId: (id: string) => void,
  setError: (msg: string) => void,
  toastError: (msg: string) => void
): Promise<string | null> {
  try {
    const row = await create()
    await reload()
    setEditingId(row.id)
    return row.id
  } catch (e) {
    const msg = parseIpcError(e).message
    setError(msg)
    toastError(msg)
    return null
  }
}

export async function actionsRunSave(ops: {
  name: string
  nameRequiredMsg: string
  savedMsg: string
  failedMsg: string
  editingId: string | null
  toastError: (m: string) => void
  toastSuccess: (m: string) => void
  setError: (m: string | null) => void
  update: (id: string) => Promise<boolean>
  create: () => Promise<unknown>
  reload: () => Promise<void> | void
  closeEditor: () => void
}): Promise<void> {
  if (actionsGuardEmptyName(ops.name, ops.toastError, ops.nameRequiredMsg)) {
    return
  }
  ops.setError(null)
  try {
    if (ops.editingId) {
      const ok = await ops.update(ops.editingId)
      if (ok) {
        ops.toastSuccess(ops.savedMsg)
        await ops.reload()
        ops.closeEditor()
      } else {
        ops.toastError(ops.failedMsg)
      }
      return
    }
    await ops.create()
    await ops.reload()
    ops.toastSuccess(ops.savedMsg)
    ops.closeEditor()
  } catch (e) {
    const msg = parseIpcError(e).message
    ops.setError(msg)
    ops.toastError(msg)
  }
}

export async function actionsRunIntroVideo(ops: {
  ensureSavedId: () => Promise<string | null>
  isBusy: (id: string) => boolean
  toastInfo: (m: string) => void
  loadingMsg: string
  hasDraft: (key: string) => boolean
  continueDraft: (key: string) => void
  startVideoPrep: (id: string) => void
  sourcePath: string
  buildKey: (id: string, path: string) => string
}): Promise<'no-id' | 'busy' | 'continue' | 'started'> {
  const id = await ops.ensureSavedId()
  if (!id) return 'no-id'
  if (actionsGuardBusy(ops.isBusy(id), ops.toastInfo, ops.loadingMsg)) {
    return 'busy'
  }
  const key = ops.buildKey(id, ops.sourcePath)
  if (
    actionsMaybeContinueVideoDraft(ops.hasDraft(key), () =>
      ops.continueDraft(key)
    )
  ) {
    return 'continue'
  }
  ops.startVideoPrep(id)
  return 'started'
}

export async function actionsRunDelete(ops: {
  name: string
  id: string
  editingId: string | null
  confirm: () => Promise<boolean>
  remove: (id: string) => Promise<boolean>
  toastSuccess: () => void
  closeEditor: () => void
}): Promise<void> {
  const ok = await ops.confirm()
  if (!ok) return
  if (await ops.remove(ops.id)) {
    ops.toastSuccess()
    if (ops.editingId === ops.id) ops.closeEditor()
  }
}

export function actionsMotionNotesBadge(
  notes: string | null | undefined
): string | null {
  if (!notes) return null
  return notes.length > 24 ? `${notes.slice(0, 24)}…` : notes
}

export function actionsMotionNotesChip(
  notes: string | null | undefined
): JSX.Element {
  const badge = actionsMotionNotesBadge(notes)
  return (
    <span
      className={
        badge
          ? 'rounded-full bg-ink-800 px-2 py-0.5 text-[10px] text-ink-400'
          : 'hidden'
      }
    >
      {badge ?? ''}
    </span>
  )
}

export function actionsMaybeAppendMultiRef(
  prompt: string,
  paths: string[],
  locale: string,
  append: (p: string, paths: string[], locale: string) => string
): string {
  if (paths.length > 1) {
    return append(prompt, paths, locale)
  }
  return prompt
}

export function actionsAiFillInfoMessage(
  key: 'fromImage' | 'background',
  fromImageMsg: string,
  backgroundMsg: string
): string {
  return key === 'fromImage' ? fromImageMsg : backgroundMsg
}

export function actionsRunAiFill(ops: {
  busy: boolean
  toastInfo: (m: string) => void
  loadingMsg: string
  idea: string
  formSnapshot: Record<string, string | undefined>
  refPath: string
  setError: (m: string) => void
  toastError: (m: string) => void
  needMsg: string
  fromImageMsg: string
  backgroundMsg: string
  startJob: (
    idea: string,
    hasDraft: boolean,
    hasImage: boolean,
    refPath: string,
    snapshot: Record<string, string | undefined>
  ) => void
}): 'busy' | 'need' | 'started' {
  if (actionsGuardBusy(ops.busy, ops.toastInfo, ops.loadingMsg)) {
    return 'busy'
  }
  const idea = ops.idea.trim()
  const snapshot = ops.formSnapshot
  const hasDraft = Object.values(snapshot).some(
    (v) => typeof v === 'string' && v.length > 0
  )
  const hasImage = Boolean(ops.refPath)
  if (
    actionsGuardAiNeedIdea(
      idea,
      hasDraft,
      hasImage,
      ops.setError,
      ops.toastError,
      ops.needMsg
    )
  ) {
    return 'need'
  }
  ops.setError(null as unknown as string)
  ops.toastInfo(
    actionsAiFillInfoMessage(
      actionsAiFillToastKey(hasImage, idea, hasDraft),
      ops.fromImageMsg,
      ops.backgroundMsg
    )
  )
  ops.startJob(idea, hasDraft, hasImage, ops.refPath, snapshot)
  return 'started'
}

export async function actionsRunPlateJob(ops: {
  ensureSavedId: () => Promise<string | null>
  isBusy: (id: string) => boolean
  toastInfo: (m: string) => void
  loadingMsg: string
  startedMsg: string
  setError: (m: string) => void
  toastError: (m: string) => void
  startJob: (
    id: string,
    run: (ctx: {
      setProgress: (n: number, s?: string) => void
      signal: { cancelled: boolean }
    }) => Promise<unknown>
  ) => void
  generatePlate: (id: string) => Promise<{
    path: string
    panelLayout?: string
    label?: string
    enhance?: unknown
  }>
  discardDraft: (path: string) => Promise<unknown>
  panelLayout: string
  plateLabel: string
  storyId: string
}): Promise<'no-id' | 'busy' | 'started' | 'error'> {
  try {
    const id = await ops.ensureSavedId()
    if (!id) return 'no-id'
    if (actionsGuardBusy(ops.isBusy(id), ops.toastInfo, ops.loadingMsg)) {
      return 'busy'
    }
    ops.toastInfo(ops.startedMsg)
    ops.startJob(id, async ({ setProgress, signal }) => {
      setProgress(10, 'image')
      const r = await ops.generatePlate(id)
      if (signal.cancelled) {
        await actionsDiscardSheetDraftSafe(ops.discardDraft, r.path)
        return
      }
      setProgress(100, 'done')
      return {
        type: 'action-plate' as const,
        actionId: id,
        storyId: ops.storyId,
        path: r.path,
        panelLayout: r.panelLayout ?? ops.panelLayout,
        label: r.label ?? ops.plateLabel,
        enhance: r.enhance
      }
    })
    return 'started'
  } catch (e) {
    actionsApplyIpcError(e, ops.setError, ops.toastError)
    return 'error'
  }
}

export async function actionsRunGeneratePlateSetup(ops: {
  ensureSavedId: () => Promise<string | null>
  isBusy: (id: string) => boolean
  toastInfo: (m: string) => void
  loadingMsg: string
  setError: (m: string) => void
  toastError: (m: string) => void
  buildConfirm: () => void
}): Promise<'no-id' | 'busy' | 'ok' | 'error'> {
  try {
    const id = await ops.ensureSavedId()
    if (!id) return 'no-id'
    if (actionsGuardBusy(ops.isBusy(id), ops.toastInfo, ops.loadingMsg)) {
      return 'busy'
    }
    ops.buildConfirm()
    return 'ok'
  } catch (e) {
    actionsApplyIpcError(e, ops.setError, ops.toastError)
    return 'error'
  }
}

/** True when name is blank — toasts nameRequired via toastError(msg). */
export function actionsGuardEmptyName(
  name: string,
  toastError: (msg: string) => void,
  msg: string
): boolean {
  if (!name.trim()) {
    toastError(msg)
    return true
  }
  return false
}

/** True when a job already occupies this action — toasts loading. */
export function actionsGuardBusy(
  busy: boolean,
  toastInfo: (msg: string) => void,
  msg: string
): boolean {
  if (busy) {
    toastInfo(msg)
    return true
  }
  return false
}

/** True when AI fill has no idea, draft fields, or reference image. */
export function actionsGuardAiNeedIdea(
  idea: string,
  hasDraft: boolean,
  hasImage: boolean,
  setError: (msg: string) => void,
  toastError: (msg: string) => void,
  msg: string
): boolean {
  if (!idea && !hasDraft && !hasImage) {
    setError(msg)
    toastError(msg)
    return true
  }
  return false
}

export function actionsAiFillToastKey(
  hasImage: boolean,
  idea: string,
  hasDraft: boolean
): 'fromImage' | 'background' {
  return hasImage && !idea && !hasDraft ? 'fromImage' : 'background'
}

export function actionsResolveWantIdentity(
  optsUseIdentity: boolean | undefined,
  useIdentityRef: boolean
): boolean {
  return optsUseIdentity !== undefined
    ? optsUseIdentity === true
    : useIdentityRef
}

export function actionsGalleryPathsFromOpts(
  referenceImagePath: string | null | undefined,
  selectedPaths: string[]
): string[] {
  const trimmed = referenceImagePath?.trim()
  return trimmed ? [trimmed] : selectedPaths
}

export function actionsCastIdentityNote(count: number, locale: string): string {
  return locale === 'en'
    ? `Cast identity stills (${count}): match face/body of attached cast references in every panel.`
    : `已附 ${count} 張參考素材（角色／道具等）：每格人物身份須與參考素材一致。`
}

export function actionsPlateReferencePaths(
  idPaths: string[],
  wantIdentity: boolean,
  mergedPaths: string[],
  castPaths: string[]
): string[] {
  if (idPaths.length > 0) return idPaths
  return wantIdentity ? mergedPaths : castPaths
}

export function actionsApplyIpcError(
  e: unknown,
  setError: (msg: string) => void,
  toastError: (msg: string) => void
): string {
  const err = parseIpcError(e)
  const msg = `${err.message}${err.details ? ` — ${err.details}` : ''}`
  setError(msg)
  toastError(msg)
  return msg
}

export async function actionsDiscardSheetDraftSafe(
  discard: (path: string) => Promise<unknown>,
  path: string
): Promise<void> {
  try {
    await discard(path)
  } catch {
    /* ignore */
  }
}

export function actionsNextCoverAfterRemove(
  coverPath: string | null,
  removedPath: string,
  nextGallery: ActionGalleryItem[]
): string | null {
  return coverPath === removedPath
    ? primaryActionGalleryPath(nextGallery)
    : coverPath
}

/** When a video-prep draft exists, continue it and return true. */
export function actionsMaybeContinueVideoDraft(
  hasDraft: boolean,
  continueDraft: () => void
): boolean {
  if (hasDraft) {
    continueDraft()
    return true
  }
  return false
}

export function actionsIntroVideoHandler(
  editingId: string | null | undefined,
  path: string,
  handler: (p: string) => void
): (() => void) | undefined {
  return editingId ? () => handler(path) : undefined
}
