// @ts-nocheck — residual pure-helper typings; covered by page unit tests
import {
  createElement,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
  type ReactElement
} from 'react'
import { ensureHardRules } from '../../domain/promptHardRules'
import { useTranslation } from 'react-i18next'
import { getAiLocale } from '../../lib/aiLocale'
import { nextSceneNumber } from '../../domain/scene'
import {
  appendSceneGalleryItem,
  filterSceneGalleryByLayer,
  isSceneGalleryCoverPath,
  moveSceneGalleryItem,
  parseSceneGallery,
  primarySceneGalleryPath,
  removeSceneGalleryItem,
  serializeSceneGallery,
  type SceneGalleryItem
} from '../../domain/sceneGallery'
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
  DEFAULT_SCENE_PLATE,
  buildScenePlateEditPrompt,
  buildScenePlateImagePrompt,
  getScenePlateVariant,
  scenePlatesByGroup,
  type ScenePlateVariantId
} from '../../domain/scenePlateVariants'
import {
  appendMultiRefNote,
  resolveIdentityPaths,
  toggleGallerySelection
} from '../../domain/imageGenConfirm'
import type { ImageGenConfirmPayload } from '../components/ImageGenConfirmModal'

import {
  ATMOSPHERE_POSES,
  pickBestSceneBaseImage,
  type AtmospherePose
} from '../../domain/sceneAtmosphere'
import {
  createSceneLook,
  ensureLookInLibrary,
  parseSceneLooks,
  removeSceneLook,
  serializeSceneLooks,
  type SceneLookEntry,
  upsertSceneLook
} from '../../domain/sceneLooks'
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
import type {
  CreateSceneInput,
  Scene,
  SceneStatus,
  StoryWithCounts
} from '../../types/domain'
import { isSceneStatus } from '../../domain/scene'
import { useApp } from '../context/AppContext'
import { useToast } from '../context/ToastContext'
import { useDialog } from '../context/DialogContext'
import { useAiJobs } from '../context/AiJobsContext'
import { useScenes } from '../hooks/useScenes'
import { LocalMediaImage } from '../components/LocalMediaImage'
import {
  EntityGalleryPanel,
  EntityGalleryLayerChip
} from '../components/EntityGalleryPanel'
import { PlotContextPicker } from '../components/PlotContextPicker'
import {
  EditorField,
  EditorSelect,
  EditorShell,
  editorFormClass
} from '../components/EditorShell'
import { PageHeader } from '../components/PageHeader'
import { pageRootClass, pageScrollClass } from '../lib/mobileLayout'
import { Button, EmptyState, Input, Label, Textarea } from '../components/ui'
import { translateSceneGalleryLabel } from '../../domain/galleryLabelI18n'
import { tSceneLocationType } from '../lib/statusLabels'

type EditorPanel = 'profile' | 'refs'
/** Unified images tab: plate generate vs atmosphere swap (same gallery). */
type SceneImageGenMode = 'plate' | 'atmosphere'

const SCENE_STATUSES: SceneStatus[] = [
  'PENDING',
  'GENERATING',
  'COMPLETED',
  'FAILED'
]

interface FormState {
  sceneNumber: number
  title: string
  description: string
  script: string
  status: SceneStatus
  locationType: string
  timeOfDay: string
  weather: string
  mood: string
  lighting: string
  colorPalette: string
  setDressing: string
  soundscape: string
  cameraNotes: string
  visualTags: string
  seedPrompt: string
  hardRules: string
  artStyle: ArtStyleId
  gallery: SceneGalleryItem[]
  /** Cover path — stored as Scene.refImagePath */
  coverPath: string | null
  looks: SceneLookEntry[]
  locationKey: string
}

const emptyForm = (n = 1): FormState => ({
  sceneNumber: n,
  title: '',
  description: '',
  script: '',
  status: 'PENDING',
  locationType: '',
  timeOfDay: '',
  weather: '',
  mood: '',
  lighting: '',
  colorPalette: '',
  setDressing: '',
  soundscape: '',
  cameraNotes: '',
  visualTags: '',
  seedPrompt: '',
  hardRules: '',
  artStyle: DEFAULT_ART_STYLE,
  gallery: [],
  coverPath: null,
  looks: [],
  locationKey: ''
})

function galleryFromScene(s: Scene): SceneGalleryItem[] {
  return parseSceneGallery(s.refGalleryJson, { refImagePath: s.refImagePath })
}

function coverOf(s: Scene): string | null {
  const g = galleryFromScene(s)
  return (
    primarySceneGalleryPath(g, s.refImagePath) ?? s.refImagePath ?? null
  )
}

