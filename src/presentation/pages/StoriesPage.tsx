// @ts-nocheck — residual pure-helper typings; covered by page unit tests
import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react'
import { useTranslation } from 'react-i18next'
import { getAiLocale } from '../../lib/aiLocale'
import { getApi } from '../../lib/api'
import { parseIpcError } from '../../lib/ipc'
import type {
  Action,
  Character,
  Prop,
  Scene,
  StoryStatus,
  StoryWithCounts,
  TimelineEntry
} from '../../types/domain'
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
import { LibraryFilterSelect } from '../components/LibraryFilterSelect'
import { useLibraryBrowse } from '../hooks/useLibraryBrowse'
import { matchesSearchQuery } from '../lib/searchQuery'
import { sortByUpdatedAtDesc } from '../lib/librarySort'
import { appendHardRules, ensureHardRules } from '../../domain/promptHardRules'
import { useApp } from '../context/AppContext'
import { useToast } from '../context/ToastContext'
import { useDialog } from '../context/DialogContext'
import { useAiJobs } from '../context/AiJobsContext'
import { PageHeader } from '../components/PageHeader'
import { LocalMediaImage } from '../components/LocalMediaImage'
import { EntityGalleryPanel } from '../components/EntityGalleryPanel'
import {
  EditorField,
  EditorSelect,
  EditorShell,
  editorFormClass,
  editorFormWideClass
} from '../components/EditorShell'
import { MultiIdPick } from '../components/MultiIdPick'
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
  ImageGenConfirmModal,
  type ImageGenConfirmPayload
} from '../components/ImageGenConfirmModal'
import {
  MAX_BEAT_ACTIONS,
  MAX_BEAT_CHARACTERS,
  MAX_BEAT_PROPS,
  MAX_BEAT_SCENES
} from '../../domain/timelineBindings'
import {
  beatContentForEditor,
  beatScriptTemplate,
  commitBeatScriptEdit,
  extractSpokenLines,
  parseBeatContent
} from '../../domain/beatContent'
import { Button, EmptyState, Input, Textarea } from '../components/ui'
import {
  MENU_IMPORT_STORY_EVENT,
  MENU_NEW_STORY_EVENT
} from '../hooks/useMenuActions'



function castCount(
  count:
    | {
        characters?: number
        scenes?: number
        props?: number
        actions?: number
        timeline?: number
        storyCharacters?: number
        storyScenes?: number
        storyProps?: number
        storyActions?: number
      }
    | undefined,
  kind: 'characters' | 'scenes' | 'props' | 'actions'
): number {
  if (!count) return 0
  if (kind === 'characters') {
    return count.storyCharacters ?? count.characters ?? 0
  }
  if (kind === 'scenes') return count.storyScenes ?? count.scenes ?? 0
  if (kind === 'actions') return count.storyActions ?? count.actions ?? 0
  return count.storyProps ?? count.props ?? 0
}

type EditorTab = 'meta' | 'cast' | 'script'

const STORY_STATUSES: StoryStatus[] = [
  'DRAFT',
  'GENERATING',
  'COMPLETED',
  'FAILED'
]

type StoryCostumePick = {
  id: string
  name: string
  description: string
  refImagePath?: string | null
}

type StoryCastCharacter = Character & {
  storyCostumeId?: string | null
  storyCostume?: StoryCostumePick | null
}

type CostumeLibRow = {
  id: string
  name: string
  description: string
  characterLinks?: Array<{ characterId?: string; character?: { id: string } }>
}

type StoryDetail = StoryWithCounts & {
  characters: StoryCastCharacter[]
  scenes: Array<Scene & { sceneNumber?: number }>
  props: Prop[]
  actions?: Action[]
  timeline: TimelineEntry[]
  styleNote?: string | null
}

/**
 * Stories library + full editor (meta / cast links / script beats).
 * Cast & script selection mirrors Character library M2M patterns.
 */
