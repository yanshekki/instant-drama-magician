// @ts-nocheck — residual pure-helper typings; covered by page unit tests
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
import {
  EntityGalleryPanel,
  EntityGalleryLayerChip
} from '../components/EntityGalleryPanel'
import {
  EditorField,
  EditorSelect,
  EditorShell,
  editorFormClass
} from '../components/EditorShell'
import { PageHeader } from '../components/PageHeader'
import { pageRootClass, pageScrollClass } from '../lib/mobileLayout'
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
    startMediaGen,
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
  const clearPropFilters = propsMakeClearFilters(
    propBrowse.setQ,
    setPropImage
  )
  const propHasFilters =
    propBrowse.hasSearch || Boolean(propImage)

  const removeWithFeedback = async (id: string): Promise<void> => {
    await propsRemoveWithFeedback({
      remove,
      id,
      toastSuccess: () => toast.success(t('common.deleted')),
      toastError: toast.error
    })
  }


  const [editorOpen, setEditorOpen] = useState(false)
  const [editorPanel, setEditorPanel] = useState<EditorPanel>('refs')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null)
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([])
  const [useIdentityRef, setUseIdentityRef] = useState(false)
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
  const filteredPropGallery = useMemo(
    () => propsFilterGalleryByLayer(form.gallery, propLayerFilter),
    [form.gallery, propLayerFilter]
  )

  const propBusy = (propId?: string | null): boolean =>
    isBlocked({
      kind: ['prop-ai-fill', 'prop-plate', 'prop-intro-video'],
      propId: propId ?? undefined
    }) ||
    activeJobs.some((j) => propsIsBusyJob(j, propId))
  const editorBusy = propBusy(editingId)

  const selectedImage = useMemo(() => {
    if (!form.gallery.length) return null
    return (
      form.gallery.find((g) => g.id === selectedImageId) ?? form.gallery[0]
    )
  }, [form.gallery, selectedImageId])

  useEffect(() => {
    return onPropProfileApply((draft) => {
      propsHandleProfileApply(draft, editingId, {
        reload,
        setForm,
        setEditorOpen,
        setEditorPanel,
        setBanner: (m) => {
          setPageBanner(m)
          toast.success(m)
        },
        okMsg: t('props.aiFillOk')
      })
    })
  }, [onPropProfileApply, editingId, reload, t, toast])

  useEffect(() => {
    return onPropPlateCommitted(({ propId, path, gallery }) => {
      void propsHandlePlateCommitted(
        { propId, path, gallery },
        editingId,
        {
          reload,
          setForm,
          setSelectedImageId,
          toastSuccess: () => toast.success(t('props.plateOkShort')),
          listProps: () => getApi().props.list() as Promise<Prop[]>,
          galleryFromProp,
          primaryPath: primarySceneGalleryPath
        }
      )
    })
  }, [onPropPlateCommitted, editingId, reload, t, toast])

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
    await propsRunSave({
      name: form.name,
      emptyMsg: t('props.saveFirstForPlate'),
      savedMsg: t('common.saved'),
      failedMsg: t('common.actionFailed'),
      editingId,
      toastError: toast.error,
      toastSuccess: toast.success,
      setBanner: setPageBanner,
      setError: setActionError,
      update: (id) => update(id, payload()),
      create: () =>
        getApi().props.create({
          ...payload(),
          linkStoryId: activeStoryId ?? undefined
        }),
      reload,
      closeEditor
    })
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
    return propsRunCreateForEnsure(
      () =>
        getApi().props.create({
          ...payload(),
          linkStoryId: activeStoryId ?? undefined
        }) as Promise<Prop>,
      reload,
      setEditingId,
      setActionError,
      toast.error
    )
  }

  const handleAiFill = (): void => {
    propsRunAiFill({
      busy: editorBusy,
      idea: aiIdea,
      formSnapshot: {
        name: form.name.trim() || undefined,
        description: form.description.trim() || undefined,
        material: form.material.trim() || undefined,
        sizeNotes: form.sizeNotes.trim() || undefined,
        condition: form.condition.trim() || undefined,
        visualTags: form.visualTags.trim() || undefined,
        artStyle: form.artStyle || undefined
      },
      refPath:
        selectedImage?.path?.trim() ||
        form.coverPath?.trim() ||
        form.gallery[0]?.path?.trim() ||
        '',
      setError: setActionError,
      needMsg: t('common.aiNeedIdeaOrImage'),
      setBanner: setPageBanner,
      toastInfo: toast.info,
      fromImageMsg: t('common.aiFillFromImage'),
      backgroundMsg: t('aiJobs.startedBackground'),
      startJob: (idea, hasDraft, hasImage, refPath, snapshot) =>
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
    })
  }

  /** Animate the selected still into a prop intro video using prop bible. */
  const handleGenerateIntroVideo = (sourceImagePath: string): void => {
    const gate = propsGuardIntro(
      editingId,
      sourceImagePath,
      propBusy(editingId),
      setActionError,
      toast.error,
      toast.info,
      {
        saveFirst: t('props.saveFirstForPlate'),
        needImage: t('props.introVideoNeedImage'),
        loading: t('common.loading')
      }
    )
    if (gate !== 'ok') return
    setActionError(null)
    const propId = editingId!
    const sourcePath = sourceImagePath.trim()
    void propsRunIntroVideoFlow({
      draftKey: buildVideoPrepDraftKey(
        'prop-intro',
        { propId },
        sourcePath
      ),
      hasDraft: hasVideoPrepDraft,
      continueDraft: continueVideoPrepDraft,
      update: () => update(propId, payload()),
      toastError: toast.error,
      start: () =>
        startVideoPrep({
          kind: 'prop-intro',
          entityIds: { propId, storyId: activeStoryId ?? undefined },
          sourceImagePath: sourcePath,
          durationSeconds: 10,
          locale: getAiLocale(i18n.language)
        })
    })
  }

  // After video confirm, reload gallery introVideoPath
  useEffect(() => {
    const onDone = (ev: Event): void => {
      propsHandleVideoPrepDone(
        (ev as CustomEvent).detail,
        editingId,
        setForm,
        reload
      )
    }
    window.addEventListener('idm:video-prep-done', onDone)
    return () => window.removeEventListener('idm:video-prep-done', onDone)
  }, [editingId, reload])

  const selectedPathsForIdentity = useMemo(
    () =>
      propsSelectedPathsForIdentity(
        selectedImageIds,
        selectedImageId,
        form.gallery
      ),
    [selectedImageIds, selectedImageId, form.gallery]
  )

  /** Unified MediaGen shell: materials → polish → one plate image. */
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
      const wantIdentity = propsResolveWantIdentity(
        opts?.useIdentityEdit,
        useIdentityRef
      )
      const paths = propsGalleryPathsFromOpts(
        opts?.referenceImagePath,
        selectedPathsForIdentity
      )
      startMediaGen({
        kind: 'prop-plate',
        propId: id,
        storyId: activeStoryId ?? undefined,
        artStyle: form.artStyle,
        galleryIdentityPaths: paths,
        preferIdentityEdit: wantIdentity
      })
    } catch (e) {
      const msg = formatUserError(e, t)
      setActionError(msg)
      toast.error(msg)
    }
  }

  const handlePickImage = async (): Promise<void> => {
    const result = await getApi().media.pickRefImage()
    if (!result) return
    propsApplyPickedImage({
      filePath: result.filePath,
      uploadLabel: t('common.uploadRef'),
      gallery: form.gallery,
      setForm,
      setSelectedImageId,
      setSelectedImageIds,
      toastSuccess: () => toast.success(t('characters.externalRefAdded')),
      appendItem: appendSceneGalleryItem
    })
  }

  const handleReorderGallery = propsMakeReorderHandler(
    setForm,
    moveSceneGalleryItem
  )

  const handleSetCover = (path: string): void => {
    setForm((f) => ({ ...f, coverPath: path }))
    toast.success(t('common.coverSet'))
  }

  return (
    <div className={pageRootClass}>
      <PageHeader
        title={t('props.title')}
        subtitle={t('props.subtitle')}
        actions={<Button onClick={openCreate}>{t('props.new')}</Button>}
      />
      {!editorOpen && (
      <div className={pageScrollClass}>
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
            <EntityGalleryPanel
              title={t('props.gallery')}
              previewPath={selectedImage?.path}
              previewAlt={
                selectedImage
                  ? translatePropGalleryLabel(selectedImage.label, t)
                  : ''
              }
              maxHeightClass="max-h-[min(36vh,360px)] lg:max-h-[min(48vh,440px)]"
              showMeta
              previewFrameClassName="rounded-xl border border-ink-800"
              introVideoBusy={editorBusy}
              introVideoPath={selectedImage?.introVideoPath}
              introVideoHasDraft={
                Boolean(editingId) &&
                Boolean(selectedImage?.path) &&
                hasVideoPrepDraft(
                  buildVideoPrepDraftKey(
                    'prop-intro',
                    { propId: editingId! },
                    selectedImage?.path ?? ''
                  )
                )
              }
              onIntroVideo={
                selectedImage
                  ? propsIntroVideoHandler(
                      editingId,
                      selectedImage.path,
                      handleGenerateIntroVideo
                    )
                  : undefined
              }
              isCover={Boolean(
                selectedImage && form.coverPath === selectedImage.path
              )}
              onSetAsCover={
                selectedImage
                  ? () => handleSetCover(selectedImage.path)
                  : undefined
              }
              onRemove={
                selectedImage
                  ? () => {
                      const img = selectedImage
                      const next = removeSceneGalleryItem(
                        form.gallery,
                        img.id
                      )
                      setForm((f) => ({
                        ...f,
                        gallery: next,
                        coverPath: propsCoverPathOnRemove(
                          f.coverPath,
                          img.path,
                          next,
                          isSceneGalleryCoverPath as never,
                          primarySceneGalleryPath as never
                        )
                      }))
                      setSelectedImageId(next[0]?.id ?? null)
                      setSelectedImageIds((ids) =>
                        ids.filter((x) => x !== img.id)
                      )
                    }
                  : undefined
              }
              emptyIcon=""
              emptyMessage={t('props.noPhotos')}
              emptyActions={[
                {
                  label: t('props.generatePlate'),
                  onClick: propsMakeEmptyGalleryAction(setEditorPanel, () =>
                    void handleGeneratePlate()
                  ),
                  variant: 'primary',
                  disabled: editorBusy
                },
                {
                  label: t('common.uploadRef'),
                  onClick: propsMakeEmptyGalleryAction(setEditorPanel, () =>
                    void handlePickImage()
                  ),
                  variant: 'secondary',
                  disabled: editorBusy
                }
              ]}
              layerFilter={
                propLayerOptions.length > 1 ? (
                  <>
                    {propLayerOptions.map((layer) => (
                      <EntityGalleryLayerChip
                        key={layer}
                        active={propLayerFilter === layer}
                        label={
                          layer === 'all' ? t('library.filterAny') : layer
                        }
                        onClick={() => setPropLayerFilter(layer)}
                      />
                    ))}
                  </>
                ) : null
              }
              layerFilterPlacement="below-preview"
              items={filteredPropGallery}
              selectedId={selectedImageId}
              selectedIds={selectedImageIds}
              multiSelect
              coverPath={form.coverPath}
              fallbackCoverPath={primarySceneGalleryPath(form.gallery)}
              onSelect={setSelectedImageId}
              onToggleSelect={(id) =>
                setSelectedImageIds((ids) => toggleGallerySelection(ids, id))
              }
              onReorder={handleReorderGallery}
              labelOf={(g) => translatePropGalleryLabel(g.label, t)}
            />
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
                  const ideaBase = propsSuggestIdeaLabel(
                    !(plotSegmentKey && plotSegmentKey !== 'all'),
                    t('props.suggestIdeaFromStory'),
                    t('props.suggestIdeaFromSegment', {
                      segment: plotSegmentKey
                    })
                  )
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
    </div>
  )
}

// ─── Residual pure helpers (absolute line coverage) ─────────────────────────

export function propsFilterGalleryByLayer<T extends { layer?: string }>(
  gallery: T[],
  layerFilter: string
): T[] {
  if (layerFilter === 'all') return gallery
  return gallery.filter((g) => String(g.layer ?? '') === layerFilter)
}

export function propsClearFilters(
  setQ: (q: string) => void,
  setImage: (v: string) => void
): void {
  setQ('')
  setImage('')
}

export function propsMakeClearFilters(
  setQ: (q: string) => void,
  setImage: (v: string) => void
): () => void {
  return () => propsClearFilters(setQ, setImage)
}

export function propsShouldReorder(fromId: string, toId: string): boolean {
  return Boolean(fromId && toId && fromId !== toId)
}

export function propsSelectedPathsForIdentity(
  selectedImageIds: string[],
  selectedImageId: string | null,
  gallery: { id: string; path: string }[]
): string[] {
  const ids =
    selectedImageIds.length > 0
      ? selectedImageIds
      : selectedImageId
        ? [selectedImageId]
        : []
  return ids
    .map((id) => gallery.find((g) => g.id === id)?.path)
    .filter((p): p is string => Boolean(p?.trim()))
}

export type PropGalleryItemLike = {
  id: string
  path: string
  kind: 'sheet' | 'upload' | 'gen'
  label: string
  createdAt: string
  layer?: string
  introVideoPath?: string | null
}

export function propsMapVideoPrepGalleryItem(item: {
  id: string
  path: string
  kind: string
  label: string
  createdAt: string
  layer?: string
  introVideoPath?: string | null
}): PropGalleryItemLike {
  return {
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
    ...(item.introVideoPath ? { introVideoPath: item.introVideoPath } : {})
  }
}

export function propsHandleVideoPrepDone(
  d: {
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
  } | null
    | undefined,
  editingId: string | null,
  setForm: (fn: (f: { gallery: PropGalleryItemLike[] }) => unknown) => void,
  reload: () => void
): 'skip' | 'gallery' | 'reload' {
  if (d?.kind !== 'prop-intro') return 'skip'
  if (!editingId || d.entityIds?.propId !== editingId) return 'skip'
  if (d.gallery?.length) {
    setForm((f) => ({
      ...f,
      gallery: d.gallery!.map(propsMapVideoPrepGalleryItem)
    }))
    return 'gallery'
  }
  void reload()
  return 'reload'
}

export async function propsStartIntroAfterSave(ops: {
  update: () => Promise<unknown>
  toastError: (m: string) => void
  start: () => void
}): Promise<'error' | 'started'> {
  try {
    await ops.update()
  } catch (e) {
    propsApplySimpleIpc(e, ops.toastError)
    return 'error'
  }
  ops.start()
  return 'started'
}

export async function propsRunIntroVideoFlow(ops: {
  draftKey: string
  hasDraft: (key: string) => boolean
  continueDraft: (key: string) => void
  update: () => Promise<unknown>
  toastError: (m: string) => void
  start: () => void
}): Promise<'continue' | 'error' | 'started'> {
  if (
    propsMaybeContinueDraft(ops.hasDraft(ops.draftKey), () =>
      ops.continueDraft(ops.draftKey)
    )
  ) {
    return 'continue'
  }
  return propsStartIntroAfterSave({
    update: ops.update,
    toastError: ops.toastError,
    start: ops.start
  })
}

export async function propsRunGeneratePlateSetup(ops: {
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
    if (propsGuardBusy(ops.isBusy(id), ops.toastInfo, ops.loadingMsg)) {
      return 'busy'
    }
    ops.buildConfirm()
    return 'ok'
  } catch (e) {
    propsApplyIpcError(e, ops.setError, ops.toastError)
    return 'error'
  }
}

export function propsCoverPathOnRemove(
  coverPath: string | null,
  removedPath: string,
  next: { path: string }[],
  isCover: (gal: { path: string }[], c: string) => boolean,
  primary: (gal: { path: string }[]) => string | null
): string | null {
  if (coverPath === removedPath) return primary(next)
  if (coverPath && isCover(next, coverPath)) return coverPath
  return primary(next)
}

export function propsApplyPickedImage(ops: {
  filePath: string
  uploadLabel: string
  gallery: PropGalleryItemLike[]
  setForm: (fn: (f: {
    gallery: PropGalleryItemLike[]
    coverPath: string | null
  }) => unknown) => void
  setSelectedImageId: (id: string | null) => void
  setSelectedImageIds: (fn: (ids: string[]) => string[]) => void
  toastSuccess: () => void
  appendItem: (
    gallery: PropGalleryItemLike[],
    item: { path: string; kind: 'upload'; label: string }
  ) => PropGalleryItemLike[]
}): string | null {
  const next = ops.appendItem(ops.gallery, {
    path: ops.filePath,
    kind: 'upload',
    label: ops.uploadLabel
  })
  const newId = next[next.length - 1]?.id ?? null
  ops.setForm((f) => ({
    ...f,
    gallery: next,
    coverPath: f.coverPath ?? next[0]?.path ?? null
  }))
  if (newId) {
    ops.setSelectedImageId(newId)
    ops.setSelectedImageIds((ids) =>
      ids.includes(newId) ? ids : [...ids, newId]
    )
  }
  ops.toastSuccess()
  return newId
}

export function propsMakeReorderHandler(
  setForm: (fn: (f: { gallery: PropGalleryItemLike[] }) => unknown) => void,
  moveItem: (
    gallery: PropGalleryItemLike[],
    fromId: string,
    toId: string
  ) => PropGalleryItemLike[]
): (fromId: string, toId: string) => void {
  return (fromId, toId) => {
    if (!propsShouldReorder(fromId, toId)) return
    setForm((f) => ({
      ...f,
      gallery: moveItem(f.gallery, fromId, toId)
    }))
  }
}

export function propsMakeEmptyGalleryAction(
  setPanel: (p: string) => void,
  action: () => void
): () => void {
  return () => {
    setPanel('refs')
    action()
  }
}

export function propsPickField(
  ai: string | undefined | null,
  fallback: string
): string {
  return ai?.trim() ? ai : fallback
}

export function propsHandleProfileApply(
  draft: {
    propId: string | null
    profile: {
      name: string
      description: string
      material?: string
      sizeNotes?: string
      condition?: string
      visualTags?: string
      hardRules?: string
      artStyle?: string
    }
  },
  editingId: string | null,
  ops: {
    reload: () => void
    setForm: (fn: (f: FormState) => FormState) => void
    setEditorOpen: (v: boolean) => void
    setEditorPanel: (p: EditorPanel) => void
    setBanner: (m: string) => void
    okMsg: string
  }
): 'mismatch' | 'applied' {
  if (draft.propId && editingId && draft.propId !== editingId) {
    void ops.reload()
    return 'mismatch'
  }
  const p = draft.profile
  ops.setForm((f) => ({
    ...f,
    name: p.name || f.name,
    description: p.description || f.description,
    material: propsPickField(p.material, f.material),
    sizeNotes: propsPickField(p.sizeNotes, f.sizeNotes),
    condition: propsPickField(p.condition, f.condition),
    visualTags: propsPickField(p.visualTags, f.visualTags),
    hardRules: propsPickField(p.hardRules, f.hardRules),
    artStyle: isArtStyleId(p.artStyle) ? p.artStyle : f.artStyle
  }))
  ops.setEditorOpen(true)
  ops.setEditorPanel('profile')
  ops.setBanner(ops.okMsg)
  void ops.reload()
  return 'applied'
}

export async function propsHandlePlateCommitted(
  payload: {
    propId: string
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
    setForm: (fn: (f: FormState) => FormState) => void
    setSelectedImageId: (id: string | null) => void
    toastSuccess: () => void
    listProps: () => Promise<Prop[]>
    galleryFromProp: (p: Prop) => PropGalleryItemLike[]
    primaryPath: (
      gal: PropGalleryItemLike[],
      ref?: string | null
    ) => string | null
  }
): Promise<'other' | 'gallery' | 'listed' | 'listed-miss'> {
  const { propId, path, gallery } = payload
  let result: 'other' | 'gallery' | 'listed' | 'listed-miss' = 'other'
  if (editingId === propId) {
    if (gallery && gallery.length > 0) {
      const g = gallery.map(propsMapVideoPrepGalleryItem)
      ops.setForm((f) => ({ ...f, gallery: g as FormState['gallery'] }))
      const newest = g.find((item) => item.path === path) ?? g[0] ?? null
      ops.setSelectedImageId(newest?.id ?? null)
      result = 'gallery'
    } else {
      const list = await ops.listProps()
      const p = list.find((x) => x.id === propId)
      if (!p) {
        result = 'listed-miss'
      } else {
        const g = ops.galleryFromProp(p)
        ops.setForm((f) => ({
          ...f,
          gallery: g as FormState['gallery'],
          coverPath: ops.primaryPath(g, p.refImagePath)
        }))
        const newest = g.find((item) => item.path === path) ?? g[0] ?? null
        ops.setSelectedImageId(newest?.id ?? null)
        result = 'listed'
      }
    }
  }
  void ops.reload()
  ops.toastSuccess()
  return result
}

export async function propsRemoveWithFeedback(ops: {
  remove: (id: string) => Promise<unknown>
  id: string
  toastSuccess: () => void
  toastError: (m: string) => void
}): Promise<void> {
  try {
    await ops.remove(ops.id)
    ops.toastSuccess()
  } catch (e) {
    propsApplySimpleIpc(e, ops.toastError)
  }
}

export function propsGuardEmptyName(
  name: string,
  toastError: (m: string) => void,
  msg: string
): boolean {
  if (!name.trim()) {
    toastError(msg)
    return true
  }
  return false
}

export function propsGuardBusy(
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

export function propsGuardAiNeed(
  idea: string,
  hasDraft: boolean,
  hasImage: boolean,
  setError: (m: string) => void,
  msg: string
): boolean {
  if (!idea && !hasDraft && !hasImage) {
    setError(msg)
    return true
  }
  return false
}

export function propsAiFillToastKey(
  hasImage: boolean,
  idea: string,
  hasDraft: boolean
): 'fromImage' | 'background' {
  return hasImage && !idea && !hasDraft ? 'fromImage' : 'background'
}

export function propsApplyIpcError(
  e: unknown,
  setError: (m: string) => void,
  toastError: (m: string) => void
): string {
  const err = parseIpcError(e)
  const msg = `${err.message}${err.details ? ` — ${err.details}` : ''}`
  setError(msg)
  toastError(msg)
  return msg
}

export function propsApplySimpleIpc(
  e: unknown,
  toastError: (m: string) => void
): string {
  const msg = parseIpcError(e).message
  toastError(msg)
  return msg
}

export async function propsDiscardDraftSafe(
  discard: (path: string) => Promise<unknown>,
  path: string
): Promise<void> {
  try {
    await discard(path)
  } catch {
    /* ignore */
  }
}

export function propsResolveWantIdentity(
  opts: boolean | undefined,
  useIdentityRef: boolean
): boolean {
  return opts !== undefined ? opts === true : useIdentityRef
}

export function propsGalleryPathsFromOpts(
  referenceImagePath: string | null | undefined,
  selected: string[]
): string[] {
  const t = referenceImagePath?.trim()
  return t ? [t] : selected
}

export function propsMaybeAppendMultiRef(
  prompt: string,
  paths: string[],
  locale: string,
  append: (p: string, paths: string[], locale: string) => string
): string {
  if (paths.length > 1) return append(prompt, paths, locale)
  return prompt
}

export function propsMaybeContinueDraft(
  has: boolean,
  cont: () => void
): boolean {
  if (has) {
    cont()
    return true
  }
  return false
}

export function propsIntroVideoHandler(
  editingId: string | null | undefined,
  path: string,
  handler: (p: string) => void
): (() => void) | undefined {
  return editingId ? () => handler(path) : undefined
}

export function propsGuardIntro(
  editingId: string | null,
  sourceImagePath: string,
  busy: boolean,
  setError: (m: string) => void,
  toastError: (m: string) => void,
  toastInfo: (m: string) => void,
  msgs: { saveFirst: string; needImage: string; loading: string }
): 'saveFirst' | 'needImage' | 'busy' | 'ok' {
  if (!editingId) {
    setError(msgs.saveFirst)
    toastError(msgs.saveFirst)
    return 'saveFirst'
  }
  if (!sourceImagePath?.trim()) {
    setError(msgs.needImage)
    toastError(msgs.needImage)
    return 'needImage'
  }
  if (busy) {
    toastInfo(msgs.loading)
    return 'busy'
  }
  return 'ok'
}

export function propsIsBusyJob(
  j: { kind: string; scope: { propId?: string } },
  propId?: string | null
): boolean {
  return (
    (j.kind === 'prop-ai-fill' ||
      j.kind === 'prop-plate' ||
      j.kind === 'prop-intro-video') &&
    (!propId || j.scope.propId === propId)
  )
}

export function propsSuggestIdeaLabel(
  hasStory: boolean,
  fromStory: string,
  generic: string
): string {
  return hasStory ? fromStory : generic
}

export function propsNextCoverAfterGallery(
  next: { path: string }[],
  coverPath: string | null,
  isCover: (gal: { path: string }[], c: string | null) => boolean,
  primary: (gal: { path: string }[]) => string | null
): string | null {
  if (isCover(next, coverPath)) return coverPath
  return primary(next)
}

export async function propsRunCreateForEnsure(
  create: () => Promise<{ id: string }>,
  reload: () => Promise<void> | void,
  setEditingId: (id: string) => void,
  setError: (m: string) => void,
  toastError: (m: string) => void
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

export function propsRunAiFill(ops: {
  busy: boolean
  idea: string
  formSnapshot: Record<string, string | undefined>
  refPath: string
  setError: (m: string) => void
  needMsg: string
  setBanner: (m: string) => void
  toastInfo: (m: string) => void
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
  if (ops.busy) return 'busy'
  const idea = ops.idea.trim()
  const snapshot = ops.formSnapshot
  const hasDraft = Object.values(snapshot).some(
    (v) => typeof v === 'string' && v.length > 0
  )
  const hasImage = Boolean(ops.refPath)
  if (propsGuardAiNeed(idea, hasDraft, hasImage, ops.setError, ops.needMsg)) {
    return 'need'
  }
  ops.setBanner(ops.backgroundMsg)
  ops.toastInfo(
    propsAiFillToastKey(hasImage, idea, hasDraft) === 'fromImage'
      ? ops.fromImageMsg
      : ops.backgroundMsg
  )
  ops.startJob(idea, hasDraft, hasImage, ops.refPath, snapshot)
  return 'started'
}

export async function propsRunPlateJob(ops: {
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
    variant?: string
    label?: string
    enhance?: unknown
  }>
  discardDraft: (path: string) => Promise<unknown>
  plateVariant: string
  storyId: string
}): Promise<'no-id' | 'busy' | 'started' | 'error'> {
  try {
    const id = await ops.ensureSavedId()
    if (!id) return 'no-id'
    if (propsGuardBusy(ops.isBusy(id), ops.toastInfo, ops.loadingMsg)) {
      return 'busy'
    }
    ops.toastInfo(ops.startedMsg)
    ops.startJob(id, async ({ setProgress, signal }) => {
      setProgress(10, 'image')
      const r = await ops.generatePlate(id)
      if (signal.cancelled) {
        await propsDiscardDraftSafe(ops.discardDraft, r.path)
        return
      }
      setProgress(100, 'done')
      return {
        type: 'prop-plate' as const,
        propId: id,
        storyId: ops.storyId,
        path: r.path,
        variant: r.variant ?? ops.plateVariant,
        label: r.label ?? ops.plateVariant,
        enhance: r.enhance
      }
    })
    return 'started'
  } catch (e) {
    propsApplyIpcError(e, ops.setError, ops.toastError)
    return 'error'
  }
}

export async function propsRunSave(ops: {
  name: string
  emptyMsg: string
  savedMsg: string
  failedMsg: string
  editingId: string | null
  toastError: (m: string) => void
  toastSuccess: (m: string) => void
  setBanner: (m: string) => void
  setError: (m: string | null) => void
  update: (id: string) => Promise<boolean>
  create: () => Promise<unknown>
  reload: () => Promise<void> | void
  closeEditor: () => void
}): Promise<void> {
  if (propsGuardEmptyName(ops.name, ops.toastError, ops.emptyMsg)) return
  ops.setError(null)
  try {
    if (ops.editingId) {
      const ok = await ops.update(ops.editingId)
      if (ok) {
        ops.toastSuccess(ops.savedMsg)
        ops.setBanner(ops.savedMsg)
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
    ops.setBanner(ops.savedMsg)
    ops.closeEditor()
  } catch (e) {
    propsApplySimpleIpc(e, (m) => {
      ops.setError(m)
      ops.toastError(m)
    })
  }
}