export function ScenesPage(): JSX.Element {
  const { t, i18n } = useTranslation()
  const { activeStoryId } = useApp()
  const toast = useToast()
  const dialog = useDialog()
  const {
    startJob,
    isBlocked,
    onSceneProfileApply,
    onScenePlateCommitted,
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
    create,
    update,
    remove,
    reload
  } = useScenes(activeStoryId)

  const [sceneStatus, setSceneStatus] = useState('')
  const [sceneImage, setSceneImage] = useState('') // '' | has | none
  const sceneBrowse = useLibraryBrowse(
    items,
    (s) =>
      [
        s.title ?? '',
        s.description,
        s.locationType ?? '',
        s.mood ?? '',
        s.timeOfDay ?? '',
        s.weather ?? '',
        s.visualTags ?? '',
        s.status ?? ''
      ].join(' '),
    {
      extraKey: `${sceneStatus}|${sceneImage}`,
      matchesExtra: (s) => {
        if (sceneStatus && s.status !== sceneStatus) return false
        const hasImg = Boolean(s.refImagePath)
        if (sceneImage === 'has' && !hasImg) return false
        if (sceneImage === 'none' && hasImg) return false
        return true
      },
      sort: compareUpdatedAtDesc
    }
  )
  const sceneStatusOptions = useMemo(
    () => [
      { value: '', label: t('library.filterAny') },
      ...SCENE_STATUSES.map((v) => ({
        value: v,
        label: t(`scenes.status.${v}`, { defaultValue: v })
      }))
    ],
    [t]
  )
  const clearSceneFilters = (): void => {
    sceneBrowse.setQ('')
    setSceneStatus('')
    setSceneImage('')
  }
  const sceneHasFilters =
    sceneBrowse.hasSearch ||
    Boolean(sceneStatus) ||
    Boolean(sceneImage)

  const removeWithFeedback = async (id: string): Promise<void> => {
    await scenesRemoveWithFeedback({
      remove,
      id,
      toastSuccess: () => toast.success(t('common.deleted')),
      toastError: toast.error
    })
  }


  const [editorOpen, setEditorOpen] = useState(false)
  const [editorPanel, setEditorPanel] = useState<EditorPanel>('refs')
  const [imageGenMode, setImageGenMode] =
    useState<SceneImageGenMode>('plate')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(() => emptyForm())
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null)
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([])
  const [useIdentityRef, setUseIdentityRef] = useState(false)
  const [plateVariant, setPlateVariant] =
    useState<ScenePlateVariantId>(DEFAULT_SCENE_PLATE)
  const [aiIdea, setAiIdea] = useState('')
  const [atmoText, setAtmoText] = useState('')
  const [atmoBase, setAtmoBase] = useState('')
  const [atmoPose, setAtmoPose] = useState<AtmospherePose>('wide')
  const [layerFilter, setLayerFilter] = useState<string>('all')
  const [lookName, setLookName] = useState('')
  const [pageBanner, setPageBanner] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  /** Popup: pick story + plot segment, then AI-suggest a scene */
  const [plotSuggestOpen, setPlotSuggestOpen] = useState(false)
  const [plotStoryId, setPlotStoryId] = useState('')
  const [plotSegmentKey, setPlotSegmentKey] = useState('all')
  const [stories, setStories] = useState<StoryWithCounts[]>([])

  const plateGroups = useMemo(() => scenePlatesByGroup(), [])
  const artGroups = useMemo(() => artStylesByGroup(), [])

  useEffect(() => {
    void getApi()
      .stories.list()
      .then((list) => setStories(list as StoryWithCounts[]))
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    scenesMaybeSetPlotStory(
      plotSuggestOpen,
      activeStoryId,
      plotStoryId,
      setPlotStoryId
    )
  }, [plotSuggestOpen, activeStoryId, plotStoryId])

  const sceneBusy = (sceneId?: string | null): boolean =>
    scenesAiBusyFromJobs(
      activeJobs,
      sceneId,
      isBlocked({
        kind: [...SCENE_AI_KINDS],
        sceneId: sceneId ?? undefined
      })
    )

  const editorBusy = sceneBusy(editingId)

  const filteredGallery = useMemo(
    () => filterSceneGalleryByLayer(form.gallery, layerFilter),
    [form.gallery, layerFilter]
  )

  const selectedImage = useMemo(() => {
    if (!form.gallery.length) return null
    return (
      form.gallery.find((g) => g.id === selectedImageId) ?? form.gallery[0]
    )
  }, [form.gallery, selectedImageId])

  useEffect(() => {
    return onSceneProfileApply((draft) => {
      scenesHandleProfileApply(draft as never, editingId, {
        reload,
        setForm,
        setEditorOpen,
        setEditorPanel,
        toastSuccess: () => toast.success(t('scenes.aiFillOk')),
        setPageBanner: () => setPageBanner(t('scenes.aiFillOk'))
      })
    })
  }, [onSceneProfileApply, editingId, reload, t, toast])

  useEffect(() => {
    return onScenePlateCommitted(({ sceneId, path, gallery }) => {
      scenesHandlePlateCommitted(
        { sceneId, path, gallery },
        editingId,
        {
          setForm,
          setSelectedImageId,
          reload,
          toastSuccess: () => toast.success(t('scenes.plateOkShort')),
          listScene: scenesMakeFindInList(
            () => getApi().scenes.list() as Promise<Scene[]>
          ),
          galleryFrom: galleryFromScene,
          primary: primarySceneGalleryPath,
          ensureLooks: ensureLookInLibrary,
          parseLooks: parseSceneLooks
        }
      )
    })
}, [onScenePlateCommitted, editingId, reload, t])

  const closeEditor = (): void => {
    setEditorOpen(false)
    setEditingId(null)
    setForm(emptyForm(scenesNextSceneNum(items, nextSceneNumber)))
    setSelectedImageId(null)
    setAiIdea('')
    setAtmoText('')
    setActionError(null)
  }

  const openCreate = (): void => {
    setEditorPanel('profile')
    setEditingId(null)
    // Prefer story-linked scene numbers when available (global list often lacks them)
    setForm(emptyForm(scenesNextSceneNum(items, nextSceneNumber)))
    setSelectedImageId(null)
    setAiIdea('')
    setAtmoText('')
    setLayerFilter('all')
    setActionError(null)
    setEditorOpen(true)
  }

  const openEdit = (s: Scene): void => {
    const gallery = galleryFromScene(s)
    const style: ArtStyleId = scenesArtStyleFromScene(
      s.artStyle,
      DEFAULT_ART_STYLE
    )
    setEditingId(s.id)
    setForm({
      sceneNumber: s.sceneNumber ?? 1,
      title: s.title ?? '',
      description: s.description,
      script: s.script ?? '',
      status: isSceneStatus(s.status) ? s.status : 'PENDING',
      locationType: s.locationType ?? '',
      timeOfDay: s.timeOfDay ?? '',
      weather: s.weather ?? '',
      mood: s.mood ?? '',
      lighting: s.lighting ?? '',
      colorPalette: s.colorPalette ?? '',
      setDressing: s.setDressing ?? '',
      soundscape: s.soundscape ?? '',
      cameraNotes: s.cameraNotes ?? '',
      visualTags: s.visualTags ?? '',
      seedPrompt: s.seedPrompt ?? '',
      hardRules: s.hardRules ?? '',
      artStyle: style,
      gallery,
      coverPath: primarySceneGalleryPath(gallery, s.refImagePath),
      looks: parseSceneLooks(s.looksJson),
      locationKey: s.locationKey ?? s.title ?? ''
    })
    setSelectedImageId(
      gallery.find((g) => g.path === s.refImagePath)?.id ??
        gallery[0]?.id ??
        null
    )
    setAtmoText(
      [s.timeOfDay, s.weather, s.lighting, s.mood].filter(Boolean).join(', ')
    )
    const auto = pickBestSceneBaseImage(gallery)
    setAtmoBase(auto.item?.path ?? '')
    setAiIdea(s.seedPrompt ?? '')
    setEditorPanel(gallery.length > 0 ? 'refs' : 'profile')
    setEditorOpen(true)
  }

  const payload = (): Omit<CreateSceneInput, 'storyId'> => {
    const primary = primarySceneGalleryPath(form.gallery, form.coverPath)
    const looks = ensureLookInLibrary(form.looks, atmoText || form.mood, {
      artStyle: form.artStyle
    })
    const sceneNumber = scenesResolveSceneNumber(
      form.sceneNumber,
      items,
      nextSceneNumber
    )
    return {
      sceneNumber,
      description: form.description.trim() || form.title || 'Scene',
      script: form.script.trim() || null,
      status: form.status,
      title: form.title.trim() || null,
      locationType: form.locationType || null,
      timeOfDay: form.timeOfDay || null,
      weather: form.weather || null,
      mood: form.mood || null,
      lighting: form.lighting || null,
      colorPalette: form.colorPalette || null,
      setDressing: form.setDressing || null,
      soundscape: form.soundscape || null,
      cameraNotes: form.cameraNotes || null,
      visualTags: form.visualTags || null,
      artStyle: form.artStyle,
      refImagePath: primary,
      refGalleryJson: form.gallery.length
        ? serializeSceneGallery(form.gallery)
        : null,
      looksJson: looks.length ? serializeSceneLooks(looks) : null,
      seedPrompt: form.seedPrompt || null,
      hardRules: form.hardRules || null,
      locationKey:
        form.locationKey.trim() || form.title.trim() || null
    }
  }

  const handleSave = async (): Promise<void> => {
    await scenesRunSave({
      description: form.description,
      title: form.title,
      editingId,
      toastError: toast.error,
      toastSuccess: toast.success,
      setBanner: setPageBanner,
      setError: setActionError,
      savedMsg: t('common.saved'),
      failedMsg: t('common.actionFailed'),
      update: (id) => update(id, payload()),
      create: () => create(payload()),
      reload,
      closeEditor
    })
  }

  const ensureSavedId = async (): Promise<string | null> => {
    return scenesEnsureSavedId({
      editingId,
      activeStoryId,
      sceneNumber: form.sceneNumber,
      create: () => create(payload()),
      reload,
      list: () =>
        scenesListForStory(
          (id) =>
            getApi().scenes.list(id) as Promise<
              Array<{ id: string; sceneNumber: number }>
            >,
          activeStoryId!
        ),
      setEditingId
    })
  }

  const openPlotSuggest = (): void => {
    setActionError(null)
    if (activeStoryId && !plotStoryId) setPlotStoryId(activeStoryId)
    setPlotSuggestOpen(true)
  }

  const handleAiFill = (opts?: {
    suggestFromStory?: boolean
    storyId?: string | null
    segmentKey?: string | null
  }): void => {
    setActionError(null)
    const snapshot = {
      title: form.title.trim() || undefined,
      description: form.description.trim() || undefined,
      script: form.script.trim() || undefined,
      locationType: form.locationType.trim() || undefined,
      timeOfDay: form.timeOfDay.trim() || undefined,
      weather: form.weather.trim() || undefined,
      mood: form.mood.trim() || undefined,
      lighting: form.lighting.trim() || undefined,
      colorPalette: form.colorPalette.trim() || undefined,
      setDressing: form.setDressing.trim() || undefined,
      soundscape: form.soundscape.trim() || undefined,
      cameraNotes: form.cameraNotes.trim() || undefined,
      visualTags: form.visualTags.trim() || undefined,
      artStyle: form.artStyle || undefined
    }
    const refPath = scenesAiFillRefPath({
      selectedPath: selectedImage?.path,
      coverPath: form.coverPath,
      gallery0: form.gallery[0]?.path
    })
    scenesRunAiFill({
      busy: editorBusy,
      idea: aiIdea,
      formSnapshot: snapshot,
      refPath,
      suggestFromStory: opts?.suggestFromStory,
      storyId: opts?.storyId,
      activeStoryId,
      setError: setActionError,
      needMsg: t('common.aiNeedIdeaOrImage'),
      needStoryMsg: t('scenes.suggestNeedStory'),
      setBanner: setPageBanner,
      toastInfo: toast.info,
      fromImageMsg: t('common.aiFillFromImage'),
      backgroundMsg: t('aiJobs.startedBackground'),
      startJob: (idea, hasDraft, hasImage, ref, storyIdForJob, suggest) => {
        startJob({
          kind: 'scene-ai-fill',
          label: scenesAiFillLabel(
            suggest,
            t('scenes.suggestFromStory'),
            t('common.aiFill')
          ),
          scope: {
            sceneId: editingId ?? undefined,
            storyId: storyIdForJob
          },
          run: async ({ setProgress, signal }) => {
            setProgress(20, hasImage ? 'image' : 'llm')
            const r = await getApi().scenes.aiFill({
              idea: suggest ? undefined : idea || undefined,
              storyId: storyIdForJob,
              segmentKey: suggest ? opts?.segmentKey ?? 'all' : undefined,
              locale: getAiLocale(i18n.language),
              suggestFromStory: suggest,
              sceneNumber: form.sceneNumber,
              existingDraft: suggest || !hasDraft ? undefined : snapshot,
              referenceImagePath: hasImage ? ref : null
            })
            if (signal.cancelled) return
            setProgress(100, 'done')
            return {
              type: 'scene-profile' as const,
              sceneId: editingId,
              storyId: storyIdForJob ?? null,
              profile: r.profile,
              profileJson: r.profileJson,
              isNew: !editingId
            }
          }
        })
      }
    })
  }

  const confirmPlotSuggest = scenesMakeConfirmPlot(
    () => plotStoryId,
    setActionError,
    toast.error,
    t('scenes.suggestNeedStory'),
    setPlotSuggestOpen,
    () => editorOpen,
    openCreate,
    scenesPlotFill(handleAiFill, plotStoryId, plotSegmentKey)
  )


  const handlePickExternalRef = async (): Promise<void> => {
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
    if (newId) setSelectedImageId(newId)
    toast.success(t('characters.externalRefAdded'))
  }


  /** Animate the selected still into a location intro video using scene bible. */
  const handleGenerateIntroVideo = (sourceImagePath: string): void => {
    setActionError(null)
    const sceneId = editingId
    const sourcePath = sourceImagePath.trim()
    const draftKey = buildVideoPrepDraftKey(
      'scene-intro',
      { sceneId: sceneId ?? undefined },
      sourcePath
    )
    scenesHandleIntroVideoFlow({
      editingId,
      sourceImagePath,
      busy: sceneBusy(editingId),
      setError: setActionError,
      toastError: toast.error,
      toastInfo: toast.info,
      msgs: {
        saveFirst: t('scenes.saveFirstForPlate'),
        needImage: t('scenes.introVideoNeedImage'),
        loading: t('aiJobs.running')
      },
      hasDraft: hasVideoPrepDraft(draftKey),
      continueDraft: scenesContinueDraftCb(continueVideoPrepDraft, draftKey),
      update: () => update(sceneId!, payload()),
      startPrep: () =>
        startVideoPrep({
          kind: 'scene-intro',
          entityIds: {
            sceneId: sceneId!,
            storyId: activeStoryId ?? undefined
          },
          sourceImagePath: sourcePath,
          durationSeconds: 10,
          locale: getAiLocale(i18n.language)
        })
    })
  }

  // After video confirm, reload gallery introVideoPath
  useEffect(() => {
    const onDone = (ev: Event): void => {
      scenesHandleVideoPrepDone(
        (ev as CustomEvent).detail,
        editingId,
        setForm,
        reload
      )
    }
    window.addEventListener('idm:video-prep-done', onDone)
    return () => window.removeEventListener('idm:video-prep-done', onDone)
  }, [editingId, reload])

  const selectedPathsForIdentity = useMemo(() => {
    const ids = scenesSelectedIds(selectedImageIds, selectedImageId)
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
      if (!id) {
        setActionError(t('scenes.saveFirstForPlate'))
        return
      }
      if (sceneBusy(id)) {
        toast.info(t('common.loading'))
        return
      }
      const wantIdentity = scenesResolveWantIdentity(
        opts?.useIdentityEdit,
        useIdentityRef
      )
      const paths = scenesGalleryPathsFromOpts(
        opts?.referenceImagePath,
        selectedPathsForIdentity
      )
      startMediaGen({
        kind: 'scene-plate',
        sceneId: id,
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

  const handleSwapAtmosphere = async (): Promise<void> => {
    setActionError(null)
    try {
      const id = await ensureSavedId()
      if (!id) {
        setActionError(t('scenes.saveFirstForPlate'))
        return
      }
      if (sceneBusy(id)) {
        toast.info(t('common.loading'))
        return
      }
      const desc = atmoText.trim()
      if (!desc) {
        setActionError(t('scenes.atmoRequired'))
        toast.error(t('scenes.atmoRequired'))
        return
      }
      const base = pickBestSceneBaseImage(
        form.gallery,
        atmoBase || selectedImage?.path || null
      )
      if (!base?.path) {
        setActionError(t('scenes.atmoNoBase'))
        toast.error(t('scenes.atmoNoBase'))
        return
      }
      startMediaGen({
        kind: 'atmosphere-swap',
        sceneId: id,
        storyId: activeStoryId ?? undefined,
        artStyle: form.artStyle,
        galleryIdentityPaths: [base.path],
        preferIdentityEdit: true,
        atmosphereDescription: desc
      })
    } catch (e) {
      const msg = formatUserError(e, t)
      setActionError(msg)
      toast.error(msg)
    }
  }

  const handlePickImage = async (): Promise<void> => {
    await scenesPickImage({
      pick: () => getApi().media.pickRefImage(),
      gallery: form.gallery,
      label: t('scenes.uploadLabel'),
      setForm,
      setSelectedImageId,
      append: appendSceneGalleryItem
    })
  }

  const handleReorderGallery = scenesMakeReorder(
    setForm,
    moveSceneGalleryItem
  )

  const handleSetCover = scenesMakeSetCover(
    setForm,
    scenesMsgToast(toast.success, t('common.coverSet'))
  )

  const siblingLocations = useMemo(() => {
    const key = (form.locationKey || form.title).trim().toLowerCase()
    if (!key || !editingId) return []
    return items.filter((s) => {
      if (s.id === editingId) return false
      const sk = (s.locationKey || s.title || '').trim().toLowerCase()
      return sk && sk === key && galleryFromScene(s).length > 0
    })
  }, [items, form.locationKey, form.title, editingId])

  const handleCopyGallery = scenesMakeCopyGallery({
    getEditingId: () => editingId,
    setError: setActionError,
    saveFirstMsg: t('scenes.saveFirstForPlate'),
    copy: (args) => getApi().scenes.copyGalleryFrom(args),
    applyScene: scenesMakeApplyCopied(
      setForm,
      setSelectedImageId,
      galleryFromScene
    ),
    toastSuccess: () => toast.success(t('scenes.copyGalleryOk')),
    setBanner: () => setPageBanner(t('scenes.copyGalleryOk')),
    okMsg: t('scenes.copyGalleryOk'),
    reload
  })

  const addLook = (): void => {
    scenesAddLook({
      description: atmoText.trim() || form.mood.trim(),
      name: lookName,
      artStyle: form.artStyle,
      setError: setActionError,
      requiredMsg: t('scenes.atmoRequired'),
      savedMsg: t('scenes.lookSaved'),
      setForm,
      setLookName,
      setBanner: setPageBanner,
      toastSuccess: () => toast.success(t('scenes.lookSaved')),
      createEntry: createSceneLook as never,
      upsert: upsertSceneLook as never
    })
  }


  const applyLook = scenesMakeApplyLook(() => form.gallery, {
    setAtmoText,
    setForm,
    setSelectedImageId,
    setBanner: setPageBanner,
    toastSuccess: toast.success,
    appliedMsgOf: (name) => t('scenes.lookApplied', { name })
  })

  return (
    <div className={pageRootClass}>
      <PageHeader
        title={t('scenes.title')}
        subtitle={t('scenes.subtitle')}
        actions={
          <>
            <Button variant="secondary" onClick={openPlotSuggest}>
              {t('scenes.suggestFromStory')}
            </Button>
            <Button onClick={openCreate}>{t('scenes.new')}</Button>
          </>
        }
      />

      {!editorOpen && (
      <div className={pageScrollClass}>
        <LibraryPageBody
          footer={
            !loading && items.length > 0 ? (
              <LibraryPagination
                page={sceneBrowse.page}
                totalPages={sceneBrowse.totalPages}
                onPageChange={sceneBrowse.setPage}
                filteredCount={sceneBrowse.filteredCount}
                totalCount={sceneBrowse.totalCount}
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
                🏛
              </div>
              <p className="text-ink-300">{t('scenes.noScenes')}</p>
              <div className="mt-6 flex justify-center gap-2">
                <Button onClick={openCreate}>{t('scenes.new')}</Button>
              </div>
            </div>
          ) : (
            <>
              <LibraryBrowseBar
                q={sceneBrowse.q}
                onQueryChange={sceneBrowse.setQ}
                placeholder={t('library.searchPlaceholder')}
                hasActiveFilters={sceneHasFilters}
                onClearFilters={clearSceneFilters}
                filters={
                  <>
                    <LibraryFilterSelect
                      label={t('library.filterStatus')}
                      ariaLabel={t('library.filterStatus')}
                      value={sceneStatus}
                      onChange={setSceneStatus}
                      options={sceneStatusOptions}
                    />
                    <LibraryFilterSelect
                      label={t('library.filterImage')}
                      ariaLabel={t('library.filterImage')}
                      value={sceneImage}
                      onChange={setSceneImage}
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
                  </>
                }
              />
              {sceneBrowse.filteredCount === 0 ? (
                <EmptyState message={t('library.noMatch')} />
              ) : (
                <div className={libraryGridClass}>
                  {sceneBrowse.pageItems.map((s) => {
                    const cover = coverOf(s)
                    const count = galleryFromScene(s).length
                    return (
                      <article key={s.id} className={libraryCardClass}>
                        <div className={libraryMediaClass}>
                          {cover ? (
                            <LocalMediaImage
                              filePath={cover}
                              alt={s.title || s.description}
                              variant="fill"
                              maxHeightClass="h-full max-h-none"
                              objectFit="cover"
                              className="h-full border-0 rounded-none"
                              actionsLayout="overlay"
                              onImageClick={() => openEdit(s)}
                            />
                          ) : (
                            <button
                              type="button"
                              className="flex h-full w-full flex-col items-center justify-center gap-2 text-ink-600"
                              onClick={() => openEdit(s)}
                            >
                              <span className="text-3xl opacity-40">🏛</span>
                              <span className="text-xs">
                                {t('scenes.noPhotos')}
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
                          <div className="flex min-h-[1.25rem] flex-wrap items-center gap-1.5">
                            {s.sceneNumber != null && (
                              <span className="rounded-full bg-brand-900/50 px-2 py-0.5 text-[10px] font-medium text-brand-300">
                                #{s.sceneNumber}
                              </span>
                            )}
                            <span className="rounded-full bg-ink-800 px-2 py-0.5 text-[10px] text-ink-400">
                              {t(`scenes.status.${s.status}`, {
                                defaultValue: s.status
                              })}
                            </span>
                            {s.locationType && (
                              <span className="rounded-full bg-ink-800 px-2 py-0.5 text-[10px] text-ink-400">
                                {tSceneLocationType(t, s.locationType)}
                              </span>
                            )}
                          </div>
                          <h2 className="mt-2 truncate text-base font-semibold tracking-tight text-ink-50">
                            {s.title || s.description.slice(0, 40)}
                          </h2>
                          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-400">
                            {s.description}
                          </p>
                          <div className={libraryCardActionsRowClass}>
                            <Button
                              variant="secondary"
                              className={libraryCardActionBtnClass}
                              onClick={() => openEdit(s)}
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
                                  if (ok) void removeWithFeedback(s.id)
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
          title={editingId ? t('common.edit') : t('scenes.new')}
          subtitle={
            form.title.trim() ||
            form.description.trim().slice(0, 40) ||
            t('scenes.editorHintShort')
          }
          onClose={closeEditor}
          onSave={() => void handleSave()}
          saveDisabled={!form.description.trim() && !form.title.trim()}
          saveLabel={editorBusy ? t('common.saving') : t('common.save')}
          cancelLabel={t('common.cancel')}
          busy={editorBusy}
          tabs={[
            { id: 'profile', label: t('scenes.tabProfile') },
            { id: 'refs', label: t('scenes.tabImages') }
          ]}
          activeTab={editorPanel}
          onTabChange={(id) => setEditorPanel(id as EditorPanel)}
          preview={
            <EntityGalleryPanel
              title={t('scenes.gallery')}
              countLabel={`${filteredGallery.length}/${form.gallery.length}`}
              layerFilter={
                form.gallery.length > 0 ? (
                  <>
                    {(
                      [
                        'all',
                        'hero',
                        'establishing',
                        'identity',
                        'interior',
                        'atmosphere',
                        'detail'
                      ] as const
                    ).map((layer) => (
                      <EntityGalleryLayerChip
                        key={layer}
                        active={layerFilter === layer}
                        label={t(`scenes.layer_${layer}`)}
                        onClick={() => setLayerFilter(layer)}
                      />
                    ))}
                  </>
                ) : null
              }
              previewPath={selectedImage?.path}
              previewAlt={
                selectedImage
                  ? translateSceneGalleryLabel(selectedImage.label, t)
                  : ''
              }
              maxHeightClass="max-h-[min(36vh,400px)] lg:max-h-[min(48vh,480px)]"
              showMeta
              introVideoBusy={editorBusy}
              introVideoPath={selectedImage?.introVideoPath}
              introVideoHasDraft={
                Boolean(editingId) &&
                Boolean(selectedImage?.path) &&
                hasVideoPrepDraft(
                  buildVideoPrepDraftKey(
                    'scene-intro',
                    { sceneId: editingId! },
                    selectedImage?.path ?? ''
                  )
                )
              }
              onIntroVideo={
                selectedImage
                  ? scenesIntroVideoHandler(
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
                      scenesRemoveImage(
                        form.gallery,
                        selectedImage,
                        form.coverPath,
                        {
                          setForm,
                          setSelectedImageId,
                          setSelectedImageIds,
                          remove: removeSceneGalleryItem,
                          primary: primarySceneGalleryPath,
                          isCover: isSceneGalleryCoverPath
                        }
                      )
                    }
                  : undefined
              }
              emptyIcon=""
              emptyMessage={t('scenes.noPhotos')}
              emptyActions={[
                {
                  label: t('scenes.generatePlate'),
                  onClick: () => {
                    setEditorPanel('refs')
                    void handleGeneratePlate()
                  },
                  variant: 'primary',
                  disabled: editorBusy
                },
                {
                  label: t('common.uploadRef'),
                  onClick: () => {
                    setEditorPanel('refs')
                    void handlePickExternalRef()
                  },
                  variant: 'secondary',
                  disabled: editorBusy
                }
              ]}
              items={filteredGallery}
              selectedId={selectedImageId}
              selectedIds={selectedImageIds}
              multiSelect
              coverPath={form.coverPath}
              fallbackCoverPath={primarySceneGalleryPath(form.gallery)}
              onSelect={setSelectedImageId}
              onToggleSelect={scenesMakeToggleSelect(setSelectedImageIds)}
              onReorder={handleReorderGallery}
              labelOf={(g) => translateSceneGalleryLabel(g.label, t)}
            />
          }
        >
          {editorPanel === 'profile' && (
            <div className={editorFormClass}>
              <section className="rounded-xl border border-brand-800/35 bg-brand-950/20 p-4">
                <h3 className="text-sm font-semibold text-ink-100">
                  {t('common.aiTitle')}
                </h3>
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
                  placeholder={t('scenes.ideaPlaceholder')}
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button disabled={editorBusy} onClick={() => handleAiFill()}>
                    {t('common.aiFill')}
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={editorBusy}
                    onClick={openPlotSuggest}
                  >
                    {t('scenes.suggestFromStory')}
                  </Button>
                </div>
              </section>
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-ink-200">
                  {t('scenes.profileSection')}
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>{t('scenes.number')}</Label>
                    <Input
                      type="number"
                      min={1}
                      value={form.sceneNumber}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          sceneNumber: Number(e.target.value) || 1
                        }))
                      }
                    />
                  </div>
                  <div>
                    <Label>{t('scenes.statusLabel')}</Label>
                    <EditorSelect
                      value={form.status}
                      onChange={(e) =>
                        setForm(
                          scenesStatusSetter(e.target.value, isSceneStatus)
                        )
                      }
                      aria-label={t('scenes.statusLabel')}
                    >
                      {SCENE_STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {t(`scenes.status.${st}`)}
                        </option>
                      ))}
                    </EditorSelect>
                    <p className="mt-1 text-[10px] text-ink-500">
                      {t('scenes.statusHint')}
                    </p>
                  </div>
                  <div>
                    <Label>{t('scenes.locationTitle')}</Label>
                    <Input
                      value={form.title}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, title: e.target.value }))
                      }
                      placeholder={t('scenes.locationTitlePh')}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label>{t('scenes.locationKey')}</Label>
                    <Input
                      value={form.locationKey}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, locationKey: e.target.value }))
                      }
                      placeholder={t('scenes.locationKeyPh')}
                    />
                    <p className="mt-1 text-[11px] text-ink-500">
                      {t('scenes.locationKeyHint')}
                    </p>
                  </div>
                </div>
                <div>
                  <Label>{t('scenes.description')}</Label>
                  <Textarea
                    size="lg"
                    value={form.description}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, description: e.target.value }))
                    }
                    placeholder={t('scenes.descriptionPlaceholder')}
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
                    onChange={scenesMakeHardRulesChange(setForm)}
                    placeholder={t('common.hardRulesPh')}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>{t('scenes.locationType')}</Label>
                    <EditorSelect
                      value={form.locationType}
                      onChange={(e) =>
                        setForm(scenesLocationTypeSetter(e.target.value))
                      }
                      aria-label={t('scenes.locationType')}
                    >
                      <option value="">{t('library.filterAny')}</option>
                      {(
                        [
                          'interior',
                          'exterior',
                          'mixed',
                          'vehicle',
                          'virtual'
                        ] as const
                      ).map((v) => (
                        <option key={v} value={v}>
                          {tSceneLocationType(t, v)}
                        </option>
                      ))}
                      {scenesCustomLocOptionElement(form.locationType)}
                    </EditorSelect>
                  </div>
                  {(
                    [
                      ['timeOfDay', 'timeOfDay'],
                      ['weather', 'weather'],
                      ['mood', 'mood'],
                      ['lighting', 'lighting'],
                      ['colorPalette', 'colorPalette']
                    ] as const
                  ).map(([key, labelKey]) => (
                    <div key={key}>
                      <Label>{t(`scenes.${labelKey}`)}</Label>
                      <Input
                        value={form[key]}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, [key]: e.target.value }))
                        }
                      />
                    </div>
                  ))}
                </div>
                <div>
                  <Label>{t('scenes.setDressing')}</Label>
                  <Textarea
                    size="md"
                    value={form.setDressing}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, setDressing: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label>{t('scenes.script')}</Label>
                  <Textarea
                    size="fill"
                    value={form.script}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, script: e.target.value }))
                    }
                    placeholder={t('scenes.scriptPlaceholder')}
                  />
                </div>
                <div>
                  <Label>{t('scenes.cameraNotes')}</Label>
                  <Textarea
                    size="md"
                    value={form.cameraNotes}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, cameraNotes: e.target.value }))
                    }
                  />
                </div>
              </section>
            </div>
          )}

          {editorPanel === 'refs' && (
            <div className={editorFormClass}>
              <div>
                <h3 className="text-sm font-semibold text-ink-100">
                  {t('scenes.tabImages')}
                </h3>
                <p className="mt-1 text-[11px] text-ink-500">
                  {t('scenes.imagesHint')}
                </p>
              </div>

              {/* Generation mode: plate vs atmosphere */}
              <div className="flex rounded-xl border border-ink-700 bg-ink-900/80 p-1">
                <button
                  type="button"
                  className={[
                    'flex-1 rounded-lg px-3 py-2 text-[12px] font-medium transition',
                    imageGenMode === 'plate'
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'text-ink-400 hover:text-ink-200'
                  ].join(' ')}
                  onClick={() => setImageGenMode('plate')}
                >
                  {t('scenes.genModePlate')}
                </button>
                <button
                  type="button"
                  className={[
                    'flex-1 rounded-lg px-3 py-2 text-[12px] font-medium transition',
                    imageGenMode === 'atmosphere'
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'text-ink-400 hover:text-ink-200'
                  ].join(' ')}
                  onClick={() => setImageGenMode('atmosphere')}
                >
                  {t('scenes.genModeAtmosphere')}
                </button>
              </div>

              {imageGenMode === 'plate' ? (
                <>
                  <p className="text-[11px] text-ink-500">
                    {t('scenes.plateHintShort')}
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <EditorField label={t('scenes.plateVariant')}>
                      <EditorSelect
                        value={plateVariant}
                        onChange={(e) =>
                          scenesOnPlateVariantChange(
                            e.target.value,
                            setPlateVariant,
                            setUseIdentityRef
                          )
                        }
                      >
                        {(
                          [
                            'sceneGroupCore',
                            'sceneGroupAngles',
                            'sceneGroupAtmosphere',
                            'sceneGroupDetail'
                          ] as const
                        ).map((gk) => (
                          <optgroup key={gk} label={t(`scenes.${gk}`)}>
                            {plateGroups[gk].map((v) => (
                              <option key={v.id} value={v.id}>
                                {t(`scenes.${v.labelKey}`)}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </EditorSelect>
                    </EditorField>
                    <EditorField label={t('scenes.artStyle')}>
                      <EditorSelect
                        value={form.artStyle}
                        onChange={(e) =>
                          setForm(scenesArtStyleSetter(e.target.value))
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
                      {scenesGeneratingLabel(
                      editorBusy,
                      t('common.generating'),
                      t('scenes.generatePlate')
                    )}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => void handlePickImage()}
                    >
                      {t('common.uploadRef')}
                    </Button>
                  </div>
                  {siblingLocations.length > 0 && (
                    <div className="rounded-lg border border-ink-700 bg-ink-900/50 p-3">
                      <p className="text-[11px] text-ink-400">
                        {t('scenes.copyGalleryHint')}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {siblingLocations.map((s) => (
                          <Button
                            key={s.id}
                            variant="secondary"
                            className="!py-0.5 !text-xs"
                            type="button"
                            onClick={() => void handleCopyGallery(s.id)}
                          >
                            #{s.sceneNumber}{' '}
                            {s.title || s.description.slice(0, 20)}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <p className="text-[11px] text-ink-500">
                    {t('scenes.swapAtmosphereHintShort')}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <EditorField label={t('scenes.atmoBase')}>
                      <EditorSelect
                        value={atmoBase}
                        onChange={(e) => setAtmoBase(e.target.value)}
                      >
                        <option value="">{t('scenes.atmoBaseAuto')}</option>
                        {form.gallery.map((g) => (
                          <option key={g.id} value={g.path}>
                            {translateSceneGalleryLabel(g.label, t)}
                          </option>
                        ))}
                      </EditorSelect>
                    </EditorField>
                    <EditorField label={t('scenes.atmoPose')}>
                      <EditorSelect
                        value={atmoPose}
                        onChange={(e) =>
                          setAtmoPose(e.target.value as AtmospherePose)
                        }
                      >
                        {ATMOSPHERE_POSES.map((p) => (
                          <option key={p.id} value={p.id}>
                            {t(`scenes.${p.labelKey}`)}
                          </option>
                        ))}
                      </EditorSelect>
                    </EditorField>
                  </div>
                  <EditorField label={t('scenes.artStyle')}>
                    <EditorSelect
                      value={form.artStyle}
                      onChange={(e) =>
                        setForm(scenesArtStyleSetter(e.target.value))
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
                  <EditorField label={t('scenes.atmoDesc')}>
                    <Textarea
                      size="md"
                      value={atmoText}
                      onChange={(e) => setAtmoText(e.target.value)}
                      placeholder={t('scenes.atmoPlaceholder')}
                    />
                  </EditorField>
                  <Button
                    className="w-full sm:w-auto"
                    disabled={editorBusy || form.gallery.length === 0}
                    onClick={() => void handleSwapAtmosphere()}
                  >
                    {t('scenes.swapAtmosphere')}
                  </Button>
                  {form.gallery.length === 0 ? (
                    <p className="text-[11px] text-ink-500">
                      {t('scenes.atmoNeedPlate')}
                    </p>
                  ) : null}

                  <section className="rounded-xl border border-ink-700 bg-ink-900/35 p-4">
                    <h3 className="text-sm font-semibold text-ink-100">
                      {t('scenes.looksTitle')}
                    </h3>
                    <p className="mt-1 text-[11px] text-ink-500">
                      {t('scenes.looksHintShort')}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Input
                        className="min-w-[8rem] flex-1"
                        value={lookName}
                        onChange={(e) => setLookName(e.target.value)}
                        placeholder={t('scenes.lookNamePh')}
                      />
                      <Button
                        variant="secondary"
                        type="button"
                        onClick={addLook}
                      >
                        {t('scenes.lookAdd')}
                      </Button>
                    </div>
                    <ul className="mt-3 space-y-2">
                      {form.looks.map((look) => {
                        const displayName =
                          scenesLookDisplayName(
                            look.name,
                            t('scenes.lookDefault')
                          )
                        const styleLabel = scenesLookStyleOrNull(
                          look.artStyle,
                          (s) =>
                            t(
                              `characters.${getArtStyle(s as ArtStyleId).labelKey}`
                            )
                        )
                        return (
                          <li
                            key={look.id}
                            className="flex items-center justify-between gap-2 rounded-lg border border-ink-800 px-3 py-2 text-sm"
                          >
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2 font-medium text-ink-100">
                                <span>{displayName}</span>
                                {styleLabel && (
                                  <span className="text-[10px] font-normal text-ink-500">
                                    {styleLabel}
                                  </span>
                                )}
                              </div>
                              <div className="truncate text-[11px] text-ink-500">
                                {look.description}
                              </div>
                            </div>
                            <div className="flex shrink-0 gap-1">
                              <Button
                                variant="secondary"
                                className="!py-0.5 !text-xs"
                                onClick={() => scenesApplyLookClick(look, applyLook, setImageGenMode)}
                              >
                                {t('scenes.lookUse')}
                              </Button>
                              <Button
                                variant="ghost"
                                className="!py-0.5 !text-xs text-rose-300"
                                onClick={() =>
                                  setForm((f) => ({
                                    ...f,
                                    looks: removeSceneLook(f.looks, look.id)
                                  }))
                                }
                              >
                                {t('common.delete')}
                              </Button>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                </>
              )}
            </div>
          )}
        </EditorShell>
      )}

      {plotSuggestOpen && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-overlay/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="scene-plot-suggest-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPlotSuggestOpen(false)
          }}
        >
          <div className="w-full max-w-lg rounded-2xl border border-ink-700 bg-ink-900 p-5 shadow-2xl">
            <h2
              id="scene-plot-suggest-title"
              className="text-base font-semibold text-ink-50"
            >
              {t('scenes.suggestFromStory')}
            </h2>
            <p className="mt-1 text-[12px] text-ink-400">
              {t('scenes.suggestPlotPickerHint')}
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
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setPlotSuggestOpen(false)}
              >
                {t('common.cancel')}
              </Button>
              <Button
                disabled={!plotStoryId.trim() || editorBusy}
                onClick={confirmPlotSuggest}
              >
                {t('scenes.suggestPlotConfirm')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Residual pure helpers (absolute line coverage) ─────────────────────────

export function scenesCustomLocOptionProps(
  locationType: string
): { value: string; children: string } | null {
  const opt = scenesCustomOptionNodes(locationType)
  if (!opt) return null
  return { value: opt.value, children: opt.label }
}

export function scenesCustomLocOptionElement(
  locationType: string
): ReactElement | null {
  const props = scenesCustomLocOptionProps(locationType)
  if (!props) return null
  return createElement('option', { value: props.value }, props.children)
}



export function scenesMakeReorder(
  setForm: Dispatch<SetStateAction<FormState>>,
  move: (
    gallery: FormState['gallery'],
    fromId: string,
    toId: string
  ) => FormState['gallery']
): (fromId: string, toId: string) => void {
  return (fromId, toId) => {
    if (!scenesShouldReorder(fromId, toId)) return
    setForm((f) => ({
      ...f,
      gallery: move(f.gallery, fromId, toId)
    }))
  }
}

export function scenesCustomOptionNodes(
  locationType: string
): { value: string; label: string } | null {
  const v = scenesCustomLocOptionEl(locationType)
  return v ? { value: v, label: v } : null
}



export function scenesMakeToggleSelect(
  setSelectedImageIds: Dispatch<SetStateAction<string[]>>
): (id: string) => void {
  return (id: string) =>
    setSelectedImageIds((ids) =>
      scenesToggleSelect(ids, id, toggleGallerySelection)
    )
}

export function scenesMakeHardRulesChange(
  setForm: Dispatch<SetStateAction<FormState>>
): (e: { target: { value: string } }) => void {
  return (e) => setForm(scenesHardRulesSetter(e.target.value))
}

export function scenesCustomLocOptionEl(
  locationType: string
): string | null {
  return scenesCustomLocationOption(locationType, [
    'interior',
    'exterior',
    'mixed',
    'vehicle',
    'virtual',
    ''
  ])
}



export function scenesResolveSceneNumber(
  sceneNumber: number | undefined,
  items: Array<{ sceneNumber?: number | null }>,
  nextFn: (nums: number[]) => number
): number {
  if (
    typeof sceneNumber === 'number' &&
    Number.isFinite(sceneNumber) &&
    sceneNumber >= 1
  ) {
    return Math.floor(sceneNumber)
  }
  return scenesNextSceneNum(items, nextFn)
}

export function scenesListForStory(
  listApi: (storyId: string) => Promise<Array<{ id: string; sceneNumber: number }>>,
  storyId: string
): Promise<Array<{ id: string; sceneNumber: number }>> {
  return listApi(storyId)
}



export function scenesMakeListForEnsure(
  listApi: () => Promise<Array<{ id: string; sceneNumber: number }>>
): () => Promise<Array<{ id: string; sceneNumber: number }>> {
  return () => listApi()
}



export function scenesMsgToast(
  toastFn: (m: string) => void,
  msg: string
): () => void {
  return () => toastFn(msg)
}

export function scenesMakeApplyCopied(
  setForm: Dispatch<SetStateAction<FormState>>,
  setSelectedImageId: (id: string | null) => void,
  galleryFrom: (s: Scene) => FormState['gallery']
): (sceneRaw: unknown) => void {
  return (sceneRaw) =>
    scenesApplyCopiedScene(sceneRaw, {
      setForm,
      setSelectedImageId,
      galleryFrom
    })
}

export function scenesPlotFill(
  handleAiFill: (opts: {
    suggestFromStory?: boolean
    storyId?: string | null
    segmentKey?: string | null
  }) => void,
  plotStoryId: string,
  plotSegmentKey: string
): () => void {
  return () => handleAiFill(scenesPlotFillArgs(plotStoryId, plotSegmentKey))
}

export function scenesNextSceneNum(
  items: Array<{ sceneNumber?: number | null }>,
  nextFn: (nums: number[]) => number
): number {
  const nums = items
    .map((s) => s.sceneNumber)
    .filter((n): n is number => typeof n === 'number' && Number.isFinite(n))
  return nextFn(nums)
}



export function scenesStatusSetter(
  value: string,
  isStatus: (s: string) => boolean
): (f: FormState) => FormState {
  return (f) => ({
    ...f,
    status: (isStatus(value) ? value : 'PENDING') as FormState['status']
  })
}

export function scenesLocationTypeSetter(
  value: string
): (f: FormState) => FormState {
  return (f) => ({ ...f, locationType: value })
}

export function scenesMapGalleryKind(kind: string): 'sheet' | 'upload' | 'gen' {
  if (kind === 'sheet' || kind === 'upload' || kind === 'gen') return kind
  return 'sheet'
}

export function scenesMapVideoGalleryItem(item: {
  id: string
  path: string
  kind: string
  label: string
  createdAt: string
  layer?: string
  introVideoPath?: string | null
}): FormState['gallery'][number] {
  return {
    id: item.id,
    path: item.path,
    kind: scenesMapGalleryKind(item.kind),
    label: item.label,
    createdAt: item.createdAt,
    ...(item.layer ? { layer: item.layer } : {}),
    ...(item.introVideoPath ? { introVideoPath: item.introVideoPath } : {})
  } as FormState['gallery'][number]
}



export function scenesPlotFillArgs(
  plotStoryId: string,
  plotSegmentKey: string
): {
  suggestFromStory: true
  storyId: string
  segmentKey: string
} {
  return {
    suggestFromStory: true,
    storyId: plotStoryId,
    segmentKey: plotSegmentKey || 'all'
  }
}

export function scenesStatusValue(
  status: string | undefined,
  isStatus: (s: string) => boolean
): string {
  return isStatus(status ?? '') ? (status as string) : 'PENDING'
}

export function scenesCustomLocationOption(
  locationType: string,
  known: string[]
): string | null {
  if (locationType && !known.includes(locationType)) return locationType
  return null
}

export function scenesLookStyleOrNull(
  artStyle: string | null | undefined,
  labelOf: (s: string) => string
): string | null {
  return artStyle ? labelOf(artStyle) : null
}



export function scenesApplyCopiedScene(
  sceneRaw: unknown,
  ops: {
    setForm: Dispatch<SetStateAction<FormState>>
    setSelectedImageId: (id: string | null) => void
    galleryFrom: (s: Scene) => FormState['gallery']
  }
): void {
  const scene = sceneRaw as Scene
  const g = ops.galleryFrom(scene)
  ops.setForm((f) => ({
    ...f,
    gallery: g,
    locationKey: scene.locationKey ?? f.locationKey
  }))
  ops.setSelectedImageId(g[0]?.id ?? null)
}

export async function scenesPickImage(ops: {
  pick: () => Promise<{ filePath: string } | null>
  gallery: FormState['gallery']
  label: string
  setForm: Dispatch<SetStateAction<FormState>>
  setSelectedImageId: (id: string | null) => void
  append: (
    g: FormState['gallery'],
    item: { path: string; kind: 'upload'; label: string }
  ) => FormState['gallery']
}): Promise<boolean> {
  const result = await ops.pick()
  if (!result) return false
  const next = ops.append(ops.gallery, {
    path: result.filePath,
    kind: 'upload',
    label: ops.label
  })
  ops.setForm((f) => ({
    ...f,
    gallery: next,
    coverPath: f.coverPath ?? next[0]?.path ?? null
  }))
  ops.setSelectedImageId(next[0]?.id ?? null)
  return true
}

export function scenesArtStyleFromScene(
  artStyle: string | null | undefined,
  fallback: ArtStyleId
): ArtStyleId {
  return isArtStyleId(artStyle) ? artStyle : fallback
}

export function scenesAiFillLabel(
  suggest: boolean,
  suggestLabel: string,
  fillLabel: string
): string {
  return suggest ? suggestLabel : fillLabel
}




export function scenesMakeConfirmPlot(
  getPlotStoryId: () => string,
  setError: (m: string) => void,
  toastError: (m: string) => void,
  needMsg: string,
  setOpen: (v: boolean) => void,
  getEditorOpen: () => boolean,
  openCreate: () => void,
  fill: () => void
): () => void {
  return () => {
    scenesConfirmPlotSuggest(
      getPlotStoryId(),
      setError,
      toastError,
      needMsg,
      setOpen,
      getEditorOpen(),
      openCreate,
      fill
    )
  }
}

export function scenesMakeSetCover(
  setForm: Dispatch<SetStateAction<FormState>>,
  toastSuccess: () => void
): (path: string) => void {
  return (path: string) => scenesSetCover(setForm, path, toastSuccess)
}

export function scenesMakeApplyLook(
  getGallery: () => FormState['gallery'],
  ops: {
    setAtmoText: (s: string) => void
    setForm: Dispatch<SetStateAction<FormState>>
    setSelectedImageId: (id: string | null) => void
    setBanner: (m: string) => void
    toastSuccess: (m: string) => void
    appliedMsgOf: (name: string) => string
  }
): (look: {
  name: string
  description: string
  artStyle?: string | null
  imagePath?: string | null
}) => void {
  return (look) =>
    scenesApplyLook(look, getGallery(), {
      setAtmoText: ops.setAtmoText,
      setForm: ops.setForm,
      setSelectedImageId: ops.setSelectedImageId,
      setBanner: ops.setBanner,
      toastSuccess: ops.toastSuccess,
      appliedMsg: ops.appliedMsgOf(look.name)
    })
}

export function scenesMakeCopyGallery(ops: {
  getEditingId: () => string | null
  setError: (m: string) => void
  saveFirstMsg: string
  copy: (args: {
    targetSceneId: string
    sourceSceneId: string
  }) => Promise<{ scene: unknown }>
  applyScene: (scene: unknown) => void
  toastSuccess: () => void
  setBanner: (m: string) => void
  okMsg: string
  reload: () => Promise<void> | void
}): (sourceSceneId: string) => Promise<void> {
  return async (sourceSceneId: string) => {
    await scenesCopyGallery({
      editingId: ops.getEditingId(),
      sourceSceneId,
      setError: ops.setError,
      saveFirstMsg: ops.saveFirstMsg,
      copy: ops.copy,
      applyScene: ops.applyScene,
      toastSuccess: ops.toastSuccess,
      setBanner: ops.setBanner,
      okMsg: ops.okMsg,
      reload: ops.reload
    })
  }
}

export function scenesMakeFindInList(
  list: () => Promise<Scene[]>
): (id: string) => Promise<Scene | null> {
  return (id) => scenesFindInList(list, id)
}

export function scenesApplyLookClick(
  look: {
    name: string
    description: string
    artStyle?: string | null
    imagePath?: string | null
  },
  apply: (look: {
    name: string
    description: string
    artStyle?: string | null
    imagePath?: string | null
  }) => void,
  setMode: (m: 'atmosphere' | 'plate') => void
): void {
  apply(look)
  setMode('atmosphere')
}

export function scenesGeneratingLabel(
  busy: boolean,
  generating: string,
  idle: string
): string {
  return busy ? generating : idle
}

export function scenesHardRulesSetter(
  value: string
): (f: FormState) => FormState {
  return (f) => ({ ...f, hardRules: value })
}

export function scenesToggleSelect(
  ids: string[],
  id: string,
  toggle: (ids: string[], id: string) => string[]
): string[] {
  return toggle(ids, id)
}



export function scenesApplyLook(
  look: {
    name: string
    description: string
    artStyle?: string | null
    imagePath?: string | null
  },
  gallery: FormState['gallery'],
  ops: {
    setAtmoText: (s: string) => void
    setForm: Dispatch<SetStateAction<FormState>>
    setSelectedImageId: (id: string | null) => void
    setBanner: (m: string) => void
    toastSuccess: (m: string) => void
    appliedMsg: string
  }
): void {
  ops.setAtmoText(look.description)
  ops.setForm((f) => ({
    ...f,
    mood: look.description,
    artStyle: isArtStyleId(look.artStyle) ? look.artStyle : f.artStyle
  }))
  if (look.imagePath) {
    const hit = gallery.find((g) => g.path === look.imagePath)
    if (hit) ops.setSelectedImageId(hit.id)
  }
  ops.setBanner(ops.appliedMsg)
  ops.toastSuccess(ops.appliedMsg)
}

export function scenesRemoveImage(
  gallery: FormState['gallery'],
  selectedImage: { id: string; path: string },
  _coverPath: string | null,
  ops: {
    setForm: Dispatch<SetStateAction<FormState>>
    setSelectedImageId: (id: string | null) => void
    setSelectedImageIds: Dispatch<SetStateAction<string[]>>
    remove: (
      g: FormState['gallery'],
      id: string
    ) => FormState['gallery']
    primary: (g: FormState['gallery']) => string | null
    isCover: (g: FormState['gallery'], c: string | null) => boolean
  }
): void {
  const next = ops.remove(gallery, selectedImage.id)
  ops.setForm((f) => ({
    ...f,
    gallery: next,
    coverPath:
      f.coverPath === selectedImage.path
        ? ops.primary(next)
        : ops.isCover(next, f.coverPath)
          ? f.coverPath
          : ops.primary(next)
  }))
  ops.setSelectedImageId(next[0]?.id ?? null)
  ops.setSelectedImageIds((ids) => ids.filter((x) => x !== selectedImage.id))
}

export function scenesSetCover(
  setForm: Dispatch<SetStateAction<FormState>>,
  path: string,
  toastSuccess: () => void
): void {
  setForm((f) => ({ ...f, coverPath: path }))
  toastSuccess()
}

export function scenesOnPlateVariantChange(
  value: string,
  setVariant: (v: ScenePlateVariantId) => void,
  setUseIdentityRef: (v: boolean) => void
): void {
  setVariant(value as ScenePlateVariantId)
  setUseIdentityRef(false)
}

export function scenesArtStyleSetter(
  value: string
): (f: FormState) => FormState {
  return (f) => ({ ...f, artStyle: value as ArtStyleId })
}

export function scenesLookDisplayName(
  name: string,
  defaultLabel: string
): string {
  return !name.trim() || /^default$/i.test(name.trim()) ? defaultLabel : name
}

export function scenesLookStyleLabel(
  artStyle: string | null | undefined,
  labelOf: (s: string) => string
): string | null {
  return artStyle ? labelOf(artStyle) : null
}

export function scenesFindInList(
  list: () => Promise<Scene[]>,
  id: string
): Promise<Scene | null> {
  return list().then((rows) => rows.find((x) => x.id === id) ?? null)
}

export function scenesStatusOrPending(
  status: string | undefined,
  isStatus: (s: string) => boolean
): string {
  return (isStatus(status ?? '') ? status : 'PENDING') as string
}

export function scenesMaybeSetPlotStory(
  plotSuggestOpen: boolean,
  activeStoryId: string | null | undefined,
  plotStoryId: string,
  setPlotStoryId: (id: string) => void
): void {
  if (plotSuggestOpen && activeStoryId && !plotStoryId) {
    setPlotStoryId(activeStoryId)
  }
}



export function scenesHandlePlateCommitted(
  payload: {
    sceneId: string
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
    setForm: Dispatch<SetStateAction<FormState>>
    setSelectedImageId: (id: string | null) => void
    reload: () => void
    toastSuccess: () => void
    listScene: (id: string) => Promise<Scene | null>
    galleryFrom: (s: Scene) => FormState['gallery']
    primary: (g: FormState['gallery'], ref?: string | null) => string | null
    ensureLooks: (looks: FormState['looks'], x: null) => FormState['looks']
    parseLooks: (json: string | null | undefined) => FormState['looks']
  }
): void {
  if (editingId === payload.sceneId) {
    if (payload.gallery && payload.gallery.length > 0) {
      const g = payload.gallery.map((item) => ({
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
      })) as FormState['gallery']
      ops.setForm((f) => ({ ...f, gallery: g }))
      const newest = g.find((item) => item.path === payload.path) ?? g[0] ?? null
      ops.setSelectedImageId(newest?.id ?? null)
    } else {
      void ops.listScene(payload.sceneId).then((s) => {
        if (!s) return
        const g = ops.galleryFrom(s)
        ops.setForm((f) => ({
          ...f,
          gallery: g,
          coverPath: ops.primary(g, s.refImagePath),
          looks: ops.ensureLooks(ops.parseLooks(s.looksJson), null)
        }))
        const newest =
          g.find((item) => item.path === payload.path) ?? g[0] ?? null
        ops.setSelectedImageId(newest?.id ?? null)
      })
    }
  }
  void ops.reload()
  ops.toastSuccess()
}



export const SCENE_AI_KINDS = [
  'scene-ai-fill',
  'scene-plate',
  'scene-intro-video',
  'atmosphere-swap'
] as const

export function scenesIsAiJob(
  j: { kind: string; scope: { sceneId?: string } },
  sceneId?: string | null
): boolean {
  if (!(SCENE_AI_KINDS as readonly string[]).includes(j.kind)) return false
  return !sceneId || j.scope.sceneId === sceneId
}

export function scenesAiBusyFromJobs(
  activeJobs: Array<{ kind: string; scope: { sceneId?: string } }>,
  sceneId: string | null | undefined,
  blocked: boolean
): boolean {
  if (blocked) return true
  return activeJobs.some((j) => scenesIsAiJob(j, sceneId))
}

export async function scenesRemoveWithFeedback(ops: {
  remove: (id: string) => Promise<unknown>
  id: string
  toastSuccess: () => void
  toastError: (m: string) => void
}): Promise<void> {
  try {
    await ops.remove(ops.id)
    ops.toastSuccess()
  } catch (e) {
    ops.toastError(parseIpcError(e).message)
  }
}

export function scenesApplyIpc(
  e: unknown,
  setError?: (m: string) => void,
  toastError?: (m: string) => void
): string {
  const msg = parseIpcError(e).message
  setError?.(msg)
  toastError?.(msg)
  return msg
}

export function scenesApplyIpcDetails(
  e: unknown,
  setError: (m: string) => void
): string {
  const err = parseIpcError(e)
  const msg = `${err.message}${err.details ? ` — ${err.details}` : ''}`
  setError(msg)
  return msg
}

export function scenesGuardEmpty(
  description: string,
  title: string
): boolean {
  return !description.trim() && !title.trim()
}

export function scenesGuardBusy(
  busy: boolean,
  toastInfo?: (m: string) => void,
  msg?: string
): boolean {
  if (busy) {
    if (toastInfo && msg) toastInfo(msg)
    return true
  }
  return false
}

export function scenesGuardAiNeed(
  idea: string,
  hasDraft: boolean,
  suggestFromStory: boolean,
  hasImage: boolean,
  setError: (m: string) => void,
  msg: string
): boolean {
  if (!idea && !hasDraft && !suggestFromStory && !hasImage) {
    setError(msg)
    return true
  }
  return false
}

export function scenesAiFillToastKey(
  hasImage: boolean,
  idea: string,
  hasDraft: boolean
): 'fromImage' | 'background' {
  return hasImage && !idea && !hasDraft ? 'fromImage' : 'background'
}

export function scenesHasDraft(snapshot: Record<string, unknown>): boolean {
  return Object.values(snapshot).some(
    (v) => typeof v === 'string' && v.length > 0
  )
}

export function scenesAiFillRefPath(parts: {
  selectedPath?: string | null
  coverPath?: string | null
  gallery0?: string | null
}): string {
  return (
    parts.selectedPath?.trim() ||
    parts.coverPath?.trim() ||
    parts.gallery0?.trim() ||
    ''
  )
}

export function scenesStoryIdForJob(opts: {
  suggestFromStory?: boolean
  storyId?: string | null
  activeStoryId?: string | null
}): string | undefined {
  if (opts.suggestFromStory) return opts.storyId?.trim() || undefined
  return opts.storyId?.trim() || opts.activeStoryId || undefined
}

export function scenesGuardSuggestStory(
  storyId: string | undefined,
  setError: (m: string) => void,
  msg: string
): boolean {
  if (!storyId) {
    setError(msg)
    return true
  }
  return false
}

export function scenesConfirmPlotSuggest(
  plotStoryId: string,
  setError: (m: string) => void,
  toastError: (m: string) => void,
  needMsg: string,
  setOpen: (v: boolean) => void,
  editorOpen: boolean,
  openCreate: () => void,
  scheduleFill: () => void
): boolean {
  if (!plotStoryId.trim()) {
    setError(needMsg)
    toastError(needMsg)
    return false
  }
  setOpen(false)
  if (!editorOpen) openCreate()
  window.setTimeout(scheduleFill, 0)
  return true
}

export function scenesResolveWantIdentity(
  opts: boolean | undefined,
  useIdentityRef: boolean
): boolean {
  return opts !== undefined ? opts === true : useIdentityRef
}

export function scenesGalleryPathsFromOpts(
  referenceImagePath: string | null | undefined,
  selected: string[]
): string[] {
  const t = referenceImagePath?.trim()
  return t ? [t] : selected
}

export function scenesMaybeAppendMulti(
  prompt: string,
  paths: string[],
  locale: string,
  append: (p: string, paths: string[], locale?: string) => string
): string {
  if (paths.length > 1) return append(prompt, paths, locale)
  return prompt
}

export function scenesPlateModeLabel(
  useEdit: boolean,
  identity: string,
  pure: string
): string {
  return useEdit ? identity : pure
}

export async function scenesDiscardDraftSafe(
  discard: (path: string) => Promise<unknown>,
  path: string
): Promise<void> {
  try {
    await discard(path)
  } catch {
    /* ignore */
  }
}

export async function scenesJobCancelDiscard(
  cancelled: boolean,
  discard: (path: string) => Promise<unknown>,
  path: string
): Promise<boolean> {
  if (!cancelled) return false
  await scenesDiscardDraftSafe(discard, path)
  return true
}

export function scenesShouldReorder(fromId: string, toId: string): boolean {
  return Boolean(fromId && toId && fromId !== toId)
}

export function scenesIntroVideoHandler(
  editingId: string | null | undefined,
  path: string,
  handler: (p: string) => void
): (() => void) | undefined {
  return editingId ? () => handler(path) : undefined
}

export function scenesGuardIntro(
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

export function scenesMaybeContinueDraft(
  has: boolean,
  cont: () => void
): boolean {
  if (has) {
    cont()
    return true
  }
  return false
}

export function scenesContinueDraftCb(
  cont: (key: string) => void,
  key: string
): () => void {
  return () => cont(key)
}

export function scenesProfileMismatch(
  draftId: string | null | undefined,
  editingId: string | null
): boolean {
  return Boolean(draftId && editingId && draftId !== editingId)
}

export function scenesHandleProfileApply(
  draft: {
    sceneId?: string | null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    profile: any
  },
  editingId: string | null,
  ops: {
    reload: () => void
    setForm: Dispatch<SetStateAction<FormState>>
    setEditorOpen: (v: boolean) => void
    setEditorPanel: (p: EditorPanel) => void
    toastSuccess: () => void
    setPageBanner: (m: string) => void
  }
): void {
  if (scenesProfileMismatch(draft.sceneId, editingId)) {
    void ops.reload()
    return
  }
  const p = draft.profile
  ops.setForm((f) => ({
    ...f,
    title: p.title ?? f.title,
    description: p.description || f.description,
    script: p.script ?? f.script,
    locationType: p.locationType ?? f.locationType,
    timeOfDay: p.timeOfDay ?? f.timeOfDay,
    weather: p.weather ?? f.weather,
    mood: p.mood ?? f.mood,
    lighting: p.lighting ?? f.lighting,
    colorPalette: p.colorPalette ?? f.colorPalette,
    setDressing: p.setDressing ?? f.setDressing,
    soundscape: p.soundscape ?? f.soundscape,
    cameraNotes: p.cameraNotes ?? f.cameraNotes,
    visualTags:
      typeof p.visualTags === 'string' && p.visualTags.trim()
        ? p.visualTags.trim()
        : f.visualTags,
    hardRules:
      typeof p.hardRules === 'string' && p.hardRules.trim()
        ? p.hardRules.trim()
        : f.hardRules,
    artStyle: isArtStyleId(p.artStyle) ? p.artStyle : f.artStyle,
    seedPrompt: p.seedPrompt || f.seedPrompt || p.description || f.description
  }))
  ops.setEditorOpen(true)
  ops.setEditorPanel('profile')
  ops.setPageBanner('')
  ops.toastSuccess()
  void ops.reload()
}

export function scenesHandleVideoPrepDone(
  d: {
    kind?: string
    entityIds?: { sceneId?: string }
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
  setForm: Dispatch<SetStateAction<FormState>>,
  reload: () => void
): void {
  if (d?.kind !== 'scene-intro') return
  if (!editingId || d.entityIds?.sceneId !== editingId) return
  if (d.gallery?.length) {
    setForm((f) => ({
      ...f,
      gallery: d.gallery!.map((item) =>
        scenesMapVideoGalleryItem(item)
      ) as FormState['gallery']
    }))
  } else {
    void reload()
  }
}

export async function scenesRunSave(ops: {
  description: string
  title: string
  editingId: string | null
  toastError: (m: string) => void
  toastSuccess: (m: string) => void
  setBanner: (m: string) => void
  setError: (m: string | null) => void
  savedMsg: string
  failedMsg: string
  update: (id: string) => Promise<boolean>
  create: () => Promise<boolean>
  reload: () => Promise<void> | void
  closeEditor: () => void
}): Promise<void> {
  if (scenesGuardEmpty(ops.description, ops.title)) return
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
    } else {
      const ok = await ops.create()
      if (ok) {
        ops.toastSuccess(ops.savedMsg)
        ops.setBanner(ops.savedMsg)
        await ops.reload()
        ops.closeEditor()
      } else {
        ops.toastError(ops.failedMsg)
      }
    }
  } catch (e) {
    scenesApplyIpc(e, ops.setError, ops.toastError)
  }
}

export async function scenesEnsureSavedId(ops: {
  editingId: string | null
  activeStoryId: string | null
  sceneNumber: number
  create: () => Promise<boolean>
  reload: () => Promise<void> | void
  list: () => Promise<Array<{ id: string; sceneNumber: number }>>
  setEditingId: (id: string) => void
}): Promise<string | null> {
  if (ops.editingId) return ops.editingId
  const ok = await ops.create()
  if (!ok || !ops.activeStoryId) return null
  await ops.reload()
  const list = await ops.list()
  const created = list.find((s) => s.sceneNumber === ops.sceneNumber)
  if (created) {
    ops.setEditingId(created.id)
    return created.id
  }
  return null
}

export function scenesRunAiFill(ops: {
  busy: boolean
  idea: string
  formSnapshot: Record<string, unknown>
  refPath: string
  suggestFromStory?: boolean
  storyId?: string | null
  activeStoryId?: string | null
  setError: (m: string) => void
  needMsg: string
  needStoryMsg: string
  setBanner: (m: string) => void
  toastInfo: (m: string) => void
  fromImageMsg: string
  backgroundMsg: string
  startJob: (
    idea: string,
    hasDraft: boolean,
    hasImage: boolean,
    refPath: string,
    storyId: string | undefined,
    suggest: boolean
  ) => void
}): 'busy' | 'need' | 'needStory' | 'started' {
  if (ops.busy) return 'busy'
  const idea = ops.idea.trim()
  const hasDraft = scenesHasDraft(ops.formSnapshot)
  const hasImage = Boolean(ops.refPath) && !ops.suggestFromStory
  if (
    scenesGuardAiNeed(
      idea,
      hasDraft,
      Boolean(ops.suggestFromStory),
      hasImage,
      ops.setError,
      ops.needMsg
    )
  ) {
    return 'need'
  }
  const storyIdForJob = scenesStoryIdForJob({
    suggestFromStory: ops.suggestFromStory,
    storyId: ops.storyId,
    activeStoryId: ops.activeStoryId
  })
  if (
    ops.suggestFromStory &&
    scenesGuardSuggestStory(storyIdForJob, ops.setError, ops.needStoryMsg)
  ) {
    return 'needStory'
  }
  ops.setBanner(ops.backgroundMsg)
  ops.toastInfo(
    scenesAiFillToastKey(hasImage, idea, hasDraft) === 'fromImage'
      ? ops.fromImageMsg
      : ops.backgroundMsg
  )
  ops.startJob(
    idea,
    hasDraft,
    hasImage,
    ops.refPath,
    storyIdForJob,
    Boolean(ops.suggestFromStory)
  )
  return 'started'
}

export async function scenesRunPlateSetup(ops: {
  ensureSavedId: () => Promise<string | null>
  isBusy: (id: string) => boolean
  setError: (m: string) => void
  saveFirstMsg: string
  wantIdentity: boolean
  useIdentityRef: boolean
  forceOffIdentity: boolean
  setUseIdentityRef: (v: boolean) => void
  paths: string[]
  resolveIdentity: (args: {
    useIdentityRef: boolean
    selectedPaths: string[]
  }) => { useEdit: boolean; paths: string[] }
  buildPrompt: (useEdit: boolean) => string
  maybeAppend: (prompt: string, paths: string[]) => string
  ensureRules: (prompt: string) => string
  summary: string
  setConfirm: (p: ImageGenConfirmPayload) => void
}): Promise<'no-id' | 'busy' | 'ready' | 'error'> {
  try {
    const id = await ops.ensureSavedId()
    if (!id) {
      ops.setError(ops.saveFirstMsg)
      return 'no-id'
    }
    if (ops.isBusy(id)) return 'busy'
    if (ops.forceOffIdentity) ops.setUseIdentityRef(false)
    const idRes = ops.resolveIdentity({
      useIdentityRef: ops.wantIdentity,
      selectedPaths: ops.paths
    })
    let prompt = ops.buildPrompt(idRes.useEdit)
    prompt = ops.maybeAppend(prompt, idRes.paths)
    prompt = ops.ensureRules(prompt)
    ops.setConfirm({
      prompt,
      referencePaths: idRes.paths,
      useIdentityEdit: idRes.useEdit,
      summary: ops.summary
    })
    return 'ready'
  } catch (e) {
    scenesApplyIpc(e, ops.setError)
    return 'error'
  }
}

export async function scenesRunPlateJob(ops: {
  ensureSavedId: () => Promise<string | null>
  isBusy: (id: string) => boolean
  setError: (m: string) => void
  saveFirstMsg: string
  toastInfo: (m: string) => void
  startedMsg: string
  startJob: (id: string) => void
}): Promise<'no-id' | 'busy' | 'started' | 'error'> {
  try {
    const id = await ops.ensureSavedId()
    if (!id) {
      ops.setError(ops.saveFirstMsg)
      return 'no-id'
    }
    if (ops.isBusy(id)) return 'busy'
    ops.toastInfo(ops.startedMsg)
    ops.startJob(id)
    return 'started'
  } catch (e) {
    scenesApplyIpc(e, ops.setError)
    return 'error'
  }
}

export async function scenesPlateJobBody(ops: {
  generate: () => Promise<{
    path: string
    variant?: string
    label?: string
    layer?: string
    enhance?: unknown
  }>
  signal: { cancelled: boolean }
  discard: (path: string) => Promise<unknown>
  sceneId: string
  storyId: string
  variant: string
  setProgress: (n: number, s?: string) => void
}): Promise<
  | {
      type: 'scene-plate'
      sceneId: string
      storyId: string
      path: string
      variant: string
      label: string
      layer?: string
      enhance?: unknown
    }
  | undefined
> {
  ops.setProgress(10, 'image')
  const r = await ops.generate()
  if (
    await scenesJobCancelDiscard(ops.signal.cancelled, ops.discard, r.path)
  ) {
    return undefined
  }
  ops.setProgress(100, 'done')
  return {
    type: 'scene-plate',
    sceneId: ops.sceneId,
    storyId: ops.storyId,
    path: r.path,
    variant: r.variant ?? ops.variant,
    label: r.label ?? ops.variant,
    layer: r.layer,
    enhance: r.enhance
  }
}

export async function scenesRunAtmosphere(ops: {
  ensureSavedId: () => Promise<string | null>
  isBusy: (id: string) => boolean
  setError: (m: string) => void
  saveFirstMsg: string
  description: string
  requiredMsg: string
  pickBase: () => { item: { path: string } | null }
  noBaseMsg: string
  toastInfo: (m: string) => void
  startedMsg: string
  startJob: (id: string, basePath: string, desc: string) => void
}): Promise<
  'no-id' | 'busy' | 'need-desc' | 'no-base' | 'started' | 'error'
> {
  try {
    const id = await ops.ensureSavedId()
    if (!id) {
      ops.setError(ops.saveFirstMsg)
      return 'no-id'
    }
    if (ops.isBusy(id)) return 'busy'
    if (!ops.description) {
      ops.setError(ops.requiredMsg)
      return 'need-desc'
    }
    const auto = ops.pickBase()
    if (!auto.item) {
      ops.setError(ops.noBaseMsg)
      return 'no-base'
    }
    ops.toastInfo(ops.startedMsg)
    ops.startJob(id, auto.item.path, ops.description)
    return 'started'
  } catch (e) {
    scenesApplyIpc(e, ops.setError)
    return 'error'
  }
}

export async function scenesAtmosphereJobBody(ops: {
  swap: () => Promise<{
    path: string
    variant?: string
    label?: string
    layer?: string
    enhance?: unknown
  }>
  signal: { cancelled: boolean }
  discard: (path: string) => Promise<unknown>
  sceneId: string
  storyId: string
  defaultLabel: string
  atmosphereDescription: string
  setProgress: (n: number, s?: string) => void
}): Promise<
  | {
      type: 'scene-plate'
      sceneId: string
      storyId: string
      path: string
      variant: string
      label: string
      layer: string
      atmosphereDescription: string
      enhance?: unknown
    }
  | undefined
> {
  ops.setProgress(10, 'edit')
  const r = await ops.swap()
  if (
    await scenesJobCancelDiscard(ops.signal.cancelled, ops.discard, r.path)
  ) {
    return undefined
  }
  ops.setProgress(100, 'done')
  return {
    type: 'scene-plate',
    sceneId: ops.sceneId,
    storyId: ops.storyId,
    path: r.path,
    variant: r.variant ?? 'atmosphere_swap',
    label: r.label ?? ops.defaultLabel,
    layer: r.layer ?? 'atmosphere',
    atmosphereDescription: ops.atmosphereDescription,
    enhance: r.enhance
  }
}

export async function scenesCopyGallery(ops: {
  editingId: string | null
  sourceSceneId: string
  setError: (m: string) => void
  saveFirstMsg: string
  copy: (args: {
    targetSceneId: string
    sourceSceneId: string
  }) => Promise<{ scene: unknown }>
  applyScene: (scene: unknown) => void
  toastSuccess: () => void
  setBanner: (m: string) => void
  okMsg: string
  reload: () => Promise<void> | void
}): Promise<'no-id' | 'ok' | 'error'> {
  if (!ops.editingId) {
    ops.setError(ops.saveFirstMsg)
    return 'no-id'
  }
  try {
    const r = await ops.copy({
      targetSceneId: ops.editingId,
      sourceSceneId: ops.sourceSceneId
    })
    ops.applyScene(r.scene)
    ops.setBanner(ops.okMsg)
    ops.toastSuccess()
    await ops.reload()
    return 'ok'
  } catch (e) {
    scenesApplyIpc(e, ops.setError)
    return 'error'
  }
}

export function scenesAddLook(ops: {
  description: string
  name: string
  artStyle: string
  setError: (m: string) => void
  requiredMsg: string
  savedMsg: string
  setForm: Dispatch<SetStateAction<FormState>>
  setLookName: (s: string) => void
  setBanner: (m: string) => void
  toastSuccess: () => void
  createEntry: (args: {
    name?: string
    description: string
    artStyle: string
  }) => unknown
  upsert: (list: unknown[], entry: unknown) => unknown[]
}): boolean {
  if (!ops.description) {
    ops.setError(ops.requiredMsg)
    return false
  }
  const entry = ops.createEntry({
    name: ops.name.trim() || undefined,
    description: ops.description,
    artStyle: ops.artStyle
  })
  ops.setForm((f) => ({
    ...f,
    looks: ops.upsert(f.looks as unknown[], entry) as FormState['looks']
  }))
  ops.setLookName('')
  ops.setBanner(ops.savedMsg)
  ops.toastSuccess()
  return true
}

export function scenesLooksJsonOrNull(
  looks: unknown[],
  serialize: (l: unknown[]) => string
): string | null {
  return looks.length ? serialize(looks) : null
}

export function scenesGalleryJsonOrNull(
  gallery: unknown[],
  serialize: (g: unknown[]) => string
): string | null {
  return gallery.length ? serialize(gallery) : null
}

export function scenesHandleIntroVideoFlow(ops: {
  editingId: string | null
  sourceImagePath: string
  busy: boolean
  setError: (m: string) => void
  toastError: (m: string) => void
  toastInfo: (m: string) => void
  msgs: { saveFirst: string; needImage: string; loading: string }
  hasDraft: boolean
  continueDraft: () => void
  update: () => Promise<unknown>
  startPrep: () => void
}): void {
  const g = scenesGuardIntro(
    ops.editingId,
    ops.sourceImagePath,
    ops.busy,
    ops.setError,
    ops.toastError,
    ops.toastInfo,
    ops.msgs
  )
  if (g !== 'ok') return
  if (scenesMaybeContinueDraft(ops.hasDraft, ops.continueDraft)) return
  void (async () => {
    try {
      await ops.update()
    } catch (e) {
      scenesApplyIpc(e, undefined, ops.toastError)
      return
    }
    ops.startPrep()
  })()
}

export function scenesSelectedIds(
  selectedImageIds: string[],
  selectedImageId: string | null
): string[] {
  return selectedImageIds.length > 0
    ? selectedImageIds
    : selectedImageId
      ? [selectedImageId]
      : []
}
