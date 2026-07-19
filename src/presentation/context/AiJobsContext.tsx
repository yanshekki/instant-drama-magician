/**
 * Global background AI jobs — survive page navigation.
 * Progress HUD (bottom-left) + draft confirm on success.
 * Pending drafts are persisted to localStorage (reload-safe).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react'
import { getApi } from '../../lib/api'
import { parseIpcError } from '../../lib/ipc'
import type {
  PersistedVideoPrepDraft,
  StartVideoPrepInput,
  VideoPrepDraftPayload,
  VideoPrepDraftStore,
  VideoPrepSession
} from '../../domain/videoPrep'
import {
  VIDEO_PREP_DRAFT_STORAGE_KEY,
  VIDEO_PREP_DRAFTS_STORAGE_KEY,
  loadVideoPrepDraftStore,
  removeVideoPrepDraft,
  serializeVideoPrepDraftStore,
  upsertVideoPrepDraft
} from '../../domain/videoPrep'
import type {
  CharacterProfileFields,
  PropProfileFields,
  SceneProfileFields
} from '../../types/domain'
import type { ArtStyleId } from '../../domain/characterArtStyles'

const AI_JOBS_STORAGE_KEY = 'idm.aiJobs.v1'
const AI_JOBS_MAX_PERSIST = 24

export type AiJobKind =
  | 'character-ai-fill'
  | 'character-sheet'
  | 'character-intro-video'
  | 'costume-ai-fill'
  | 'costume-swap'
  | 'costume-intro-video'
  | 'wardrobe-suggest'
  | 'scene-ai-fill'
  | 'scene-plate'
  | 'scene-intro-video'
  | 'atmosphere-swap'
  | 'prop-ai-fill'
  | 'prop-plate'
  | 'prop-intro-video'
  | 'story-cover'
  | 'story-ai-meta'
  | 'story-ai-script'
  | 'pipeline'
  | 'clip'
  | 'video-prep'
  | 'video-confirm'
  /** Advanced prep storyboard still (single or batch) */
  | 'storyboard-still'

export type AiJobStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled'

export interface AiJobScope {
  storyId?: string
  characterId?: string
  sceneId?: string
  propId?: string
  costumeId?: string
  entryId?: string
}

export type AiDraft =
  | {
      type: 'character-profile'
      characterId: string | null
      storyId: string | null
      profile: CharacterProfileFields
      profileJson: string
      /** If true, character was new and not yet created */
      isNew: boolean
    }
  | {
      type: 'character-sheet'
      characterId: string
      storyId: string
      path: string
      variant: string
      label: string
      usedEdit?: boolean
      enhance?: unknown
      layer?: string
      /** When set, commit also writes Character.costume (costume-swap). */
      costumeDescription?: string
    }
  | {
      type: 'pipeline'
      storyId: string
      success: boolean
      summary: string
      degraded?: boolean
    }
  | {
      type: 'clip'
      storyId: string
      entryId: string
      success: boolean
      summary: string
      degraded?: boolean
    }
  | {
      type: 'wardrobe-suggest'
      characterId: string | null
      storyId: string | null
      suggestion: {
        name: string
        costume: string
        artStyle: ArtStyleId | string
        rationale: string
      }
    }
  | {
      type: 'scene-profile'
      sceneId: string | null
      storyId: string | null
      profile: SceneProfileFields & { artStyle?: string }
      profileJson: string
      isNew: boolean
    }
  | {
      type: 'scene-plate'
      sceneId: string
      storyId: string
      path: string
      variant: string
      label: string
      layer?: string
      atmosphereDescription?: string
      enhance?: unknown
    }
  | {
      type: 'prop-profile'
      propId: string | null
      storyId: string | null
      profile: PropProfileFields & { artStyle?: string }
      profileJson: string
      isNew: boolean
    }
  | {
      type: 'prop-plate'
      propId: string
      storyId: string
      path: string
      variant: string
      label: string
      enhance?: unknown
    }
  | {
      type: 'story-cover'
      storyId: string
      path: string
      label: string
      usedEdit?: boolean
    }

