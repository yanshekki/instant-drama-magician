import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getAiLocale } from '../../lib/aiLocale'
import { nextSceneNumber } from '../../domain/scene'
import {
  appendSceneGalleryItem,
  filterSceneGalleryByLayer,
  isSceneGalleryCoverPath,
  listSceneExternalRefs,
  moveSceneGalleryItem,
  parseSceneGallery,
  pickSceneExternalRefPath,
  primarySceneGalleryPath,
  removeSceneGalleryItem,
  serializeSceneGallery,
  type SceneGalleryItem
} from '../../domain/sceneGallery'
import { ExternalRefSection } from '../components/ExternalRefSection'
import {
  libraryBodyClass,
  libraryCardClass,
  libraryGridClass,
  libraryMediaBadgeClass,
  libraryMediaClass
} from '../components/libraryCard'
import {
  LibraryBrowseBar,
  LibraryPageBody,
  LibraryPagination
} from '../components/LibraryBrowseBar'
import { LibraryFilterSelect } from '../components/LibraryFilterSelect'
import { useLibraryBrowse } from '../hooks/useLibraryBrowse'
import {
  DEFAULT_SCENE_PLATE,
  scenePlatesByGroup,
  type ScenePlateVariantId
} from '../../domain/scenePlateVariants'
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
import { GalleryThumbStrip } from '../components/GalleryThumbStrip'
import { PlotContextPicker } from '../components/PlotContextPicker'
import {
  EditorField,
  EditorSelect,
  EditorShell,
  editorFormClass
} from '../components/EditorShell'
import { PageHeader } from '../components/PageHeader'
import { Button, EmptyState, Input, Label, Textarea } from '../components/ui'
import { translateSceneGalleryLabel } from '../../domain/galleryLabelI18n'
import { tSceneLocationType } from '../lib/statusLabels'

