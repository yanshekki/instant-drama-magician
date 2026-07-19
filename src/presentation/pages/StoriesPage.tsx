import { useCallback, useEffect, useMemo, useState } from 'react'
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
  libraryMediaClass
} from '../components/libraryCard'
import {
  LibraryBrowseBar,
  LibraryPageBody,
  LibraryPagination
} from '../components/LibraryBrowseBar'
import { LibraryFilterSelect } from '../components/LibraryFilterSelect'
import { useLibraryBrowse } from '../hooks/useLibraryBrowse'
import { matchesSearchQuery } from '../lib/searchQuery'
import { useApp } from '../context/AppContext'
import { useToast } from '../context/ToastContext'
import { useDialog } from '../context/DialogContext'
import { useAiJobs } from '../context/AiJobsContext'
import { PageHeader } from '../components/PageHeader'
import { LocalMediaImage } from '../components/LocalMediaImage'
import { GalleryThumbStrip } from '../components/GalleryThumbStrip'
import { ExternalRefSection } from '../components/ExternalRefSection'
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
  listExternalRefs,
  parseCharacterGallery,
  pickExternalRefPath,
  primaryGalleryPath,
  removeGalleryItem,
  serializeCharacterGallery,
  type CharacterGalleryItem
} from '../../domain/characterGallery'
import { translateCharacterGalleryLabel } from '../../domain/galleryLabelI18n'
import {
  artStylesByGroup,
  DEFAULT_ART_STYLE,
  isArtStyleId,
  type ArtStyleId
} from '../../domain/characterArtStyles'
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
  const { startJob, isBlocked, onStoryCoverCommitted } = useAiJobs()
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
      sort: (a, b) => {
        if (storySort === 'title') {
          return a.title.localeCompare(b.title, 'zh-Hant')
        }
        const ta = (a as { updatedAt?: string | Date }).updatedAt
        const tb = (b as { updatedAt?: string | Date }).updatedAt
        const sa = ta ? new Date(ta).getTime() : 0
        const sb = tb ? new Date(tb).getTime() : 0
        return sb - sa
      }
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
  const [storyArtStyle, setStoryArtStyle] =
    useState<ArtStyleId>(DEFAULT_ART_STYLE)
  const [coverPath, setCoverPath] = useState<string | null>(null)
  const [coverGallery, setCoverGallery] = useState<CharacterGalleryItem[]>([])
  const [selectedCoverId, setSelectedCoverId] = useState<string | null>(null)
  const [useIdentityRef, setUseIdentityRef] = useState(false)
  const [useExternalRef, setUseExternalRef] = useState(true)
  const artGroups = useMemo(() => artStylesByGroup(), [])
  const selectedCoverImage = useMemo(() => {
    if (!coverGallery.length) return null
    return (
      coverGallery.find((g) => g.id === selectedCoverId) ??
      coverGallery.find((g) => g.path === coverPath) ??
      coverGallery[0] ??
      null
    )
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
        (STORY_STATUSES.includes(d.status as StoryStatus)
          ? d.status
          : 'DRAFT') as StoryStatus
      )
      setStyleNote(d.styleNote ?? '')
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
      setAllChars(chars)
      setAllScenes(scenes)
      setAllProps(props)
      setAllActions(actions)
      setBeats(timeline)
      setCostumeLib(Array.isArray(costumes) ? costumes : [])
    } catch (e) {
      setActionError(parseIpcError(e).message)
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
    if (!editingId) return
    try {
      const api = getApi().stories
      const payload = {
        storyId: editingId,
        characterId,
        costumeId: costumeId || null
      }
      // Prefer dedicated IPC; fall back to linkCharacter upsert (older preload)
      if (typeof api.setCharacterCostume === 'function') {
        await api.setCharacterCostume(payload)
      } else {
        await api.linkCharacter(payload)
      }
      await loadDetail(editingId)
      toast.success(t('common.saved'))
    } catch (e) {
      const msg = parseIpcError(e).message
      setActionError(msg)
      toast.error(msg)
    }
  }

  const resetEditorForm = (): void => {
    setEditTitle('')
    setEditStatus('DRAFT')
    setStyleNote('')
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
    setUseExternalRef(true)
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
    try {
      await getApi().stories.delete(id)
      await refreshStories()
      toast.success(t('common.deleted'))
    } catch (e) {
      toast.error(parseIpcError(e).message)
    }
  }

  const handleSaveMeta = async (): Promise<void> => {
    if (!editTitle.trim()) return
    setBusy(true)
    try {
      let id = editingId
      if (!id) {
        const created = await getApi().stories.create({
          title: editTitle.trim()
        })
        id = created.id as string
        setEditingId(id)
        setActiveStoryId(id)
      }
      await getApi().stories.update(id, {
        title: editTitle.trim(),
        status: editStatus,
        styleNote: styleNote.trim() || null,
        artStyle: storyArtStyle,
        coverPath: coverPath,
        refGalleryJson: serializeCharacterGallery(coverGallery)
      })
      await refreshStories()
      await loadDetail(id)
      toast.success(t('common.saved'))
    } catch (e) {
      const msg = parseIpcError(e).message
      setActionError(msg)
      toast.error(msg)
    } finally {
      setBusy(false)
    }
  }

  const storyExternalRefs = useMemo(
    () => listExternalRefs(coverGallery),
    [coverGallery]
  )

  useEffect(() => {
    return onStoryCoverCommitted(({ storyId, path }) => {
      if (editingId === storyId) {
        setCoverPath(path)
        void loadDetail(storyId)
      }
      void refreshStories()
      toast.success(t('stories.coverOk'))
    })
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

  const handleGenerateCover = (opts?: {
    storyId?: string
    referenceImagePath?: string | null
    useIdentityEdit?: boolean
    useExternalRef?: boolean
    idea?: string | null
  }): void => {
    const sid = opts?.storyId ?? editingId
    if (!sid) return
    if (storyCoverBusyId(sid)) return
    const useId =
      opts?.useIdentityEdit !== undefined
        ? opts.useIdentityEdit
        : useIdentityRef
    const wantExt =
      opts?.useExternalRef !== undefined
        ? opts.useExternalRef
        : useExternalRef
    const externalPath = wantExt
      ? pickExternalRefPath(coverGallery, {
          preferredPath: opts?.referenceImagePath ?? coverPath
        })
      : null
    const refPath =
      opts?.referenceImagePath !== undefined
        ? opts.referenceImagePath
        : useId
          ? coverPath ?? externalPath
          : externalPath
    toast.info(t('aiJobs.startedBackground'))
    startJob({
      kind: 'story-cover',
      label: t('stories.generateCover'),
      scope: { storyId: sid },
      run: async ({ setProgress, signal }) => {
        setProgress(10, 'image')
        const r = await getApi().stories.generateCover({
          storyId: sid,
          idea: (opts?.idea !== undefined ? opts.idea : aiIdea) || null,
          useIdentityEdit: Boolean(refPath),
          referenceImagePath: refPath,
          locale: getAiLocale(i18n.language)
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

  const handlePickStoryExternal = async (): Promise<void> => {
    if (!editingId) return
    const result = await getApi().media.pickRefImage()
    if (!result) return
    const next = appendGalleryItem(coverGallery, {
      path: result.filePath,
      kind: 'external',
      label: t('characters.externalRefLabel')
    })
    setCoverGallery(next)
    setSelectedCoverId(next[next.length - 1]?.id ?? null)
    setUseExternalRef(true)
    if (!coverPath) setCoverPath(result.filePath)
    toast.success(t('characters.externalRefAdded'))
  }

  const handleSetStoryCover = (path: string): void => {
    setCoverPath(path)
    const hit = coverGallery.find((g) => g.path === path)
    if (hit) setSelectedCoverId(hit.id)
    toast.success(t('common.coverSet'))
  }

  const handleRemoveCoverImage = (id: string): void => {
    const removed = coverGallery.find((g) => g.id === id)
    const next = removeGalleryItem(coverGallery, id)
    setCoverGallery(next)
    if (removed && coverPath === removed.path) {
      const primary = primaryGalleryPath(next)
      setCoverPath(primary)
      setSelectedCoverId(
        next.find((g) => g.path === primary)?.id ?? next[0]?.id ?? null
      )
    } else if (!isGalleryCoverPath(next, coverPath)) {
      setCoverPath(primaryGalleryPath(next))
      setSelectedCoverId(next[0]?.id ?? null)
    } else {
      setSelectedCoverId((cur) => (cur === id ? next[0]?.id ?? null : cur))
    }
  }

  const handleAiMeta = (): void => {
    if (!editTitle.trim() && !aiIdea.trim() && !styleNote.trim()) {
      setActionError(t('stories.aiNeedTitle'))
      return
    }
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
            styleNote: styleNote.trim() || null
          })
        }
        const r = await getApi().stories.aiFillMeta({
          storyId: editingId ?? undefined,
          title: editTitle,
          idea: aiIdea,
          existingStyleNote: styleNote,
          locale: getAiLocale(i18n.language)
        })
        if (signal.cancelled) return
        setProgress(100, 'done')
        setStyleNote(r.styleNote)
        setPageBanner(t('stories.aiMetaOk'))
        toast.success(t('stories.aiMetaOk'))
      }
    })
  }

  const handleAiScript = async (): Promise<void> => {
    if (!editingId) {
      setActionError(t('stories.aiNeedSave'))
      return
    }
    if (
      (detail?.characters?.length ?? 0) === 0 &&
      (detail?.scenes?.length ?? 0) === 0
    ) {
      setActionError(t('stories.aiNeedCast'))
      return
    }
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
    const sid = editingId
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
    const ok = await dialog.confirm({
      title: t('stories.exportBackupConfirmTitle'),
      message: t('stories.exportBackupConfirm'),
      confirmLabel: t('stories.exportBackup')
    })
    if (!ok) return
    try {
      const r = (await getApi().project.exportBackup(id)) as {
        filePath?: string
        downloadUrl?: string
        fileName?: string
      } | null
      if (r?.downloadUrl || r?.filePath) {
        toast.success(
          t('menu.storyBackupExported', {
            path: r.fileName || r.filePath || ''
          })
        )
      }
    } catch (e) {
      toast.error(parseIpcError(e).message)
    }
  }

  const handleImportBackup = async (): Promise<void> => {
    try {
      const result = await getApi().project.importBackup()
      if (result) {
        await refreshStories()
        setActiveStoryId(
          (result as { storyId: string }).storyId
        )
        toast.success(
          t('stories.importBackupOk', {
            title: (result as { title?: string }).title || ''
          })
        )
      }
    } catch (e) {
      toast.error(parseIpcError(e).message)
    }
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

  const toggleCharacter = async (
    characterId: string,
    linked: boolean
  ): Promise<void> => {
    if (!editingId) return
    try {
      if (linked) {
        await getApi().stories.unlinkCharacter({
          storyId: editingId,
          characterId
        })
      } else {
        await getApi().stories.linkCharacter({
          storyId: editingId,
          characterId
        })
      }
      await loadDetail(editingId)
      await refreshStories()
      toast.success(linked ? t('common.unlinked') : t('common.linked'))
    } catch (e) {
      const msg = parseIpcError(e).message
      setActionError(msg)
      toast.error(msg)
    }
  }

  const toggleScene = async (
    sceneId: string,
    linked: boolean
  ): Promise<void> => {
    if (!editingId) return
    try {
      if (linked) {
        await getApi().stories.unlinkScene({ storyId: editingId, sceneId })
      } else {
        await getApi().stories.linkScene({ storyId: editingId, sceneId })
      }
      await loadDetail(editingId)
      await refreshStories()
      toast.success(linked ? t('common.unlinked') : t('common.linked'))
    } catch (e) {
      const msg = parseIpcError(e).message
      setActionError(msg)
      toast.error(msg)
    }
  }

  const toggleProp = async (propId: string, linked: boolean): Promise<void> => {
    if (!editingId) return
    try {
      if (linked) {
        await getApi().stories.unlinkProp({ storyId: editingId, propId })
      } else {
        await getApi().stories.linkProp({ storyId: editingId, propId })
      }
      await loadDetail(editingId)
      await refreshStories()
      toast.success(linked ? t('common.unlinked') : t('common.linked'))
    } catch (e) {
      const msg = parseIpcError(e).message
      setActionError(msg)
      toast.error(msg)
    }
  }

  const toggleAction = async (
    actionId: string,
    linked: boolean
  ): Promise<void> => {
    if (!editingId) return
    try {
      if (linked) {
        await getApi().stories.unlinkAction({ storyId: editingId, actionId })
      } else {
        await getApi().stories.linkAction({ storyId: editingId, actionId })
      }
      await loadDetail(editingId)
      await refreshStories()
      toast.success(linked ? t('common.unlinked') : t('common.linked'))
    } catch (e) {
      const msg = parseIpcError(e).message
      setActionError(msg)
      toast.error(msg)
    }
  }

  useEffect(() => {
    setCastPage(1)
  }, [castKind, castQ, castLinkFilter, editingId])

  const castBrowser = useMemo(() => {
    type Row = { id: string; label: string; sub?: string }
    let items: Row[] = []
    let linkedIds = linkedCharIds
    let empty = t('stories.castEmptyChars')

    if (castKind === 'characters') {
      items = allChars.map((c) => ({
        id: c.id,
        label: c.name,
        sub: c.description
      }))
      linkedIds = linkedCharIds
      empty = t('stories.castEmptyChars')
    } else if (castKind === 'scenes') {
      items = allScenes.map((s) => ({
        id: s.id,
        label: s.title || s.description.slice(0, 48),
        sub: s.description
      }))
      linkedIds = linkedSceneIds
      empty = t('stories.castEmptyScenes')
    } else if (castKind === 'props') {
      items = allProps.map((p) => ({
        id: p.id,
        label: p.name,
        sub: p.description
      }))
      linkedIds = linkedPropIds
      empty = t('stories.castEmptyProps')
    } else {
      items = allActions.map((a) => ({
        id: a.id,
        label: a.name,
        sub: a.description
      }))
      linkedIds = linkedActionIds
      empty = t('stories.castEmptyActions')
    }

    const filtered = items.filter((it) => {
      const linked = linkedIds.has(it.id)
      if (castLinkFilter === 'linked' && !linked) return false
      if (castLinkFilter === 'unlinked' && linked) return false
      return matchesSearchQuery(
        [it.label, it.sub ?? ''].join(' '),
        castQ
      )
    })

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
    if (castKind === 'characters') void toggleCharacter(id, linked)
    else if (castKind === 'scenes') void toggleScene(id, linked)
    else if (castKind === 'props') void toggleProp(id, linked)
    else void toggleAction(id, linked)
  }

  const addBeat = async (): Promise<void> => {
    if (!editingId) return
    try {
      const order = beats.length
      const start = order * 6
      const firstChar = detail?.characters[0]?.id
      const firstScene = detail?.scenes[0]?.id
      await getApi().timeline.create({
        storyId: editingId,
        startTime: start,
        endTime: start + 6,
        order,
        dialogue: '',
        characterIds: firstChar ? [firstChar] : [],
        sceneIds: firstScene ? [firstScene] : [],
        propIds: [],
        actionIds: []
      })
      await loadDetail(editingId)
      await refreshStories()
    } catch (e) {
      setActionError(parseIpcError(e).message)
    }
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
    // Optimistic multi-select so chips feel instant
    if (
      patch.characterIds !== undefined ||
      patch.sceneIds !== undefined ||
      patch.propIds !== undefined ||
      patch.actionIds !== undefined
    ) {
      setBeats((prev) =>
        prev.map((b) => {
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
      )
    }
    try {
      const updated = (await getApi().timeline.update(
        id,
        patch
      )) as TimelineEntry
      setBeats((prev) =>
        prev.map((b) => (b.id === id ? { ...b, ...updated } : b))
      )
    } catch (e) {
      const msg = parseIpcError(e).message
      setActionError(msg)
      toast.error(msg)
      if (editingId) await loadDetail(editingId)
    }
  }

  const deleteBeat = async (id: string): Promise<void> => {
    const ok = await dialog.confirm({
      message: t('common.confirmDelete'),
      variant: 'danger'
    })
    if (!ok) return
    try {
      await getApi().timeline.delete(id)
      if (editingId) {
        await loadDetail(editingId)
        await refreshStories()
      }
      toast.success(t('common.deleted'))
    } catch (e) {
      const msg = parseIpcError(e).message
      setActionError(msg)
      toast.error(msg)
    }
  }

  const moveBeat = async (id: string, delta: -1 | 1): Promise<void> => {
    if (!editingId) return
    const idx = beats.findIndex((b) => b.id === id)
    const target = idx + delta
    if (idx < 0 || target < 0 || target >= beats.length) return
    const next = [...beats]
    const [item] = next.splice(idx, 1)
    next.splice(target, 0, item)
    setBeats(next)
    try {
      await getApi().timeline.reorder(
        editingId,
        next.map((b) => b.id)
      )
      toast.success(t('stories.beatReordered'))
    } catch (e) {
      const msg = parseIpcError(e).message
      setActionError(msg)
      toast.error(msg)
      await loadDetail(editingId)
    }
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
                            regenerateBusy={storyCoverBusyId(story.id)}
                            onImageClick={() => openEditor(story.id)}
                            onRegenerate={() =>
                              handleGenerateCover({
                                storyId: story.id,
                                useIdentityEdit: false
                              })
                            }
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
                        <div className="mt-auto flex items-center gap-2 pt-4">
                          <Button
                            variant="secondary"
                            className="min-w-0 flex-1 !py-1.5 text-xs"
                            onClick={() => openEditor(story.id)}
                          >
                            {t('common.edit')}
                          </Button>
                          <Button
                            variant="ghost"
                            className="min-w-0 flex-1 !py-1.5 text-xs"
                            onClick={() => void handleExportBackup(story.id)}
                          >
                            {t('stories.exportBackup')}
                          </Button>
                          <Button
                            variant="ghost"
                            className="min-w-0 flex-1 !py-1.5 text-xs text-rose-300"
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
          <div className="flex h-full flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-400">
                {t('stories.coverTitle')}
              </h3>
              <span className="text-[11px] text-ink-500">
                {coverGallery.length}
              </span>
            </div>
            <div className="rounded-xl border border-ink-800 bg-ink-900/60">
              {(selectedCoverImage?.path ?? coverPath) ? (
                <LocalMediaImage
                  filePath={selectedCoverImage?.path ?? coverPath}
                  alt={editTitle || t('stories.coverTitle')}
                  maxHeightClass="max-h-[min(36vh,420px)] lg:max-h-[min(48vh,520px)]"
                  showMeta
                  objectFit="cover"
                  className="border-0 rounded-xl"
                  actionsLayout="bar"
                  regenerateBusy={storyCoverBusy}
                  onRegenerate={
                    editingId ? () => handleGenerateCover() : undefined
                  }
                />
              ) : (
                <div className="flex h-40 flex-col items-center justify-center gap-2 px-3 text-xs text-ink-500">
                  <span className="text-2xl opacity-40">🖼</span>
                  <p>{t('stories.coverMissing')}</p>
                  {!editingId ? (
                    <p className="text-center text-[11px] text-ink-600">
                      {t('stories.metaHint')}
                    </p>
                  ) : null}
                </div>
              )}
            </div>
            {coverGallery.length > 0 ? (
              <GalleryThumbStrip
                items={coverGallery}
                selectedId={selectedCoverId}
                coverPath={coverPath}
                onSelect={(id) => setSelectedCoverId(id)}
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
              />
            ) : null}
            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-ink-800 bg-ink-950/40 px-3 py-2.5">
              <input
                type="checkbox"
                className="mt-0.5 rounded border-ink-600"
                checked={useIdentityRef}
                onChange={(e) => setUseIdentityRef(e.target.checked)}
                disabled={!coverPath && !selectedCoverImage}
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
              items={storyExternalRefs.map((g) => ({
                id: g.id,
                path: g.path,
                label: g.label
              }))}
              useExternalRef={useExternalRef}
              onUseExternalChange={setUseExternalRef}
              onAdd={handlePickStoryExternal}
              onRemove={(id) => handleRemoveCoverImage(id)}
              disabled={!editingId || storyCoverBusy}
            />
            <div className="flex flex-col gap-2">
              <Button
                disabled={!editingId || storyCoverBusy}
                onClick={() => handleGenerateCover()}
              >
                {storyCoverBusy
                  ? t('common.generating')
                  : t('stories.generateCover')}
              </Button>
              <Button
                variant="secondary"
                disabled={!editingId}
                onClick={() => void handlePickCover()}
              >
                {t('scenes.pickImage')}
              </Button>
              {selectedCoverImage &&
                coverPath !== selectedCoverImage.path && (
                  <Button
                    variant="secondary"
                    onClick={() =>
                      handleSetStoryCover(selectedCoverImage.path)
                    }
                  >
                    {t('common.setAsCover')}
                  </Button>
                )}
              {selectedCoverImage &&
                coverPath === selectedCoverImage.path && (
                  <span className="inline-flex items-center justify-center rounded-lg border border-amber-700/50 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
                    {t('common.isCover')}
                  </span>
                )}
              {selectedCoverImage && (
                <Button
                  variant="ghost"
                  className="text-rose-300"
                  onClick={() =>
                    handleRemoveCoverImage(selectedCoverImage.id)
                  }
                >
                  {t('characters.removePhoto')}
                </Button>
              )}
            </div>
            <p className="text-[11px] text-ink-500">
              {t('common.galleryReorderHint')}
            </p>
          </div>
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
                  {storyAiBusy || aiBusy
                    ? t('common.generating')
                    : t('stories.aiFillMeta')}
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
                                    {c.name?.trim() ||
                                      c.description.slice(0, 40)}
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
                    onClick={() =>
                      setCastPage((p) =>
                        Math.min(castBrowser.totalPages, p + 1)
                      )
                    }
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
                  {aiBusy
                    ? t('common.generating')
                    : t('stories.aiFillScript')}
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
                        onChange={(ids) =>
                          void updateBeat(beat.id, { characterIds: ids })
                        }
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
                        onChange={(ids) =>
                          void updateBeat(beat.id, { sceneIds: ids })
                        }
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
                        onChange={(ids) =>
                          void updateBeat(beat.id, { propIds: ids })
                        }
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
                        onChange={(ids) =>
                          void updateBeat(beat.id, { actionIds: ids })
                        }
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
                              prev.map((b) =>
                                b.id === beat.id
                                  ? {
                                      ...b,
                                      dialogue: b.dialogue?.trim()
                                        ? `${b.dialogue.trim()}\n${tmpl}`
                                        : tmpl
                                    }
                                  : b
                              )
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
                                text:
                                  spoken.length > 80
                                    ? `${spoken.slice(0, 80)}…`
                                    : spoken
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
                            dialogue:
                              committed.dialogue ??
                              (e.target.value.trim() || null),
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
    </div>
  )
}