export interface AiJob {
  id: string
  kind: AiJobKind
  label: string
  status: AiJobStatus
  progress: number
  message?: string
  scope: AiJobScope
  draft?: AiDraft
  error?: string
  startedAt: number
  finishedAt?: number
  /** When true, result was cancelled/ignored */
  discarded?: boolean
}

export type GenerationProgressPayload = {
  storyId: string
  step: string
  index: number
  total: number
  result?: {
    step: string
    success: boolean
    output?: string
    error?: string
  }
  entryId?: string
  mediaStatus?: string
  jobId?: string
}

type JobRunner = (ctx: {
  jobId: string
  signal: { cancelled: boolean }
  setProgress: (n: number, message?: string) => void
}) => Promise<AiDraft | void>

interface StartJobInput {
  kind: AiJobKind
  label: string
  scope?: AiJobScope
  run: JobRunner
}

interface AiJobsContextValue {
  jobs: AiJob[]
  activeJobs: AiJob[]
  pendingDrafts: AiJob[]
  reviewingJobId: string | null
  setReviewingJobId: (id: string | null) => void
  /**
   * @deprecated Prefer startVideoPrep — kept for rare direct draft patches.
   */
  videoPrepDraft: VideoPrepDraftPayload | null
  setVideoPrepDraft: (d: VideoPrepDraftPayload | null) => void
  /** Full wizard session (null = closed). */
  videoPrepSession: VideoPrepSession | null
  setVideoPrepSession: (
    s:
      | VideoPrepSession
      | null
      | ((prev: VideoPrepSession | null) => VideoPrepSession | null)
  ) => void
  /** Open video-prep wizard immediately (locked loading until still ready). */
  startVideoPrep: (input: StartVideoPrepInput) => void
  /** Host registers the real start implementation. */
  registerStartVideoPrep: (
    fn: ((input: StartVideoPrepInput) => void) | null
  ) => void
  /** Multi-draft map keyed by buildVideoPrepDraftKey(...). */
  savedVideoPrepDrafts: VideoPrepDraftStore
  hasVideoPrepDraft: (key: string) => boolean
  getVideoPrepDraft: (key: string) => PersistedVideoPrepDraft | null
  upsertSavedVideoPrepDraft: (
    key: string,
    draft: VideoPrepDraftPayload,
    queueRemaining?: string[]
  ) => void
  removeSavedVideoPrepDraft: (key: string) => void
  continueVideoPrepDraft: (key: string) => boolean
  startJob: (input: StartJobInput) => string
  cancelJob: (id: string) => Promise<void>
  isBlocked: (query: {
    kind?: AiJobKind | AiJobKind[]
    /** string = that entity; null = new-entity jobs only; omit = ignore */
    characterId?: string | null
    sceneId?: string | null
    propId?: string | null
    costumeId?: string | null
    storyId?: string
    entryId?: string
  }) => boolean
  acceptDraft: (jobId: string) => Promise<void>
  discardDraft: (jobId: string) => Promise<void>
  dismissJob: (jobId: string) => void
  /** Subscribe page-level handlers for profile apply-to-form */
  onProfileApply: (
    handler: (draft: Extract<AiDraft, { type: 'character-profile' }>) => void
  ) => () => void
  onSheetCommitted: (
    handler: (payload: {
      characterId: string
      path: string
      gallery?: Array<{
        id: string
        path: string
        kind: string
        label: string
        createdAt: string
        layer?: string
      }>
      costume?: string | null
    }) => void
  ) => () => void
  onPipelineDone: (handler: (storyId: string) => void) => () => void
  onWardrobeApply: (
    handler: (draft: Extract<AiDraft, { type: 'wardrobe-suggest' }>) => void
  ) => () => void
  onSceneProfileApply: (
    handler: (draft: Extract<AiDraft, { type: 'scene-profile' }>) => void
  ) => () => void
  onScenePlateCommitted: (
    handler: (payload: {
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
    }) => void
  ) => () => void
  onPropProfileApply: (
    handler: (draft: Extract<AiDraft, { type: 'prop-profile' }>) => void
  ) => () => void
  onStoryCoverCommitted: (
    handler: (payload: { storyId: string; path: string }) => void
  ) => () => void
  onPropPlateCommitted: (
    handler: (payload: {
      propId: string
      path: string
      gallery?: Array<{
        id: string
        path: string
        kind: string
        label: string
        createdAt: string
        layer?: string
      }>
    }) => void
  ) => () => void
}