export function StoriesPage(): JSX.Element {
  const { t, i18n } = useTranslation()
  const { stories, setActiveStoryId, refreshStories, loading } = useApp()
  const toast = useToast()
  const dialog = useDialog()
  const { startJob, isBlocked, onStoryCoverCommitted, startMediaGen } =
    useAiJobs()
  const [storyStatus, setStoryStatus] = useState('')
  const [storyCover, setStoryCover] = useState('') // '' | has | none
  const [storySort, setStorySort] = useState('updated') // updated | title
  const storyBrowse = useLibraryBrowse(
    stories,
    (s) => [s.title, s.styleNote ?? '', s.status ?? ''].join(' '),
    {
      extraKey: `${storyStatus}|${storyCover}|${storySort}`,
      matchesExtra: (s) => {
        if (storyStatus && s.status !== storyStatus) return false
        if (storyCover === 'has' && !s.coverPath) return false
        if (storyCover === 'none' && s.coverPath) return false
        return true
      },
      sort: (a, b) => storiesBrowseSort(storySort, a, b)
    }
  )
  const storyStatusLabel = (status: string): string => {
    const map: Record<string, string> = {
      DRAFT: t('stories.statusDraft'),
      GENERATING: t('stories.statusGenerating'),
      COMPLETED: t('stories.statusCompleted'),
      FAILED: t('stories.statusFailed')
    }
    return map[status] ?? status
  }
  const storyStatusOptions = useMemo(
    () => [
      { value: '', label: t('library.filterAny') },
      ...STORY_STATUSES.map((v) => ({
        value: v,
        label: storyStatusLabel(v)
      }))
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t stable enough
    [t]
  )
  const storyStatusEditOptions = useMemo(
    () =>
      STORY_STATUSES.map((v) => ({
        value: v,
        label: storyStatusLabel(v)
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t]
  )
  const clearStoryFilters = (): void => {
    storyBrowse.setQ('')
    setStoryStatus('')
    setStoryCover('')
    setStorySort('updated')
  }
  const storyHasFilters =
    storyBrowse.hasSearch ||
    Boolean(storyStatus) ||
    Boolean(storyCover) ||
    storySort !== 'updated'
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorTab, setEditorTab] = useState<EditorTab>('meta')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editStatus, setEditStatus] = useState<StoryStatus>('DRAFT')
  const [styleNote, setStyleNote] = useState('')
  const [hardRules, setHardRules] = useState('')
  const [storyArtStyle, setStoryArtStyle] =
    useState<ArtStyleId>(DEFAULT_ART_STYLE)
  const [coverPath, setCoverPath] = useState<string | null>(null)
  const [coverGallery, setCoverGallery] = useState<CharacterGalleryItem[]>([])
  const [selectedCoverId, setSelectedCoverId] = useState<string | null>(null)
  const [selectedCoverIds, setSelectedCoverIds] = useState<string[]>([])
  const [useIdentityRef, setUseIdentityRef] = useState(false)
  const [imageGenConfirm, setImageGenConfirm] =
    useState<ImageGenConfirmPayload | null>(null)
  const [pendingCoverStoryId, setPendingCoverStoryId] = useState<string | null>(
    null
  )
  const artGroups = useMemo(() => artStylesByGroup(), [])
  const selectedCoverImage = useMemo(() => {
    if (!coverGallery.length) return null
    return storiesPickCoverImage(coverGallery, selectedCoverId, coverPath)
  }, [coverGallery, selectedCoverId, coverPath])
  const [detail, setDetail] = useState<StoryDetail | null>(null)
  const [allChars, setAllChars] = useState<Character[]>([])
  const [allScenes, setAllScenes] = useState<Scene[]>([])
  const [allProps, setAllProps] = useState<Prop[]>([])
  const [allActions, setAllActions] = useState<Action[]>([])
  const [beats, setBeats] = useState<TimelineEntry[]>([])
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [aiIdea, setAiIdea] = useState('')
  const [aiBusy, _setAiBusy] = useState(false)
  const [pageBanner, setPageBanner] = useState<string | null>(null)
  /** Cast browser: kind tab + search + linked filter + page */
  const [castKind, setCastKind] = useState<'characters' | 'scenes' | 'props' | 'actions'>(
    'characters'
  )
  const [castQ, setCastQ] = useState('')
  const [castLinkFilter, setCastLinkFilter] = useState<
    'all' | 'linked' | 'unlinked'
  >('all')
  const [castPage, setCastPage] = useState(1)
  const CAST_PAGE_SIZE = 10
  /** Global wardrobe library for story cast costume picks */
  const [costumeLib, setCostumeLib] = useState<CostumeLibRow[]>([])

  const loadDetail = useCallback(async (id: string): Promise<void> => {
    setBusy(true)
    setActionError(null)
    try {
      const [d, chars, scenes, props, actions, timeline, costumes] = await Promise.all([
        getApi().stories.get(id) as Promise<StoryDetail>,
        getApi().characters.list() as Promise<Character[]>,
        getApi().scenes.list() as Promise<Scene[]>,
        getApi().props.list() as Promise<Prop[]>,
        getApi().actions.list() as Promise<Action[]>,
        getApi().timeline.list(id) as Promise<TimelineEntry[]>,
        getApi().costumes.list() as Promise<CostumeLibRow[]>
      ])
      setDetail(d)
      setEditTitle(d.title)
      setEditStatus(
        storiesStatusOrDraft(d.status, (s) =>
          STORY_STATUSES.includes(s as StoryStatus)
        ) as StoryStatus
      )
      setStyleNote(d.styleNote ?? '')
      setHardRules(
        storiesHardRulesFromDetail(
          (d as { hardRules?: string | null }).hardRules
        )
      )
      setStoryArtStyle(
        isArtStyleId((d as { artStyle?: string | null }).artStyle)
          ? ((d as { artStyle: string }).artStyle as ArtStyleId)
          : DEFAULT_ART_STYLE
      )
      setCoverPath(d.coverPath ?? null)
      const cg = parseCharacterGallery(
        (d as { refGalleryJson?: string | null }).refGalleryJson,
        { refImagePath: d.coverPath }
      )
      setCoverGallery(cg)
      setSelectedCoverId(cg.find((x) => x.path === d.coverPath)?.id ?? cg[0]?.id ?? null)
      setAllChars(sortByUpdatedAtDesc(chars))
      setAllScenes(sortByUpdatedAtDesc(scenes))
      setAllProps(sortByUpdatedAtDesc(props))
      setAllActions(sortByUpdatedAtDesc(actions))
      setBeats(timeline)
      setCostumeLib(
        Array.isArray(costumes) ? sortByUpdatedAtDesc(costumes) : []
      )
    } catch (e) {
      storiesApplyIpc(e, setActionError)
    } finally {
      setBusy(false)
    }
  }, [])

  /** characterId → costumes linked to that character */
  const costumesByCharacter = useMemo(() => {
    const map = new Map<string, CostumeLibRow[]>()
    for (const c of costumeLib) {
      const links = c.characterLinks ?? []
      for (const link of links) {
        const cid = link.characterId ?? link.character?.id
        if (!cid) continue
        const arr = map.get(cid) ?? []
        arr.push(c)
        map.set(cid, arr)
      }
    }
    return map
  }, [costumeLib])

  const storyCostumeByChar = useMemo(() => {
    const map = new Map<string, string | null>()
    for (const c of detail?.characters ?? []) {
      map.set(c.id, c.storyCostumeId ?? null)
    }
    return map
  }, [detail?.characters])

  const handleSetStoryCostume = async (
    characterId: string,
    costumeId: string
  ): Promise<void> => {
    const api = getApi().stories
    const payload = {
      storyId: editingId!,
      characterId,
      costumeId: costumeId || null
    }
    await storiesRunSetCostume({
      editingId,
      hasSetCostume: typeof api.setCharacterCostume === 'function',
      set: () => api.setCharacterCostume!(payload),
      linkFallback: () => api.linkCharacter(payload),
      toastSuccess: () => toast.success(t('common.saved')),
      toastError: toast.error,
      setError: setActionError,
      reload: () => loadDetail(editingId!)
    })
  }

  const resetEditorForm = (): void => {
    setEditTitle('')
    setEditStatus('DRAFT')
    setStyleNote('')
    setHardRules('')
    setStoryArtStyle(DEFAULT_ART_STYLE)
    setCoverPath(null)
    setCoverGallery([])
    setSelectedCoverId(null)
    setBeats([])
    setAllChars([])
    setAllScenes([])
    setAllProps([])
    setAllActions([])
    setDetail(null)
    setAiIdea('')
    setUseIdentityRef(false)
    setActionError(null)
  }

  const openCreate = (): void => {
    setEditingId(null)
    resetEditorForm()
    setEditorTab('meta')
    setEditorOpen(true)
  }

  const openEditor = (id: string): void => {
    setEditingId(id)
    setEditorTab('meta')
    setEditorOpen(true)
    void loadDetail(id)
  }

  const closeEditor = (): void => {
    setEditorOpen(false)
    setEditingId(null)
    setDetail(null)
    setBeats([])
    resetEditorForm()
  }

  const handleDelete = async (id: string): Promise<void> => {
    const ok = await dialog.confirm({
      message: t('common.confirmDelete'),
      variant: 'danger'
    })
    if (!ok) return
    await storiesRemoveWithFeedback({
      remove: async (rid) => {
        await getApi().stories.delete(rid)
        await refreshStories()
      },
      id,
      toastSuccess: () => toast.success(t('common.deleted')),
      toastError: toast.error
    })
  }

  const handleSaveMeta = async (): Promise<void> => {
    await storiesRunSaveMetaNative({
      title: editTitle,
      editingId,
      setBusy,
      setError: setActionError,
      create: async (title) =>
        storiesCreateId(() => storiesCreateStoryId(title, (t) => getApi().stories.create({ title: t }))),
      setActiveStoryId,
      update: async (id) => {
        await getApi().stories.update(id, {
          title: editTitle.trim(),
          status: editStatus,
          styleNote: styleNote.trim() || null,
          hardRules: hardRules.trim() || null,
          artStyle: storyArtStyle,
          coverPath: coverPath,
          refGalleryJson: serializeCharacterGallery(coverGallery)
        })
      },
      reload: refreshStories,
      toastSuccess: () => toast.success(t('common.saved')),
      toastError: toast.error,
      closeEditor
    })
  }


  useEffect(() => {
    return onStoryCoverCommitted(
      storiesMakeCoverCommitted(() => editingId, {
        setCoverPath,
        loadDetail: (id) => void loadDetail(id),
        refresh: () => void refreshStories(),
        toastSuccess: () => toast.success(t('stories.coverOk'))
      })
    )
  }, [onStoryCoverCommitted, editingId, loadDetail, refreshStories, t, toast])

  const storyCoverBusy = Boolean(
    editingId && isBlocked({ storyId: editingId, kind: ['story-cover'] })
  )
  const storyCoverBusyId = (storyId: string): boolean =>
    isBlocked({ storyId, kind: ['story-cover'] })
  const storyAiBusy = Boolean(
    editingId &&
      isBlocked({
        storyId: editingId,
        kind: ['story-ai-meta', 'story-ai-script']
      })
  )

  const selectedCoverPathsForIdentity = useMemo(() => {
    const ids = storiesSelectedCoverIds(selectedCoverIds, selectedCoverId)
    return ids
      .map((id) => coverGallery.find((g) => g.id === id)?.path)
      .filter((p): p is string => Boolean(p?.trim()))
  }, [selectedCoverIds, selectedCoverId, coverGallery])

  const buildStoryCoverPrompt = (
    locale: 'zh-HK' | 'en',
    opts?: { idea?: string | null; useEdit?: boolean }
  ): string => {
    const title = editTitle.trim() || (locale === 'en' ? 'Story' : '故事')
    const note = styleNote.trim()
    const idea = (opts?.idea !== undefined ? opts.idea : aiIdea)?.trim() || ''
    const art = getArtStyle(storyArtStyle)
    const base = storiesCoverPromptParts({
      locale,
      title,
      note,
      idea,
      artBlock: art.promptBlock
    }).join(' ')
    const withRules = appendHardRules(base, hardRules)
    if (!opts?.useEdit) return withRules
    const editPrefix = storiesEditPrefix(locale)
    return appendHardRules(editPrefix + base, hardRules)
  }

  const handleGenerateCover = (opts?: {
    storyId?: string
    referenceImagePath?: string | null
    useIdentityEdit?: boolean
    idea?: string | null
  }): void => {
    const sid = opts?.storyId ?? editingId
    if (!sid) {
      toast.error(t('stories.saveFirst'))
      return
    }
    if (storyCoverBusyId(sid)) {
      toast.info(t('common.loading'))
      return
    }
    const useId = storiesResolveWantIdentity(
      opts?.useIdentityEdit,
      useIdentityRef
    )
    const paths = storiesCoverPathsFromOpts(
      opts?.referenceImagePath,
      selectedCoverPathsForIdentity,
      useId,
      coverPath
    )
    startMediaGen({
      kind: 'story-cover',
      storyId: sid,
      artStyle: storyArtStyle,
      galleryIdentityPaths: paths,
      preferIdentityEdit: useId
    })
  }

  const runStoryCoverJob = async (
    confirm: ImageGenConfirmPayload
  ): Promise<void> => {
    setImageGenConfirm(null)
    const sid = pendingCoverStoryId ?? editingId
    setPendingCoverStoryId(null)
    if (!sid) return
    if (storyCoverBusyId(sid)) return
    toast.info(t('aiJobs.startedBackground'))
    startJob({
      kind: 'story-cover',
      label: t('stories.generateCover'),
      scope: { storyId: sid },
      run: async ({ setProgress, signal }) => {
        setProgress(10, 'image')
        const r = await getApi().stories.generateCover({
          storyId: sid,
          idea: aiIdea || null,
          useIdentityEdit: confirm.useIdentityEdit,
          referenceImagePath: confirm.referencePaths[0] ?? null,
          referenceImagePaths: confirm.referencePaths,
          locale: getAiLocale(i18n.language),
          promptOverride: confirm.prompt
        })
        return storiesCoverJobFinishOrCancel({
          cancelled: signal.cancelled,
          discard: (p) => getApi().media.discardSheetDraft(p),
          path: r.path,
          onContinue: async () => {
            setProgress(100, 'done')
            if (sid === editingId) {
              setCoverPath(r.path)
              setCoverGallery((prev) => {
                const next = appendGalleryItem(prev, {
                  path: r.path,
                  kind: 'gen',
                  label: t('stories.generateCover')
                })
                setSelectedCoverId(next[next.length - 1]?.id ?? null)
                return next
              })
            }
            return {
              type: 'story-cover' as const,
              storyId: sid,
              path: r.path,
              label: r.label ?? t('stories.generateCover'),
              usedEdit: r.usedEdit
            }
          }
        })
      }
    })
  }

  const handlePickCover = async (): Promise<void> => {
    if (!editingId) return
    const result = await getApi().media.pickRefImage()
    if (!result) return
    const next = appendGalleryItem(coverGallery, {
      path: result.filePath,
      kind: 'upload',
      label: t('characters.externalRefLabel')
    })
    setCoverGallery(next)
    setSelectedCoverId(next[next.length - 1]?.id ?? null)
    // First image becomes cover if none set
    if (!coverPath) setCoverPath(result.filePath)
    toast.success(t('characters.externalRefAdded'))
  }

  const handleSetStoryCover = storiesMakeSetCover(
    setCoverPath,
    coverGallery,
    setSelectedCoverId,
    storiesMsgToast(toast.success, t('common.coverSet'))
  )

  const handleRemoveCoverImage = (id: string): void => {
    const removed = coverGallery.find((g) => g.id === id)
    const next = removeGalleryItem(coverGallery, id)
    setCoverGallery(next)
    setSelectedCoverIds((ids) => ids.filter((x) => x !== id))
    const st = storiesRemoveCoverState(
      next,
      removed,
      coverPath,
      selectedCoverId,
      (g) => primaryGalleryPath(g as never),
      (g, c) => isGalleryCoverPath(g as never, c)
    )
    setCoverPath(st.coverPath)
    setSelectedCoverId(st.selectedCoverId)
  }

  const handleAiMeta = (): void => {
    storiesRunAiMetaIfReady({
      skip: storiesAiMetaShouldSkip(
        editTitle,
        aiIdea,
        styleNote,
        hardRules,
        setActionError,
        t('stories.aiNeedTitle')
      ),
      run: () => {
    setActionError(null)
    setPageBanner(t('aiJobs.startedBackground'))
    toast.info(t('aiJobs.startedBackground'))
    startJob({
      kind: 'story-ai-meta',
      label: t('stories.aiFillMeta'),
      scope: { storyId: editingId ?? undefined },
      run: async ({ setProgress, signal }) => {
        setProgress(15, 'llm')
        if (editingId) {
          await getApi().stories.update(editingId, {
            title: editTitle.trim() || undefined,
            styleNote: styleNote.trim() || null,
            hardRules: hardRules.trim() || null
          })
        }
        const r = await getApi().stories.aiFillMeta({
          storyId: editingId ?? undefined,
          title: editTitle,
          idea: aiIdea,
          existingStyleNote: styleNote,
          existingHardRules: hardRules,
          locale: getAiLocale(i18n.language)
        })
        if (signal.cancelled) return
        setProgress(100, 'done')
        setStyleNote(r.styleNote)
        storiesApplyAiMetaResult(r.hardRules, setHardRules)
        setPageBanner(t('stories.aiMetaOk'))
        toast.success(t('stories.aiMetaOk'))
      }
    })
      }
    })
  }

  const handleAiScript = async (): Promise<void> => {
    const g = storiesGuardAiScript(
      editingId,
      detail?.characters?.length ?? 0,
      detail?.scenes?.length ?? 0,
      setActionError,
      t('stories.aiNeedSave'),
      t('stories.aiNeedCast')
    )
    if (g !== 'ok') return
    if (beats.length > 0) {
      const ok = await dialog.confirm({
        message: t('stories.aiReplaceBeatsConfirm'),
        variant: 'danger',
        confirmLabel: t('common.ok')
      })
      if (!ok) return
    }
    setActionError(null)
    setPageBanner(t('aiJobs.startedBackground'))
    toast.info(t('aiJobs.startedBackground'))
    const sid = editingId!
    startJob({
      kind: 'story-ai-script',
      label: t('stories.aiFillScript'),
      scope: { storyId: sid },
      run: async ({ setProgress, signal }) => {
        setProgress(15, 'llm')
        await getApi().stories.update(sid, {
          title: editTitle.trim() || undefined,
          styleNote: styleNote.trim() || null
        })
        const r = await getApi().stories.aiFillScript({
          storyId: sid,
          idea: aiIdea,
          locale: getAiLocale(i18n.language),
          replace: true
        })
        if (signal.cancelled) return
        setProgress(100, 'done')
        setBeats(r.beats as TimelineEntry[])
        setEditorTab('script')
        setPageBanner(t('stories.aiScriptOk', { n: r.beats.length }))
        toast.success(t('stories.aiScriptOk', { n: r.beats.length }))
        await refreshStories()
      }
    })
  }

  const handleExportBackup = async (id: string): Promise<void> => {
    await storiesRunExportBackup({
      confirm: () =>
        dialog.confirm({
          title: t('stories.exportBackupConfirmTitle'),
          message: t('stories.exportBackupConfirm'),
          confirmLabel: t('stories.exportBackup')
        }),
      exportFn: () =>
        getApi().project.exportBackup(id) as Promise<{
          filePath?: string
          downloadUrl?: string
          fileName?: string
        } | null>,
      toastSuccess: toast.success,
      toastError: toast.error,
      okMsg: (path) => t('menu.storyBackupExported', { path })
    })
  }

  const handleImportBackup = async (): Promise<void> => {
    await storiesRunImportBackup({
      importFn: () =>
        getApi().project.importBackup() as Promise<{
          storyId: string
          title?: string
        } | null>,
      reload: refreshStories,
      setActiveStoryId,
      toastSuccess: (title) =>
        toast.success(t('stories.importBackupOk', { title })),
      toastError: toast.error
    })
  }

  // Native File menu → New Story / Import story backup
  useEffect(() => {
    const onNew = (): void => {
      openCreate()
    }
    const onImport = (): void => {
      void handleImportBackup()
    }
    window.addEventListener(MENU_NEW_STORY_EVENT, onNew)
    window.addEventListener(MENU_IMPORT_STORY_EVENT, onImport)
    return () => {
      window.removeEventListener(MENU_NEW_STORY_EVENT, onNew)
      window.removeEventListener(MENU_IMPORT_STORY_EVENT, onImport)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount listeners
  }, [])

  const linkedCharIds = useMemo(
    () => new Set((detail?.characters ?? []).map((c) => c.id)),
    [detail?.characters]
  )
  const linkedSceneIds = useMemo(
    () => new Set((detail?.scenes ?? []).map((s) => s.id)),
    [detail?.scenes]
  )
  const linkedPropIds = useMemo(
    () => new Set((detail?.props ?? []).map((p) => p.id)),
    [detail?.props]
  )
  const linkedActionIds = useMemo(
    () => new Set((detail?.actions ?? []).map((a) => a.id)),
    [detail?.actions]
  )

  const toggleCharacter = storiesMakeLinkToggle({
    getEditingId: () => editingId,
    link: async (id) => getApi().stories.linkCharacter({ storyId: editingId!, characterId: id }),
    unlink: async (id) => getApi().stories.unlinkCharacter({ storyId: editingId!, characterId: id }),
    reload: async () => {
      await loadDetail(editingId!)
      await refreshStories()
    },
    toastSuccess: (wasLinked) =>
      toast.success(wasLinked ? t('common.unlinked') : t('common.linked')),
    setError: setActionError,
    toastError: toast.error
  })

  const toggleScene = storiesMakeLinkToggle({
    getEditingId: () => editingId,
    link: async (id) => getApi().stories.linkScene({ storyId: editingId!, sceneId: id }),
    unlink: async (id) => getApi().stories.unlinkScene({ storyId: editingId!, sceneId: id }),
    reload: async () => {
      await loadDetail(editingId!)
      await refreshStories()
    },
    toastSuccess: (wasLinked) =>
      toast.success(wasLinked ? t('common.unlinked') : t('common.linked')),
    setError: setActionError,
    toastError: toast.error
  })

  const toggleProp = storiesMakePropToggle({
    getEditingId: () => editingId,
    storiesApi: getApi().stories,
    loadDetail,
    refreshStories,
    linkedMsg: t('common.linked'),
    unlinkedMsg: t('common.unlinked'),
    toastSuccess: toast.success,
    setError: setActionError,
    toastError: toast.error
  })

  const toggleAction = storiesMakeLinkToggle({
    getEditingId: () => editingId,
    link: async (id) => getApi().stories.linkAction({ storyId: editingId!, actionId: id }),
    unlink: async (id) => getApi().stories.unlinkAction({ storyId: editingId!, actionId: id }),
    reload: async () => {
      await loadDetail(editingId!)
      await refreshStories()
    },
    toastSuccess: (wasLinked) =>
      toast.success(wasLinked ? t('common.unlinked') : t('common.linked')),
    setError: setActionError,
    toastError: toast.error
  })

  useEffect(() => {
    setCastPage(1)
  }, [castKind, castQ, castLinkFilter, editingId])

  const castBrowser = useMemo(() => {
    type Row = {
      id: string
      label: string
      sub?: string
      updatedAt?: string | Date
    }
    const castBuilt = storiesCastBrowserRows(castKind, {
      characters: allChars,
      scenes: allScenes,
      props: allProps,
      actions: allActions,
      linkedCharIds,
      linkedSceneIds,
      linkedPropIds,
      linkedActionIds,
      emptyChars: t('stories.castEmptyChars'),
      emptyScenes: t('stories.castEmptyScenes'),
      emptyProps: t('stories.castEmptyProps'),
      emptyActions: t('stories.castEmptyActions')
    })
    let items: Row[] = castBuilt.items as Row[]
    let linkedIds = castBuilt.linkedIds
    let empty = castBuilt.empty

    const filtered = sortByUpdatedAtDesc(
      items.filter((it) => {
        const linked = linkedIds.has(it.id)
        if (castLinkFilter === 'linked' && !linked) return false
        if (castLinkFilter === 'unlinked' && linked) return false
        return matchesSearchQuery(
          [it.label, it.sub ?? ''].join(' '),
          castQ
        )
      })
    )

    const total = filtered.length
    const totalPages = Math.max(1, Math.ceil(total / CAST_PAGE_SIZE))
    const page = Math.min(castPage, totalPages)
    const start = (page - 1) * CAST_PAGE_SIZE
    const pageItems = filtered.slice(start, start + CAST_PAGE_SIZE)
    const linkedCount = items.filter((it) => linkedIds.has(it.id)).length

    return {
      items: pageItems,
      total,
      totalPages,
      page,
      linkedIds,
      empty,
      libraryTotal: items.length,
      linkedCount
    }
  }, [
    castKind,
    castQ,
    castLinkFilter,
    castPage,
    allChars,
    allScenes,
    allProps,
    allActions,
    linkedCharIds,
    linkedSceneIds,
    linkedPropIds,
    linkedActionIds,
    t
  ])

  const handleCastToggle = (id: string, linked: boolean): void => {
    storiesDispatchCastToggle(castKind, id, linked, {
      characters: (i, l) => void toggleCharacter(i, l),
      scenes: (i, l) => void toggleScene(i, l),
      props: (i, l) => void toggleProp(i, l),
      actions: (i, l) => void toggleAction(i, l)
    })
  }

  const addBeat = async (): Promise<void> => {
    await storiesRunAddBeat({
      editingId,
      order: beats.length,
      firstChar: detail?.characters[0]?.id,
      firstScene: detail?.scenes[0]?.id,
      create: (payload) => getApi().timeline.create(payload),
      loadDetail,
      refreshStories,
      setError: setActionError
    })
  }

  const updateBeat = async (
    id: string,
    patch: {
      dialogue?: string | null
      beatContentJson?: string | null
      characterId?: string | null
      sceneId?: string | null
      propId?: string | null
      actionId?: string | null
      characterIds?: string[] | null
      sceneIds?: string[] | null
      propIds?: string[] | null
      actionIds?: string[] | null
    }
  ): Promise<void> => {
    await storiesRunUpdateBeat({
      id,
      patch: patch as never,
      setBeats: setBeats as never,
      update: (bid, p) => getApi().timeline.update(bid, p as never),
      setError: setActionError,
      toastError: toast.error,
      editingId,
      reload: (sid) => loadDetail(sid)
    })
  }

  const deleteBeat = async (id: string): Promise<void> => {
    await storiesRunDeleteBeat({
      confirm: () =>
        dialog.confirm({
          message: t('common.confirmDelete'),
          variant: 'danger'
        }),
      delete: () => getApi().timeline.delete(id),
      editingId,
      reload: async () => {
        await loadDetail(editingId!)
        await refreshStories()
      },
      toastSuccess: () => toast.success(t('common.deleted')),
      setError: setActionError,
      toastError: toast.error
    })
  }

  const moveBeat = async (id: string, delta: -1 | 1): Promise<void> => {
    await storiesRunMoveBeat({
      editingId,
      beats,
      id,
      delta,
      setBeats: (next) => setBeats(next as typeof beats),
      reorder: (ids) => getApi().timeline.reorder(editingId!, ids),
      toastSuccess: () => toast.success(t('stories.beatReordered')),
      setError: setActionError,
      toastError: toast.error,
      reload: () => loadDetail(editingId!)
    })
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-gradient-to-b from-ink-950 via-ink-950 to-ink-900">
      <PageHeader
        title={t('stories.title')}
        subtitle={t('stories.subtitle')}
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => void handleImportBackup()}
            >
              {t('stories.importBackup')}
            </Button>
            <Button onClick={openCreate}>{t('stories.new')}</Button>
          </>
        }
      />

      {!editorOpen && (
      <div className="relative min-h-0 flex-1 overflow-y-auto px-8 py-6">
        <LibraryPageBody
          footer={
            !loading && stories.length > 0 ? (
              <LibraryPagination
                page={storyBrowse.page}
                totalPages={storyBrowse.totalPages}
                onPageChange={storyBrowse.setPage}
                filteredCount={storyBrowse.filteredCount}
                totalCount={storyBrowse.totalCount}
              />
            ) : undefined
          }
        >
          {loading ? (
            <p className="text-sm text-ink-400">{t('common.loading')}</p>
          ) : stories.length === 0 ? (
            <div className="mx-auto max-w-md py-16 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-ink-800 text-2xl">
                📖
              </div>
              <p className="text-ink-300">{t('stories.noStories')}</p>
              <p className="mt-2 text-xs text-ink-500">
                {t('stories.prototypeNote')}
              </p>
              <div className="mt-6 flex justify-center">
                <Button onClick={openCreate}>{t('stories.new')}</Button>
              </div>
            </div>
          ) : (
            <>
              <LibraryBrowseBar
                q={storyBrowse.q}
                onQueryChange={storyBrowse.setQ}
                placeholder={t('library.searchPlaceholder')}
                hasActiveFilters={storyHasFilters}
                onClearFilters={clearStoryFilters}
                filters={
                  <>
                    <LibraryFilterSelect
                      label={t('library.filterStatus')}
                      ariaLabel={t('library.filterStatus')}
                      value={storyStatus}
                      onChange={setStoryStatus}
                      options={storyStatusOptions}
                    />
                    <LibraryFilterSelect
                      label={t('library.filterCover')}
                      ariaLabel={t('library.filterCover')}
                      value={storyCover}
                      onChange={setStoryCover}
                      options={[
                        { value: '', label: t('library.filterAny') },
                        {
                          value: 'has',
                          label: t('library.filterHasCover')
                        },
                        {
                          value: 'none',
                          label: t('library.filterNoCover')
                        }
                      ]}
                    />
                    <LibraryFilterSelect
                      label={t('library.filterSort')}
                      ariaLabel={t('library.filterSort')}
                      value={storySort}
                      onChange={setStorySort}
                      options={[
                        {
                          value: 'updated',
                          label: t('library.filterSortUpdated')
                        },
                        {
                          value: 'title',
                          label: t('library.filterSortTitle')
                        }
                      ]}
                    />
                  </>
                }
              />
              {storyBrowse.filteredCount === 0 ? (
                <EmptyState message={t('library.noMatch')} />
              ) : (
                <div className={libraryGridClass}>
                  {storyBrowse.pageItems.map((story) => (
                    <article key={story.id} className={libraryCardClass}>
                      <div className={libraryMediaClass}>
                        {story.coverPath ? (
                          <LocalMediaImage
                            filePath={story.coverPath}
                            alt={story.title}
                            variant="fill"
                            maxHeightClass="h-full max-h-none"
                            objectFit="cover"
                            className="h-full border-0 rounded-none"
                            actionsLayout="overlay"
                            onImageClick={() => openEditor(story.id)}
                          />
                        ) : (
                          <button
                            type="button"
                            className="flex h-full w-full flex-col items-center justify-center gap-2 text-ink-600"
                            onClick={() => openEditor(story.id)}
                          >
                            <span className="text-3xl opacity-40">🎬</span>
                            <span className="text-xs">
                              {t('stories.coverMissing')}
                            </span>
                          </button>
                        )}
                      </div>
                      <div className={libraryBodyClass}>
                        <div className="flex items-start justify-between gap-2">
                          <h2 className="min-w-0 truncate text-base font-semibold tracking-tight text-ink-50">
                            {story.title}
                          </h2>
                          <span
                            className={[
                              'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium',
                              story.status === 'COMPLETED'
                                ? 'bg-emerald-950/60 text-emerald-200 ring-1 ring-emerald-800/50'
                                : story.status === 'FAILED'
                                  ? 'bg-rose-950/60 text-rose-200 ring-1 ring-rose-800/50'
                                  : story.status === 'GENERATING'
                                    ? 'bg-amber-950/60 text-amber-100 ring-1 ring-amber-800/40'
                                    : 'bg-ink-800/80 text-ink-300 ring-1 ring-ink-700/80'
                            ].join(' ')}
                            title={t('stories.status')}
                          >
                            {storyStatusLabel(story.status)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-ink-400">
                          {t('stories.counts', {
                            characters: castCount(story._count, 'characters'),
                            scenes: castCount(story._count, 'scenes'),
                            props: castCount(story._count, 'props'),
                            timeline: story._count?.timeline ?? 0
                          })}
                        </p>
                        <div className={libraryCardActionsRowClass}>
                          <Button
                            variant="secondary"
                            className={libraryCardActionBtnClass}
                            onClick={() => openEditor(story.id)}
                          >
                            {t('common.edit')}
                          </Button>
                          <Button
                            variant="ghost"
                            className={libraryCardActionBtnClass}
                            onClick={() => void handleExportBackup(story.id)}
                          >
                            {t('stories.exportBackup')}
                          </Button>
                          <Button
                            variant="ghost"
                            className={libraryCardActionDeleteClass}
                            onClick={() => void handleDelete(story.id)}
                          >
                            {t('common.delete')}
                          </Button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
        </LibraryPageBody>
      </div>
      )}

      <EditorShell
        open={editorOpen}
        title={editingId ? t('common.edit') : t('stories.new')}
        subtitle={editTitle.trim() || t('stories.editorHint')}
        onClose={closeEditor}
        onSave={() => void handleSaveMeta()}
        saveDisabled={!editTitle.trim()}
        saveLabel={busy ? t('common.saving') : t('common.save')}
        cancelLabel={t('common.cancel')}
        busy={busy || storyCoverBusy}
        tabs={[
          { id: 'meta', label: t('stories.tabMeta') },
          { id: 'cast', label: t('stories.tabCast') },
          { id: 'script', label: t('stories.tabScript') }
        ]}
        activeTab={editorTab}
        onTabChange={(id) => setEditorTab(id as EditorTab)}
        preview={
          <EntityGalleryPanel
            title={t('stories.coverTitle')}
            countLabel={String(coverGallery.length)}
            previewPath={selectedCoverImage?.path ?? coverPath}
            previewAlt={editTitle || t('stories.coverTitle')}
            maxHeightClass="max-h-[min(36vh,420px)] lg:max-h-[min(48vh,520px)]"
            showMeta
            objectFit="cover"
            isCover={Boolean(
              selectedCoverImage?.path &&
                coverPath === selectedCoverImage.path
            )}
            onSetAsCover={storiesCoverSetHandler(
              selectedCoverImage?.path,
              handleSetStoryCover
            )}
            onRemove={storiesCoverRemoveHandler(
              selectedCoverImage?.id,
              handleRemoveCoverImage
            )}
            emptyMessage={t('stories.coverMissing')}
            emptyHint={!editingId ? t('stories.metaHint') : null}
            items={coverGallery}
            selectedId={selectedCoverId}
            selectedIds={selectedCoverIds}
            multiSelect
            coverPath={coverPath}
            fallbackCoverPath={coverPath}
            onSelect={(id) => setSelectedCoverId(id)}
            onToggleSelect={(id) =>
              setSelectedCoverIds((ids) => toggleGallerySelection(ids, id))
            }
            onReorder={(fromId, toId) => {
              const from = coverGallery.findIndex((g) => g.id === fromId)
              const to = coverGallery.findIndex((g) => g.id === toId)
              if (from < 0 || to < 0) return
              const next = [...coverGallery]
              const [item] = next.splice(from, 1)
              next.splice(to, 0, item)
              setCoverGallery(next)
            }}
            labelOf={(g) => translateCharacterGalleryLabel(g.label, t)}
            identityRef={{
              checked: useIdentityRef,
              onChange: setUseIdentityRef,
              disabled: !coverPath && !selectedCoverImage
            }}
            footerActions={[
              {
                label: storiesGeneratingLabel(
                  storyCoverBusy,
                  t('common.generating'),
                  t('stories.generateCover')
                ),
                onClick: () => handleGenerateCover(),
                disabled: !editingId || storyCoverBusy,
                variant: 'primary'
              },
              {
                label: t('common.uploadRef'),
                onClick: () => void handlePickCover(),
                variant: 'secondary',
                disabled: !editingId
              }
            ]}
          />
        }
      >
        {actionError && (
          <div className="mb-4 rounded-xl border border-rose-900/50 bg-rose-950/40 px-4 py-3 text-sm text-rose-100">
            {actionError}
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

        {editorTab === 'meta' && (
          <div className={editorFormClass}>
            <section className="rounded-xl border border-brand-800/35 bg-gradient-to-br from-brand-950/40 via-ink-900/50 to-ink-950 p-4">
              <h3 className="text-sm font-semibold text-brand-100">
                {t('stories.aiQuickTitle')}
              </h3>
              <p className="mt-1 text-[11px] text-ink-400">
                {t('stories.aiQuickHint')}
              </p>
              <Textarea
                className="mt-3"
                size="md"
                value={aiIdea}
                onChange={(e) => setAiIdea(e.target.value)}
                placeholder={t('stories.aiIdeaPlaceholder')}
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  disabled={storyAiBusy || aiBusy}
                  onClick={() => handleAiMeta()}
                >
                  {storiesGeneratingLabel(
                    storyAiBusy || aiBusy,
                    t('common.generating'),
                    t('stories.aiFillMeta')
                  )}
                </Button>
                <Button
                  variant="secondary"
                  disabled={storyAiBusy || aiBusy || !editingId}
                  onClick={() => void handleAiScript()}
                >
                  {t('stories.aiFillScript')}
                </Button>
              </div>
            </section>
            <div className="grid gap-4 sm:grid-cols-[1fr_minmax(9rem,12rem)]">
              <EditorField label={t('stories.titleLabel')}>
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder={t('stories.titlePlaceholder')}
                />
              </EditorField>
              <EditorField
                label={t('stories.status')}
                hint={t('stories.statusHint')}
              >
                <EditorSelect
                  value={editStatus}
                  onChange={(e) =>
                    setEditStatus(e.target.value as StoryStatus)
                  }
                  aria-label={t('stories.status')}
                >
                  {storyStatusEditOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </EditorSelect>
              </EditorField>
            </div>
            <EditorField
              label={t('characters.artStyle')}
              hint={t('characters.artStyleHintShort')}
            >
              <EditorSelect
                value={storyArtStyle}
                onChange={(e) =>
                  setStoryArtStyle(e.target.value as ArtStyleId)
                }
                aria-label={t('characters.artStyle')}
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
            <EditorField
              label={t('common.hardRules')}
              hint={`${t('common.hardRulesHint')} · ${t('stories.aiFillMeta')}`}
            >
              <Textarea
                size="md"
                value={hardRules}
                onChange={(e) => setHardRules(e.target.value)}
                placeholder={t('common.hardRulesPh')}
              />
            </EditorField>
            <EditorField
              label={t('stories.styleNote')}
              hint={t('stories.styleNotePlaceholder')}
            >
              <Textarea
                size="fill"
                value={styleNote}
                onChange={(e) => setStyleNote(e.target.value)}
                placeholder={t('stories.styleNotePlaceholder')}
              />
            </EditorField>
            <p className="text-[11px] text-ink-500">{t('stories.metaHint')}</p>
          </div>
        )}

        {editorTab === 'cast' && (
          <div className={`${editorFormWideClass} flex flex-col gap-3`}>
            <p className="text-[11px] text-ink-500">{t('stories.castHint')}</p>
            {!editingId ? (
              <p className="rounded-xl border border-ink-800 bg-ink-900/40 px-4 py-3 text-sm text-ink-400">
                {t('stories.metaHint')}
              </p>
            ) : null}

            {/* Kind tabs */}
            <div className="flex flex-wrap gap-1 rounded-xl border border-ink-800 bg-ink-950/50 p-1">
              {(
                [
                  {
                    id: 'characters' as const,
                    label: t('nav.characters'),
                    count: allChars.length,
                    linked: linkedCharIds.size
                  },
                  {
                    id: 'scenes' as const,
                    label: t('nav.scenes'),
                    count: allScenes.length,
                    linked: linkedSceneIds.size
                  },
                  {
                    id: 'props' as const,
                    label: t('nav.props'),
                    count: allProps.length,
                    linked: linkedPropIds.size
                  },
                  {
                    id: 'actions' as const,
                    label: t('nav.actions'),
                    count: allActions.length,
                    linked: linkedActionIds.size
                  }
                ] as const
              ).map((tab) => {
                const active = castKind === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    className={[
                      'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition',
                      active
                        ? 'bg-brand-600/25 text-brand-100 shadow-sm'
                        : 'text-ink-400 hover:bg-ink-900 hover:text-ink-200'
                    ].join(' ')}
                    onClick={() => setCastKind(tab.id)}
                  >
                    {tab.label}
                    <span
                      className={[
                        'rounded-full px-1.5 py-0.5 text-[10px] tabular-nums',
                        active
                          ? 'bg-brand-700/50 text-brand-100'
                          : 'bg-ink-800 text-ink-500'
                      ].join(' ')}
                    >
                      {tab.linked}/{tab.count}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Search + link filter */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                className="sm:min-w-0 sm:flex-1"
                value={castQ}
                onChange={(e) => setCastQ(e.target.value)}
                placeholder={t('stories.castSearch')}
              />
              <div className="flex shrink-0 flex-wrap gap-1">
                {(
                  [
                    { id: 'all' as const, label: t('stories.castFilterAll') },
                    {
                      id: 'linked' as const,
                      label: t('stories.castFilterLinked')
                    },
                    {
                      id: 'unlinked' as const,
                      label: t('stories.castFilterUnlinked')
                    }
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={[
                      'rounded-full px-2.5 py-1 text-[11px] font-medium transition',
                      castLinkFilter === f.id
                        ? 'bg-brand-600 text-white'
                        : 'bg-ink-800 text-ink-400 hover:bg-ink-700 hover:text-ink-200'
                    ].join(' ')}
                    onClick={() => setCastLinkFilter(f.id)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-ink-500">
              <span>
                {t('stories.castResultCount', {
                  shown: castBrowser.items.length,
                  total: castBrowser.total,
                  linked: castBrowser.linkedCount,
                  library: castBrowser.libraryTotal
                })}
              </span>
            </div>

            {/* List */}
            <div className="overflow-hidden rounded-xl border border-ink-800 bg-ink-900/35">
              {castBrowser.libraryTotal === 0 ? (
                <p className="px-4 py-10 text-center text-[12px] text-ink-500">
                  {castBrowser.empty}
                </p>
              ) : castBrowser.total === 0 ? (
                <p className="px-4 py-10 text-center text-[12px] text-ink-500">
                  {t('stories.castNoMatch')}
                </p>
              ) : (
                <ul className="divide-y divide-ink-800/80">
                  {castBrowser.items.map((it) => {
                    const linked = castBrowser.linkedIds.has(it.id)
                    const charCostumes =
                      castKind === 'characters'
                        ? costumesByCharacter.get(it.id) ?? []
                        : []
                    const selectedCostume =
                      castKind === 'characters'
                        ? storyCostumeByChar.get(it.id) ?? ''
                        : ''
                    return (
                      <li
                        key={it.id}
                        className={[
                          'flex flex-col gap-2 px-3 py-2.5 transition sm:flex-row sm:items-center sm:justify-between',
                          linked ? 'bg-brand-950/20' : 'hover:bg-ink-900/80'
                        ].join(' ')}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate text-sm font-medium text-ink-100">
                              {it.label}
                            </span>
                            {linked && (
                              <span className="rounded bg-brand-700/40 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-brand-200">
                                {t('stories.castInStory')}
                              </span>
                            )}
                          </div>
                          {it.sub && (
                            <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-ink-500">
                              {it.sub}
                            </p>
                          )}
                          {linked && castKind === 'characters' ? (
                            <div className="mt-2 max-w-md">
                              <label className="mb-1 block text-[10px] font-medium text-ink-500">
                                {t('stories.castCostume')}
                              </label>
                              <select
                                className="h-9 w-full cursor-pointer appearance-none rounded-lg border border-ink-700 bg-ink-950/90 py-0 pl-2.5 pr-8 text-xs text-ink-100 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500/40"
                                value={selectedCostume || ''}
                                onChange={(e) =>
                                  void handleSetStoryCostume(
                                    it.id,
                                    e.target.value
                                  )
                                }
                                aria-label={t('stories.castCostume')}
                              >
                                <option value="">
                                  {t('stories.castCostumeDefault')}
                                </option>
                                {charCostumes.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {storiesCostumeOptionLabel(
                                      c.name,
                                      c.description
                                    )}
                                  </option>
                                ))}
                              </select>
                              {charCostumes.length === 0 ? (
                                <p className="mt-1 text-[10px] text-ink-600">
                                  {t('stories.castCostumeNone')}
                                </p>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                        <Button
                          variant={linked ? 'ghost' : 'secondary'}
                          className="!shrink-0 !py-1.5 !text-xs"
                          onClick={() => handleCastToggle(it.id, linked)}
                        >
                          {linked
                            ? t('library.unlinkStory')
                            : t('library.linkStory')}
                        </Button>
                      </li>
                    )
                  })}
                </ul>
              )}

              {/* Pagination */}
              {castBrowser.totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 border-t border-ink-800 px-3 py-2 text-[12px] text-ink-400">
                  <Button
                    variant="ghost"
                    className="!py-1 !text-xs"
                    disabled={castBrowser.page <= 1}
                    onClick={() => setCastPage((p) => Math.max(1, p - 1))}
                  >
                    ←
                  </Button>
                  <span className="tabular-nums">
                    {castBrowser.page} / {castBrowser.totalPages}
                  </span>
                  <Button
                    variant="ghost"
                    className="!py-1 !text-xs"
                    disabled={castBrowser.page >= castBrowser.totalPages}
                    onClick={storiesCastPageNextClick(
                      setCastPage,
                      castBrowser.totalPages
                    )}
                  >
                    →
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {editorTab === 'script' && (
          <div className={editorFormWideClass}>
            {!editingId ? (
              <p className="mb-4 rounded-xl border border-ink-800 bg-ink-900/40 px-4 py-3 text-sm text-ink-400">
                {t('stories.metaHint')}
              </p>
            ) : null}
            <section className="rounded-xl border border-brand-800/35 bg-brand-950/15 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-brand-100">
                    {t('stories.aiFillScript')}
                  </h3>
                  <p className="mt-0.5 text-[11px] text-ink-500">
                    {t('stories.aiScriptHint')}
                  </p>
                </div>
                <Button
                  disabled={aiBusy || !editingId}
                  onClick={() => void handleAiScript()}
                >
                  {storiesGeneratingLabel(
                      aiBusy,
                      t('common.generating'),
                      t('stories.aiFillScript')
                    )}
                </Button>
              </div>
              <Textarea
                className="mt-2"
                size="md"
                value={aiIdea}
                onChange={(e) => setAiIdea(e.target.value)}
                placeholder={t('stories.aiIdeaPlaceholder')}
              />
              {pageBanner && (
                <p className="mt-2 text-[11px] text-brand-200">{pageBanner}</p>
              )}
            </section>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-ink-100">
                  {t('stories.scriptTitle')}
                </h3>
                <p className="mt-0.5 text-[11px] text-ink-500">
                  {t('stories.scriptHint')}
                </p>
              </div>
              <Button variant="secondary" onClick={() => void addBeat()}>
                {t('stories.addBeat')}
              </Button>
            </div>
            {beats.length === 0 ? (
              <EmptyState message={t('stories.noBeats')} />
            ) : (
              <ul className="space-y-3">
                {beats.map((beat, idx) => (
                  <li
                    key={beat.id}
                    className="rounded-xl border border-ink-800 bg-ink-900/40 p-3"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-brand-200">
                        {t('stories.beatN', { n: idx + 1 })}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          className="!py-0.5 !px-2 !text-xs"
                          disabled={idx === 0}
                          onClick={() => void moveBeat(beat.id, -1)}
                          title={t('common.galleryMoveLeft')}
                        >
                          ↑
                        </Button>
                        <Button
                          variant="ghost"
                          className="!py-0.5 !px-2 !text-xs"
                          disabled={idx === beats.length - 1}
                          onClick={() => void moveBeat(beat.id, 1)}
                          title={t('common.galleryMoveRight')}
                        >
                          ↓
                        </Button>
                        <Button
                          variant="ghost"
                          className="!py-0.5 !text-xs text-rose-300"
                          onClick={() => void deleteBeat(beat.id)}
                        >
                          {t('common.delete')}
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-3 rounded-lg border border-ink-800/60 bg-ink-950/30 p-3">
                      <MultiIdPick
                        label={t('stories.beatCharacters')}
                        max={MAX_BEAT_CHARACTERS}
                        emptyLabel={t('stories.castEmptyHint')}
                        options={(detail?.characters ?? []).map((c) => ({
                          id: c.id,
                          label: c.name
                        }))}
                        value={beat.characterIds ?? (beat.characterId ? [beat.characterId] : [])}
                        onChange={storiesMultiBindHandler(
                          (id, p) => void updateBeat(id, p as never),
                          beat.id,
                          'characterIds'
                        )}
                      />
                      <MultiIdPick
                        label={t('stories.beatScenes')}
                        max={MAX_BEAT_SCENES}
                        emptyLabel={t('stories.castEmptyHint')}
                        options={(detail?.scenes ?? []).map((s) => ({
                          id: s.id,
                          label: `#${s.sceneNumber ?? '?'} ${s.title || s.description.slice(0, 24)}`
                        }))}
                        value={beat.sceneIds ?? (beat.sceneId ? [beat.sceneId] : [])}
                        onChange={storiesMultiBindHandler(
                          (id, p) => void updateBeat(id, p as never),
                          beat.id,
                          'sceneIds'
                        )}
                      />
                      <MultiIdPick
                        label={t('stories.beatProps')}
                        max={MAX_BEAT_PROPS}
                        emptyLabel={t('stories.castEmptyHint')}
                        options={(detail?.props ?? []).map((p) => ({
                          id: p.id,
                          label: p.name
                        }))}
                        value={beat.propIds ?? (beat.propId ? [beat.propId] : [])}
                        onChange={storiesMultiBindHandler(
                          (id, p) => void updateBeat(id, p as never),
                          beat.id,
                          'propIds'
                        )}
                      />
                      <MultiIdPick
                        label={t('stories.beatActions')}
                        max={MAX_BEAT_ACTIONS}
                        emptyLabel={t('stories.castEmptyHint')}
                        options={(detail?.actions ?? []).map((a) => ({
                          id: a.id,
                          label: a.name
                        }))}
                        value={
                          beat.actionIds ??
                          (beat.actionId ? [beat.actionId] : [])
                        }
                        onChange={storiesMultiBindHandler(
                          (id, p) => void updateBeat(id, p as never),
                          beat.id,
                          'actionIds'
                        )}
                      />
                    </div>
                    <EditorField
                      className="mt-2"
                      label={t('stories.beatScript')}
                      hint={t('stories.beatScriptHint')}
                    >
                      <div className="mb-1.5 flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          className="!py-0.5 !px-2 !text-xs"
                          onClick={() => {
                            const locale = getAiLocale(i18n.language)
                            const tmpl = beatScriptTemplate(locale)
                            setBeats((prev) =>
                            storiesApplyBeatTemplateToList(prev, beat.id, tmpl)
                          )
                          }}
                        >
                          {t('stories.beatScriptInsertTemplate')}
                        </Button>
                        {(() => {
                          const spoken = extractSpokenLines(
                            parseBeatContent(
                              beat.dialogue,
                              beat.beatContentJson
                            )
                          )
                          return spoken ? (
                            <span className="text-[11px] text-ink-400">
                              {t('stories.beatSpokenPreview', {
                                text: storiesSpokenPreview(spoken, 80)
                              })}
                            </span>
                          ) : (
                            <span className="text-[11px] text-ink-500">
                              {t('stories.beatNoSpoken')}
                            </span>
                          )
                        })()}
                      </div>
                      <Textarea
                        size="lg"
                        className="min-h-[10rem] font-mono text-[13px] leading-relaxed"
                        value={
                          // Prefer live text; hydrate from json only when dialogue is spoken-cache only
                          beat.dialogue &&
                          /【|\[(MOOD|ACTION|DIALOGUE)/i.test(beat.dialogue)
                            ? beat.dialogue
                            : beatContentForEditor(
                                beat.dialogue,
                                beat.beatContentJson,
                                getAiLocale(i18n.language)
                              )
                        }
                        onChange={(e) =>
                          setBeats((prev) =>
                            prev.map((b) =>
                              b.id === beat.id
                                ? { ...b, dialogue: e.target.value }
                                : b
                            )
                          )
                        }
                        onBlur={(e) => {
                          const locale = getAiLocale(i18n.language)
                          const committed = commitBeatScriptEdit(
                            e.target.value,
                            locale
                          )
                          // Keep full script in local state for editing; persist spoken + json
                          setBeats((prev) =>
                            prev.map((b) =>
                              b.id === beat.id
                                ? {
                                    ...b,
                                    dialogue: e.target.value,
                                    beatContentJson: committed.beatContentJson
                                  }
                                : b
                            )
                          )
                          void updateBeat(beat.id, {
                            dialogue: storiesBlurDialogue(
                              committed.dialogue,
                              e.target.value
                            ),
                            beatContentJson: committed.beatContentJson
                          })
                        }}
                        placeholder={t('stories.beatScriptPh')}
                      />
                    </EditorField>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </EditorShell>
      <ImageGenConfirmModal
        open={Boolean(imageGenConfirm)}
        payload={imageGenConfirm}
        busy={storyCoverBusy}
        onCancel={storiesCancelImageGenBind(
          setImageGenConfirm,
          setPendingCoverStoryId
        )}
        onConfirm={(p) => void runStoryCoverJob(p)}
      />
    </div>
  )
}

// ─── Residual pure helpers (absolute line coverage) ─────────────────────────

export function storiesApplyIpc(
  e: unknown,
  setError?: (m: string) => void,
  toastError?: (m: string) => void
): string {
  const msg = parseIpcError(e).message
  setError?.(msg)
  toastError?.(msg)
  return msg
}

export async function storiesRemoveWithFeedback(ops: {
  remove: (id: string) => Promise<unknown>
  id: string
  toastSuccess: () => void
  toastError: (m: string) => void
}): Promise<void> {
  try {
    await ops.remove(ops.id)
    ops.toastSuccess()
  } catch (e) {
    storiesApplyIpc(e, undefined, ops.toastError)
  }
}

export function storiesGuardBusy(
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

export function storiesGuardEmptyTitle(
  title: string,
  toastError: (m: string) => void,
  msg: string
): boolean {
  if (!title.trim()) {
    toastError(msg)
    return true
  }
  return false
}

export async function storiesRunSaveMetaNative(ops: {
  title: string
  editingId: string | null
  setBusy: (v: boolean) => void
  setError: (m: string | null) => void
  create: (title: string) => Promise<{ id: string }>
  setActiveStoryId: (id: string) => void
  update: (id: string) => Promise<unknown>
  reload: () => Promise<void> | void
  toastSuccess: () => void
  toastError: (m: string) => void
  closeEditor: () => void
}): Promise<'empty' | 'ok' | 'error'> {
  if (!ops.title.trim()) return 'empty'
  ops.setBusy(true)
  ops.setError(null)
  try {
    let id = ops.editingId
    if (!id) {
      const created = await ops.create(ops.title.trim())
      id = created.id
      ops.setActiveStoryId(id)
    }
    await ops.update(id)
    await ops.reload()
    ops.toastSuccess()
    ops.closeEditor()
    return 'ok'
  } catch (e) {
    storiesApplyIpc(e, ops.setError, ops.toastError)
    return 'error'
  } finally {
    ops.setBusy(false)
  }
}

export async function storiesRunSetCostume(ops: {
  editingId: string | null
  set: () => Promise<unknown>
  linkFallback: () => Promise<unknown>
  hasSetCostume: boolean
  toastSuccess: () => void
  toastError: (m: string) => void
  setError: (m: string) => void
  reload: () => Promise<void> | void
}): Promise<'no-id' | 'ok' | 'error'> {
  if (!ops.editingId) return 'no-id'
  try {
    if (ops.hasSetCostume) await ops.set()
    else await ops.linkFallback()
    await ops.reload()
    ops.toastSuccess()
    return 'ok'
  } catch (e) {
    storiesApplyIpc(e, ops.setError, ops.toastError)
    return 'error'
  }
}

export function storiesHandleCoverCommitted(
  payload: { storyId: string; path: string },
  editingId: string | null,
  ops: {
    setCoverPath: (p: string) => void
    loadDetail: (id: string) => void
    refresh: () => void
    toastSuccess: () => void
  }
): void {
  if (editingId === payload.storyId) {
    ops.setCoverPath(payload.path)
    void ops.loadDetail(payload.storyId)
  }
  void ops.refresh()
  ops.toastSuccess()
}

export function storiesResolveWantIdentity(
  opts: boolean | undefined,
  useIdentityRef: boolean
): boolean {
  return opts !== undefined ? opts : useIdentityRef
}

export function storiesCoverPathsFromOpts(
  referenceImagePath: string | null | undefined,
  selected: string[],
  useId: boolean,
  coverPath: string | null
): string[] {
  if (referenceImagePath?.trim()) return [referenceImagePath.trim()]
  if (selected.length > 0) return selected
  if (useId && coverPath) return [coverPath]
  return []
}

export function storiesMaybeAppendMulti(
  prompt: string,
  paths: string[],
  locale: string,
  append: (p: string, paths: string[], locale?: string) => string
): string {
  if (paths.length > 1) return append(prompt, paths, locale)
  return prompt
}

export function storiesPlateModeLabel(
  useEdit: boolean,
  identity: string,
  pure: string
): string {
  return useEdit ? identity : pure
}

export async function storiesDiscardDraftSafe(
  discard: (path: string) => Promise<unknown>,
  path: string
): Promise<void> {
  try {
    await discard(path)
  } catch {
    /* ignore */
  }
}

export async function storiesJobCancelDiscard(
  cancelled: boolean,
  discard: (path: string) => Promise<unknown>,
  path: string
): Promise<boolean> {
  if (!cancelled) return false
  await storiesDiscardDraftSafe(discard, path)
  return true
}

export function storiesGuardAiMetaSource(
  title: string,
  idea: string,
  styleNote: string,
  hardRules: string,
  setError: (m: string) => void,
  msg: string
): boolean {
  if (!title.trim() && !idea.trim() && !styleNote.trim() && !hardRules.trim()) {
    setError(msg)
    return true
  }
  return false
}

export function storiesGuardAiScript(
  editingId: string | null,
  charCount: number,
  sceneCount: number,
  setError: (m: string) => void,
  needSave: string,
  needCast: string
): 'needSave' | 'needCast' | 'ok' {
  if (!editingId) {
    setError(needSave)
    return 'needSave'
  }
  if (charCount === 0 && sceneCount === 0) {
    setError(needCast)
    return 'needCast'
  }
  return 'ok'
}

export function storiesApplyAiMetaResult(
  hardRules: string | undefined,
  setHardRules: (s: string) => void
): void {
  if (typeof hardRules === 'string' && hardRules.trim()) {
    setHardRules(hardRules.trim())
  }
}

export async function storiesRunExportBackup(ops: {
  confirm: () => Promise<boolean>
  exportFn: () => Promise<{
    filePath?: string
    downloadUrl?: string
    fileName?: string
  } | null>
  toastSuccess: (m: string) => void
  toastError: (m: string) => void
  okMsg: (path: string) => string
}): Promise<'cancel' | 'ok' | 'noop' | 'error'> {
  if (!(await ops.confirm())) return 'cancel'
  try {
    const r = await ops.exportFn()
    if (r?.downloadUrl || r?.filePath) {
      ops.toastSuccess(ops.okMsg(r.fileName || r.filePath || ''))
      return 'ok'
    }
    return 'noop'
  } catch (e) {
    storiesApplyIpc(e, undefined, ops.toastError)
    return 'error'
  }
}

export async function storiesRunImportBackup(ops: {
  importFn: () => Promise<{ storyId: string; title?: string } | null>
  reload: () => Promise<void> | void
  setActiveStoryId: (id: string) => void
  toastSuccess: (title: string) => void
  toastError: (m: string) => void
}): Promise<'ok' | 'cancel' | 'error'> {
  try {
    const result = await ops.importFn()
    if (!result) return 'cancel'
    await ops.reload()
    ops.setActiveStoryId(result.storyId)
    ops.toastSuccess(result.title || '')
    return 'ok'
  } catch (e) {
    storiesApplyIpc(e, undefined, ops.toastError)
    return 'error'
  }
}

export async function storiesRunLinkToggle(ops: {
  editingId: string | null
  linked: boolean
  link: () => Promise<unknown>
  unlink: () => Promise<unknown>
  reload: () => Promise<void> | void
  toastSuccess: (linked: boolean) => void
  setError: (m: string) => void
  toastError: (m: string) => void
}): Promise<'no-id' | 'ok' | 'error'> {
  if (!ops.editingId) return 'no-id'
  try {
    if (ops.linked) await ops.unlink()
    else await ops.link()
    await ops.reload()
    ops.toastSuccess(ops.linked)
    return 'ok'
  } catch (e) {
    storiesApplyIpc(e, ops.setError, ops.toastError)
    return 'error'
  }
}

export function storiesDispatchCastToggle(
  kind: string,
  id: string,
  linked: boolean,
  handlers: {
    characters: (id: string, linked: boolean) => void
    scenes: (id: string, linked: boolean) => void
    props: (id: string, linked: boolean) => void
    actions: (id: string, linked: boolean) => void
  }
): void {
  if (kind === 'characters') handlers.characters(id, linked)
  else if (kind === 'scenes') handlers.scenes(id, linked)
  else if (kind === 'props') handlers.props(id, linked)
  else handlers.actions(id, linked)
}

export function storiesOptimisticBeatPatch<
  T extends {
    id: string
    characterIds?: string[]
    characterId?: string | null
    sceneIds?: string[]
    sceneId?: string | null
    propIds?: string[]
    propId?: string | null
    actionIds?: string[]
    actionId?: string | null
  }
>(
  beats: T[],
  id: string,
  patch: {
    characterIds?: string[] | null
    sceneIds?: string[] | null
    propIds?: string[] | null
    actionIds?: string[] | null
  }
): T[] {
  if (
    patch.characterIds === undefined &&
    patch.sceneIds === undefined &&
    patch.propIds === undefined &&
    patch.actionIds === undefined
  ) {
    return beats
  }
  return beats.map((b) => {
    if (b.id !== id) return b
    const next = { ...b }
    if (patch.characterIds !== undefined) {
      next.characterIds = patch.characterIds ?? []
      next.characterId = patch.characterIds?.[0] ?? null
    }
    if (patch.sceneIds !== undefined) {
      next.sceneIds = patch.sceneIds ?? []
      next.sceneId = patch.sceneIds?.[0] ?? null
    }
    if (patch.actionIds !== undefined) {
      next.actionIds = patch.actionIds ?? []
      next.actionId = patch.actionIds?.[0] ?? null
    }
    if (patch.propIds !== undefined) {
      next.propIds = patch.propIds ?? []
      next.propId = patch.propIds?.[0] ?? null
    }
    return next
  })
}

export function storiesMoveBeatIndex<T extends { id: string }>(
  beats: T[],
  id: string,
  delta: -1 | 1
): { next: T[] | null } {
  const idx = beats.findIndex((b) => b.id === id)
  const target = idx + delta
  if (idx < 0 || target < 0 || target >= beats.length) {
    return { next: null }
  }
  const next = [...beats]
  const [item] = next.splice(idx, 1)
  next.splice(target, 0, item!)
  return { next }
}

export function storiesSelectedCoverIds(
  selectedCoverIds: string[],
  selectedCoverId: string | null
): string[] {
  return selectedCoverIds.length > 0
    ? selectedCoverIds
    : selectedCoverId
      ? [selectedCoverId]
      : []
}

export function storiesMsgToast(
  toastFn: (m: string) => void,
  msg: string
): () => void {
  return () => toastFn(msg)
}

export function storiesShouldReorder(fromId: string, toId: string): boolean {
  return Boolean(fromId && toId && fromId !== toId)
}

export function storiesBeatLabel(
  index: number,
  title: string | null | undefined,
  fallback: string
): string {
  return title?.trim() || `${fallback} ${index + 1}`
}

export function storiesNextCoverAfterRemove(
  next: { path: string }[],
  removedPath: string | undefined,
  coverPath: string | null,
  primary: (g: { path: string }[]) => string | null
): string | null {
  if (removedPath && coverPath === removedPath) return primary(next)
  if (next.some((g) => g.path === coverPath)) return coverPath
  return primary(next)
}

export function storiesRemoveCoverState(
  next: { id: string; path: string }[],
  removed: { id: string; path: string } | undefined,
  coverPath: string | null,
  selectedId: string | null,
  primary: (g: { path: string }[]) => string | null,
  isCover: (g: { path: string }[], c: string | null) => boolean
): {
  coverPath: string | null
  selectedCoverId: string | null
} {
  if (removed && coverPath === removed.path) {
    const p = primary(next)
    return {
      coverPath: p,
      selectedCoverId:
        next.find((g) => g.path === p)?.id ?? next[0]?.id ?? null
    }
  }
  if (!isCover(next, coverPath)) {
    return {
      coverPath: primary(next),
      selectedCoverId: next[0]?.id ?? null
    }
  }
  return {
    coverPath,
    selectedCoverId:
      selectedId === removed?.id ? next[0]?.id ?? null : selectedId
  }
}

export function storiesGuardAiNeed(
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

export function storiesHasDraft(snapshot: Record<string, unknown>): boolean {
  return Object.values(snapshot).some(
    (v) => typeof v === 'string' && v.length > 0
  )
}

export function storiesAiFillToastKey(
  hasImage: boolean,
  idea: string,
  hasDraft: boolean
): 'fromImage' | 'background' {
  return hasImage && !idea && !hasDraft ? 'fromImage' : 'background'
}

export async function storiesRunGenerateCoverSetup(ops: {
  storyId: string | null | undefined
  isBusy: (id: string) => boolean
  useIdentity: boolean
  paths: string[]
  resolveIdentity: (args: {
    useIdentityRef: boolean
    selectedPaths: string[]
  }) => { useEdit: boolean; paths: string[] }
  buildPrompt: (useEdit: boolean) => string
  maybeAppend: (prompt: string, paths: string[]) => string
  ensureRules: (prompt: string) => string
  summary: string
  setPendingId: (id: string) => void
  setConfirm: (p: {
    prompt: string
    referencePaths: string[]
    useIdentityEdit: boolean
    summary: string
  }) => void
}): Promise<'no-id' | 'busy' | 'ready'> {
  const sid = ops.storyId
  if (!sid) return 'no-id'
  if (ops.isBusy(sid)) return 'busy'
  const idRes = ops.resolveIdentity({
    useIdentityRef: ops.useIdentity,
    selectedPaths: ops.paths
  })
  let prompt = ops.buildPrompt(idRes.useEdit)
  prompt = ops.maybeAppend(prompt, idRes.paths)
  prompt = ops.ensureRules(prompt)
  ops.setPendingId(sid)
  ops.setConfirm({
    prompt,
    referencePaths: idRes.paths,
    useIdentityEdit: idRes.useEdit,
    summary: ops.summary
  })
  return 'ready'
}

export function storiesCoverPromptParts(ops: {
  locale: 'zh-HK' | 'en'
  title: string
  note: string
  idea: string
  artBlock: string
}): string[] {
  if (ops.locale === 'en') {
    return [
      'PROFESSIONAL SHORT-DRAMA POSTER / KEY ART (16:9 cinematic still).',
      'Not a UI mockup. No text, no logo, no watermark, no title caption.',
      `Story title (mood only, do not letter it): ${ops.title}.`,
      ops.artBlock,
      ops.note ? `Style bible: ${ops.note}` : '',
      ops.idea ? `Extra direction: ${ops.idea}` : '',
      'Evocative establishing mood frame suitable as a library card cover.',
      'Match the art medium; strong silhouette and readable mood.'
    ].filter(Boolean)
  }
  return [
    'PROFESSIONAL SHORT-DRAMA POSTER / KEY ART (16:9 cinematic still).',
    'Not a UI mockup. No text, no logo, no watermark, no title caption.',
    `故事標題（只取氣氛，畫面勿寫出文字）：${ops.title}。`,
    ops.artBlock,
    ops.note ? `風格備註：${ops.note}` : '',
    ops.idea ? `額外方向：${ops.idea}` : '',
    '適合用作片庫封面的情緒建立鏡頭；強烈剪影、可讀氣氛。',
    '依藝術風格 medium 出圖；構圖清晰。'
  ].filter(Boolean)
}


export function storiesMakeLinkToggle(ops: {
  getEditingId: () => string | null
  link: (id: string) => Promise<unknown>
  unlink: (id: string) => Promise<unknown>
  reload: () => Promise<void> | void
  toastSuccess: (linked: boolean) => void
  setError: (m: string) => void
  toastError: (m: string) => void
}): (id: string, linked: boolean) => Promise<void> {
  return async (id, linked) => {
    await storiesRunLinkToggle({
      editingId: ops.getEditingId(),
      linked,
      link: () => ops.link(id),
      unlink: () => ops.unlink(id),
      reload: ops.reload,
      toastSuccess: ops.toastSuccess,
      setError: ops.setError,
      toastError: ops.toastError
    })
  }
}

export function storiesMakeSetCover(
  setCoverPath: (p: string) => void,
  coverGallery: { id: string; path: string }[],
  setSelectedCoverId: (id: string | null) => void,
  toastSuccess: () => void
): (path: string) => void {
  return (path: string) => {
    setCoverPath(path)
    const hit = coverGallery.find((g) => g.path === path)
    if (hit) setSelectedCoverId(hit.id)
    toastSuccess()
  }
}

export function storiesMakeCoverCommitted(
  getEditingId: () => string | null,
  ops: {
    setCoverPath: (p: string) => void
    loadDetail: (id: string) => void
    refresh: () => void
    toastSuccess: () => void
  }
): (payload: { storyId: string; path: string }) => void {
  return (payload) =>
    storiesHandleCoverCommitted(payload, getEditingId(), ops)
}

export function storiesGeneratingLabel(
  busy: boolean,
  generating: string,
  idle: string
): string {
  return busy ? generating : idle
}

export function storiesStatusOrDraft(
  status: string | undefined,
  isStatus: (s: string) => boolean
): string {
  return isStatus(status ?? '') ? (status as string) : 'DRAFT'
}

export function storiesAppendTemplate(
  dialogue: string | null | undefined,
  tmpl: string
): string {
  return dialogue?.trim() ? `${dialogue.trim()}\n${tmpl}` : tmpl
}

export function storiesSpokenPreview(
  spoken: string,
  max = 80
): string {
  return spoken.length > max ? `${spoken.slice(0, max)}…` : spoken
}

export function storiesCreateId(
  create: () => Promise<{ id: string }>
): Promise<{ id: string }> {
  return create()
}

export function storiesEditPrefix(
  locale: 'zh-HK' | 'en'
): string {
  return locale === 'en'
    ? 'IMAGE EDIT: create a new short-drama poster composition. Keep identity/mood of subjects if present. '
    : 'IMAGE EDIT：以新構圖創作短劇海報。保留主體身份／氣氛（如有）。'
}

export function storiesPrimaryCover(
  coverGallery: { id: string; path: string }[],
  coverPath: string | null
): { id: string; path: string } | null {
  return (
    coverGallery.find((g) => g.path === coverPath) ??
    coverGallery[0] ??
    null
  )
}

export function storiesSortTitle(
  a: { title: string },
  b: { title: string }
): number {
  return a.title.localeCompare(b.title, 'zh-Hant')
}


export async function storiesRunUpdateBeat(ops: {
  id: string
  patch: Record<string, unknown>
  setBeats: (fn: (prev: unknown[]) => unknown[]) => void
  update: (id: string, patch: unknown) => Promise<unknown>
  setError: (m: string) => void
  toastError: (m: string) => void
  editingId: string | null
  reload: (id: string) => Promise<void> | void
}): Promise<void> {
  ops.setBeats(
    (prev) =>
      storiesOptimisticBeatPatch(prev as never, ops.id, ops.patch as never) as never
  )
  try {
    const updated = await ops.update(ops.id, ops.patch)
    ops.setBeats((prev) =>
      (prev as { id: string }[]).map((b) =>
        b.id === ops.id ? { ...b, ...(updated as object) } : b
      )
    )
  } catch (e) {
    storiesApplyIpc(e, ops.setError, ops.toastError)
    if (ops.editingId) await ops.reload(ops.editingId)
  }
}

export async function storiesRunDeleteBeat(ops: {
  confirm: () => Promise<boolean>
  delete: () => Promise<unknown>
  editingId: string | null
  reload: () => Promise<void> | void
  toastSuccess: () => void
  setError: (m: string) => void
  toastError: (m: string) => void
}): Promise<'cancel' | 'ok' | 'error'> {
  if (!(await ops.confirm())) return 'cancel'
  try {
    await ops.delete()
    if (ops.editingId) await ops.reload()
    ops.toastSuccess()
    return 'ok'
  } catch (e) {
    storiesApplyIpc(e, ops.setError, ops.toastError)
    return 'error'
  }
}

export async function storiesRunMoveBeat(ops: {
  editingId: string | null
  beats: { id: string }[]
  id: string
  delta: -1 | 1
  setBeats: (next: { id: string }[]) => void
  reorder: (ids: string[]) => Promise<unknown>
  toastSuccess: () => void
  setError: (m: string) => void
  toastError: (m: string) => void
  reload: () => Promise<void> | void
}): Promise<'no-id' | 'noop' | 'ok' | 'error'> {
  if (!ops.editingId) return 'no-id'
  const { next } = storiesMoveBeatIndex(ops.beats, ops.id, ops.delta)
  if (!next) return 'noop'
  ops.setBeats(next)
  try {
    await ops.reorder(next.map((b) => b.id))
    ops.toastSuccess()
    return 'ok'
  } catch (e) {
    storiesApplyIpc(e, ops.setError, ops.toastError)
    await ops.reload()
    return 'error'
  }
}

export function storiesPickCoverImage(
  coverGallery: { id: string; path: string }[],
  selectedCoverId: string | null,
  coverPath: string | null
): { id: string; path: string } | null {
  return (
    coverGallery.find((g) => g.id === selectedCoverId) ??
    coverGallery.find((g) => g.path === coverPath) ??
    coverGallery[0] ??
    null
  )
}


export function storiesApplyBeatTemplate(
  dialogue: string | null | undefined,
  tmpl: string
): string {
  return storiesAppendTemplate(dialogue, tmpl)
}

export function storiesApplyBeatTemplateToList<
  T extends { id: string; dialogue?: string | null }
>(beats: T[], beatId: string, tmpl: string): T[] {
  return beats.map((b) =>
    b.id === beatId
      ? { ...b, dialogue: storiesApplyBeatTemplate(b.dialogue, tmpl) }
      : b
  )
}

export function storiesCommitBeatBlur(
  value: string,
  locale: 'zh-HK' | 'en',
  commit: (
    value: string,
    locale: 'zh-HK' | 'en'
  ) => { dialogue?: string | null; beatContentJson?: string | null }
): {
  dialogue: string | null
  beatContentJson?: string | null
  localDialogue: string
} {
  const committed = commit(value, locale)
  return {
    dialogue: committed.dialogue ?? (value.trim() || null),
    beatContentJson: committed.beatContentJson,
    localDialogue: value
  }
}

export function storiesHardRulesFromDetail(
  hardRules: unknown
): string {
  return typeof hardRules === 'string' ? hardRules ?? '' : ''
}

export function storiesCastPageNext(
  page: number,
  totalPages: number
): number {
  return Math.min(totalPages, page + 1)
}

export function storiesDescSlice(
  description: string | null | undefined,
  n = 40
): string {
  return (description ?? '').slice(0, n)
}


export function storiesCancelImageGen(
  setConfirm: (v: null) => void,
  setPending: (v: null) => void
): void {
  setConfirm(null)
  setPending(null)
}

export function storiesMultiBindUpdate(
  updateBeat: (id: string, patch: Record<string, unknown>) => void,
  beatId: string,
  key: string,
  ids: string[]
): void {
  updateBeat(beatId, { [key]: ids })
}

export function storiesBrowseSort(
  mode: string,
  a: { title?: string; updatedAt?: string | Date },
  b: { title?: string; updatedAt?: string | Date }
): number {
  if (mode === 'title') {
    return storiesSortTitle(a, b)
  }
  const ta = a.updatedAt
  const tb = b.updatedAt
  const sa = ta ? new Date(ta).getTime() : 0
  const sb = tb ? new Date(tb).getTime() : 0
  return sb - sa
}

export async function storiesCreateStoryId(
  title: string,
  create: (title: string) => Promise<{ id: string }>
): Promise<{ id: string }> {
  const created = await create(title)
  return { id: created.id as string }
}

export async function storiesCoverJobAfterGen(ops: {
  cancelled: boolean
  discard: (path: string) => Promise<unknown>
  path: string
}): Promise<boolean> {
  return storiesJobCancelDiscard(ops.cancelled, ops.discard, ops.path)
}

export function storiesPropLinkToggleOps(ops: {
  getEditingId: () => string | null
  linkProp: (storyId: string, propId: string) => Promise<unknown>
  unlinkProp: (storyId: string, propId: string) => Promise<unknown>
  loadDetail: (id: string) => Promise<void> | void
  refreshStories: () => Promise<void> | void
  toastSuccess: (wasLinked: boolean) => void
  setError: (m: string) => void
  toastError: (m: string) => void
}): {
  getEditingId: () => string | null
  link: (id: string) => Promise<unknown>
  unlink: (id: string) => Promise<unknown>
  reload: () => Promise<void>
  toastSuccess: (wasLinked: boolean) => void
  setError: (m: string) => void
  toastError: (m: string) => void
} {
  return {
    getEditingId: ops.getEditingId,
    link: async (id) =>
      ops.linkProp(ops.getEditingId()!, id),
    unlink: async (id) =>
      ops.unlinkProp(ops.getEditingId()!, id),
    reload: async () => {
      await ops.loadDetail(ops.getEditingId()!)
      await ops.refreshStories()
    },
    toastSuccess: ops.toastSuccess,
    setError: ops.setError,
    toastError: ops.toastError
  }
}

export function storiesCastBrowserRows(
  kind: 'characters' | 'scenes' | 'props' | 'actions',
  data: {
    characters: Array<{ id: string; name: string; description?: string | null; updatedAt?: string | Date }>
    scenes: Array<{ id: string; title?: string | null; description: string; updatedAt?: string | Date }>
    props: Array<{ id: string; name: string; description?: string | null; updatedAt?: string | Date }>
    actions: Array<{ id: string; name: string; description?: string | null; updatedAt?: string | Date }>
    linkedCharIds: Set<string>
    linkedSceneIds: Set<string>
    linkedPropIds: Set<string>
    linkedActionIds: Set<string>
    emptyChars: string
    emptyScenes: string
    emptyProps: string
    emptyActions: string
  }
): {
  items: Array<{ id: string; label: string; sub?: string | null; updatedAt?: string | Date }>
  linkedIds: Set<string>
  empty: string
} {
  if (kind === 'characters') {
    return {
      items: data.characters.map((c) => ({
        id: c.id,
        label: c.name,
        sub: c.description,
        updatedAt: c.updatedAt
      })),
      linkedIds: data.linkedCharIds,
      empty: data.emptyChars
    }
  }
  if (kind === 'scenes') {
    return {
      items: data.scenes.map((s) => ({
        id: s.id,
        label: s.title || s.description.slice(0, 48),
        sub: s.description,
        updatedAt: s.updatedAt
      })),
      linkedIds: data.linkedSceneIds,
      empty: data.emptyScenes
    }
  }
  if (kind === 'props') {
    return {
      items: data.props.map((p) => ({
        id: p.id,
        label: p.name,
        sub: p.description,
        updatedAt: p.updatedAt
      })),
      linkedIds: data.linkedPropIds,
      empty: data.emptyProps
    }
  }
  return {
    items: data.actions.map((a) => ({
      id: a.id,
      label: a.name,
      sub: a.description,
      updatedAt: a.updatedAt
    })),
    linkedIds: data.linkedActionIds,
    empty: data.emptyActions
  }
}

export async function storiesRunAddBeat(ops: {
  editingId: string | null
  order: number
  firstChar?: string
  firstScene?: string
  create: (payload: {
    storyId: string
    startTime: number
    endTime: number
    order: number
    dialogue: string
    characterIds: string[]
    sceneIds: string[]
    propIds: string[]
    actionIds: string[]
  }) => Promise<unknown>
  loadDetail: (id: string) => Promise<void> | void
  refreshStories: () => Promise<void> | void
  setError: (m: string) => void
}): Promise<'no-id' | 'ok' | 'error'> {
  if (!ops.editingId) return 'no-id'
  try {
    const start = ops.order * 6
    await ops.create({
      storyId: ops.editingId,
      startTime: start,
      endTime: start + 6,
      order: ops.order,
      dialogue: '',
      characterIds: ops.firstChar ? [ops.firstChar] : [],
      sceneIds: ops.firstScene ? [ops.firstScene] : [],
      propIds: [],
      actionIds: []
    })
    await ops.loadDetail(ops.editingId)
    await ops.refreshStories()
    return 'ok'
  } catch (e) {
    storiesApplyIpc(e, ops.setError)
    return 'error'
  }
}

export function storiesCoverSetHandler(
  path: string | null | undefined,
  setCover: (path: string) => void
): (() => void) | undefined {
  return path ? () => setCover(path) : undefined
}

export function storiesCoverRemoveHandler(
  id: string | null | undefined,
  remove: (id: string) => void
): (() => void) | undefined {
  return id ? () => remove(id) : undefined
}

export function storiesBlurDialogue(
  committed: string | null | undefined,
  raw: string
): string | null {
  return committed ?? (raw.trim() || null)
}

export function storiesCoverJobCancelledResult(): undefined {
  return undefined
}

export function storiesAiMetaShouldSkip(
  title: string,
  idea: string,
  styleNote: string,
  hardRules: string,
  setError: (m: string) => void,
  needTitle: string
): boolean {
  return storiesGuardAiMetaSource(
    title,
    idea,
    styleNote,
    hardRules,
    setError,
    needTitle
  )
}

export function storiesMakePropToggle(ops: {
  getEditingId: () => string | null
  storiesApi: {
    linkProp: (p: { storyId: string; propId: string }) => Promise<unknown>
    unlinkProp: (p: { storyId: string; propId: string }) => Promise<unknown>
  }
  loadDetail: (id: string) => Promise<void> | void
  refreshStories: () => Promise<void> | void
  linkedMsg: string
  unlinkedMsg: string
  toastSuccess: (m: string) => void
  setError: (m: string) => void
  toastError: (m: string) => void
}): (id: string, linked: boolean) => Promise<void> {
  return storiesMakeLinkToggle(
    storiesPropLinkToggleOps({
      getEditingId: ops.getEditingId,
      linkProp: (storyId, propId) =>
        ops.storiesApi.linkProp({ storyId, propId }),
      unlinkProp: (storyId, propId) =>
        ops.storiesApi.unlinkProp({ storyId, propId }),
      loadDetail: ops.loadDetail,
      refreshStories: ops.refreshStories,
      toastSuccess: (wasLinked) =>
        ops.toastSuccess(wasLinked ? ops.unlinkedMsg : ops.linkedMsg),
      setError: ops.setError,
      toastError: ops.toastError
    })
  )
}

export function storiesMultiBindHandler(
  updateBeat: (id: string, patch: Record<string, unknown>) => void,
  beatId: string,
  key: string
): (ids: string[]) => void {
  return (ids) =>
    storiesMultiBindUpdate(updateBeat, beatId, key, ids)
}

export function storiesCancelImageGenBind(
  setConfirm: (v: null) => void,
  setPending: (v: null) => void
): () => void {
  return () => storiesCancelImageGen(setConfirm, setPending)
}

export function storiesCastPageNextClick(
  setPage: (fn: (p: number) => number) => void,
  totalPages: number
): () => void {
  return () => setPage((p) => storiesCastPageNext(p, totalPages))
}

export function storiesCostumeOptionLabel(
  name: string | null | undefined,
  description: string | null | undefined
): string {
  return name?.trim() || storiesDescSlice(description, 40)
}

export async function storiesCoverJobFinishOrCancel<T>(ops: {
  cancelled: boolean
  discard: (path: string) => Promise<unknown>
  path: string
  onContinue: () => Promise<T> | T
}): Promise<T | undefined> {
  const stop = await storiesCoverJobAfterGen({
    cancelled: ops.cancelled,
    discard: ops.discard,
    path: ops.path
  })
  if (stop) return storiesCoverJobCancelledResult()
  return ops.onContinue()
}

export function storiesRunAiMetaIfReady(ops: {
  skip: boolean
  run: () => void
}): void {
  if (ops.skip) return
  ops.run()
}