type EditorPanel = 'profile' | 'refs' | 'atmosphere'

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
      }
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
  const [form, setForm] = useState<FormState>(() => emptyForm())
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null)
  const [useIdentityRef, setUseIdentityRef] = useState(false)
  const [useExternalRef, setUseExternalRef] = useState(true)
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
    if (plotSuggestOpen && activeStoryId && !plotStoryId) {
      setPlotStoryId(activeStoryId)
    }
  }, [plotSuggestOpen, activeStoryId, plotStoryId])

  const sceneBusy = (sceneId?: string | null): boolean =>
    isBlocked({
      kind: [
        'scene-ai-fill',
        'scene-plate',
        'scene-intro-video',
        'atmosphere-swap'
      ],
      sceneId: sceneId ?? undefined
    }) ||
    activeJobs.some(
      (j) =>
        (j.kind === 'scene-ai-fill' ||
          j.kind === 'scene-plate' ||
          j.kind === 'scene-intro-video' ||
          j.kind === 'atmosphere-swap') &&
        (!sceneId || j.scope.sceneId === sceneId)
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
      if (draft.sceneId && editingId && draft.sceneId !== editingId) {
        void reload()
        return
      }
      const p = draft.profile
      setForm((f) => ({
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
        visualTags: p.visualTags ?? f.visualTags,
        artStyle: isArtStyleId(p.artStyle) ? p.artStyle : f.artStyle,
        seedPrompt: p.description || f.seedPrompt
      }))
      setEditorOpen(true)
      setPageBanner(t('scenes.aiFillOk')); toast.success(t('scenes.aiFillOk'))
      void reload()
    })
  }, [onSceneProfileApply, editingId, reload, t])

  useEffect(() => {
    return onScenePlateCommitted(({ sceneId, path, gallery }) => {
      if (editingId === sceneId) {
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
            ...(item.introVideoPath
              ? { introVideoPath: item.introVideoPath }
              : {})
          }))
          setForm((f) => ({ ...f, gallery: g }))
          const newest =
            g.find((item) => item.path === path) ?? g[0] ?? null
          setSelectedImageId(newest?.id ?? null)
        } else {
          void getApi()
            .scenes.list()
            .then((list) => {
              const s = (list as Scene[]).find((x) => x.id === sceneId)
              if (!s) return
              const g = galleryFromScene(s)
              setForm((f) => ({
                ...f,
                gallery: g,
                coverPath: primarySceneGalleryPath(g, s.refImagePath),
                looks: ensureLookInLibrary(parseSceneLooks(s.looksJson), null)
              }))
              const newest =
                g.find((item) => item.path === path) ?? g[0] ?? null
              setSelectedImageId(newest?.id ?? null)
            })
        }
      }
      void reload()
      toast.success(t('scenes.plateOkShort'))
    })
  }, [onScenePlateCommitted, editingId, reload, t])

  const closeEditor = (): void => {
    setEditorOpen(false)
    setEditingId(null)
    setForm(emptyForm(nextSceneNumber(items.map((s) => s.sceneNumber))))
    setSelectedImageId(null)
    setAiIdea('')
    setAtmoText('')
    setActionError(null)
  }

  const openCreate = (): void => {
    setEditorPanel('profile')
    setEditingId(null)
    // Prefer story-linked scene numbers when available (global list often lacks them)
    const nums = items
      .map((s) => s.sceneNumber)
      .filter((n): n is number => typeof n === 'number' && Number.isFinite(n))
    setForm(emptyForm(nextSceneNumber(nums)))
    setSelectedImageId(null)
    setAiIdea('')
    setAtmoText('')
    setLayerFilter('all')
    setActionError(null)
    setEditorOpen(true)
  }

  const openEdit = (s: Scene): void => {
    const gallery = galleryFromScene(s)
    const style: ArtStyleId = isArtStyleId(s.artStyle)
      ? s.artStyle
      : DEFAULT_ART_STYLE
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
    const sceneNumber =
      typeof form.sceneNumber === 'number' &&
      Number.isFinite(form.sceneNumber) &&
      form.sceneNumber >= 1
        ? Math.floor(form.sceneNumber)
        : nextSceneNumber(items.map((s) => s.sceneNumber))
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
      locationKey:
        form.locationKey.trim() || form.title.trim() || null
    }
  }

  const handleSave = async (): Promise<void> => {
    if (!form.description.trim() && !form.title.trim()) return
    setActionError(null)
    try {
      if (editingId) {
        const ok = await update(editingId, payload())
        if (ok) {
          toast.success(t('common.saved'))
          setPageBanner(t('scenes.saved'))
        } else {
          toast.error(t('common.actionFailed'))
        }
      } else {
        const ok = await create(payload())
        if (ok) {
          toast.success(t('common.saved'))
          setPageBanner(t('scenes.saved'))
          await reload()
          const list = activeStoryId
            ? ((await getApi().scenes.list(activeStoryId)) as Scene[])
            : []
          const created = list.find(
            (s) =>
              s.sceneNumber === form.sceneNumber &&
              s.description === (form.description.trim() || form.title)
          )
          if (created) {
            setEditingId(created.id)
            openEdit(created)
          } else {
            closeEditor()
          }
        } else {
          toast.error(t('common.actionFailed'))
        }
      }
    } catch (e) {
      const msg = parseIpcError(e).message
      setActionError(msg)
      toast.error(msg)
    }
  }

  const ensureSavedId = async (): Promise<string | null> => {
    if (editingId) return editingId
    const ok = await create(payload())
    if (!ok || !activeStoryId) return null
    await reload()
    const list = (await getApi().scenes.list(activeStoryId)) as Scene[]
    const created = list.find((s) => s.sceneNumber === form.sceneNumber)
    if (created) {
      setEditingId(created.id)
      return created.id
    }
    return null
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
    if (editorBusy) return
    const idea = aiIdea.trim()
    // All scene form fields — generate always improves when anything is filled
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
    const hasDraft = Object.values(snapshot).some(
      (v) => typeof v === 'string' && v.length > 0
    )
    const refPath =
      selectedImage?.path?.trim() ||
      form.coverPath?.trim() ||
      form.gallery[0]?.path?.trim() ||
      ''
    const hasImage = Boolean(refPath) && !opts?.suggestFromStory
    if (!idea && !hasDraft && !opts?.suggestFromStory && !hasImage) {
      setActionError(t('common.aiNeedIdeaOrImage'))
      return
    }
    const storyIdForJob =
      (opts?.suggestFromStory
        ? opts.storyId?.trim()
        : opts?.storyId?.trim() || activeStoryId) || undefined
    if (opts?.suggestFromStory && !storyIdForJob) {
      setActionError(t('scenes.suggestNeedStory'))
      return
    }
    setPageBanner(t('aiJobs.startedBackground'))
    toast.info(
      hasImage && !idea && !hasDraft
        ? t('common.aiFillFromImage')
        : t('aiJobs.startedBackground')
    )
    startJob({
      kind: 'scene-ai-fill',
      label: opts?.suggestFromStory
        ? t('scenes.suggestFromStory')
        : hasDraft
          ? t('scenes.aiFill')
          : t('scenes.aiFill'),
      scope: {
        sceneId: editingId ?? undefined,
        storyId: storyIdForJob
      },
      run: async ({ setProgress, signal }) => {
        setProgress(20, hasImage ? 'image' : 'llm')
        const r = await getApi().scenes.aiFill({
          idea: opts?.suggestFromStory ? undefined : idea || undefined,
          storyId: storyIdForJob,
          segmentKey: opts?.suggestFromStory
            ? opts.segmentKey ?? 'all'
            : undefined,
          locale: getAiLocale(i18n.language),
          suggestFromStory: opts?.suggestFromStory,
          sceneNumber: form.sceneNumber,
          // Plot-suggest invents a location from the chosen segment — don't mix form draft
          existingDraft:
            opts?.suggestFromStory || !hasDraft ? undefined : snapshot,
          referenceImagePath: hasImage ? refPath : null
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

  const confirmPlotSuggest = (): void => {
    if (!plotStoryId.trim()) {
      setActionError(t('scenes.suggestNeedStory'))
      toast.error(t('scenes.suggestNeedStory'))
      return
    }
    setPlotSuggestOpen(false)
    if (!editorOpen) {
      openCreate()
    }
    // openCreate is sync state — next tick so form is ready
    window.setTimeout(() => {
      handleAiFill({
        suggestFromStory: true,
        storyId: plotStoryId,
        segmentKey: plotSegmentKey || 'all'
      })
    }, 0)
  }

  const sceneExternalRefs = useMemo(
    () => listSceneExternalRefs(form.gallery),
    [form.gallery]
  )

  const handlePickExternalRef = async (): Promise<void> => {
    const result = await getApi().media.pickRefImage()
    if (!result) return
    const next = appendSceneGalleryItem(form.gallery, {
      path: result.filePath,
      kind: 'external',
      label: t('characters.externalRefLabel')
    })
    setForm((f) => ({
      ...f,
      gallery: next,
      coverPath: f.coverPath ?? next[0]?.path ?? null
    }))
    setSelectedImageId(next[next.length - 1]?.id ?? null)
    setUseExternalRef(true)
    toast.success(t('characters.externalRefAdded'))
  }

  /** Animate the selected still into a location intro video using scene bible. */
  const handleGenerateIntroVideo = (sourceImagePath: string): void => {
    if (!editingId) {
      setActionError(t('scenes.saveFirstForPlate'))
      toast.error(t('scenes.saveFirstForPlate'))
      return
    }
    if (!sourceImagePath?.trim()) {
      setActionError(t('scenes.introVideoNeedImage'))
      return
    }
    if (sceneBusy(editingId)) return
    setActionError(null)
    const sceneId = editingId
    const sourcePath = sourceImagePath.trim()
    const draftKey = buildVideoPrepDraftKey(
      'scene-intro',
      { sceneId },
      sourcePath
    )
    if (hasVideoPrepDraft(draftKey)) {
      continueVideoPrepDraft(draftKey)
      return
    }
    void (async () => {
      try {
        await update(sceneId, payload())
      } catch (e) {
        toast.error(parseIpcError(e).message)
        return
      }
      startVideoPrep({
        kind: 'scene-intro',
        entityIds: { sceneId, storyId: activeStoryId ?? undefined },
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
      }
      if (d?.kind !== 'scene-intro') return
      if (!editingId || d.entityIds?.sceneId !== editingId) return
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

  const handleGeneratePlate = async (opts?: {
    referenceImagePath?: string | null
    useIdentityEdit?: boolean
    useExternalRef?: boolean
  }): Promise<void> => {
    setActionError(null)
    try {
      const id = await ensureSavedId()
      if (!id) {
        setActionError(t('scenes.saveFirstForPlate'))
        return
      }
      if (sceneBusy(id)) return
      // Pure generate unless identity lock is on (checkbox or explicit opts).
      const wantIdentity =
        opts?.useIdentityEdit !== undefined
          ? opts.useIdentityEdit === true
          : useIdentityRef
      const wantExternal =
        opts?.useExternalRef !== undefined
          ? opts.useExternalRef
          : useExternalRef
      if (useIdentityRef && opts?.useIdentityEdit === false) {
        setUseIdentityRef(false)
      }
      const externalPath = wantExternal
        ? pickSceneExternalRefPath(
            form.gallery,
            opts?.referenceImagePath ?? selectedImage?.path
          )
        : null
      const preferred = wantIdentity
        ? (opts?.referenceImagePath ??
          externalPath ??
          selectedImage?.path ??
          null)
        : externalPath
      toast.info(t('aiJobs.startedBackground'))
      startJob({
        kind: 'scene-plate',
        label: t('scenes.generatePlate'),
        scope: { sceneId: id, storyId: activeStoryId ?? undefined },
        run: async ({ setProgress, signal }) => {
          setProgress(10, 'image')
          const r = await getApi().scenes.generatePlate({
            sceneId: id,
            variant: plateVariant,
            referenceImagePath: preferred,
            useIdentityEdit: Boolean(preferred),
            persist: false,
            artStyle: form.artStyle
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
            type: 'scene-plate' as const,
            sceneId: id,
            storyId: activeStoryId ?? '',
            path: r.path,
            variant: r.variant ?? plateVariant,
            label: r.label ?? plateVariant,
            layer: r.layer,
            enhance: r.enhance
          }
        }
      })
    } catch (e) {
      setActionError(parseIpcError(e).message)
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
      if (sceneBusy(id)) return
      const atmosphereDescription = atmoText.trim()
      if (!atmosphereDescription) {
        setActionError(t('scenes.atmoRequired'))
        return
      }
      const auto = pickBestSceneBaseImage(
        form.gallery,
        atmoBase || selectedImage?.path || null
      )
      if (!auto.item) {
        setActionError(t('scenes.atmoNoBase'))
        return
      }
      toast.info(t('aiJobs.startedBackground'))
      startJob({
        kind: 'atmosphere-swap',
        label: t('scenes.swapAtmosphere'),
        scope: { sceneId: id, storyId: activeStoryId ?? undefined },
        run: async ({ setProgress, signal }) => {
          setProgress(10, 'edit')
          const r = await getApi().scenes.swapAtmosphere({
            sceneId: id,
            atmosphereDescription,
            baseImagePath: auto.item!.path,
            artStyle: form.artStyle,
            pose: atmoPose,
            persist: false
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
            type: 'scene-plate' as const,
            sceneId: id,
            storyId: activeStoryId ?? '',
            path: r.path,
            variant: r.variant ?? 'atmosphere_swap',
            label: r.label ?? t('scenes.swapAtmosphere'),
            layer: r.layer ?? 'atmosphere',
            atmosphereDescription,
            enhance: r.enhance
          }
        }
      })
    } catch (e) {
      setActionError(parseIpcError(e).message)
    }
  }

  const handlePickImage = async (): Promise<void> => {
    const result = await getApi().media.pickRefImage()
    if (!result) return
    const next = appendSceneGalleryItem(form.gallery, {
      path: result.filePath,
      kind: 'upload',
      label: t('scenes.uploadLabel')
    })
    setForm((f) => ({
      ...f,
      gallery: next,
      coverPath: f.coverPath ?? next[0]?.path ?? null
    }))
    setSelectedImageId(next[0]?.id ?? null)
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

  const siblingLocations = useMemo(() => {
    const key = (form.locationKey || form.title).trim().toLowerCase()
    if (!key || !editingId) return []
    return items.filter((s) => {
      if (s.id === editingId) return false
      const sk = (s.locationKey || s.title || '').trim().toLowerCase()
      return sk && sk === key && galleryFromScene(s).length > 0
    })
  }, [items, form.locationKey, form.title, editingId])

  const handleCopyGallery = async (sourceSceneId: string): Promise<void> => {
    if (!editingId) {
      setActionError(t('scenes.saveFirstForPlate'))
      return
    }
    try {
      const r = await getApi().scenes.copyGalleryFrom({
        targetSceneId: editingId,
        sourceSceneId
      })
      const scene = r.scene as Scene
      const g = galleryFromScene(scene)
      setForm((f) => ({
        ...f,
        gallery: g,
        locationKey: scene.locationKey ?? f.locationKey
      }))
      setSelectedImageId(g[0]?.id ?? null)
      setPageBanner(t('scenes.copyGalleryOk')); toast.success(t('scenes.copyGalleryOk'))
      await reload()
    } catch (e) {
      setActionError(parseIpcError(e).message)
    }
  }

  const addLook = (): void => {
    const description = atmoText.trim() || form.mood.trim()
    if (!description) {
      setActionError(t('scenes.atmoRequired'))
      return
    }
    const entry = createSceneLook({
      name: lookName.trim() || undefined,
      description,
      artStyle: form.artStyle
    })
    setForm((f) => ({ ...f, looks: upsertSceneLook(f.looks, entry) }))
    setLookName('')
    setPageBanner(t('scenes.lookSaved')); toast.success(t('scenes.lookSaved'))
  }

  const applyLook = (look: SceneLookEntry): void => {
    setAtmoText(look.description)
    setForm((f) => ({
      ...f,
      mood: look.description,
      artStyle: isArtStyleId(look.artStyle) ? look.artStyle : f.artStyle
    }))
    if (look.imagePath) {
      const hit = form.gallery.find((g) => g.path === look.imagePath)
      if (hit) setSelectedImageId(hit.id)
    }
    setPageBanner(t('scenes.lookApplied', { name: look.name })); toast.success(t('scenes.lookApplied', { name: look.name }))
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-gradient-to-b from-ink-950 via-ink-950 to-ink-900">
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
      <div className="relative min-h-0 flex-1 overflow-y-auto px-8 py-6">
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
                              regenerateBusy={sceneBusy(s.id)}
                              onImageClick={() => openEdit(s)}
                              onRegenerate={() => {
                                toast.info(t('aiJobs.startedBackground'))
                                startJob({
                                  kind: 'scene-plate',
                                  label: t('scenes.generatePlate'),
                                  scope: {
                                    sceneId: s.id,
                                    storyId: activeStoryId ?? undefined
                                  },
                                  run: async ({ setProgress, signal }) => {
                                    setProgress(10, 'image')
                                    const r =
                                      await getApi().scenes.generatePlate({
                                        sceneId: s.id,
                                        variant: plateVariant,
                                        useIdentityEdit: false,
                                        persist: false,
                                        artStyle: s.artStyle ?? undefined
                                      })
                                    if (signal.cancelled) {
                                      try {
                                        await getApi().media.discardSheetDraft(
                                          r.path
                                        )
                                      } catch {
                                        /* ignore */
                                      }
                                      return
                                    }
                                    setProgress(100, 'done')
                                    return {
                                      type: 'scene-plate' as const,
                                      sceneId: s.id,
                                      storyId: activeStoryId ?? '',
                                      path: r.path,
                                      variant: r.variant ?? plateVariant,
                                      label: r.label ?? plateVariant,
                                      layer: r.layer,
                                      enhance: r.enhance
                                    }
                                  }
                                })
                              }}
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
                          <div className="mt-auto flex items-center gap-2 pt-4">
                            <Button
                              variant="secondary"
                              className="min-w-0 flex-1 !py-1.5 text-xs"
                              onClick={() => openEdit(s)}
                            >
                              {t('common.edit')}
                            </Button>
                            <Button
                              variant="ghost"
                              className="min-w-0 flex-1 !py-1.5 text-xs text-rose-300"
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
            { id: 'refs', label: t('scenes.tabRefs') },
            { id: 'atmosphere', label: t('scenes.tabAtmosphere') }
          ]}
          activeTab={editorPanel}
          onTabChange={(id) => setEditorPanel(id as EditorPanel)}
          preview={
            <div className="flex h-full flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-400">
                  {t('scenes.gallery')}
                </h3>
                <span className="text-[11px] text-ink-500">
                  {filteredGallery.length}/{form.gallery.length}
                </span>
              </div>
              {form.gallery.length > 0 && (
                <div className="flex flex-wrap gap-1">
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
                    <button
                      key={layer}
                      type="button"
                      className={[
                        'rounded-full px-2 py-0.5 text-[10px] font-medium',
                        layerFilter === layer
                          ? 'bg-brand-600 text-white'
                          : 'bg-ink-800 text-ink-400'
                      ].join(' ')}
                      onClick={() => setLayerFilter(layer)}
                    >
                      {t(`scenes.layer_${layer}`)}
                    </button>
                  ))}
                </div>
              )}
              <div className="rounded-xl border border-ink-800 bg-ink-900/60">
                {selectedImage ? (
                  <LocalMediaImage
                    filePath={selectedImage.path}
                    alt={translateSceneGalleryLabel(selectedImage.label, t)}
                    maxHeightClass="max-h-[min(36vh,400px)] lg:max-h-[min(48vh,480px)]"
                    showMeta
                    className="border-0 rounded-xl"
                    actionsLayout="bar"
                    regenerateBusy={editorBusy}
                    introVideoBusy={editorBusy}
                    introVideoPath={selectedImage.introVideoPath}
                    introVideoHasDraft={
                      Boolean(editingId) &&
                      hasVideoPrepDraft(
                        buildVideoPrepDraftKey(
                          'scene-intro',
                          { sceneId: editingId! },
                          selectedImage.path
                        )
                      )
                    }
                    onIntroVideo={
                      editingId
                        ? () => handleGenerateIntroVideo(selectedImage.path)
                        : undefined
                    }
                    onRegenerate={() =>
                      void handleGeneratePlate({
                        useIdentityEdit: useIdentityRef,
                        referenceImagePath: selectedImage.path
                      })
                    }
                  />
                ) : (
                  <div className="flex h-40 flex-col items-center justify-center gap-2 px-3 text-xs text-ink-500">
                    <p>{t('scenes.noPhotos')}</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      <Button
                        disabled={editorBusy}
                        onClick={() => {
                          setEditorPanel('refs')
                          void handleGeneratePlate()
                        }}
                      >
                        {t('scenes.generatePlate')}
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={editorBusy}
                        onClick={() => {
                          setEditorPanel('refs')
                          void handlePickExternalRef()
                        }}
                      >
                        {t('characters.externalRefTitle')}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              <GalleryThumbStrip
                items={filteredGallery}
                selectedId={selectedImageId}
                coverPath={form.coverPath}
                fallbackCoverPath={primarySceneGalleryPath(form.gallery)}
                onSelect={setSelectedImageId}
                onReorder={handleReorderGallery}
                labelOf={(g) => translateSceneGalleryLabel(g.label, t)}
              />
            </div>
          }
        >
          {editorPanel === 'profile' && (
            <div className={editorFormClass}>
              <section className="rounded-xl border border-brand-800/35 bg-brand-950/20 p-4">
                <h3 className="text-sm font-semibold text-ink-100">
                  {t('scenes.aiTitle')}
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
                    {t('scenes.aiFill')}
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
                        setForm((f) => ({
                          ...f,
                          status: (isSceneStatus(e.target.value)
                            ? e.target.value
                            : 'PENDING') as SceneStatus
                        }))
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
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>{t('scenes.locationType')}</Label>
                    <EditorSelect
                      value={form.locationType}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          locationType: e.target.value
                        }))
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
                      {form.locationType &&
                      ![
                        'interior',
                        'exterior',
                        'mixed',
                        'vehicle',
                        'virtual',
                        ''
                      ].includes(form.locationType.toLowerCase()) ? (
                        <option value={form.locationType}>
                          {form.locationType}
                        </option>
                      ) : null}
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
                  {t('scenes.tabRefs')}
                </h3>
                <p className="mt-1 text-[11px] text-ink-500">
                  {t('scenes.plateHintShort')}
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <EditorField label={t('scenes.plateVariant')}>
                  <EditorSelect
                    value={plateVariant}
                    onChange={(e) => {
                      setPlateVariant(e.target.value as ScenePlateVariantId)
                      setUseIdentityRef(false)
                    }}
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
              <ExternalRefSection
                items={sceneExternalRefs.map((g) => ({
                  id: g.id,
                  path: g.path,
                  label: g.label
                }))}
                useExternalRef={useExternalRef}
                onUseExternalChange={setUseExternalRef}
                onAdd={handlePickExternalRef}
                onRemove={(id) => {
                  const next = removeSceneGalleryItem(form.gallery, id)
                  setForm((f) => ({
                    ...f,
                    gallery: next,
                    coverPath: isSceneGalleryCoverPath(next, f.coverPath)
                      ? f.coverPath
                      : primarySceneGalleryPath(next)
                  }))
                }}
                disabled={editorBusy}
              />
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Button
                  className="sm:flex-1"
                  disabled={editorBusy}
                  onClick={() => void handleGeneratePlate()}
                >
                  {editorBusy
                    ? t('common.generating')
                    : t('scenes.generatePlate')}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => void handlePickImage()}
                >
                  {t('scenes.pickImage')}
                </Button>
                {selectedImage &&
                  form.coverPath !== selectedImage.path && (
                    <Button
                      variant="secondary"
                      onClick={() => handleSetCover(selectedImage.path)}
                    >
                      {t('common.setAsCover')}
                    </Button>
                  )}
                {selectedImage && form.coverPath === selectedImage.path && (
                  <span className="inline-flex items-center rounded-lg border border-amber-700/50 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
                    {t('common.isCover')}
                  </span>
                )}
                {selectedImage && (
                  <Button
                    variant="ghost"
                    className="text-rose-300"
                    onClick={() => {
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
                    }}
                  >
                    {t('scenes.removePhoto')}
                  </Button>
                )}
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
            </div>
          )}

          {editorPanel === 'atmosphere' && (
            <div className={editorFormClass}>
              <section className="rounded-xl border border-brand-800/35 bg-brand-950/15 p-4">
                <h3 className="text-sm font-semibold text-ink-100">
                  {t('scenes.swapAtmosphereTitle')}
                </h3>
                <p className="mt-1 text-[11px] text-ink-500">
                  {t('scenes.swapAtmosphereHintShort')}
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
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
                <EditorField className="mt-3" label={t('scenes.atmoDesc')}>
                  <Textarea
                    size="md"
                    value={atmoText}
                    onChange={(e) => setAtmoText(e.target.value)}
                    placeholder={t('scenes.atmoPlaceholder')}
                  />
                </EditorField>
                <Button
                  className="mt-3"
                  disabled={editorBusy || form.gallery.length === 0}
                  onClick={() => void handleSwapAtmosphere()}
                >
                  {t('scenes.swapAtmosphere')}
                </Button>
              </section>

              <section className="rounded-xl border border-ink-700 bg-ink-900/35 p-4">
                <h3 className="text-sm font-semibold">
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
                  <Button variant="secondary" type="button" onClick={addLook}>
                    {t('scenes.lookAdd')}
                  </Button>
                </div>
                <ul className="mt-3 space-y-2">
                  {form.looks.map((look) => {
                    const displayName =
                      !look.name.trim() || /^default$/i.test(look.name.trim())
                        ? t('scenes.lookDefault')
                        : look.name
                    const styleLabel = look.artStyle
                      ? t(
                          `characters.${getArtStyle(look.artStyle).labelKey}`
                        )
                      : null
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
                            onClick={() => applyLook(look)}
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