const AiJobsContext = createContext<AiJobsContextValue | null>(null)

function newId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function loadPersistedJobs(): AiJob[] {
  try {
    const raw = localStorage.getItem(AI_JOBS_STORAGE_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return []
    return arr
      .filter((j): j is AiJob => Boolean(j && typeof j === 'object' && (j as AiJob).id))
      .map((j) => {
        // Running jobs cannot resume after reload — drop them (don't leave sticky red cards)
        if (j.status === 'running' || j.status === 'queued') {
          return null
        }
        // Drop interrupt placeholders from older builds
        if (
          j.status === 'failed' &&
          (j.error === 'interrupted_on_reload' ||
            j.message === 'interrupted')
        ) {
          return null
        }
        return j
      })
      .filter((j): j is AiJob => Boolean(j))
      .slice(0, AI_JOBS_MAX_PERSIST)
  } catch {
    return []
  }
}

function persistJobs(jobs: AiJob[]): void {
  try {
    // Only pending drafts + short-lived real failures (not interrupt stubs)
    const keep = jobs
      .filter(
        (j) =>
          (j.status === 'succeeded' && j.draft && !j.discarded) ||
          (j.status === 'failed' &&
            j.error &&
            j.error !== 'interrupted_on_reload')
      )
      .slice(0, AI_JOBS_MAX_PERSIST)
    localStorage.setItem(AI_JOBS_STORAGE_KEY, JSON.stringify(keep))
  } catch {
    /* quota / private mode */
  }
}

export function AiJobsProvider({ children }: { children: ReactNode }): JSX.Element {
  const [jobs, setJobs] = useState<AiJob[]>(() => loadPersistedJobs())
  const [reviewingJobId, setReviewingJobId] = useState<string | null>(() => {
    const restored = loadPersistedJobs()
    const pending = restored.find(
      (j) => j.status === 'succeeded' && j.draft && !j.discarded
    )
    return pending?.id ?? null
  })
  const [videoPrepDraft, setVideoPrepDraft] =
    useState<VideoPrepDraftPayload | null>(null)
  const [videoPrepSession, setVideoPrepSession] =
    useState<VideoPrepSession | null>(null)
  const [savedVideoPrepDrafts, setSavedVideoPrepDrafts] =
    useState<VideoPrepDraftStore>(() => {
      try {
        return loadVideoPrepDraftStore({
          v2Raw: localStorage.getItem(VIDEO_PREP_DRAFTS_STORAGE_KEY),
          v1Raw: localStorage.getItem(VIDEO_PREP_DRAFT_STORAGE_KEY)
        })
      } catch {
        return {}
      }
    })
  const startVideoPrepImpl = useRef<
    ((input: StartVideoPrepInput) => void) | null
  >(null)

  const persistDraftStore = useCallback((store: VideoPrepDraftStore) => {
    try {
      localStorage.setItem(
        VIDEO_PREP_DRAFTS_STORAGE_KEY,
        serializeVideoPrepDraftStore(store)
      )
    } catch {
      /* ignore quota */
    }
  }, [])
  const cancelFlags = useRef(new Map<string, { cancelled: boolean }>())
  const profileHandlers = useRef(
    new Set<(d: Extract<AiDraft, { type: 'character-profile' }>) => void>()
  )
  const sheetHandlers = useRef(
    new Set<
      (p: {
        characterId: string
        path: string
        gallery?: Array<{
          id: string
          path: string
          kind: string
          label: string
          createdAt: string
          layer?: string
        }>
        costume?: string | null
      }) => void
    >()
  )
  const pipelineHandlers = useRef(new Set<(storyId: string) => void>())
  const wardrobeHandlers = useRef(
    new Set<(d: Extract<AiDraft, { type: 'wardrobe-suggest' }>) => void>()
  )
  const sceneProfileHandlers = useRef(
    new Set<(d: Extract<AiDraft, { type: 'scene-profile' }>) => void>()
  )
  const scenePlateHandlers = useRef(
    new Set<
      (p: {
        sceneId: string
        path: string
        gallery?: Array<{
          id: string
          path: string
          kind: string
          label: string
          createdAt: string
          layer?: string
        }>
      }) => void
    >()
  )
  const propProfileHandlers = useRef(
    new Set<(d: Extract<AiDraft, { type: 'prop-profile' }>) => void>()
  )
  const propPlateHandlers = useRef(
    new Set<
      (p: {
        propId: string
        path: string
        gallery?: Array<{
          id: string
          path: string
          kind: string
          label: string
          createdAt: string
          layer?: string
        }>
      }) => void
    >()
  )
  const storyCoverHandlers = useRef(
    new Set<(p: { storyId: string; path: string }) => void>()
  )

  useEffect(() => {
    persistJobs(jobs)
  }, [jobs])

  const patchJob = useCallback((id: string, patch: Partial<AiJob>): void => {
    setJobs((prev) =>
      prev.map((j) => (j.id === id ? { ...j, ...patch } : j))
    )
  }, [])

  // Global generation progress → running pipeline/clip jobs
  useEffect(() => {
    return getApi().generation.onProgress((payload: GenerationProgressPayload) => {
      setJobs((prev) =>
        prev.map((j) => {
          if (j.status !== 'running') return j
          if (j.kind === 'pipeline' && j.scope.storyId === payload.storyId) {
            const pct =
              payload.total > 0
                ? Math.min(
                    99,
                    Math.round(((payload.index + 1) / payload.total) * 100)
                  )
                : j.progress
            return {
              ...j,
              progress: pct,
              message: payload.step
            }
          }
          if (
            j.kind === 'clip' &&
            j.scope.entryId &&
            payload.entryId === j.scope.entryId
          ) {
            return {
              ...j,
              progress: Math.min(99, j.progress + 10),
              message: payload.mediaStatus || payload.step
            }
          }
          return j
        })
      )
    })
  }, [])

  const startJob = useCallback(
    (input: StartJobInput): string => {
      const id = newId()
      const flag = { cancelled: false }
      cancelFlags.current.set(id, flag)

      const job: AiJob = {
        id,
        kind: input.kind,
        label: input.label,
        status: 'running',
        progress: 2,
        message: undefined,
        scope: input.scope ?? {},
        startedAt: Date.now()
      }
      setJobs((prev) => [job, ...prev].slice(0, 40))

      const setProgress = (n: number, message?: string): void => {
        patchJob(id, {
          progress: Math.max(0, Math.min(99, n)),
          ...(message !== undefined ? { message } : {})
        })
      }

      void (async () => {
        try {
          const draft = await input.run({ jobId: id, signal: flag, setProgress })
          if (flag.cancelled) {
            patchJob(id, {
              status: 'cancelled',
              progress: 100,
              finishedAt: Date.now(),
              message: 'cancelled' // i18n: aiJobs.step.cancelled
            })
            return
          }
          if (draft) {
            patchJob(id, {
              status: 'succeeded',
              progress: 100,
              draft,
              finishedAt: Date.now(),
              message: 'done' // i18n: aiJobs.step.done
            })
            setReviewingJobId(id)
          } else {
            patchJob(id, {
              status: 'succeeded',
              progress: 100,
              finishedAt: Date.now()
            })
          }
        } catch (e) {
          if (flag.cancelled) {
            patchJob(id, {
              status: 'cancelled',
              progress: 100,
              finishedAt: Date.now()
            })
            return
          }
          const err = parseIpcError(e)
          patchJob(id, {
            status: 'failed',
            progress: 100,
            error: `${err.message}${err.details ? ` — ${err.details}` : ''}`,
            finishedAt: Date.now()
          })
        } finally {
          cancelFlags.current.delete(id)
        }
      })()

      return id
    },
    [patchJob]
  )

  const cancelJob = useCallback(
    async (id: string): Promise<void> => {
      const flag = cancelFlags.current.get(id)
      if (flag) flag.cancelled = true
      const job = jobs.find((j) => j.id === id)
      if (job?.kind === 'pipeline' || job?.kind === 'clip') {
        try {
          await getApi().generation.cancel()
        } catch {
          /* ignore */
        }
      }
      patchJob(id, {
        status: 'cancelled',
        progress: 100,
        finishedAt: Date.now(),
        message: 'cancelling' // i18n: aiJobs.step.cancelling
      })
    },
    [jobs, patchJob]
  )

  const isBlocked = useCallback(
    (query: {
      kind?: AiJobKind | AiJobKind[]
      /**
       * string → block jobs for that entity
       * null → block only "new entity" jobs (no id in scope)
       * undefined → do not filter by this dimension
       */
      characterId?: string | null
      sceneId?: string | null
      propId?: string | null
      costumeId?: string | null
      storyId?: string
      entryId?: string
    }): boolean => {
      const kinds = query.kind
        ? Array.isArray(query.kind)
          ? query.kind
          : [query.kind]
        : null
      return jobs.some((j) => {
        if (j.status !== 'running' && j.status !== 'queued') return false
        if (kinds && !kinds.includes(j.kind)) return false
        if (
          query.characterId &&
          j.scope.characterId &&
          j.scope.characterId === query.characterId
        ) {
          return true
        }
        if (
          query.sceneId &&
          j.scope.sceneId &&
          j.scope.sceneId === query.sceneId
        ) {
          return true
        }
        if (
          query.propId &&
          j.scope.propId &&
          j.scope.propId === query.propId
        ) {
          return true
        }
        if (
          query.costumeId &&
          j.scope.costumeId &&
          j.scope.costumeId === query.costumeId
        ) {
          return true
        }
        if (
          query.storyId &&
          j.scope.storyId &&
          j.scope.storyId === query.storyId &&
          (j.kind === 'pipeline' || j.kind === 'clip')
        ) {
          return true
        }
        if (
          query.entryId &&
          j.scope.entryId &&
          j.scope.entryId === query.entryId
        ) {
          return true
        }
        // "New entity" jobs: query.characterId === null means only block jobs
        // that also have no characterId (creating a new character). Do NOT
        // treat omitted/undefined as "block every job of these kinds".
        if (
          query.characterId === null &&
          !j.scope.characterId &&
          kinds &&
          kinds.some((k) =>
            k === 'character-ai-fill' ||
            k === 'character-sheet' ||
            k === 'character-intro-video' ||
            k === 'costume-swap' ||
            k === 'wardrobe-suggest'
          )
        ) {
          return true
        }
        if (
          query.sceneId === null &&
          !j.scope.sceneId &&
          kinds
        ) {
          return true
        }
        if (
          query.propId === null &&
          !j.scope.propId &&
          kinds
        ) {
          return true
        }
        if (
          query.costumeId === null &&
          !j.scope.costumeId &&
          kinds &&
          kinds.some(
            (k) =>
              k === 'costume-ai-fill' ||
              k === 'costume-intro-video' ||
              k === 'costume-swap'
          )
        ) {
          return true
        }
        return false
      })
    },
    [jobs]
  )

  const dismissJob = useCallback((jobId: string): void => {
    setJobs((prev) => prev.filter((j) => j.id !== jobId))
    setReviewingJobId((cur) => (cur === jobId ? null : cur))
  }, [])

  const discardDraft = useCallback(
    async (jobId: string): Promise<void> => {
      const job = jobs.find((j) => j.id === jobId)
      if (
        (job?.draft?.type === 'character-sheet' ||
          job?.draft?.type === 'scene-plate' ||
          job?.draft?.type === 'prop-plate' ||
          job?.draft?.type === 'story-cover') &&
        job.draft.path
      ) {
        try {
          await getApi().media.discardSheetDraft(job.draft.path)
        } catch {
          /* ignore */
        }
      }
      patchJob(jobId, { discarded: true, draft: undefined })
      dismissJob(jobId)
    },
    [jobs, patchJob, dismissJob]
  )

  const acceptDraft = useCallback(
    async (jobId: string): Promise<void> => {
      const job = jobs.find((j) => j.id === jobId)
      if (!job?.draft) {
        dismissJob(jobId)
        return
      }
      const d = job.draft
      if (d.type === 'character-profile') {
        // Persist if characterId known
        if (d.characterId) {
          const p = d.profile
          await getApi().characters.update(d.characterId, {
            name: p.name,
            description: p.description,
            appearance: p.appearance ?? null,
            personality: p.personality ?? null,
            backstory: p.backstory ?? null,
            costume: p.costume ?? null,
            ageRange: p.ageRange ?? null,
            gender: p.gender ?? null,
            voiceDesc: p.voiceDesc ?? null,
            spokenLanguages:
              Array.isArray(p.spokenLanguages) && p.spokenLanguages.length
                ? JSON.stringify(p.spokenLanguages)
                : null,
            mannerisms: p.mannerisms ?? null,
            relationships: p.relationships ?? null,
            visualTags: p.visualTags ?? null,
            seedPrompt: p.seedPrompt ?? null,
            profileJson: d.profileJson
          })
        }
        for (const h of profileHandlers.current) h(d)
        dismissJob(jobId)
        return
      }
      if (d.type === 'character-sheet') {
        const committed = await getApi().characters.commitSheet({
          characterId: d.characterId,
          path: d.path,
          variant: d.variant,
          label: d.label,
          layer: d.layer,
          costumeDescription: d.costumeDescription
        })
        const char = committed.character as {
          costume?: string | null
        } | null
        for (const h of sheetHandlers.current) {
          h({
            characterId: d.characterId,
            path: committed.path,
            gallery: committed.gallery as
              | Array<{
                  id: string
                  path: string
                  kind: string
                  label: string
                  createdAt: string
                  layer?: string
                }>
              | undefined,
            costume: char?.costume ?? d.costumeDescription
          })
        }
        dismissJob(jobId)
        return
      }
      if (d.type === 'pipeline') {
        for (const h of pipelineHandlers.current) h(d.storyId)
        dismissJob(jobId)
        return
      }
      if (d.type === 'clip') {
        for (const h of pipelineHandlers.current) h(d.storyId)
        dismissJob(jobId)
        return
      }
      if (d.type === 'wardrobe-suggest') {
        for (const h of wardrobeHandlers.current) h(d)
        dismissJob(jobId)
        return
      }
      if (d.type === 'scene-profile') {
        if (d.sceneId) {
          const p = d.profile
          await getApi().scenes.update(d.sceneId, {
            title: p.title ?? null,
            description: p.description,
            script: p.script ?? null,
            locationType: p.locationType ?? null,
            timeOfDay: p.timeOfDay ?? null,
            weather: p.weather ?? null,
            mood: p.mood ?? null,
            lighting: p.lighting ?? null,
            colorPalette: p.colorPalette ?? null,
            setDressing: p.setDressing ?? null,
            soundscape: p.soundscape ?? null,
            cameraNotes: p.cameraNotes ?? null,
            visualTags: p.visualTags ?? null,
            artStyle: p.artStyle ?? null,
            profileJson: d.profileJson,
            seedPrompt: p.description
          })
        }
        for (const h of sceneProfileHandlers.current) h(d)
        dismissJob(jobId)
        return
      }
      if (d.type === 'scene-plate') {
        const committed = await getApi().scenes.commitPlate({
          sceneId: d.sceneId,
          path: d.path,
          variant: d.variant,
          label: d.label,
          layer: d.layer,
          atmosphereDescription: d.atmosphereDescription
        })
        for (const h of scenePlateHandlers.current) {
          h({
            sceneId: d.sceneId,
            path: committed.path,
            gallery: committed.gallery as
              | Array<{
                  id: string
                  path: string
                  kind: string
                  label: string
                  createdAt: string
                  layer?: string
                }>
              | undefined
          })
        }
        dismissJob(jobId)
        return
      }
      if (d.type === 'prop-profile') {
        if (d.propId) {
          const p = d.profile
          await getApi().props.update(d.propId, {
            name: p.name,
            description: p.description,
            material: p.material ?? null,
            sizeNotes: p.sizeNotes ?? null,
            condition: p.condition ?? null,
            visualTags: p.visualTags ?? null,
            artStyle: p.artStyle ?? null,
            profileJson: d.profileJson,
            seedPrompt: p.description
          })
        }
        for (const h of propProfileHandlers.current) h(d)
        dismissJob(jobId)
        return
      }
      if (d.type === 'prop-plate') {
        const committed = await getApi().props.commitPlate({
          propId: d.propId,
          path: d.path,
          variant: d.variant,
          label: d.label
        })
        for (const h of propPlateHandlers.current) {
          h({
            propId: d.propId,
            path: committed.path,
            gallery: committed.gallery as
              | Array<{
                  id: string
                  path: string
                  kind: string
                  label: string
                  createdAt: string
                  layer?: string
                }>
              | undefined
          })
        }
        dismissJob(jobId)
        return
      }
      if (d.type === 'story-cover') {
        const committed = await getApi().stories.commitCover({
          storyId: d.storyId,
          path: d.path,
          label: d.label
        })
        for (const h of storyCoverHandlers.current) {
          h({ storyId: d.storyId, path: committed.path })
        }
        dismissJob(jobId)
      }
    },
    [jobs, dismissJob]
  )

  const onProfileApply = useCallback(
    (
      handler: (draft: Extract<AiDraft, { type: 'character-profile' }>) => void
    ) => {
      profileHandlers.current.add(handler)
      return () => {
        profileHandlers.current.delete(handler)
      }
    },
    []
  )

  const onSheetCommitted = useCallback(
    (
      handler: (payload: {
        characterId: string
        path: string
        gallery?: Array<{
          id: string
          path: string
          kind: string
          label: string
          createdAt: string
          layer?: string
        }>
        costume?: string | null
      }) => void
    ) => {
      sheetHandlers.current.add(handler)
      return () => {
        sheetHandlers.current.delete(handler)
      }
    },
    []
  )

  const onPipelineDone = useCallback((handler: (storyId: string) => void) => {
    pipelineHandlers.current.add(handler)
    return () => {
      pipelineHandlers.current.delete(handler)
    }
  }, [])

  const registerStartVideoPrep = useCallback(
    (fn: ((input: StartVideoPrepInput) => void) | null) => {
      startVideoPrepImpl.current = fn
    },
    []
  )

  const startVideoPrep = useCallback((input: StartVideoPrepInput) => {
    if (startVideoPrepImpl.current) {
      startVideoPrepImpl.current(input)
      return
    }
    // Host not mounted yet — queue as session shell (Host will pick up)
    console.warn('[aiJobs] startVideoPrep: host not registered')
  }, [])

  const hasVideoPrepDraft = useCallback(
    (key: string): boolean => Boolean(key && savedVideoPrepDrafts[key]),
    [savedVideoPrepDrafts]
  )

  const getVideoPrepDraft = useCallback(
    (key: string): PersistedVideoPrepDraft | null =>
      (key && savedVideoPrepDrafts[key]) || null,
    [savedVideoPrepDrafts]
  )

  const upsertSavedVideoPrepDraft = useCallback(
    (
      key: string,
      draft: VideoPrepDraftPayload,
      queueRemaining: string[] = []
    ) => {
      setSavedVideoPrepDrafts((prev) => {
        const next = upsertVideoPrepDraft(prev, key, draft, queueRemaining)
        persistDraftStore(next)
        return next
      })
    },
    [persistDraftStore]
  )

  const removeSavedVideoPrepDraft = useCallback(
    (key: string) => {
      setSavedVideoPrepDrafts((prev) => {
        const next = removeVideoPrepDraft(prev, key)
        persistDraftStore(next)
        return next
      })
    },
    [persistDraftStore]
  )

  const continueVideoPrepDraft = useCallback(
    (key: string): boolean => {
      const saved = savedVideoPrepDrafts[key]
      if (!saved?.draft) return false
      startVideoPrep({
        kind: saved.draft.kind,
        entityIds: saved.draft.entityIds,
        sourceImagePath: saved.draft.sourceImagePath,
        durationSeconds: saved.draft.durationSeconds,
        userExtraPrompt: saved.draft.userExtraPrompt,
        queueIndex: saved.draft.queueIndex,
        queueTotal: saved.draft.queueTotal,
        queueRemaining: saved.queueRemaining,
        resumeDraft: saved.draft
      })
      return true
    },
    [savedVideoPrepDrafts, startVideoPrep]
  )

  const onWardrobeApply = useCallback(
    (
      handler: (draft: Extract<AiDraft, { type: 'wardrobe-suggest' }>) => void
    ) => {
      wardrobeHandlers.current.add(handler)
      return () => {
        wardrobeHandlers.current.delete(handler)
      }
    },
    []
  )

  const onSceneProfileApply = useCallback(
    (
      handler: (draft: Extract<AiDraft, { type: 'scene-profile' }>) => void
    ) => {
      sceneProfileHandlers.current.add(handler)
      return () => {
        sceneProfileHandlers.current.delete(handler)
      }
    },
    []
  )

  const onScenePlateCommitted = useCallback(
    (
      handler: (payload: {
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
      }) => void
    ) => {
      scenePlateHandlers.current.add(handler)
      return () => {
        scenePlateHandlers.current.delete(handler)
      }
    },
    []
  )

  const onPropProfileApply = useCallback(
    (
      handler: (draft: Extract<AiDraft, { type: 'prop-profile' }>) => void
    ) => {
      propProfileHandlers.current.add(handler)
      return () => {
        propProfileHandlers.current.delete(handler)
      }
    },
    []
  )

  const onPropPlateCommitted = useCallback(
    (
      handler: (payload: {
        propId: string
        path: string
        gallery?: Array<{
          id: string
          path: string
          kind: string
          label: string
          createdAt: string
          layer?: string
        }>
      }) => void
    ) => {
      propPlateHandlers.current.add(handler)
      return () => {
        propPlateHandlers.current.delete(handler)
      }
    },
    []
  )

  const onStoryCoverCommitted = useCallback(
    (handler: (payload: { storyId: string; path: string }) => void) => {
      storyCoverHandlers.current.add(handler)
      return () => {
        storyCoverHandlers.current.delete(handler)
      }
    },
    []
  )

  const activeJobs = useMemo(
    () => jobs.filter((j) => j.status === 'running' || j.status === 'queued'),
    [jobs]
  )
  const pendingDrafts = useMemo(
    () =>
      jobs.filter(
        (j) => j.status === 'succeeded' && j.draft && !j.discarded
      ),
    [jobs]
  )

  const value = useMemo(
    () => ({
      jobs,
      activeJobs,
      pendingDrafts,
      reviewingJobId,
      setReviewingJobId,
      videoPrepDraft,
      setVideoPrepDraft,
      videoPrepSession,
      setVideoPrepSession,
      startVideoPrep,
      registerStartVideoPrep,
      savedVideoPrepDrafts,
      hasVideoPrepDraft,
      getVideoPrepDraft,
      upsertSavedVideoPrepDraft,
      removeSavedVideoPrepDraft,
      continueVideoPrepDraft,
      startJob,
      cancelJob,
      isBlocked,
      acceptDraft,
      discardDraft,
      dismissJob,
      onProfileApply,
      onSheetCommitted,
      onPipelineDone,
      onWardrobeApply,
      onSceneProfileApply,
      onScenePlateCommitted,
      onPropProfileApply,
      onPropPlateCommitted,
      onStoryCoverCommitted
    }),
    [
      jobs,
      activeJobs,
      videoPrepDraft,
      videoPrepSession,
      savedVideoPrepDrafts,
      pendingDrafts,
      reviewingJobId,
      startVideoPrep,
      registerStartVideoPrep,
      hasVideoPrepDraft,
      getVideoPrepDraft,
      upsertSavedVideoPrepDraft,
      removeSavedVideoPrepDraft,
      continueVideoPrepDraft,
      startJob,
      cancelJob,
      isBlocked,
      acceptDraft,
      discardDraft,
      dismissJob,
      onProfileApply,
      onSheetCommitted,
      onPipelineDone,
      onWardrobeApply,
      onSceneProfileApply,
      onScenePlateCommitted,
      onPropProfileApply,
      onPropPlateCommitted,
      onStoryCoverCommitted
    ]
  )

  return (
    <AiJobsContext.Provider value={value}>{children}</AiJobsContext.Provider>
  )
}

export function useAiJobs(): AiJobsContextValue {
  const ctx = useContext(AiJobsContext)
  if (!ctx) {
    throw new Error('useAiJobs must be used within AiJobsProvider')
  }
  return ctx
}
