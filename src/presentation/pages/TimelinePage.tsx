import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { TimelineService } from '../../application/TimelineService'
import { charactersMissingRef } from '../../domain/promptContinuity'
import {
  beatContentForEditor,
  commitBeatScriptEdit,
  extractSpokenLines,
  parseBeatContent
} from '../../domain/beatContent'
import { getAiLocale } from '../../lib/aiLocale'
import { buildVideoPrepDraftKey } from '../../domain/videoPrep'
import {
  snapClipRange,
  snapVideoSeconds,
  type GrokVideoSeconds
} from '../../domain/videoDuration'
import { getApi } from '../../lib/api'
import { parseIpcError } from '../../lib/ipc'
import type {
  Character,
  GenerationResult,
  MediaStatus,
  Prop
} from '../../types/domain'
import type { AppSettings } from '../../types/settings'
import { useApp } from '../context/AppContext'
import { useToast } from '../context/ToastContext'
import { useDialog } from '../context/DialogContext'
import { useAiJobs } from '../context/AiJobsContext'
import { useTimeline } from '../hooks/useTimeline'
import { PageHeader } from '../components/PageHeader'
import {
  sceneCastLabel,
  type StoryCastScene
} from '../components/timeline/timelineLabels'
import type { AssetDropPayload } from '../components/timeline/TimelineCanvas'
import { KonvaTimeline } from '../components/timeline/KonvaTimeline'
import { TimelineAdvancedStudio } from '../components/timeline/TimelineAdvancedStudio'
import { PreviewPlayer } from '../components/timeline/PreviewPlayer'
import { useTimelineHistory } from '../hooks/useTimelineHistory'
import { Button, EmptyState, Label, Select, Textarea } from '../components/ui'
import { ExportFinalDialog } from '../components/ExportFinalDialog'
import {
  defaultExportFinalOptions,
  type ExportFinalOptions
} from '../../domain/exportOptions'
import { tMediaStatus } from '../lib/statusLabels'

const STEP_I18N: Record<string, string> = {
  script: 'pipeline.script',
  character: 'pipeline.character',
  scene: 'pipeline.scene',
  props: 'pipeline.props',
  timeline: 'pipeline.timeline',
  video: 'pipeline.video',
  export: 'pipeline.export'
}

const mediaBadge: Record<MediaStatus, string> = {
  EMPTY: 'bg-ink-700 text-ink-300',
  QUEUED: 'bg-slate-700 text-slate-200',
  GENERATING: 'bg-amber-900/60 text-amber-200',
  READY: 'bg-emerald-900/50 text-emerald-200',
  FAILED: 'bg-rose-900/50 text-rose-200'
}

export function TimelinePage(): JSX.Element {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const toast = useToast()
  const dialog = useDialog()
  const {
    activeStoryId,
    setActiveStoryId,
    stories,
    refreshStories,
    refreshAiStatus
  } = useApp()
  const {
    startJob,
    isBlocked,
    onPipelineDone,
    cancelJob,
    activeJobs,
    startVideoPrep,
    setVideoPrepSession,
    hasVideoPrepDraft,
    continueVideoPrepDraft
  } = useAiJobs()
  const {
    entries,
    loading,
    error,
    totalDuration,
    create,
    update,
    remove,
    reload
  } = useTimeline(activeStoryId)

  const [castCharacters, setCastCharacters] = useState<Character[]>([])
  const [castScenes, setCastScenes] = useState<StoryCastScene[]>([])
  const [castProps, setCastProps] = useState<Prop[]>([])

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dialogue, setDialogue] = useState('')
  /** Per-clip director revision notes for re-generate */
  const [revisionByEntry, setRevisionByEntry] = useState<
    Record<string, string>
  >({})
  const [exporting, setExporting] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [stepTotal, setStepTotal] = useState(7)
  const [actionError, setActionError] = useState<string | null>(null)
  const [playhead, setPlayhead] = useState(0)
  const [pxPerSec, setPxPerSec] = useState(40)
  const [snapEnabled, setSnapEnabled] = useState(true)
  const [snapGridSec, setSnapGridSec] = useState(0.5)
  const [isPlaying, setIsPlaying] = useState(false)
  const [packAbutBusy, setPackAbutBusy] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const history = useTimelineHistory()
  const [clipSeconds, setClipSeconds] = useState<6 | 10>(6)
  const [videoMode, setVideoMode] = useState<string>('auto')
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [exportInitial, setExportInitial] =
    useState<Partial<ExportFinalOptions> | null>(null)
  const [lastExportPath, setLastExportPath] = useState<string | null>(null)
  const [exportHistory, setExportHistory] = useState<
    Array<{
      id: string
      kind: 'final' | 'board'
      fileName: string
      path: string
      createdAt: string
      sizeBytes?: number | null
    }>
  >([])
  const [exportHistoryOpen, setExportHistoryOpen] = useState(false)
  const [exportDeleteBusyId, setExportDeleteBusyId] = useState<string | null>(
    null
  )
  const [currentStepLabel, setCurrentStepLabel] = useState<string | null>(null)
  const [liveClipStatus, setLiveClipStatus] = useState<
    Record<string, string>
  >({})

  const activeStory = useMemo(
    () => stories.find((s) => s.id === activeStoryId) ?? null,
    [stories, activeStoryId]
  )

  const selected = entries.find((e) => e.id === selectedId) ?? null
  const storyGenBusy = Boolean(
    activeStoryId &&
      isBlocked({
        storyId: activeStoryId,
        kind: ['pipeline', 'clip', 'video-prep', 'video-confirm']
      })
  )
  const clipBusyId =
    activeJobs.find(
      (j) =>
        (j.kind === 'clip' ||
          j.kind === 'video-prep' ||
          j.kind === 'video-confirm') &&
        (j.status === 'running' || j.status === 'queued') &&
        j.scope.storyId === activeStoryId
    )?.scope.entryId ?? null
  const busy = storyGenBusy

  const loadCast = useCallback(async (): Promise<void> => {
    if (!activeStoryId) {
      setCastCharacters([])
      setCastScenes([])
      setCastProps([])
      return
    }
    try {
      const [chars, scns, prps] = await Promise.all([
        getApi().characters.list({
          storyId: activeStoryId,
          forStory: true
        }) as Promise<Character[]>,
        getApi().scenes.list({
          storyId: activeStoryId,
          forStory: true
        }) as Promise<StoryCastScene[]>,
        getApi().props.list({
          storyId: activeStoryId,
          forStory: true
        }) as Promise<Prop[]>
      ])
      setCastCharacters(chars)
      setCastScenes(scns)
      setCastProps(prps)
    } catch (e) {
      toast.error(parseIpcError(e).message)
    }
  }, [activeStoryId, toast])

  useEffect(() => {
    void loadCast()
  }, [loadCast])

  const missingRefs = useMemo(
    () => charactersMissingRef(entries, castCharacters),
    [entries, castCharacters]
  )
  const failedCount = useMemo(
    () => entries.filter((e) => e.mediaStatus === 'FAILED').length,
    [entries]
  )
  const readyCount = useMemo(
    () => entries.filter((e) => e.mediaStatus === 'READY').length,
    [entries]
  )

  useEffect(() => {
    void getApi()
      .settings.get()
      .then((s: AppSettings) => {
        setVideoMode(s.videoMode)
        setSnapEnabled(s.snapEnabled !== false)
        setSnapGridSec(
          typeof s.snapGridSec === 'number' && s.snapGridSec > 0
            ? s.snapGridSec
            : 0.5
        )
        setExportInitial({
          exportProfile: s.exportProfile,
          burnSubtitles: s.burnSubtitles,
          includeSilentAudio: s.includeSilentAudio,
          openExportFolder: s.openExportFolder,
          bgmVolume: s.bgmVolume,
          dialogueVolume: s.dialogueVolume
        })
      })
      .catch(() => undefined)
  }, [])

  const persistSnapSettings = useCallback(
    async (next: { snapEnabled?: boolean; snapGridSec?: number }) => {
      if (next.snapEnabled !== undefined) setSnapEnabled(next.snapEnabled)
      if (next.snapGridSec !== undefined) setSnapGridSec(next.snapGridSec)
      try {
        await getApi().settings.set({
          ...(next.snapEnabled !== undefined
            ? { snapEnabled: next.snapEnabled }
            : {}),
          ...(next.snapGridSec !== undefined
            ? { snapGridSec: next.snapGridSec }
            : {})
        })
      } catch {
        /* non-fatal */
      }
    },
    []
  )

  const refreshExportHistory = useCallback(async (): Promise<void> => {
    if (!activeStoryId) {
      setExportHistory([])
      setLastExportPath(null)
      return
    }
    try {
      const api = getApi().media
      if (typeof api.listExports !== 'function') {
        setExportHistory([])
        setLastExportPath(null)
        return
      }
      const r = await api.listExports(activeStoryId)
      setExportHistory(Array.isArray(r.items) ? r.items : [])
      setLastExportPath(r.latestPath ?? null)
    } catch (e) {
      // Surface once in console; keep empty state visible in UI
      console.warn('[timeline] listExports failed', e)
      setExportHistory([])
    }
  }, [activeStoryId])

  useEffect(() => {
    void refreshExportHistory()
  }, [refreshExportHistory])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        void (async () => {
          if (e.shiftKey) {
            if (await history.redo()) {
              toast.success(t('timeline.redoDone'))
              await reload()
            }
          } else if (await history.undo()) {
            toast.success(t('timeline.undoDone'))
            await reload()
          }
        })()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [history, t, reload, toast])

  useEffect(() => {
    if (!selected) {
      setDialogue('')
      return
    }
    setDialogue(
      beatContentForEditor(
        selected.dialogue,
        selected.beatContentJson,
        getAiLocale(i18n.language)
      )
    )
  }, [selected?.id, selected?.dialogue, selected?.beatContentJson, i18n.language])

  /**
   * On enter / after reload: auto-select first clip so preview is not empty.
   * If current selection was deleted, re-select first remaining.
   */
  useEffect(() => {
    if (entries.length === 0) {
      if (selectedId != null) setSelectedId(null)
      return
    }
    const stillThere =
      selectedId != null && entries.some((e) => e.id === selectedId)
    if (stillThere) return
    const first = [...entries].sort((a, b) => a.startTime - b.startTime)[0]
    if (!first) return
    setSelectedId(first.id)
    setPlayhead(first.startTime)
    setIsPlaying(false)
  }, [entries, selectedId])

  const entriesRef = useRef(entries)
  entriesRef.current = entries
  const selectedIdRef = useRef(selectedId)
  selectedIdRef.current = selectedId
  const isPlayingRef = useRef(isPlaying)
  isPlayingRef.current = isPlaying

  /**
   * Advance playhead to the next timeline entry after `fromTime`.
   * Skips EMPTY/FAILED gaps so sequential preview keeps going.
   * Returns false if story ended.
   */
  const advanceToNextClip = useCallback(
    (fromTime: number): boolean => {
      const list = [...entriesRef.current].sort(
        (a, b) => a.startTime - b.startTime
      )
      // Next clip strictly after the one that just finished
      const candidate =
        list.find((e) => e.startTime >= fromTime - 0.02 && e.endTime > fromTime) ??
        list.find((e) => e.startTime > fromTime + 0.01) ??
        null
      if (!candidate) {
        setIsPlaying(false)
        setPlayhead(Math.max(totalDuration, fromTime))
        return false
      }
      setSelectedId(candidate.id)
      setPlayhead(candidate.startTime)
      // Non-playable: skip after a short beat (gap clock / empty preview)
      if (candidate.mediaStatus !== 'READY' || !candidate.mediaPath) {
        window.setTimeout(() => {
          if (!isPlayingRef.current) return
          advanceToNextClip(candidate.endTime)
        }, 50)
      }
      return true
    },
    [totalDuration]
  )

  /** While playing over EMPTY/gap regions, keep the playhead moving with rAF. */
  useEffect(() => {
    if (!isPlaying) return
    const cur = entriesRef.current.find((e) => e.id === selectedIdRef.current)
    const needsClock =
      !cur ||
      cur.mediaStatus !== 'READY' ||
      !cur.mediaPath ||
      playhead < cur.startTime ||
      playhead >= cur.endTime
    if (!needsClock) return

    let raf = 0
    let last = performance.now()
    const tick = (now: number): void => {
      const dt = (now - last) / 1000
      last = now
      setPlayhead((t) => {
        const next = t + dt
        if (next >= Math.max(totalDuration, 0.1)) {
          setIsPlaying(false)
          return Math.max(totalDuration, 0)
        }
        const list = entriesRef.current
        const hit = list.find((e) => next >= e.startTime && next < e.endTime)
        if (hit) {
          if (hit.id !== selectedIdRef.current) setSelectedId(hit.id)
          // Entered a READY clip — video clock takes over
          if (hit.mediaStatus === 'READY' && hit.mediaPath) {
            return Math.max(next, hit.startTime)
          }
        }
        return next
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [isPlaying, totalDuration, selectedId, selected?.mediaStatus, playhead])

  useEffect(() => {
    return onPipelineDone(() => {
      void reload()
      void refreshStories()
      void refreshAiStatus()
      void loadCast()
    })
  }, [onPipelineDone, reload, refreshStories, refreshAiStatus, loadCast])

  useEffect(() => {
    return getApi().generation.onProgress((payload) => {
      if (activeStoryId && payload.storyId !== activeStoryId) return
      setStepIndex(payload.index + 1)
      setStepTotal(Math.max(1, payload.total))
      const stepKey = STEP_I18N[payload.step]
      const human = stepKey ? t(stepKey) : payload.step
      setCurrentStepLabel(human)
      if (payload.entryId && payload.mediaStatus) {
        setLiveClipStatus((prev) => ({
          ...prev,
          [payload.entryId!]: payload.mediaStatus!
        }))
      }
      // Refresh list when a clip finishes so player can pick up READY media
      if (
        payload.entryId &&
        (payload.mediaStatus === 'READY' || payload.mediaStatus === 'FAILED')
      ) {
        void reload()
      }
    })
  }, [reload, t, activeStoryId])

  const labels = useMemo(() => {
    const map: Record<string, string> = {}
    const charMap = new Map(castCharacters.map((c) => [c.id, c.name]))
    const sceneMap = new Map(
      castScenes.map((s) => [s.id, sceneCastLabel(s)])
    )
    const propMap = new Map(castProps.map((p) => [p.id, p.name]))
    for (const e of entries) {
      const charIds =
        e.characterIds?.length
          ? e.characterIds
          : e.characterId
            ? [e.characterId]
            : []
      const sceneIds =
        e.sceneIds?.length ? e.sceneIds : e.sceneId ? [e.sceneId] : []
      const propIds =
        e.propIds?.length ? e.propIds : e.propId ? [e.propId] : []
      const names = [
        ...charIds.map((id) => charMap.get(id)).filter(Boolean),
        ...sceneIds.map((id) => sceneMap.get(id)).filter(Boolean),
        ...propIds.map((id) => propMap.get(id)).filter(Boolean)
      ]
      map[e.id] =
        (e.dialogue && e.dialogue.trim()) ||
        (names.length ? names.join(' · ') : null) ||
        `#${e.order + 1}`
    }
    return map
  }, [entries, castCharacters, castScenes, castProps])

  const selectedBindings = useMemo(() => {
    if (!selected) return [] as string[]
    const chips: string[] = []
    const charIds =
      selected.characterIds?.length
        ? selected.characterIds
        : selected.characterId
          ? [selected.characterId]
          : []
    const sceneIds =
      selected.sceneIds?.length
        ? selected.sceneIds
        : selected.sceneId
          ? [selected.sceneId]
          : []
    const propIds =
      selected.propIds?.length
        ? selected.propIds
        : selected.propId
          ? [selected.propId]
          : []
    for (const id of charIds) {
      const c = castCharacters.find((x) => x.id === id)
      if (c) chips.push(c.name)
    }
    for (const id of sceneIds) {
      const s = castScenes.find((x) => x.id === id)
      if (s) chips.push(sceneCastLabel(s))
    }
    for (const id of propIds) {
      const p = castProps.find((x) => x.id === id)
      if (p) chips.push(p.name)
    }
    return chips
  }, [selected, castCharacters, castScenes, castProps])

  const openStoryEditor = (): void => {
    navigate('/')
  }

  const addAsset = async (
    payload: AssetDropPayload,
    atTime?: number
  ): Promise<void> => {
    if (!activeStoryId) return
    const duration = clipSeconds
    let startTime: number
    let order: number
    if (atTime !== undefined) {
      startTime = Math.max(0, atTime)
      order = entries.length
    } else {
      const slot = TimelineService.suggestNextSlot(entries, duration)
      startTime = slot.startTime
      order = slot.order
    }
    const range = TimelineService.clampDuration(
      startTime,
      startTime + duration,
      10
    )
    await create({
      startTime: range.startTime,
      endTime: range.endTime,
      order,
      characterId: payload.kind === 'character' ? payload.id : null,
      sceneId: payload.kind === 'scene' ? payload.id : null,
      propId: payload.kind === 'prop' ? payload.id : null,
      dialogue: null
    })
    await refreshStories()
    toast.success(t('timeline.addClip'))
  }

  const persistMove = async (
    id: string,
    startTime: number,
    endTime: number
  ): Promise<void> => {
    const prev = entries.find((e) => e.id === id)
    if (prev) {
      history.recordUpdate(
        id,
        { startTime: prev.startTime, endTime: prev.endTime },
        { startTime, endTime }
      )
    }
    await update(id, { startTime, endTime })
  }

  /** Pack all clips end-to-end (no gaps), keep each duration & relative order. */
  const handlePackAbut = async (): Promise<void> => {
    if (entries.length < 2) {
      toast.info(t('timeline.packAbutNeedClips'))
      return
    }
    if (TimelineService.isAlreadyPacked(entries)) {
      toast.info(t('timeline.packAbutAlready'))
      return
    }
    const plan = TimelineService.packAbutting(entries)
    setPackAbutBusy(true)
    setActionError(null)
    try {
      const byId = new Map(entries.map((e) => [e.id, e]))
      const api = getApi()
      for (const slot of plan) {
        const prev = byId.get(slot.id)
        if (!prev) continue
        const changed =
          prev.startTime !== slot.startTime ||
          prev.endTime !== slot.endTime ||
          prev.order !== slot.order
        if (!changed) continue
        history.recordUpdate(
          slot.id,
          {
            startTime: prev.startTime,
            endTime: prev.endTime,
            order: prev.order
          },
          {
            startTime: slot.startTime,
            endTime: slot.endTime,
            order: slot.order
          }
        )
        await api.timeline.update(slot.id, {
          startTime: slot.startTime,
          endTime: slot.endTime,
          order: slot.order
        })
      }
      await reload()
      setPlayhead(0)
      setIsPlaying(false)
      toast.success(t('timeline.packAbutDone'))
    } catch (e) {
      setActionError(parseIpcError(e).message)
      toast.error(parseIpcError(e).message)
    } finally {
      setPackAbutBusy(false)
    }
  }

  const handleUndoLocal = async (): Promise<void> => {
    if (await history.undo()) {
      toast.success(t('timeline.undoDone'))
      await reload()
    }
  }

  const handleRedoLocal = async (): Promise<void> => {
    if (await history.redo()) {
      toast.success(t('timeline.redoDone'))
      await reload()
    }
  }

  const handleSaveDialogue = async (): Promise<void> => {
    if (!selectedId) return
    try {
      const committed = commitBeatScriptEdit(
        dialogue,
        getAiLocale(i18n.language)
      )
      await update(selectedId, {
        dialogue: committed.dialogue ?? (dialogue.trim() || null),
        beatContentJson: committed.beatContentJson
      })
      toast.success(t('common.saved'))
    } catch (e) {
      toast.error(parseIpcError(e).message)
    }
  }

  /** AI clip length 6s | 10s — updates endTime and refreshes the Konva track. */
  const handleClipDuration = async (seconds: GrokVideoSeconds): Promise<void> => {
    if (!selected) return
    const cur = snapVideoSeconds(selected.endTime - selected.startTime)
    if (cur === seconds) return
    const range = snapClipRange(selected.startTime, selected.startTime + seconds)
    try {
      const ok = await update(selected.id, {
        startTime: range.startTime,
        endTime: range.endTime
      })
      if (ok) {
        // Keep playhead inside the clip after resize
        setPlayhead((ph) => {
          if (ph < range.startTime) return range.startTime
          if (ph >= range.endTime) return Math.max(range.startTime, range.endTime - 0.05)
          return ph
        })
        setClipSeconds(seconds)
        toast.success(
          t('timeline.clipDurationSet', { n: seconds })
        )
      }
    } catch (e) {
      toast.error(parseIpcError(e).message)
    }
  }

  const handleDeleteClip = async (): Promise<void> => {
    if (!selected) return
    const ok = await dialog.confirm({
      message: t('common.confirmDelete'),
      variant: 'danger'
    })
    if (!ok) return
    try {
      await remove(selected.id)
      setSelectedId(null)
      toast.success(t('common.deleted'))
    } catch (e) {
      toast.error(parseIpcError(e).message)
    }
  }

  /**
   * Open wizard for first clip; remaining ids passed as queueRemaining.
   * Host shows「下一格」after each success — never silent auto-video.
   */
  const revisionByEntryRef = useRef(revisionByEntry)
  revisionByEntryRef.current = revisionByEntry

  const startClipPrepQueue = useCallback(
    (
      storyId: string,
      entryIds: string[],
      opts?: { skipStillIfExists?: boolean }
    ): void => {
      const ids = entryIds.filter(Boolean)
      if (ids.length === 0) {
        toast.info(t('pipeline.noFailedClips'))
        return
      }
      const [first, ...rest] = ids
      const entry = entriesRef.current.find((e) => e.id === first)
      const revisionPrompt =
        revisionByEntryRef.current[first]?.trim() || ''
      const durationSeconds = snapVideoSeconds(
        entry ? entry.endTime - entry.startTime : clipSeconds
      )
      setSelectedId(first)
      setCurrentStepLabel(
        ids.length > 1
          ? t('videoPrep.queueProgress', { current: 1, total: ids.length })
          : t('timeline.generateClip')
      )
      startVideoPrep({
        kind: 'timeline-clip',
        entityIds: { storyId, entryId: first },
        durationSeconds,
        locale: getAiLocale(i18n.language),
        userExtraPrompt: revisionPrompt,
        queueIndex: 1,
        queueTotal: ids.length,
        queueRemaining: rest,
        skipStillIfExists: opts?.skipStillIfExists
      })
    },
    [clipSeconds, i18n.language, startVideoPrep, t, toast]
  )

  const handleGenerate = async (onlyFailed = false): Promise<void> => {
    if (!activeStoryId || busy) return
    if (onlyFailed) {
      const need = [...entries]
        .filter(
          (e) => e.mediaStatus === 'FAILED' || e.mediaStatus === 'EMPTY'
        )
        .sort((a, b) => a.order - b.order)
      if (need.length === 0) {
        toast.info(t('pipeline.noFailedClips'))
        return
      }
    } else if (entries.length === 0) {
      toast.info(t('timeline.noEntries'))
      return
    }
    const modeHint = t('videoPrep.timelineBatchHint')
    if (
      !(await dialog.confirm({
        message: modeHint,
        confirmLabel: t('common.ok')
      }))
    ) {
      return
    }
    if (videoMode !== 'stub' && missingRefs.length > 0) {
      const ok = await dialog.confirm({
        message: t('pipeline.missingRefConfirm', {
          names: missingRefs.map((c) => c.name).join(', ')
        }),
        confirmLabel: t('common.ok')
      })
      if (!ok) return
    }
    const storyId = activeStoryId
    setActionError(null)
    setLiveClipStatus({})
    setStepIndex(0)

    // Retry failed / empty: interactive video-prep only (no auto pipeline video).
    if (onlyFailed) {
      const need = [...entries]
        .filter(
          (e) => e.mediaStatus === 'FAILED' || e.mediaStatus === 'EMPTY'
        )
        .sort((a, b) => a.order - b.order)
        .map((e) => e.id)
      setCurrentStepLabel(t('common.retryFailed'))
      startClipPrepQueue(storyId, need)
      return
    }

    // Full generate: prep pipeline (script…timeline) without auto video, then
    // sequential video-prep for every clip.
    setCurrentStepLabel(t('common.generate'))
    toast.info(t('aiJobs.startedBackground'))
    startJob({
      kind: 'pipeline',
      label: t('common.generate'),
      scope: { storyId },
      run: async ({ setProgress, signal }) => {
        setProgress(5, 'start')
        const result = (await getApi().generation.run(storyId, {
          interactiveVideo: true
        })) as GenerationResult
        if (signal.cancelled) return
        const summary = result.steps
          .map((s) => {
            const human = STEP_I18N[s.step] ? t(STEP_I18N[s.step]) : s.step
            return s.success
              ? `✓ ${human}${s.degraded ? ` (${t('pipeline.degraded')})` : ''}`
              : `✗ ${human}: ${s.error ?? 'failed'}`
          })
          .join('\n')
        const anyDegraded = result.steps.some((s) => s.degraded)
        setProgress(85, 'video-queue')
        if (!result.success) {
          setProgress(100, 'done')
          toast.error(t('aiJobs.pipelineFail'))
          return {
            type: 'pipeline' as const,
            storyId,
            success: false,
            summary,
            degraded: anyDegraded
          }
        }
        // Reload timeline ids after pipeline may have rewritten entries
        let entryIds: string[] = []
        try {
          const list = (await getApi().timeline.list(storyId)) as Array<{
            id: string
            order: number
          }>
          entryIds = [...list]
            .sort((a, b) => a.order - b.order)
            .map((e) => e.id)
        } catch {
          entryIds = [...entriesRef.current]
            .sort((a, b) => a.order - b.order)
            .map((e) => e.id)
        }
        setProgress(100, 'done')
        toast.success(
          anyDegraded ? t('pipeline.degraded') : t('aiJobs.pipelineOk')
        )
        // Kick interactive per-clip video-prep queue on main thread
        queueMicrotask(() => {
          startClipPrepQueue(storyId, entryIds)
        })
        return {
          type: 'pipeline' as const,
          storyId,
          success: true,
          summary: `${summary}\n→ ${t('videoPrep.queueStart', { count: entryIds.length })}`,
          degraded: anyDegraded
        }
      }
    })
  }

  const handleCancel = async (): Promise<void> => {
    setVideoPrepSession(null)
    const running = activeJobs.filter(
      (j) =>
        j.scope.storyId === activeStoryId &&
        (j.kind === 'pipeline' ||
          j.kind === 'clip' ||
          j.kind === 'video-prep' ||
          j.kind === 'video-confirm')
    )
    for (const j of running) {
      await cancelJob(j.id)
    }
    toast.info(t('pipeline.cancelling'))
  }

  const handleExportFinal = async (
    rawOpts: ExportFinalOptions
  ): Promise<void> => {
    if (!activeStoryId) return
    const opts = defaultExportFinalOptions(rawOpts)
    setExporting(true)
    setActionError(null)
    try {
      const pre = await getApi().media.exportPreflight(activeStoryId)
      if (!pre.canExport) {
        const msg =
          pre.ffmpegMessage && !/ffmpeg OK/i.test(pre.ffmpegMessage)
            ? `${t('pipeline.needFfmpeg')}${
                pre.ffmpegMessage ? `（${pre.ffmpegMessage}）` : ''
              }`
            : t('pipeline.needFfmpeg')
        setActionError(msg)
        toast.error(msg)
        return
      }
      if (pre.willUseFallback) {
        const ok = await dialog.confirm({
          message: `${pre.warnings.join('\n')}\n\n${t('pipeline.exportFallbackConfirm')}`,
          confirmLabel: t('common.ok')
        })
        if (!ok) return
      }
      const { outputPath } = await getApi().media.exportFinal(
        activeStoryId,
        opts
      )
      setLastExportPath(outputPath)
      setExportInitial(opts)
      setExportDialogOpen(false)
      setExportHistoryOpen(true)
      await refreshExportHistory()
      toast.success(t('pipeline.exportOk', { path: outputPath }))
      if (opts.openExportFolder) {
        void getApi().shell.showItemInFolder(outputPath)
      }
    } catch (e) {
      const err = parseIpcError(e)
      const msg =
        err.code === 'FFMPEG_UNAVAILABLE' || /ffmpeg/i.test(err.message)
          ? t('pipeline.needFfmpeg')
          : `${err.message}${err.details ? ` — ${err.details}` : ''}`
      setActionError(msg)
      toast.error(msg)
    } finally {
      setExporting(false)
    }
  }

  const handleDeleteExport = async (exportId: string): Promise<void> => {
    if (!activeStoryId) return
    const ok = await dialog.confirm({
      message: t('timeline.exportDeleteConfirm'),
      confirmLabel: t('common.delete'),
      variant: 'danger'
    })
    if (!ok) return
    setExportDeleteBusyId(exportId)
    try {
      const r = await getApi().media.deleteExport(activeStoryId, exportId)
      setExportHistory(r.items)
      setLastExportPath(r.latestPath)
      toast.success(t('timeline.exportDeleted'))
    } catch (e) {
      toast.error(parseIpcError(e).message)
    } finally {
      setExportDeleteBusyId(null)
    }
  }

  const formatExportSize = (n?: number | null): string => {
    if (n == null || !Number.isFinite(n) || n < 0) return ''
    if (n < 1024) return `${n} B`
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
    return `${(n / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatExportWhen = (iso: string): string => {
    const d = Date.parse(iso)
    if (!Number.isFinite(d)) return iso
    try {
      return new Date(d).toLocaleString(i18n.language || undefined)
    } catch {
      return new Date(d).toLocaleString()
    }
  }

  const handleRunClip = async (entryId: string): Promise<void> => {
    if (!activeStoryId || busy) return
    if (videoMode !== 'stub' && missingRefs.length > 0) {
      const ok = await dialog.confirm({
        message: t('pipeline.missingRefConfirm', {
          names: missingRefs.map((c) => c.name).join(', ')
        }),
        confirmLabel: t('common.ok')
      })
      if (!ok) return
    }
    setActionError(null)
    const draftKey = buildVideoPrepDraftKey('timeline-clip', {
      storyId: activeStoryId,
      entryId
    })
    if (hasVideoPrepDraft(draftKey)) {
      continueVideoPrepDraft(draftKey)
      return
    }
    // Prefer reusing advanced-prep / continuity still when present
    startClipPrepQueue(activeStoryId, [entryId], {
      skipStillIfExists: true
    })
  }

  const clipGenerateLabel = (entryId: string, status: MediaStatus): string => {
    const draftKey = buildVideoPrepDraftKey('timeline-clip', {
      storyId: activeStoryId ?? '',
      entryId
    })
    if (activeStoryId && hasVideoPrepDraft(draftKey)) {
      return t('videoPrep.continueVideo')
    }
    return status === 'FAILED' || status === 'EMPTY'
      ? t('timeline.generateClip')
      : t('timeline.regenClip')
  }

  // After timeline-clip video confirm — refresh media (wizard owns「下一格」)
  useEffect(() => {
    const onDone = (ev: Event): void => {
      const d = (ev as CustomEvent).detail as {
        kind?: string
        entityIds?: { storyId?: string; entryId?: string }
        path?: string
      }
      if (d?.kind !== 'timeline-clip') return
      if (!activeStoryId || d.entityIds?.storyId !== activeStoryId) return
      void reload()
      if (d.entityIds?.entryId) {
        setLiveClipStatus((prev) => ({
          ...prev,
          [d.entityIds!.entryId!]: 'READY'
        }))
        setSelectedId(d.entityIds.entryId)
      }
    }
    window.addEventListener('idm:video-prep-done', onDone)
    return () => window.removeEventListener('idm:video-prep-done', onDone)
  }, [activeStoryId, reload])

  /** Timeline play for whole story (sequential clips). Wrap to 0 when at end. */
  const handleTogglePlay = (): void => {
    if (isPlaying) {
      setIsPlaying(false)
      return
    }
    const end = Math.max(totalDuration, 0.1)
    if (playhead >= end - 0.05) {
      setPlayhead(0)
      const first = [...entries].sort((a, b) => a.startTime - b.startTime)[0]
      if (first) setSelectedId(first.id)
    } else {
      // Ensure selection matches playhead so the correct media loads
      const hit = entries.find(
        (e) => playhead >= e.startTime && playhead < e.endTime
      )
      if (hit) setSelectedId(hit.id)
      else if (entries.length > 0) {
        const next = entries
          .filter((e) => e.startTime >= playhead)
          .sort((a, b) => a.startTime - b.startTime)[0]
        if (next) {
          setSelectedId(next.id)
          setPlayhead(next.startTime)
        }
      }
    }
    setIsPlaying(true)
  }

  const handleMediaClock = useCallback((globalTime: number): void => {
    if (!isPlayingRef.current) return
    setPlayhead(globalTime)
  }, [])

  const handleClipEnded = useCallback((): void => {
    if (!isPlayingRef.current) return
    const cur = entriesRef.current.find((e) => e.id === selectedIdRef.current)
    const from = cur ? cur.endTime : playhead
    advanceToNextClip(from)
  }, [advanceToNextClip, playhead])

  /** Select a clip and keep playhead inside it so the preview shows that media. */
  const selectClip = (id: string | null): void => {
    if (id == null) {
      setSelectedId(null)
      return
    }
    setSelectedId(id)
    setIsPlaying(false)
    const clip = entries.find((e) => e.id === id)
    if (!clip) return
    if (playhead < clip.startTime || playhead >= clip.endTime) {
      setPlayhead(clip.startTime)
    }
  }

  const handleImportClip = async (): Promise<void> => {
    if (!activeStoryId || !selectedId) return
    const result = await getApi().media.importClip(activeStoryId, selectedId)
    if (result) {
      await reload()
      toast.success(t('timeline.importClip'))
    }
  }

  const handleOpenClip = async (): Promise<void> => {
    if (!selected?.mediaPath) return
    await getApi().media.openClip(selected.mediaPath)
  }

  const storyPicker = (
    <Select
      aria-label={t('timeline.story')}
      className="!w-[12rem]"
      value={activeStoryId ?? ''}
      onChange={(e) => {
        const id = e.target.value || null
        setActiveStoryId(id)
        setSelectedId(null)
        setPlayhead(0)
        setIsPlaying(false)
      }}
      disabled={stories.length === 0}
    >
      {stories.length === 0 ? (
        <option value="">{t('timeline.noStories')}</option>
      ) : (
        stories.map((s) => (
          <option key={s.id} value={s.id}>
            {s.title}
          </option>
        ))
      )}
    </Select>
  )

  const toolbarDivider = (
    <span
      className="mx-0.5 hidden h-6 w-px shrink-0 bg-ink-700/80 sm:block"
      aria-hidden
    />
  )

  const timelineToolbar = (
    <>
      {storyPicker}
      {toolbarDivider}
      <Button variant="secondary" onClick={handleTogglePlay}>
        {isPlaying ? t('timeline.toolbarPause') : t('timeline.toolbarPlay')}
      </Button>
      <Button
        variant="ghost"
        onClick={() => void handleUndoLocal()}
        disabled={!history.canUndo}
        title={t('timeline.undoHint')}
      >
        {t('timeline.undoHint')}
      </Button>
      <Button
        variant="ghost"
        onClick={() => void handleRedoLocal()}
        disabled={!history.canRedo}
        title={t('timeline.redoHint')}
      >
        {t('timeline.redoHint')}
      </Button>
      {toolbarDivider}
      <Button
        variant="secondary"
        onClick={() => setExportDialogOpen(true)}
        disabled={exporting}
      >
        {exporting ? t('common.exporting') : t('timeline.toolbarExportFinal')}
      </Button>
      <Button
        variant="ghost"
        onClick={() => {
          setExportHistoryOpen(true)
          void refreshExportHistory()
        }}
        title={t('timeline.exportHistory')}
      >
        {t('timeline.exportHistory')}
        {exportHistory.length > 0 ? (
          <span className="ml-1 rounded-full bg-brand-900/70 px-1.5 text-[10px] text-brand-100">
            {exportHistory.length}
          </span>
        ) : null}
      </Button>
      {toolbarDivider}
      {busy ? (
        <Button variant="danger" onClick={() => void handleCancel()}>
          {t('timeline.toolbarCancel')}
        </Button>
      ) : (
        <>
          {failedCount > 0 && (
            <Button
              variant="secondary"
              onClick={() => void handleGenerate(true)}
              disabled={exporting}
              title={t('common.retryFailed')}
            >
              {t('timeline.toolbarRetry')} ({failedCount})
            </Button>
          )}
          <Button
            onClick={() => void handleGenerate(false)}
            disabled={exporting}
          >
            {t('timeline.toolbarGenerate')}
          </Button>
        </>
      )}
    </>
  )

  if (!activeStoryId) {
    return (
      <div className="flex h-full flex-col overflow-hidden bg-gradient-to-b from-ink-950 via-ink-950 to-ink-900">
        <PageHeader
          title={t('timeline.title')}
          subtitle={t('timeline.subtitle')}
          actions={storyPicker}
        />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
          <EmptyState message={t('timeline.pickStoryHint')} />
          {stories.length === 0 && (
            <Button variant="secondary" onClick={() => navigate('/stories')}>
              {t('timeline.goStories')}
            </Button>
          )}
        </div>
      </div>
    )
  }

  const progressPct =
    stepTotal > 0 ? Math.round((stepIndex / stepTotal) * 100) : 0

  return (
    <div className="flex h-full flex-col overflow-hidden bg-gradient-to-b from-ink-950 via-ink-950 to-ink-900">
      <PageHeader
        title={t('timeline.title')}
        subtitle={
          activeStory
            ? `${t('timeline.subtitle')} · ${activeStory.title}`
            : t('timeline.subtitle')
        }
        actions={timelineToolbar}
      />

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden border-r border-ink-800/80">
          {/* Status chips */}
          <div className="flex flex-wrap items-center gap-2 border-b border-ink-800/80 px-6 py-3">
            <span className="rounded-full border border-ink-700/80 bg-ink-900/60 px-2.5 py-1 text-[11px] text-ink-300">
              {t('timeline.duration', { seconds: totalDuration.toFixed(1) })}
            </span>
            <span className="rounded-full border border-ink-700/80 bg-ink-900/60 px-2.5 py-1 text-[11px] text-emerald-200/90">
              {t('timeline.readyCount', {
                ready: readyCount,
                total: entries.length
              })}
            </span>
            {failedCount > 0 && (
              <span className="rounded-full border border-rose-900/50 bg-rose-950/40 px-2.5 py-1 text-[11px] text-rose-200">
                {t('timeline.failedCount', { n: failedCount })}
              </span>
            )}
            <span className="rounded-full border border-ink-700/80 bg-ink-900/60 px-2.5 py-1 text-[11px] text-brand-200">
              {t('timeline.videoMode', { mode: videoMode })}
            </span>
            <span className="rounded-full border border-amber-900/40 bg-amber-950/30 px-2.5 py-1 text-[11px] text-amber-100/90">
              {t('timeline.aiClipHint')}
            </span>
          </div>

          {missingRefs.length > 0 && videoMode !== 'stub' && (
            <div className="border-b border-amber-900/40 bg-amber-950/30 px-6 py-2 text-xs text-amber-100">
              {t('pipeline.missingRefBanner', {
                names: missingRefs.map((c) => c.name).join(', ')
              })}
            </div>
          )}

          {busy && (
            <div className="border-b border-ink-800/80 px-6 py-3">
              <div className="mb-1.5 flex justify-between text-[11px] text-ink-400">
                <span>
                  {t('common.generating')}
                  {currentStepLabel ? ` · ${currentStepLabel}` : ''}
                  {stepTotal > 0
                    ? ` (${Math.min(stepIndex, stepTotal)}/${stepTotal})`
                    : ''}
                </span>
                <span>{progressPct}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-ink-800">
                <div
                  className="h-full bg-brand-500 transition-all"
                  style={{ width: `${Math.max(progressPct, 4)}%` }}
                />
              </div>
            </div>
          )}

          {/* Timeline track — compact, always on top */}
          <div className="shrink-0 border-b border-ink-800/80 px-6 py-3">
            <div className="rounded-2xl border border-ink-800/80 bg-ink-900/40 p-3 shadow-xl shadow-black/20">
              <KonvaTimeline
                entries={entries}
                labels={labels}
                selectedId={selectedId}
                playhead={playhead}
                pxPerSec={pxPerSec}
                onPxPerSecChange={setPxPerSec}
                onPlayheadChange={(t) => {
                  setIsPlaying(false)
                  setPlayhead(t)
                  const hit = entries.find(
                    (e) => t >= e.startTime && t < e.endTime
                  )
                  if (hit && hit.id !== selectedId) setSelectedId(hit.id)
                }}
                onSelect={selectClip}
                onMove={(id, s, e) => void persistMove(id, s, e)}
                onDropAsset={(payload, at) => void addAsset(payload, at)}
                onPackAbut={() => void handlePackAbut()}
                packAbutBusy={packAbutBusy}
                snapEnabled={snapEnabled}
                snapGridSec={snapGridSec}
                onSnapEnabledChange={(v) =>
                  void persistSnapSettings({ snapEnabled: v })
                }
                onSnapGridSecChange={(v) =>
                  void persistSnapSettings({ snapGridSec: v })
                }
                width={900}
              />
            </div>
          </div>

          {/* Workbench: preview | editor + clip list (always reachable) */}
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-6 py-3 lg:flex-row">
            {/* Preview fills remaining left space */}
            <div className="flex min-h-[200px] min-w-0 flex-1 flex-col lg:min-h-0">
              {(error || actionError) && (
                <p className="mb-2 shrink-0 rounded-xl border border-rose-900/40 bg-rose-950/40 px-3 py-2 text-sm text-rose-200">
                  {error?.message ?? actionError}
                </p>
              )}
              <PreviewPlayer
                className="min-h-0 flex-1"
                entry={selected}
                playhead={playhead}
                isPlaying={isPlaying}
                onMediaClock={handleMediaClock}
                onClipEnded={handleClipEnded}
                onGenerate={
                  selected && selected.mediaStatus !== 'READY'
                    ? () => handleRunClip(selected.id)
                    : undefined
                }
                generateDisabled={busy}
                generateLabel={
                  selected
                    ? clipGenerateLabel(selected.id, selected.mediaStatus)
                    : t('timeline.generateClip')
                }
              />
            </div>

            {/* Clip inspector + list:
                narrow → editor above list (stack)
                wide (xl+) → editor | list side-by-side so both show more */}
            <div
              className={[
                'flex min-h-0 w-full flex-1 gap-3 overflow-hidden',
                'flex-col',
                'lg:w-[min(400px,42%)] lg:flex-none lg:shrink-0',
                'xl:w-[min(720px,54%)] xl:flex-row'
              ].join(' ')}
            >
              <div className="flex min-h-0 min-w-0 flex-[1.35] flex-col overflow-hidden rounded-2xl border border-ink-800/80 bg-ink-900/40 shadow-lg shadow-black/10 xl:flex-1">
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 [scrollbar-gutter:stable]">
                {selected ? (
                  <>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-ink-100">
                        {t('timeline.clipEditor')}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="rounded-full bg-ink-800/80 px-2 py-0.5 font-mono text-brand-300">
                          {selected.startTime.toFixed(1)}s →{' '}
                          {selected.endTime.toFixed(1)}s
                        </span>
                        <span
                          className={[
                            'rounded-full px-2 py-0.5 text-[10px]',
                            mediaBadge[selected.mediaStatus]
                          ].join(' ')}
                        >
                          {tMediaStatus(t, selected.mediaStatus)}
                        </span>
                      </div>
                    </div>

                    {selectedBindings.length > 0 && (
                      <div className="mb-3">
                        <p className="mb-1 text-[10px] uppercase tracking-wide text-ink-500">
                          {t('timeline.boundAssets')}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedBindings.map((label) => (
                            <span
                              key={label}
                              className="rounded-lg border border-ink-700/80 bg-ink-950/50 px-2 py-0.5 text-[11px] text-ink-200"
                            >
                              {label}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="mb-3">
                      <Label>{t('timeline.clipDuration')}</Label>
                      <div className="mt-1.5 flex gap-2">
                        {([6, 10] as const).map((sec) => {
                          const active =
                            snapVideoSeconds(
                              selected.endTime - selected.startTime
                            ) === sec
                          return (
                            <Button
                              key={sec}
                              variant={active ? 'primary' : 'secondary'}
                              className="min-w-[4.5rem] !py-1.5 text-xs"
                              disabled={busy}
                              onClick={() => void handleClipDuration(sec)}
                            >
                              {sec}s
                            </Button>
                          )
                        })}
                      </div>
                      <p className="mt-1 text-[10px] leading-relaxed text-ink-500">
                        {t('timeline.clipDurationHint')}
                      </p>
                    </div>

                    <Label>{t('stories.beatScript')}</Label>
                    <p className="mb-1 text-[10px] leading-relaxed text-ink-500">
                      {t('stories.beatScriptHint')}
                    </p>
                    {(() => {
                      const spoken = extractSpokenLines(
                        parseBeatContent(dialogue, selected.beatContentJson)
                      )
                      return spoken ? (
                        <p className="mb-1 text-[10px] text-ink-400">
                          {t('stories.beatSpokenPreview', {
                            text:
                              spoken.length > 60
                                ? `${spoken.slice(0, 60)}…`
                                : spoken
                          })}
                        </p>
                      ) : (
                        <p className="mb-1 text-[10px] text-ink-500">
                          {t('stories.beatNoSpoken')}
                        </p>
                      )
                    })()}
                    <Textarea
                      size="sm"
                      value={dialogue}
                      onChange={(e) => setDialogue(e.target.value)}
                      placeholder={t('stories.beatScriptPh')}
                      className="min-h-[8rem] font-mono text-[12px] leading-relaxed"
                    />
                    <div className="mt-3">
                      <Label>{t('timeline.revisionPrompt')}</Label>
                      <Textarea
                        size="sm"
                        value={revisionByEntry[selected.id] ?? ''}
                        onChange={(e) =>
                          setRevisionByEntry((prev) => ({
                            ...prev,
                            [selected.id]: e.target.value
                          }))
                        }
                        placeholder={t('timeline.revisionPlaceholder')}
                        className="min-h-[3.5rem]"
                      />
                      <p className="mt-1 text-[10px] leading-relaxed text-ink-500">
                        {t('timeline.revisionHint')}
                      </p>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button onClick={() => void handleSaveDialogue()}>
                        {t('common.save')}
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={() => handleRunClip(selected.id)}
                      >
                        {clipBusyId === selected.id
                          ? t('common.generating')
                          : clipGenerateLabel(
                              selected.id,
                              selected.mediaStatus
                            )}
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => void handleImportClip()}
                      >
                        {t('timeline.importClip')}
                      </Button>
                      {selected.mediaPath && (
                        <Button
                          variant="secondary"
                          onClick={() => void handleOpenClip()}
                        >
                          {t('timeline.openClip')}
                        </Button>
                      )}
                      <Button
                        variant="danger"
                        onClick={() => void handleDeleteClip()}
                      >
                        {t('common.delete')}
                      </Button>
                    </div>
                    {selected.mediaError && (
                      <p className="mt-2 text-xs text-rose-300">
                        {selected.mediaError}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="py-6 text-center text-xs text-ink-500">
                    {t('timeline.previewEmpty')}
                  </p>
                )}
                </div>
              </div>

              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-ink-800/80 bg-ink-900/30 xl:flex-1">
                <div className="flex shrink-0 items-center justify-between gap-2 border-b border-ink-800/60 px-3 py-2">
                  <h3 className="text-sm font-semibold text-ink-100">
                    {t('timeline.clipList')}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-ink-500">
                      {entries.length}
                    </span>
                    <Button
                      variant="secondary"
                      className="!px-2 !py-0.5 !text-[10px]"
                      disabled={!activeStoryId || entries.length === 0 || busy}
                      title={t('timeline.advanced.openHint')}
                      onClick={() => setAdvancedOpen(true)}
                    >
                      {t('timeline.advanced.open')}
                    </Button>
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-2">
                  {loading ? (
                    <p className="p-3 text-sm text-ink-400">
                      {t('common.loading')}
                    </p>
                  ) : entries.length === 0 ? (
                    <div className="px-3 py-8 text-center">
                      <EmptyState message={t('timeline.noEntries')} />
                      <Button
                        variant="secondary"
                        className="mt-3"
                        onClick={openStoryEditor}
                      >
                        {t('timeline.openStoryEditor')}
                      </Button>
                    </div>
                  ) : (
                    <ul className="space-y-1.5">
                      {entries.map((e) => {
                        const live = liveClipStatus[e.id]
                        const status = (live as MediaStatus) || e.mediaStatus
                        const isSelected = selectedId === e.id
                        const isGen =
                          status === 'GENERATING' || clipBusyId === e.id
                        return (
                          <li
                            key={e.id}
                            className={[
                              'cursor-pointer rounded-xl border px-2.5 py-2 transition',
                              isSelected
                                ? 'border-brand-500 bg-brand-950/30 shadow-md shadow-brand-950/20'
                                : 'border-ink-800/80 bg-ink-900/40 hover:border-ink-600',
                              isGen ? 'ring-1 ring-amber-700/40' : ''
                            ].join(' ')}
                            onClick={() => selectClip(e.id)}
                          >
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="rounded-md bg-ink-800/80 px-1.5 py-0.5 font-mono text-[10px] text-brand-300">
                                {e.startTime.toFixed(1)}–{e.endTime.toFixed(1)}s
                              </span>
                              <span className="rounded-md bg-ink-800 px-1 py-0.5 text-[10px] text-ink-300">
                                {snapVideoSeconds(e.endTime - e.startTime)}s
                              </span>
                              <span
                                className={[
                                  'rounded-full px-1.5 py-0.5 text-[9px]',
                                  mediaBadge[
                                    status in mediaBadge
                                      ? status
                                      : e.mediaStatus
                                  ]
                                ].join(' ')}
                              >
                                {tMediaStatus(t, status)}
                              </span>
                            </div>
                            <div className="mt-1 flex items-start gap-1">
                              <span className="min-w-0 flex-1 text-xs leading-snug text-ink-100 line-clamp-2">
                                {labels[e.id]}
                              </span>
                              <Button
                                variant="ghost"
                                className="!shrink-0 !px-1.5 !py-0.5 text-[10px]"
                                disabled={busy}
                                onClick={(ev) => {
                                  ev.stopPropagation()
                                  void handleRunClip(e.id)
                                }}
                              >
                                {clipBusyId === e.id
                                  ? t('common.generating')
                                  : clipGenerateLabel(e.id, e.mediaStatus)}
                              </Button>
                            </div>
                            {live && live !== e.mediaStatus && (
                              <p className="mt-0.5 text-[10px] text-amber-200">
                                → {tMediaStatus(t, live)}
                              </p>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ExportFinalDialog
        open={exportDialogOpen}
        initial={exportInitial}
        busy={exporting}
        onCancel={() => {
          if (!exporting) setExportDialogOpen(false)
        }}
        onConfirm={(opts) => void handleExportFinal(opts)}
      />

      {/* Export history — popup only (not permanent layout chrome) */}
      {exportHistoryOpen ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-overlay/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={t('timeline.exportHistory')}
          onClick={() => {
            if (!exportDeleteBusyId) setExportHistoryOpen(false)
          }}
        >
          <div
            className="flex max-h-[min(85vh,36rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-ink-700 bg-ink-950 shadow-theme-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-ink-800 px-5 py-4">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-ink-50">
                  {t('timeline.exportHistory')}
                </h2>
                <p className="mt-0.5 text-xs text-ink-500">
                  {t('timeline.exportHistoryCount', {
                    n: exportHistory.length
                  })}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button
                  variant="ghost"
                  className="!px-2 !py-1 !text-xs"
                  onClick={() => void refreshExportHistory()}
                >
                  {t('common.refresh')}
                </Button>
                <button
                  type="button"
                  className="rounded-lg px-2 py-1 text-sm text-ink-400 hover:bg-ink-800 hover:text-ink-100"
                  onClick={() => setExportHistoryOpen(false)}
                  aria-label={t('common.cancel')}
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
              {exportHistory.length === 0 ? (
                <p className="px-2 py-8 text-center text-xs leading-relaxed text-ink-500">
                  {t('timeline.exportHistoryEmpty')}
                </p>
              ) : (
                <ul className="space-y-2">
                  {exportHistory.map((item, idx) => {
                    const isLatest =
                      lastExportPath === item.path || idx === 0
                    return (
                      <li
                        key={item.id}
                        className="rounded-xl border border-ink-800/80 bg-ink-900/50 px-3 py-2.5"
                      >
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={[
                              'rounded px-1.5 py-0.5 text-[10px] font-medium',
                              item.kind === 'board'
                                ? 'bg-slate-800 text-slate-200'
                                : 'bg-brand-950/80 text-brand-100'
                            ].join(' ')}
                          >
                            {item.kind === 'board'
                              ? t('timeline.exportKindBoard')
                              : t('timeline.exportKindFinal')}
                          </span>
                          {isLatest && (
                            <span className="rounded bg-emerald-950/60 px-1.5 py-0.5 text-[10px] text-emerald-200">
                              {t('timeline.exportLatest')}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 truncate font-mono text-[12px] text-ink-100">
                          {item.fileName}
                        </p>
                        <p className="mt-0.5 text-[10px] text-ink-500">
                          {formatExportWhen(item.createdAt)}
                          {item.sizeBytes != null
                            ? ` · ${formatExportSize(item.sizeBytes)}`
                            : ''}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <Button
                            variant="secondary"
                            className="!px-2.5 !py-1 !text-[11px]"
                            onClick={() =>
                              void getApi().shell.openPath(item.path)
                            }
                          >
                            {t('pipeline.openFile')}
                          </Button>
                          <Button
                            variant="ghost"
                            className="!px-2.5 !py-1 !text-[11px]"
                            onClick={() =>
                              void getApi().shell.showItemInFolder(item.path)
                            }
                          >
                            {t('pipeline.openFolder')}
                          </Button>
                          <Button
                            variant="danger"
                            className="!px-2.5 !py-1 !text-[11px]"
                            disabled={exportDeleteBusyId === item.id}
                            loading={exportDeleteBusyId === item.id}
                            onClick={() => void handleDeleteExport(item.id)}
                          >
                            {t('common.delete')}
                          </Button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            <div className="flex shrink-0 justify-end border-t border-ink-800 bg-ink-900/40 px-5 py-3">
              <Button
                variant="ghost"
                onClick={() => setExportHistoryOpen(false)}
              >
                {t('common.cancel')}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {activeStoryId ? (
        <TimelineAdvancedStudio
          storyId={activeStoryId}
          open={advancedOpen}
          onClose={() => setAdvancedOpen(false)}
          onRefreshTimeline={() => void reload()}
          onStartVideoQueue={(entryIds, opts) => {
            startClipPrepQueue(activeStoryId, entryIds, {
              skipStillIfExists: opts?.skipStill !== false
            })
          }}
        />
      ) : null}
    </div>
  )
}
