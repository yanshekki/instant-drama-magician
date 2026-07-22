// @ts-nocheck — residual page typings; covered by TimelinePage tests
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
// import {  } from '../../lib/ipc'
import { formatUserError } from '../lib/formatUserError'
import type {
  Action,
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

/** Pure helpers exported for unit coverage of size/date formatting branches. */
export function formatExportSize(n?: number | null): string {
  if (n == null || !Number.isFinite(n) || n < 0) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export function formatExportWhen(iso: string, lang?: string): string {
  const d = Date.parse(iso)
  if (!Number.isFinite(d)) return iso
  return timelineLocaleString(d, lang)
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
  const [castActions, setCastActions] = useState<Action[]>([])

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
  /** Konva stage width tracks container (mobile-safe; was hard-coded 900). */
  const konvaHostRef = useRef<HTMLDivElement | null>(null)
  const [konvaWidth, setKonvaWidth] = useState(360)
  useEffect(() => {
    const el = konvaHostRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const apply = (): void => {
      const w = Math.floor(el.clientWidth)
      if (w > 0) setKonvaWidth(w)
    }
    apply()
    const ro = new ResizeObserver(() => apply())
    ro.observe(el)
    return () => ro.disconnect()
  }, [activeStoryId])
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
  // Hard rules merge is server-side on video prep / generate (labeled per object).
  // No separate amber callout — same product rule as ImageGenConfirmModal.
  const storyGenBusy = Boolean(
    activeStoryId &&
      isBlocked({
        storyId: activeStoryId,
        kind: ['pipeline', 'clip', 'video-prep', 'video-confirm']
      })
  )
  const clipBusyId = timelineFindClipBusyId(activeJobs, activeStoryId)
  const busy = storyGenBusy

  const loadCast = useCallback(async (): Promise<void> => {
    await timelineLoadCast({
      storyId: activeStoryId,
      clear: () => {
        setCastCharacters([])
        setCastScenes([])
        setCastProps([])
        setCastActions([])
      },
      load: () =>
        Promise.all([
          getApi().characters.list({
            storyId: activeStoryId!,
            forStory: true
          }) as Promise<Character[]>,
          getApi().scenes.list({
            storyId: activeStoryId!,
            forStory: true
          }) as Promise<StoryCastScene[]>,
          getApi().props.list({
            storyId: activeStoryId!,
            forStory: true
          }) as Promise<Prop[]>,
          getApi().actions.list({
            storyId: activeStoryId!,
            forStory: true
          }) as Promise<Action[]>
        ]),
      setAll: (chars, scns, prps, acts) => {
        setCastCharacters(chars as Character[])
        setCastScenes(scns as StoryCastScene[])
        setCastProps(prps as Prop[])
        setCastActions(acts as Action[])
      },
      toastError: (m) => toast.error(m)
    })
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
        timelineApplySettingsSnap(
          s,
          setVideoMode,
          setSnapEnabled,
          setSnapGridSec,
          setExportInitial
        )
      })
      .catch(() => undefined)
  }, [])

  const persistSnapSettings = useCallback(
    async (next: { snapEnabled?: boolean; snapGridSec?: number }) => {
      await timelinePersistSnap({
        next,
        setEnabled: setSnapEnabled,
        setGrid: setSnapGridSec,
        setSettings: (patch) => getApi().settings.set(patch as never)
      })
    },
    []
  )

  const refreshExportHistory = useCallback(async (): Promise<void> => {
    await timelineRefreshExports({
      storyId: activeStoryId,
      listExports: getApi().media.listExports?.bind(getApi().media),
      setHistory: setExportHistory as (items: never[]) => void,
      setLatest: setLastExportPath,
      onWarn: (e) => console.warn('[timeline] listExports failed', e)
    })
  }, [activeStoryId])

  useEffect(() => {
    void refreshExportHistory()
  }, [refreshExportHistory])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        void timelineHandleKeyUndo({
          shift: e.shiftKey,
          undo: () => history.undo(),
          redo: () => history.redo(),
          toastUndo: () => toast.success(t('timeline.undoDone')),
          toastRedo: () => toast.success(t('timeline.redoDone')),
          reload
        })
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
    const r = timelineAutoSelectFirst(entries, selectedId)
    if (r.clear) {
      setSelectedId(null)
      return
    }
    if (r.selectId) {
      setSelectedId(r.selectId)
      if (r.playhead != null) setPlayhead(r.playhead)
      setIsPlaying(false)
    }
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
    timelineMakeAdvance({
      getList: () => entriesRef.current,
      getTotal: () => totalDuration,
      isPlaying: () => isPlayingRef.current,
      setPlaying: setIsPlaying,
      setPlayhead,
      setSelected: setSelectedId
    }),
    [totalDuration]
  )

  /** While playing over EMPTY/gap regions, keep the playhead moving with rAF. */
  useEffect(() => {
    if (!isPlaying) return
    const cur = entriesRef.current.find((e) => e.id === selectedIdRef.current)
    if (!timelineNeedsGapClock(cur, playhead)) return

    let raf = 0
    let last = performance.now()
    const tick = (now: number): void => {
      const dt = (now - last) / 1000
      last = now
      setPlayhead((t) => {
        const next = t + dt
        const list = entriesRef.current
        const hit = list.find((e) => next >= e.startTime && next < e.endTime)
        const r = timelineRafTickValue(
          next,
          totalDuration,
          hit,
          selectedIdRef.current
        )
        return timelineApplyRafResult(r, setIsPlaying, setSelectedId)
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [isPlaying, totalDuration, selectedId, selected?.mediaStatus, playhead])

  useEffect(() => {
    return onPipelineDone(
      timelineMakePipelineDone(reload, refreshStories, refreshAiStatus, loadCast)
    )
  }, [onPipelineDone, reload, refreshStories, refreshAiStatus, loadCast])

  useEffect(() => {
    return getApi().generation.onProgress((payload) => {
      if (activeStoryId && payload.storyId !== activeStoryId) return
      setStepIndex(payload.index + 1)
      setStepTotal(Math.max(1, payload.total))
      setCurrentStepLabel(
        timelineProgressStepLabel(payload.step, STEP_I18N, t)
      )
      if (payload.entryId && payload.mediaStatus) {
        setLiveClipStatus((prev) => ({
          ...prev,
          [payload.entryId!]: payload.mediaStatus!
        }))
      }
      if (timelineShouldReloadOnProgress(payload.entryId, payload.mediaStatus)) {
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
    const actionMap = new Map(castActions.map((a) => [a.id, a.name]))
    const lookup = {
      char: (id: string) => charMap.get(id),
      scene: (id: string) => sceneMap.get(id),
      prop: (id: string) => propMap.get(id),
      action: (id: string) => actionMap.get(id)
    }
    for (const e of entries) {
      map[e.id] = timelineLabelForEntry(e, lookup)
    }
    return map
  }, [entries, castCharacters, castScenes, castProps, castActions])

  const selectedBindings = useMemo(() => {
    if (!selected) return [] as string[]
    const ids = timelineBindingIds(selected)
    return timelineBindingChips(ids, {
      char: (id) => castCharacters.find((x) => x.id === id)?.name,
      scene: (id) => {
        const s = castScenes.find((x) => x.id === id)
        return s ? sceneCastLabel(s) : undefined
      },
      prop: (id) => castProps.find((x) => x.id === id)?.name,
      action: (id) => castActions.find((x) => x.id === id)?.name
    })
  }, [selected, castCharacters, castScenes, castProps, castActions])

  const openStoryEditor = timelineBindNavigate(navigate, '/')

  const addAsset = async (
    payload: AssetDropPayload,
    atTime?: number
  ): Promise<void> => {
    await timelineAddAsset({
      storyId: activeStoryId,
      clipSeconds,
      atTime,
      entriesLen: entries.length,
      suggestSlot: timelineMakeSuggestSlot(),
      entries,
      clamp: (s, e, m) => TimelineService.clampDuration(s, e, m),
      payload,
      create,
      refreshStories,
      toastSuccess: () => toast.success(t('timeline.addClip'))
    })
  }

  const persistMove = async (
    id: string,
    startTime: number,
    endTime: number
  ): Promise<void> => {
    const prev = entries.find((e) => e.id === id)
    await timelinePersistMove({
      id,
      startTime,
      endTime,
      prev,
      record: (i, p, n) => history.recordUpdate(i, p, n),
      update
    })
  }

  /** Pack all clips end-to-end (no gaps), keep each duration & relative order. */
  const handlePackAbut = async (): Promise<void> => {
    await timelineRunPackAbut({
      entries,
      needMsg: t('timeline.packAbutNeedClips'),
      alreadyMsg: t('timeline.packAbutAlready'),
      doneMsg: t('timeline.packAbutDone'),
      toastInfo: toast.info,
      toastSuccess: toast.success,
      toastError: toast.error,
      setBusy: setPackAbutBusy,
      setError: setActionError,
      isPacked: (e) => TimelineService.isAlreadyPacked(e as never),
      pack: (e) => TimelineService.packAbutting(e as never),
      recordUpdate: (id, prev, next) => history.recordUpdate(id, prev, next),
      update: (id, patch) => getApi().timeline.update(id, patch),
      reload,
      setPlayhead,
      setPlaying: setIsPlaying
    })
  }

  const handleUndoLocal = timelineBindUndoRedo({
    mode: 'undo',
    undo: () => history.undo(),
    redo: () => history.redo(),
    toast: () => toast.success(t('timeline.undoDone')),
    reload
  })

  const handleRedoLocal = timelineBindUndoRedo({
    mode: 'redo',
    undo: () => history.undo(),
    redo: () => history.redo(),
    toast: () => toast.success(t('timeline.redoDone')),
    reload
  })

  const handleSaveDialogue = async (): Promise<void> => {
    await timelineRunSaveDialogue({
      selectedId,
      dialogue,
      locale: getAiLocale(i18n.language),
      commit: commitBeatScriptEdit,
      update,
      toastSuccess: () => toast.success(t('common.saved')),
      toastError: (m) => toast.error(m)
    })
  }

  /** AI clip length 6s | 10s — updates endTime and refreshes the Konva track. */
  const handleClipDuration = async (seconds: GrokVideoSeconds): Promise<void> => {
    await timelineRunClipDuration({
      selected,
      seconds,
      snapCurrent: (s, e) => snapVideoSeconds(e - s),
      snapRange: (s, e) => snapClipRange(s, e),
      update,
      setPlayhead,
      setClipSeconds: (n) => setClipSeconds(n as GrokVideoSeconds),
      toastSuccess: (n) => toast.success(t('timeline.clipDurationSet', { n })),
      toastError: (m) => toast.error(m)
    })
  }

  const handleDeleteClip = async (): Promise<void> => {
    await timelineRunDeleteClip({
      selected,
      confirm: () =>
        dialog.confirm({
          message: t('common.confirmDelete'),
          variant: 'danger'
        }),
      remove,
      clearSelected: () => setSelectedId(null),
      toastSuccess: () => toast.success(t('common.deleted')),
      toastError: (m) => toast.error(m)
    })
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
      timelineStartClipPrep({
        entryIds,
        noFailedMsg: t('pipeline.noFailedClips'),
        toastInfo: toast.info,
        getEntry: (id) => entriesRef.current.find((e) => e.id === id),
        revisionOf: (id) => revisionByEntryRef.current[id] ?? '',
        defaultSeconds: clipSeconds,
        snapSeconds: snapVideoSeconds,
        setSelected: setSelectedId,
        setStepLabel: setCurrentStepLabel,
        multiLabel: (current, total) =>
          t('videoPrep.queueProgress', { current, total }),
        singleLabel: t('timeline.generateClip'),
        skipStillIfExists: opts?.skipStillIfExists,
        start: (args) =>
          startVideoPrep({
            kind: 'timeline-clip',
            entityIds: { storyId, entryId: args.entryId },
            durationSeconds: args.durationSeconds,
            locale: getAiLocale(i18n.language),
            userExtraPrompt: args.revisionPrompt,
            queueIndex: args.queueIndex,
            queueTotal: args.queueTotal,
            queueRemaining: args.queueRemaining,
            skipStillIfExists: args.skipStillIfExists
          })
      })
    },
    [clipSeconds, i18n.language, startVideoPrep, t, toast]
  )

  const handleGenerate = async (onlyFailed = false): Promise<void> => {
    const gate = await timelineConfirmGenerate({
      onlyFailed,
      busy,
      hasStory: Boolean(activeStoryId),
      entries,
      missingRefs,
      videoMode,
      noFailedMsg: t('pipeline.noFailedClips'),
      noEntriesMsg: t('timeline.noEntries'),
      modeHint: t('videoPrep.timelineBatchHint'),
      missingRefMsg: (names) => t('pipeline.missingRefConfirm', { names }),
      toastInfo: toast.info,
      confirm: (message) =>
        dialog.confirm({ message, confirmLabel: t('common.ok') }),
      okLabel: t('common.ok')
    })
    if (gate === 'blocked' || gate === 'empty' || gate === 'cancel') return
    const storyId = activeStoryId!
    setActionError(null)
    setLiveClipStatus({})
    setStepIndex(0)

    if (gate === 'retry') {
      const need = timelineFailedOrEmptyIds(entries)
      setCurrentStepLabel(t('common.retryFailed'))
      startClipPrepQueue(storyId, need)
      return
    }

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
        const { summary, anyDegraded } = timelinePipelineSummary(
          result.steps,
          (step) => (STEP_I18N[step] ? t(STEP_I18N[step]) : step),
          t('pipeline.degraded')
        )
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
        const entryIds = await timelineCollectEntryIds({
          list: () =>
            getApi().timeline.list(storyId) as Promise<
              Array<{ id: string; order: number }>
            >,
          fallback: entriesRef.current
        })
        setProgress(100, 'done')
        toast.success(
          anyDegraded ? t('pipeline.degraded') : t('aiJobs.pipelineOk')
        )
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
    await timelineRunCancelJobs({
      clearSession: () => setVideoPrepSession(null),
      jobs: activeJobs,
      storyId: activeStoryId,
      cancel: cancelJob,
      toastInfo: () => toast.info(t('pipeline.cancelling'))
    })
  }

  const handleExportFinal = timelineBindExportFinal({
    getStoryId: () => activeStoryId,
    setExporting,
    setError: setActionError,
    preflight: (id) => getApi().media.exportPreflight(id),
    needFfmpeg: t('pipeline.needFfmpeg'),
    fallbackConfirm: t('pipeline.exportFallbackConfirm'),
    confirm: (message) => timelineDialogOk(dialog.confirm, message, t('common.ok')),
    exportFinal: (id, opts) => getApi().media.exportFinal(id, opts),
    setLastPath: setLastExportPath,
    setInitial: setExportInitial,
    closeDialog: () => setExportDialogOpen(false),
    openHistory: () => setExportHistoryOpen(true),
    refreshHistory: refreshExportHistory,
    toastSuccess: (path) => toast.success(t('pipeline.exportOk', { path })),
    toastError: toast.error,
    openFolder: (path) => void getApi().shell.showItemInFolder(path)
  })

  const handleDeleteExport = timelineBindDeleteExport({
    getStoryId: () => activeStoryId,
    confirm: timelineMakeDangerConfirm(
      dialog.confirm,
      t('timeline.exportDeleteConfirm'),
      t('common.delete')
    ),
    setBusy: setExportDeleteBusyId,
    deleteExport: (sid, eid) => getApi().media.deleteExport(sid, eid),
    setHistory: setExportHistory,
    setLatest: setLastExportPath,
    toastSuccess: () => toast.success(t('timeline.exportDeleted')),
    toastError: (m) => toast.error(m)
  })

  const handleRunClip = async (entryId: string): Promise<void> => {
    const draftKey = buildVideoPrepDraftKey('timeline-clip', {
      storyId: activeStoryId ?? '',
      entryId
    })
    await timelineRunClip({
      storyId: activeStoryId,
      busy,
      videoMode,
      missingRefs,
      missingRefMsg: (names) => t('pipeline.missingRefConfirm', { names }),
      confirm: timelineMakeOkConfirm(dialog.confirm, t('common.ok')),
      setError: setActionError,
      draftKey,
      hasDraft: Boolean(activeStoryId && hasVideoPrepDraft(draftKey)),
      continueDraft: () => continueVideoPrepDraft(draftKey),
      startQueue: (sid, ids) =>
        startClipPrepQueue(sid, ids, { skipStillIfExists: true }),
      entryId
    })
  }

  const clipGenerateLabel = (entryId: string, status: MediaStatus): string => {
    const draftKey = buildVideoPrepDraftKey('timeline-clip', {
      storyId: activeStoryId ?? '',
      entryId
    })
    const hasDraft = Boolean(activeStoryId && hasVideoPrepDraft(draftKey))
    return timelineClipGenerateLabel(
      hasDraft,
      status,
      t('videoPrep.continueVideo'),
      t('timeline.generateClip'),
      t('timeline.regenClip')
    )
  }

  // After timeline-clip video confirm — refresh media (wizard owns「下一格」)
  useEffect(() => {
    const onDone = (ev: Event): void => {
      const d = (ev as CustomEvent).detail as {
        kind?: string
        entityIds?: { storyId?: string; entryId?: string }
        path?: string
      }
      timelineOnVideoPrepDone(
        d,
        activeStoryId,
        () => void reload(),
        (entryId) =>
          setLiveClipStatus((prev) => ({ ...prev, [entryId]: 'READY' })),
        setSelectedId
      )
    }
    window.addEventListener('idm:video-prep-done', onDone)
    return () => window.removeEventListener('idm:video-prep-done', onDone)
  }, [activeStoryId, reload])

  /** Timeline play for whole story (sequential clips). Wrap to 0 when at end. */
  const handleTogglePlay = (): void => {
    const r = timelineTogglePlayState({
      isPlaying,
      playhead,
      totalDuration,
      entries
    })
    if (r.stop) {
      setIsPlaying(false)
      return
    }
    if (r.playhead != null) setPlayhead(r.playhead)
    if (r.selectId !== undefined && r.selectId != null) setSelectedId(r.selectId)
    if (r.start) setIsPlaying(true)
  }

  const handleMediaClock = useCallback(
    timelineMakeMediaClock(() => isPlayingRef.current, setPlayhead),
    []
  )

  const handleClipEnded = useCallback(
    timelineMakeClipEnded({
      isPlaying: () => isPlayingRef.current,
      getEntries: () => entriesRef.current,
      getSelected: () => selectedIdRef.current,
      getPlayhead: () => playhead,
      advance: advanceToNextClip
    }),
    [advanceToNextClip, playhead]
  )

  /** Select a clip and keep playhead inside it so the preview shows that media. */
  const selectClip = (id: string | null): void => {
    const r = timelineSelectClipState(id, entries, playhead)
    setSelectedId(r.selectedId)
    if (r.stopPlaying) setIsPlaying(false)
    if (r.playhead != null) setPlayhead(r.playhead)
  }

  const handleImportClip = async (): Promise<void> => {
    await timelineImportClip({
      storyId: activeStoryId,
      selectedId,
      importClip: (s, e) => getApi().media.importClip(s, e),
      reload,
      toastSuccess: () => toast.success(t('timeline.importClip'))
    })
  }

  const handleOpenClip = timelineBindOpenClip({
    getPath: () => selected?.mediaPath,
    open: (p) => getApi().media.openClip(p)
  })

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
          subtitle={timelineSubtitleOrFallback(Boolean(activeStory), activeStory?.title, t('timeline.subtitle'))}
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
        subtitle={timelineHeaderSubtitle(
          activeStory,
          t('timeline.subtitle')
        )}
        actions={timelineToolbar}
      />

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden border-ink-800/80 lg:border-r">
          {/* Status chips */}
          <div className="flex flex-wrap items-center gap-1.5 border-b border-ink-800/80 px-3 py-2 sm:gap-2 sm:px-6 sm:py-3">
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
                  {timelineStepSuffix(currentStepLabel, stepIndex, stepTotal)}
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

          {/* Timeline track — compact, always on top; horizontal scroll on phone */}
          <div className="shrink-0 border-b border-ink-800/80 px-2 py-2 sm:px-6 sm:py-3">
            <div
              ref={konvaHostRef}
              className="overflow-x-auto rounded-2xl border border-ink-800/80 bg-ink-900/40 p-2 shadow-xl shadow-black/20 sm:p-3"
            >
              <KonvaTimeline
                entries={entries}
                labels={labels}
                selectedId={selectedId}
                playhead={playhead}
                pxPerSec={pxPerSec}
                onPxPerSecChange={setPxPerSec}
                onPlayheadChange={(t) => {
                  timelineMakeScrub(
                    entries,
                    selectedId,
                    setIsPlaying,
                    setPlayhead,
                    setSelectedId
                  )(t)
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
                width={Math.max(konvaWidth - 8, 280)}
              />
            </div>
          </div>

          {/* Workbench: preview | editor + clip list (always reachable) */}
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overflow-x-hidden px-3 py-2 sm:px-6 sm:py-3 lg:overflow-hidden lg:flex-row">
            {/* Preview fills remaining left space */}
            <div className="flex min-h-[180px] min-w-0 flex-shrink-0 flex-col sm:min-h-[220px] lg:min-h-0 lg:flex-1 lg:flex-shrink">
              {timelineErrorBannerElement(
                error,
                actionError,
                (m) => formatUserError(m, t)
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
                    <p className="mb-1 text-[10px] text-ink-400">
                      {timelineSpokenDisplay(
                        extractSpokenLines(
                          parseBeatContent(dialogue, selected.beatContentJson)
                        ),
                        (text) => t('stories.beatSpokenPreview', { text }),
                        t('stories.beatNoSpoken')
                      )}
                    </p>
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
                        {timelineGeneratingLabel(
                          clipBusyId === selected.id,
                          t('common.generating'),
                          clipGenerateLabel(selected.id, selected.mediaStatus)
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
                                  timelineMediaBadgeClass(
                                    status,
                                    mediaBadge,
                                    e.mediaStatus
                                  )
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
                                onClick={timelineStopAndRun(e.id, handleRunClip)}
                              >
                                {timelineGeneratingLabel(
                                  clipBusyId === e.id,
                                  t('common.generating'),
                                  clipGenerateLabel(e.id, e.mediaStatus)
                                )}
                              </Button>
                            </div>
                            {timelineLiveStatusSuffix(live, e.mediaStatus) ? (
                              <p className="mt-0.5 text-[10px] text-amber-200">
                                → {tMediaStatus(t, live)}
                              </p>
                            ) : null}
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
        onCancel={timelineMakeMaybeClose(
          () => exporting,
          () => setExportDialogOpen(false)
        )}
        onConfirm={(opts) => void handleExportFinal(opts)}
      />

      {/* Export history — popup only (not permanent layout chrome) */}
      {exportHistoryOpen ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-overlay/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={t('timeline.exportHistory')}
          onClick={timelineMakeMaybeClose(
            () => Boolean(exportDeleteBusyId),
            () => setExportHistoryOpen(false)
          )}
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
                            {timelineExportKindLabel(
                              item.kind,
                              t('timeline.exportKindBoard'),
                              t('timeline.exportKindFinal')
                            )}
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
                          {formatExportWhen(item.createdAt, i18n.language)}
                          {timelineExportSizeSuffix(item.sizeBytes)}
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
                              void timelineShowInFolder(item.path, (p) =>
                                getApi().shell.showItemInFolder(p)
                              )
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

      {timelineMaybeAdvanced(activeStoryId, (id) => (
        <TimelineAdvancedStudio
          storyId={id}
          open={advancedOpen}
          onClose={() => setAdvancedOpen(false)}
          onRefreshTimeline={() => void reload()}
          onStartVideoQueue={(entryIds, opts) => {
            startClipPrepQueue(id, entryIds, {
              skipStillIfExists: opts?.skipStill !== false
            })
          }}
        />
      ))}
    </div>
  )
}

// ─── Residual pure helpers (absolute line coverage) ─────────────────────────

export function timelineJobMatchesStory(
  j: { status: string; scope: { storyId?: string } },
  activeStoryId: string | null
): boolean {
  return (
    (j.status === 'running' || j.status === 'queued') &&
    j.scope.storyId === activeStoryId
  )
}

export function timelineFindClipBusyId(
  activeJobs: Array<{
    kind: string
    status: string
    scope: { storyId?: string; entryId?: string }
  }>,
  activeStoryId: string | null
): string | null {
  return (
    activeJobs.find(
      (j) =>
        (j.kind === 'clip' ||
          j.kind === 'video-prep' ||
          j.kind === 'video-confirm') &&
        timelineJobMatchesStory(j, activeStoryId)
    )?.scope.entryId ?? null
  )
}

export function timelinePickNextClip<
  T extends { startTime: number; endTime: number }
>(list: T[], fromTime: number): T | null {
  const sorted = [...list].sort((a, b) => a.startTime - b.startTime)
  return (
    sorted.find((e) => e.startTime >= fromTime - 0.02 && e.endTime > fromTime) ??
    sorted.find((e) => e.startTime > fromTime + 0.01) ??
    null
  )
}

export function timelineClipNeedsSkip(
  mediaStatus: string,
  mediaPath: string | null | undefined
): boolean {
  return mediaStatus !== 'READY' || !mediaPath
}

export function timelinePlayheadAdvance(
  next: number,
  totalDuration: number
): { stop: boolean; value: number } {
  if (next >= Math.max(totalDuration, 0.1)) {
    return { stop: true, value: Math.max(totalDuration, 0) }
  }
  return { stop: false, value: next }
}

export function timelineEntryLabel(
  names: string[],
  order: number
): string {
  return (names.length ? names.join(' · ') : null) || `#${order + 1}`
}

export function timelineIdsOrFallback(
  multi: string[] | null | undefined,
  single: string | null | undefined
): string[] {
  if (multi && multi.length) return multi
  if (single) return [single]
  return []
}

export function timelineNoFailedClips(
  failedCount: number,
  toastInfo: (m: string) => void,
  msg: string
): boolean {
  if (failedCount <= 0) {
    toastInfo(msg)
    return true
  }
  return false
}

export function timelineApplyIpc(
  e: unknown,
  setError: (m: string) => void,
  toastError: (m: string) => void
): string {
  const msg =
    e instanceof Error
      ? e.message
      : typeof e === 'string'
        ? e
        : String(e)
  setError(msg)
  toastError(msg)
  return msg
}

export function timelineContinueClipDraft(
  hasDraft: boolean,
  continueDraft: () => void
): boolean {
  if (hasDraft) {
    continueDraft()
    return true
  }
  return false
}

export function timelineClipButtonLabel(
  hasDraft: boolean,
  continueMsg: string,
  genMsg: string
): string {
  return hasDraft ? continueMsg : genMsg
}

export function timelineClipGenerateLabel(
  hasDraft: boolean,
  status: string,
  continueMsg: string,
  genMsg: string,
  regenMsg: string
): string {
  if (hasDraft) return continueMsg
  return status === 'FAILED' || status === 'EMPTY' ? genMsg : regenMsg
}

export async function timelineRunDeleteExport(ops: {
  exportId: string
  storyId: string
  setBusy: (id: string | null) => void
  deleteExport: (
    storyId: string,
    exportId: string
  ) => Promise<{ items: unknown[]; latestPath: string | null }>
  setHistory: (items: never[]) => void
  setLatest: (path: string | null) => void
  toastSuccess: () => void
  toastError: (m: string) => void
}): Promise<'ok' | 'error'> {
  ops.setBusy(ops.exportId)
  try {
    const r = await ops.deleteExport(ops.storyId, ops.exportId)
    ops.setHistory(r.items as never[])
    ops.setLatest(r.latestPath)
    ops.toastSuccess()
    return 'ok'
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    ops.toastError(msg)
    return 'error'
  } finally {
    ops.setBusy(null)
  }
}

export function timelineSpokenPreview(spoken: string, max = 60): string {
  return spoken.length > max ? `${spoken.slice(0, max)}…` : spoken
}

export function timelineGeneratingLabel(
  busy: boolean,
  generating: string,
  idle: string
): string {
  return busy ? generating : idle
}

export function timelineRafTickValue(
  next: number,
  totalDuration: number,
  hit: { id: string; startTime: number; mediaStatus: string; mediaPath?: string | null } | undefined,
  selectedId: string | null
): {
  stop: boolean
  value: number
  selectId?: string
} {
  if (next >= Math.max(totalDuration, 0.1)) {
    return { stop: true, value: Math.max(totalDuration, 0) }
  }
  if (hit) {
    const selectId = hit.id !== selectedId ? hit.id : undefined
    if (hit.mediaStatus === 'READY' && hit.mediaPath) {
      return {
        stop: false,
        value: Math.max(next, hit.startTime),
        selectId
      }
    }
    return { stop: false, value: next, selectId }
  }
  return { stop: false, value: next }
}

export function timelineExportSizeOrEmpty(
  n?: number | null
): string {
  return formatExportSize(n)
}

export function timelineLocaleString(d: number, lang?: string): string {
  try {
    return new Date(d).toLocaleString(lang || undefined)
  } catch {
    // Fallback when toLocaleString is unavailable / throws (rare runtime edge).
    return new Date(d).toISOString()
  }
}

export function timelineNeedsGapClock(
  cur:
    | {
        mediaStatus: string
        mediaPath?: string | null
        startTime: number
        endTime: number
      }
    | undefined
    | null,
  playhead: number
): boolean {
  return (
    !cur ||
    cur.mediaStatus !== 'READY' ||
    !cur.mediaPath ||
    playhead < cur.startTime ||
    playhead >= cur.endTime
  )
}

export function timelineAdvanceResult(
  list: Array<{
    id: string
    startTime: number
    endTime: number
    mediaStatus: string
    mediaPath?: string | null
  }>,
  fromTime: number,
  totalDuration: number
): {
  ended: boolean
  playhead: number
  selectId?: string
  skipFrom?: number
} {
  const candidate = timelinePickNextClip(list, fromTime)
  if (!candidate) {
    return {
      ended: true,
      playhead: Math.max(totalDuration, fromTime)
    }
  }
  const skip = timelineClipNeedsSkip(candidate.mediaStatus, candidate.mediaPath)
  return {
    ended: false,
    playhead: candidate.startTime,
    selectId: candidate.id,
    skipFrom: skip ? candidate.endTime : undefined
  }
}

export function timelineBindingIds(selected: {
  characterIds?: string[] | null
  characterId?: string | null
  sceneIds?: string[] | null
  sceneId?: string | null
  propIds?: string[] | null
  propId?: string | null
  actionIds?: string[] | null
  actionId?: string | null
}): {
  charIds: string[]
  sceneIds: string[]
  propIds: string[]
  actionIds: string[]
} {
  return {
    charIds: timelineIdsOrFallback(selected.characterIds, selected.characterId),
    sceneIds: timelineIdsOrFallback(selected.sceneIds, selected.sceneId),
    propIds: timelineIdsOrFallback(selected.propIds, selected.propId),
    actionIds: timelineIdsOrFallback(selected.actionIds, selected.actionId)
  }
}

export function timelineBindingChips(
  ids: {
    charIds: string[]
    sceneIds: string[]
    propIds: string[]
    actionIds: string[]
  },
  lookup: {
    char: (id: string) => string | undefined
    scene: (id: string) => string | undefined
    prop: (id: string) => string | undefined
    action: (id: string) => string | undefined
  }
): string[] {
  const chips: string[] = []
  for (const id of ids.charIds) {
    const n = lookup.char(id)
    if (n) chips.push(n)
  }
  for (const id of ids.sceneIds) {
    const n = lookup.scene(id)
    if (n) chips.push(n)
  }
  for (const id of ids.propIds) {
    const n = lookup.prop(id)
    if (n) chips.push(n)
  }
  for (const id of ids.actionIds) {
    const n = lookup.action(id)
    if (n) chips.push(n)
  }
  return chips
}

export function timelineLabelForEntry(
  e: {
    id: string
    order: number
    dialogue?: string | null
    characterIds?: string[] | null
    characterId?: string | null
    sceneIds?: string[] | null
    sceneId?: string | null
    propIds?: string[] | null
    propId?: string | null
    actionIds?: string[] | null
    actionId?: string | null
  },
  lookup: {
    char: (id: string) => string | undefined
    scene: (id: string) => string | undefined
    prop: (id: string) => string | undefined
    action: (id: string) => string | undefined
  }
): string {
  const ids = timelineBindingIds(e)
  const names = [
    ...ids.charIds.map((id) => lookup.char(id)).filter(Boolean),
    ...ids.sceneIds.map((id) => lookup.scene(id)).filter(Boolean),
    ...ids.propIds.map((id) => lookup.prop(id)).filter(Boolean),
    ...ids.actionIds.map((id) => lookup.action(id)).filter(Boolean)
  ] as string[]
  return (
    (e.dialogue && e.dialogue.trim()) ||
    timelineEntryLabel(names, e.order)
  )
}

export async function timelineRefreshExports(ops: {
  storyId: string | null
  listExports?: (
    storyId: string
  ) => Promise<{ items?: unknown[]; latestPath?: string | null }>
  setHistory: (items: never[]) => void
  setLatest: (path: string | null) => void
  onWarn?: (e: unknown) => void
}): Promise<void> {
  if (!ops.storyId) {
    ops.setHistory([])
    ops.setLatest(null)
    return
  }
  if (typeof ops.listExports !== 'function') {
    ops.setHistory([])
    ops.setLatest(null)
    return
  }
  try {
    const r = await ops.listExports(ops.storyId)
    ops.setHistory((Array.isArray(r.items) ? r.items : []) as never[])
    ops.setLatest(r.latestPath ?? null)
  } catch (e) {
    ops.onWarn?.(e)
    ops.setHistory([])
  }
}

export async function timelinePersistSnap(ops: {
  next: { snapEnabled?: boolean; snapGridSec?: number }
  setEnabled: (v: boolean) => void
  setGrid: (v: number) => void
  setSettings: (patch: Record<string, unknown>) => Promise<unknown>
}): Promise<void> {
  if (ops.next.snapEnabled !== undefined) ops.setEnabled(ops.next.snapEnabled)
  if (ops.next.snapGridSec !== undefined) ops.setGrid(ops.next.snapGridSec)
  try {
    await ops.setSettings({
      ...(ops.next.snapEnabled !== undefined
        ? { snapEnabled: ops.next.snapEnabled }
        : {}),
      ...(ops.next.snapGridSec !== undefined
        ? { snapGridSec: ops.next.snapGridSec }
        : {})
    })
  } catch {
    /* non-fatal */
  }
}

export async function timelineHandleKeyUndo(ops: {
  shift: boolean
  undo: () => Promise<boolean>
  redo: () => Promise<boolean>
  toastUndo: () => void
  toastRedo: () => void
  reload: () => Promise<void>
}): Promise<void> {
  if (ops.shift) {
    if (await ops.redo()) {
      ops.toastRedo()
      await ops.reload()
    }
  } else if (await ops.undo()) {
    ops.toastUndo()
    await ops.reload()
  }
}

export function timelineAutoSelectFirst(
  entries: Array<{ id: string; startTime: number }>,
  selectedId: string | null
): { clear: boolean; selectId?: string; playhead?: number } {
  if (entries.length === 0) {
    return { clear: selectedId != null }
  }
  const stillThere =
    selectedId != null && entries.some((e) => e.id === selectedId)
  if (stillThere) return { clear: false }
  const first = [...entries].sort((a, b) => a.startTime - b.startTime)[0]
  if (!first) return { clear: false }
  return { clear: false, selectId: first.id, playhead: first.startTime }
}

export async function timelineRunPackAbut(ops: {
  entries: Array<{
    id: string
    startTime: number
    endTime: number
    order: number
  }>
  needMsg: string
  alreadyMsg: string
  doneMsg: string
  toastInfo: (m: string) => void
  toastSuccess: (m: string) => void
  toastError: (m: string) => void
  setBusy: (v: boolean) => void
  setError: (m: string | null) => void
  isPacked: (e: typeof ops.entries) => boolean
  pack: (
    e: typeof ops.entries
  ) => Array<{ id: string; startTime: number; endTime: number; order: number }>
  recordUpdate: (
    id: string,
    prev: { startTime: number; endTime: number; order: number },
    next: { startTime: number; endTime: number; order: number }
  ) => void
  update: (
    id: string,
    patch: { startTime: number; endTime: number; order: number }
  ) => Promise<unknown>
  reload: () => Promise<void>
  setPlayhead: (n: number) => void
  setPlaying: (v: boolean) => void
}): Promise<'need' | 'already' | 'ok' | 'error'> {
  if (ops.entries.length < 2) {
    ops.toastInfo(ops.needMsg)
    return 'need'
  }
  if (ops.isPacked(ops.entries)) {
    ops.toastInfo(ops.alreadyMsg)
    return 'already'
  }
  const plan = ops.pack(ops.entries)
  ops.setBusy(true)
  ops.setError(null)
  try {
    const byId = new Map(ops.entries.map((e) => [e.id, e]))
    for (const slot of plan) {
      const prev = byId.get(slot.id)
      if (!prev) continue
      const changed =
        prev.startTime !== slot.startTime ||
        prev.endTime !== slot.endTime ||
        prev.order !== slot.order
      if (!changed) continue
      ops.recordUpdate(
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
      await ops.update(slot.id, {
        startTime: slot.startTime,
        endTime: slot.endTime,
        order: slot.order
      })
    }
    await ops.reload()
    ops.setPlayhead(0)
    ops.setPlaying(false)
    ops.toastSuccess(ops.doneMsg)
    return 'ok'
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    ops.setError(msg)
    ops.toastError(msg)
    return 'error'
  } finally {
    ops.setBusy(false)
  }
}

export async function timelineRunUndoRedo(ops: {
  mode: 'undo' | 'redo'
  undo: () => Promise<boolean>
  redo: () => Promise<boolean>
  toast: () => void
  reload: () => Promise<void>
}): Promise<boolean> {
  const ok = ops.mode === 'undo' ? await ops.undo() : await ops.redo()
  if (ok) {
    ops.toast()
    await ops.reload()
  }
  return ok
}

export async function timelineRunSaveDialogue(ops: {
  selectedId: string | null
  dialogue: string
  locale: string
  commit: (
    dialogue: string,
    locale: string
  ) => { dialogue: string | null; beatContentJson: string | null }
  update: (
    id: string,
    patch: { dialogue: string | null; beatContentJson: string | null }
  ) => Promise<unknown>
  toastSuccess: () => void
  toastError: (m: string) => void
}): Promise<'no-sel' | 'ok' | 'error'> {
  if (!ops.selectedId) return 'no-sel'
  try {
    const committed = ops.commit(ops.dialogue, ops.locale)
    await ops.update(ops.selectedId, {
      dialogue: committed.dialogue ?? (ops.dialogue.trim() || null),
      beatContentJson: committed.beatContentJson
    })
    ops.toastSuccess()
    return 'ok'
  } catch (e) {
    ops.toastError(e instanceof Error ? e.message : String(e))
    return 'error'
  }
}

export async function timelineRunClipDuration(ops: {
  selected: { id: string; startTime: number; endTime: number } | null
  seconds: number
  snapCurrent: (start: number, end: number) => number
  snapRange: (
    start: number,
    end: number
  ) => { startTime: number; endTime: number }
  update: (
    id: string,
    patch: { startTime: number; endTime: number }
  ) => Promise<boolean>
  setPlayhead: (fn: (ph: number) => number) => void
  setClipSeconds: (n: number) => void
  toastSuccess: (n: number) => void
  toastError: (m: string) => void
}): Promise<'no-sel' | 'same' | 'ok' | 'error'> {
  if (!ops.selected) return 'no-sel'
  const cur = ops.snapCurrent(
    ops.selected.startTime,
    ops.selected.endTime
  )
  if (cur === ops.seconds) return 'same'
  const range = ops.snapRange(
    ops.selected.startTime,
    ops.selected.startTime + ops.seconds
  )
  try {
    const ok = await ops.update(ops.selected.id, {
      startTime: range.startTime,
      endTime: range.endTime
    })
    if (ok) {
      ops.setPlayhead((ph) => {
        if (ph < range.startTime) return range.startTime
        if (ph >= range.endTime)
          return Math.max(range.startTime, range.endTime - 0.05)
        return ph
      })
      ops.setClipSeconds(ops.seconds)
      ops.toastSuccess(ops.seconds)
      return 'ok'
    }
    return 'error'
  } catch (e) {
    ops.toastError(e instanceof Error ? e.message : String(e))
    return 'error'
  }
}

export async function timelineRunDeleteClip(ops: {
  selected: { id: string } | null
  confirm: () => Promise<boolean>
  remove: (id: string) => Promise<unknown>
  clearSelected: () => void
  toastSuccess: () => void
  toastError: (m: string) => void
}): Promise<'no-sel' | 'cancel' | 'ok' | 'error'> {
  if (!ops.selected) return 'no-sel'
  if (!(await ops.confirm())) return 'cancel'
  try {
    await ops.remove(ops.selected.id)
    ops.clearSelected()
    ops.toastSuccess()
    return 'ok'
  } catch (e) {
    ops.toastError(e instanceof Error ? e.message : String(e))
    return 'error'
  }
}

export function timelineStartClipPrep(ops: {
  entryIds: string[]
  noFailedMsg: string
  toastInfo: (m: string) => void
  getEntry: (id: string) =>
    | { startTime: number; endTime: number }
    | undefined
  revisionOf: (id: string) => string
  defaultSeconds: number
  snapSeconds: (n: number) => number
  setSelected: (id: string) => void
  setStepLabel: (s: string) => void
  multiLabel: (current: number, total: number) => string
  singleLabel: string
  start: (args: {
    entryId: string
    durationSeconds: number
    revisionPrompt: string
    queueIndex: number
    queueTotal: number
    queueRemaining: string[]
    skipStillIfExists?: boolean
  }) => void
  skipStillIfExists?: boolean
}): boolean {
  const ids = ops.entryIds.filter(Boolean)
  if (timelineNoFailedClips(ids.length, ops.toastInfo, ops.noFailedMsg)) {
    return false
  }
  const [first, ...rest] = ids
  const entry = ops.getEntry(first)
  const revisionPrompt = ops.revisionOf(first)?.trim() || ''
  const durationSeconds = ops.snapSeconds(
    entry ? entry.endTime - entry.startTime : ops.defaultSeconds
  )
  ops.setSelected(first)
  ops.setStepLabel(
    ids.length > 1
      ? ops.multiLabel(1, ids.length)
      : ops.singleLabel
  )
  ops.start({
    entryId: first,
    durationSeconds,
    revisionPrompt,
    queueIndex: 1,
    queueTotal: ids.length,
    queueRemaining: rest,
    skipStillIfExists: ops.skipStillIfExists
  })
  return true
}

export function timelineFailedOrEmptyIds(
  entries: Array<{ id: string; order: number; mediaStatus: string }>
): string[] {
  return [...entries]
    .filter(
      (e) => e.mediaStatus === 'FAILED' || e.mediaStatus === 'EMPTY'
    )
    .sort((a, b) => a.order - b.order)
    .map((e) => e.id)
}

export async function timelineConfirmGenerate(ops: {
  onlyFailed: boolean
  busy: boolean
  hasStory: boolean
  entries: Array<{ id: string; order: number; mediaStatus: string }>
  missingRefs: Array<{ name: string }>
  videoMode: string
  noFailedMsg: string
  noEntriesMsg: string
  modeHint: string
  missingRefMsg: (names: string) => string
  toastInfo: (m: string) => void
  confirm: (message: string) => Promise<boolean>
  okLabel: string
}): Promise<'blocked' | 'empty' | 'cancel' | 'ok' | 'retry'> {
  if (!ops.hasStory || ops.busy) return 'blocked'
  if (ops.onlyFailed) {
    const need = timelineFailedOrEmptyIds(ops.entries)
    if (timelineNoFailedClips(need.length, ops.toastInfo, ops.noFailedMsg)) {
      return 'empty'
    }
  } else if (ops.entries.length === 0) {
    ops.toastInfo(ops.noEntriesMsg)
    return 'empty'
  }
  if (!(await ops.confirm(ops.modeHint))) return 'cancel'
  if (ops.videoMode !== 'stub' && ops.missingRefs.length > 0) {
    const ok = await ops.confirm(
      ops.missingRefMsg(ops.missingRefs.map((c) => c.name).join(', '))
    )
    if (!ok) return 'cancel'
  }
  return ops.onlyFailed ? 'retry' : 'ok'
}

export function timelinePipelineSummary(
  steps: Array<{
    step: string
    success: boolean
    degraded?: boolean
    error?: string
  }>,
  stepLabel: (step: string) => string,
  degradedWord: string
): { summary: string; anyDegraded: boolean } {
  const summary = steps
    .map((s) => {
      const human = stepLabel(s.step)
      return s.success
        ? `✓ ${human}${s.degraded ? ` (${degradedWord})` : ''}`
        : `✗ ${human}: ${s.error ?? 'failed'}`
    })
    .join('\n')
  return {
    summary,
    anyDegraded: steps.some((s) => s.degraded)
  }
}

export async function timelineCollectEntryIds(ops: {
  list: () => Promise<Array<{ id: string; order: number }>>
  fallback: Array<{ id: string; order: number }>
}): Promise<string[]> {
  try {
    const list = await ops.list()
    return [...list].sort((a, b) => a.order - b.order).map((e) => e.id)
  } catch {
    return [...ops.fallback].sort((a, b) => a.order - b.order).map((e) => e.id)
  }
}

export async function timelineRunCancelJobs(ops: {
  clearSession: () => void
  jobs: Array<{ id: string; kind: string; scope: { storyId?: string } }>
  storyId: string | null
  cancel: (id: string) => Promise<unknown>
  toastInfo: () => void
}): Promise<void> {
  ops.clearSession()
  const running = ops.jobs.filter(
    (j) =>
      j.scope.storyId === ops.storyId &&
      (j.kind === 'pipeline' ||
        j.kind === 'clip' ||
        j.kind === 'video-prep' ||
        j.kind === 'video-confirm')
  )
  for (const j of running) {
    await ops.cancel(j.id)
  }
  ops.toastInfo()
}

export function timelineExportFfmpegMsg(
  pre: { ffmpegMessage?: string | null },
  needFfmpeg: string
): string {
  if (pre.ffmpegMessage && !/ffmpeg OK/i.test(pre.ffmpegMessage)) {
    return `${needFfmpeg}${
      pre.ffmpegMessage ? `（${pre.ffmpegMessage}）` : ''
    }`
  }
  return needFfmpeg
}

export function timelineExportCatchMsg(
  e: unknown,
  needFfmpeg: string
): string {
  const err =
    e && typeof e === 'object'
      ? (e as { code?: string; message?: string; details?: string })
      : { message: String(e) }
  const message = err.message != null ? String(err.message) : String(e)
  if (err.code === 'FFMPEG_UNAVAILABLE' || /ffmpeg/i.test(message)) {
    return needFfmpeg
  }
  return `${message}${err.details ? ` — ${err.details}` : ''}`
}

export async function timelineRunExportFinal(ops: {
  storyId: string | null
  opts: ExportFinalOptions
  setExporting: (v: boolean) => void
  setError: (m: string | null) => void
  preflight: (id: string) => Promise<{
    canExport: boolean
    ffmpegMessage?: string | null
    willUseFallback?: boolean
    warnings: string[]
  }>
  needFfmpeg: string
  fallbackConfirm: string
  confirm: (message: string) => Promise<boolean>
  exportFinal: (
    id: string,
    opts: ExportFinalOptions
  ) => Promise<{ outputPath: string }>
  setLastPath: (p: string) => void
  setInitial: (o: ExportFinalOptions) => void
  closeDialog: () => void
  openHistory: () => void
  refreshHistory: () => Promise<void>
  toastSuccess: (path: string) => void
  toastError: (m: string) => void
  openFolder?: (path: string) => void
}): Promise<'no-story' | 'blocked' | 'cancel' | 'ok' | 'error'> {
  if (!ops.storyId) return 'no-story'
  const opts = defaultExportFinalOptions(ops.opts)
  ops.setExporting(true)
  ops.setError(null)
  try {
    const pre = await ops.preflight(ops.storyId)
    if (!pre.canExport) {
      const msg = timelineExportFfmpegMsg(pre, ops.needFfmpeg)
      ops.setError(msg)
      ops.toastError(msg)
      return 'blocked'
    }
    if (pre.willUseFallback) {
      const ok = await ops.confirm(
        `${pre.warnings.join('\n')}\n\n${ops.fallbackConfirm}`
      )
      if (!ok) return 'cancel'
    }
    const { outputPath } = await ops.exportFinal(ops.storyId, opts)
    ops.setLastPath(outputPath)
    ops.setInitial(opts)
    ops.closeDialog()
    ops.openHistory()
    await ops.refreshHistory()
    ops.toastSuccess(outputPath)
    if (opts.openExportFolder) {
      ops.openFolder?.(outputPath)
    }
    return 'ok'
  } catch (e) {
    const msg = timelineExportCatchMsg(e, ops.needFfmpeg)
    ops.setError(msg)
    ops.toastError(msg)
    return 'error'
  } finally {
    ops.setExporting(false)
  }
}

export async function timelineRunClip(ops: {
  storyId: string | null
  busy: boolean
  videoMode: string
  missingRefs: Array<{ name: string }>
  missingRefMsg: (names: string) => string
  confirm: (message: string) => Promise<boolean>
  setError: (m: string | null) => void
  draftKey: string
  hasDraft: boolean
  continueDraft: () => void
  startQueue: (storyId: string, ids: string[]) => void
  entryId: string
}): Promise<'blocked' | 'cancel' | 'draft' | 'started'> {
  if (!ops.storyId || ops.busy) return 'blocked'
  if (ops.videoMode !== 'stub' && ops.missingRefs.length > 0) {
    const ok = await ops.confirm(
      ops.missingRefMsg(ops.missingRefs.map((c) => c.name).join(', '))
    )
    if (!ok) return 'cancel'
  }
  ops.setError(null)
  if (timelineContinueClipDraft(ops.hasDraft, ops.continueDraft)) {
    return 'draft'
  }
  ops.startQueue(ops.storyId, [ops.entryId])
  return 'started'
}

export function timelineOnVideoPrepDone(
  d: {
    kind?: string
    entityIds?: { storyId?: string; entryId?: string }
    path?: string
  } | null
    | undefined,
  activeStoryId: string | null,
  reload: () => void,
  setLive: (entryId: string) => void,
  setSelected: (id: string) => void
): boolean {
  if (d?.kind !== 'timeline-clip') return false
  if (!activeStoryId || d.entityIds?.storyId !== activeStoryId) return false
  void reload()
  if (d.entityIds?.entryId) {
    setLive(d.entityIds.entryId)
    setSelected(d.entityIds.entryId)
  }
  return true
}

export function timelineTogglePlayState(ops: {
  isPlaying: boolean
  playhead: number
  totalDuration: number
  entries: Array<{ id: string; startTime: number; endTime: number }>
}): {
  stop?: boolean
  playhead?: number
  selectId?: string | null
  start: boolean
} {
  if (ops.isPlaying) {
    return { stop: true, start: false }
  }
  const end = Math.max(ops.totalDuration, 0.1)
  if (ops.playhead >= end - 0.05) {
    const first = [...ops.entries].sort((a, b) => a.startTime - b.startTime)[0]
    return {
      playhead: 0,
      selectId: first?.id ?? null,
      start: true
    }
  }
  const hit = ops.entries.find(
    (e) => ops.playhead >= e.startTime && ops.playhead < e.endTime
  )
  if (hit) {
    return { selectId: hit.id, start: true }
  }
  if (ops.entries.length > 0) {
    const next = ops.entries
      .filter((e) => e.startTime >= ops.playhead)
      .sort((a, b) => a.startTime - b.startTime)[0]
    if (next) {
      return { selectId: next.id, playhead: next.startTime, start: true }
    }
  }
  return { start: true }
}

export function timelineSelectClipState(
  id: string | null,
  entries: Array<{ id: string; startTime: number; endTime: number }>,
  playhead: number
): {
  selectedId: string | null
  playhead?: number
  stopPlaying: boolean
} {
  if (id == null) {
    return { selectedId: null, stopPlaying: false }
  }
  const clip = entries.find((e) => e.id === id)
  if (!clip) {
    return { selectedId: id, stopPlaying: true }
  }
  if (playhead < clip.startTime || playhead >= clip.endTime) {
    return {
      selectedId: id,
      playhead: clip.startTime,
      stopPlaying: true
    }
  }
  return { selectedId: id, stopPlaying: true }
}

export async function timelineAddAsset(ops: {
  storyId: string | null
  clipSeconds: number
  atTime: number | undefined
  entriesLen: number
  suggestSlot: (
    entries: unknown[],
    duration: number
  ) => { startTime: number; order: number }
  entries: unknown[]
  clamp: (
    start: number,
    end: number,
    max: number
  ) => { startTime: number; endTime: number }
  payload: AssetDropPayload
  create: (input: {
    startTime: number
    endTime: number
    order: number
    characterId: string | null
    sceneId: string | null
    propId: string | null
    actionId: string | null
    dialogue: null
  }) => Promise<unknown>
  refreshStories: () => Promise<void>
  toastSuccess: () => void
}): Promise<boolean> {
  if (!ops.storyId) return false
  const duration = ops.clipSeconds
  let startTime: number
  let order: number
  if (ops.atTime !== undefined) {
    startTime = Math.max(0, ops.atTime)
    order = ops.entriesLen
  } else {
    const slot = ops.suggestSlot(ops.entries, duration)
    startTime = slot.startTime
    order = slot.order
  }
  const range = ops.clamp(startTime, startTime + duration, 10)
  await ops.create({
    startTime: range.startTime,
    endTime: range.endTime,
    order,
    characterId: ops.payload.kind === 'character' ? ops.payload.id : null,
    sceneId: ops.payload.kind === 'scene' ? ops.payload.id : null,
    propId: ops.payload.kind === 'prop' ? ops.payload.id : null,
    actionId: ops.payload.kind === 'action' ? ops.payload.id : null,
    dialogue: null
  })
  await ops.refreshStories()
  ops.toastSuccess()
  return true
}

export async function timelinePersistMove(ops: {
  id: string
  startTime: number
  endTime: number
  prev: { startTime: number; endTime: number } | undefined
  record: (
    id: string,
    prev: { startTime: number; endTime: number },
    next: { startTime: number; endTime: number }
  ) => void
  update: (
    id: string,
    patch: { startTime: number; endTime: number }
  ) => Promise<unknown>
}): Promise<void> {
  if (ops.prev) {
    ops.record(
      ops.id,
      { startTime: ops.prev.startTime, endTime: ops.prev.endTime },
      { startTime: ops.startTime, endTime: ops.endTime }
    )
  }
  await ops.update(ops.id, {
    startTime: ops.startTime,
    endTime: ops.endTime
  })
}

export function timelineMediaBadgeClass(
  status: string,
  badge: Record<string, string>,
  fallbackStatus: string
): string {
  return badge[status in badge ? status : fallbackStatus] ?? badge[fallbackStatus] ?? ''
}

export function timelineExportKindLabel(
  kind: string,
  board: string,
  final: string
): string {
  return kind === 'board' ? board : final
}

export function timelineExportSizeSuffix(
  sizeBytes: number | null | undefined
): string {
  return sizeBytes != null ? ` · ${formatExportSize(sizeBytes)}` : ''
}

export function timelineProgressStepLabel(
  step: string,
  stepMap: Record<string, string>,
  t: (k: string) => string
): string {
  const stepKey = stepMap[step]
  return stepKey ? t(stepKey) : step
}

export function timelineShouldReloadOnProgress(
  entryId: string | undefined,
  mediaStatus: string | undefined
): boolean {
  return Boolean(
    entryId && (mediaStatus === 'READY' || mediaStatus === 'FAILED')
  )
}

export async function timelineLoadCast(ops: {
  storyId: string | null
  clear: () => void
  load: () => Promise<[unknown[], unknown[], unknown[], unknown[]]>
  setAll: (
    chars: unknown[],
    scns: unknown[],
    prps: unknown[],
    acts: unknown[]
  ) => void
  toastError: (m: string) => void
}): Promise<void> {
  if (!ops.storyId) {
    ops.clear()
    return
  }
  try {
    const [chars, scns, prps, acts] = await ops.load()
    ops.setAll(chars, scns, prps, acts)
  } catch (e) {
    ops.toastError(e instanceof Error ? e.message : String(e))
  }
}

export function timelineApplySettingsSnap(
  s: {
    videoMode?: string
    snapEnabled?: boolean
    snapGridSec?: number
    exportProfile?: string
    burnSubtitles?: boolean
    includeSilentAudio?: boolean
    openExportFolder?: boolean
    bgmVolume?: number
    dialogueVolume?: number
  },
  setVideoMode: (m: string) => void,
  setSnapEnabled: (v: boolean) => void,
  setSnapGridSec: (v: number) => void,
  setExportInitial: (o: Partial<ExportFinalOptions>) => void
): void {
  if (s.videoMode) setVideoMode(s.videoMode)
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
}

export async function timelineImportClip(ops: {
  storyId: string | null
  selectedId: string | null
  importClip: (
    storyId: string,
    entryId: string
  ) => Promise<unknown>
  reload: () => Promise<void>
  toastSuccess: () => void
}): Promise<boolean> {
  if (!ops.storyId || !ops.selectedId) return false
  const result = await ops.importClip(ops.storyId, ops.selectedId)
  if (result) {
    await ops.reload()
    ops.toastSuccess()
    return true
  }
  return false
}

export async function timelineOpenClip(ops: {
  mediaPath: string | null | undefined
  open: (path: string) => Promise<unknown>
}): Promise<boolean> {
  if (!ops.mediaPath) return false
  await ops.open(ops.mediaPath)
  return true
}


export function timelineBindUndoRedo(ops: {
  mode: 'undo' | 'redo'
  undo: () => Promise<boolean>
  redo: () => Promise<boolean>
  toast: () => void
  reload: () => Promise<void>
}): () => Promise<void> {
  return async () => {
    await timelineRunUndoRedo(ops)
  }
}

export function timelineBindNavigate(
  navigate: (path: string) => void,
  path: string
): () => void {
  return () => navigate(path)
}

export function timelineBindExportFinal(ops: {
  getStoryId: () => string | null
  setExporting: (v: boolean) => void
  setError: (m: string | null) => void
  preflight: (id: string) => Promise<{
    canExport: boolean
    ffmpegMessage?: string | null
    willUseFallback?: boolean
    warnings: string[]
  }>
  needFfmpeg: string
  fallbackConfirm: string
  confirm: (message: string) => Promise<boolean>
  exportFinal: (
    id: string,
    opts: ExportFinalOptions
  ) => Promise<{ outputPath: string }>
  setLastPath: (p: string) => void
  setInitial: (o: ExportFinalOptions) => void
  closeDialog: () => void
  openHistory: () => void
  refreshHistory: () => Promise<void>
  toastSuccess: (path: string) => void
  toastError: (m: string) => void
  openFolder?: (path: string) => void
}): (rawOpts: ExportFinalOptions) => Promise<void> {
  return async (rawOpts) => {
    await timelineRunExportFinal({
      storyId: ops.getStoryId(),
      opts: rawOpts,
      setExporting: ops.setExporting,
      setError: ops.setError,
      preflight: ops.preflight,
      needFfmpeg: ops.needFfmpeg,
      fallbackConfirm: ops.fallbackConfirm,
      confirm: ops.confirm,
      exportFinal: ops.exportFinal,
      setLastPath: ops.setLastPath,
      setInitial: ops.setInitial,
      closeDialog: ops.closeDialog,
      openHistory: ops.openHistory,
      refreshHistory: ops.refreshHistory,
      toastSuccess: ops.toastSuccess,
      toastError: ops.toastError,
      openFolder: ops.openFolder
    })
  }
}

export function timelineBindDeleteExport(ops: {
  getStoryId: () => string | null
  confirm: () => Promise<boolean>
  setBusy: (id: string | null) => void
  deleteExport: (
    storyId: string,
    exportId: string
  ) => Promise<{ items: unknown[]; latestPath: string | null }>
  setHistory: (items: never[]) => void
  setLatest: (path: string | null) => void
  toastSuccess: () => void
  toastError: (m: string) => void
}): (exportId: string) => Promise<void> {
  return async (exportId) => {
    const storyId = ops.getStoryId()
    if (!storyId) return
    if (!(await ops.confirm())) return
    await timelineRunDeleteExport({
      exportId,
      storyId,
      setBusy: ops.setBusy,
      deleteExport: ops.deleteExport,
      setHistory: ops.setHistory,
      setLatest: ops.setLatest,
      toastSuccess: ops.toastSuccess,
      toastError: ops.toastError
    })
  }
}

export function timelineBindOpenClip(ops: {
  getPath: () => string | null | undefined
  open: (path: string) => Promise<unknown>
}): () => Promise<void> {
  return async () => {
    await timelineOpenClip({ mediaPath: ops.getPath(), open: ops.open })
  }
}

export function timelineMediaClockTick(
  playing: boolean,
  globalTime: number,
  setPlayhead: (n: number) => void
): void {
  if (!playing) return
  setPlayhead(globalTime)
}

export function timelineClipEndedTick(
  playing: boolean,
  entries: Array<{ id: string; endTime: number }>,
  selectedId: string | null,
  playhead: number,
  advance: (from: number) => void
): void {
  if (!playing) return
  const cur = entries.find((e) => e.id === selectedId)
  const from = cur ? cur.endTime : playhead
  advance(from)
}

export function timelineOnPipelineDone(
  reload: () => void | Promise<void>,
  refreshStories: () => void | Promise<void>,
  refreshAiStatus: () => void | Promise<void>,
  loadCast: () => void | Promise<void>
): void {
  void reload()
  void refreshStories()
  void refreshAiStatus()
  void loadCast()
}

export function timelineMaybeCloseExport(
  busy: boolean,
  close: () => void
): void {
  if (!busy) close()
}

export function timelineScrubTo(
  t: number,
  entries: Array<{ id: string; startTime: number; endTime: number }>,
  selectedId: string | null,
  setPlaying: (v: boolean) => void,
  setPlayhead: (n: number) => void,
  setSelected: (id: string) => void
): void {
  setPlaying(false)
  setPlayhead(t)
  const hit = entries.find((e) => t >= e.startTime && t < e.endTime)
  if (hit && hit.id !== selectedId) setSelected(hit.id)
}

export async function timelineShowInFolder(
  path: string,
  show: (p: string) => Promise<unknown>
): Promise<void> {
  await show(path)
}

export function timelineStopAndRun(
  id: string,
  run: (id: string) => void | Promise<void>
): (ev: { stopPropagation: () => void }) => void {
  return (ev) => {
    ev.stopPropagation()
    void run(id)
  }
}

export function timelineDoAdvance(ops: {
  list: Array<{
    id: string
    startTime: number
    endTime: number
    mediaStatus: string
    mediaPath?: string | null
  }>
  fromTime: number
  totalDuration: number
  isPlaying: () => boolean
  setPlaying: (v: boolean) => void
  setPlayhead: (n: number) => void
  setSelected: (id: string) => void
  scheduleSkip: (from: number, again: (from: number) => void) => void
  again: (from: number) => void
}): boolean {
  const r = timelineAdvanceResult(ops.list, ops.fromTime, ops.totalDuration)
  if (r.ended) {
    ops.setPlaying(false)
    ops.setPlayhead(r.playhead)
    return false
  }
  if (r.selectId) ops.setSelected(r.selectId)
  ops.setPlayhead(r.playhead)
  if (r.skipFrom != null) {
    ops.scheduleSkip(r.skipFrom, ops.again)
  }
  return true
}

export function timelineSubtitleOrFallback(
  hasStory: boolean,
  storyTitle: string | undefined,
  fallback: string
): string {
  return hasStory && storyTitle ? storyTitle : fallback
}

export function timelineLiveStatusSuffix(
  live: string | undefined,
  status: string
): string {
  return live && live !== status ? live : ''
}


export function timelineScheduleSkip(
  from: number,
  again: (from: number) => void,
  isPlaying: () => boolean,
  delayMs = 50
): void {
  window.setTimeout(() => {
    if (!isPlaying()) return
    again(from)
  }, delayMs)
}

export function timelineApplyRafResult(
  r: { stop: boolean; value: number; selectId?: string },
  setPlaying: (v: boolean) => void,
  setSelected: (id: string) => void
): number {
  if (r.stop) {
    setPlaying(false)
    return r.value
  }
  if (r.selectId) setSelected(r.selectId)
  return r.value
}

export function timelineDialogOk(
  confirm: (opts: { message: string; confirmLabel: string }) => Promise<boolean>,
  message: string,
  okLabel: string
): Promise<boolean> {
  return confirm({ message, confirmLabel: okLabel })
}

export function timelineDialogDanger(
  confirm: (opts: {
    message: string
    confirmLabel: string
    variant: 'danger'
  }) => Promise<boolean>,
  message: string,
  deleteLabel: string
): Promise<boolean> {
  return confirm({
    message,
    confirmLabel: deleteLabel,
    variant: 'danger'
  })
}

export function timelineSuggestSlot(
  entries: unknown[],
  duration: number,
  suggest: (
    entries: unknown[],
    duration: number
  ) => { startTime: number; order: number }
): { startTime: number; order: number } {
  return suggest(entries, duration)
}

export function timelineErrorBannerText(
  errorMessage: string | undefined,
  actionError: string | null
): string | null {
  return errorMessage ?? actionError
}

export function timelineSpokenBlock(
  spoken: string | null | undefined
): { kind: 'spoken'; text: string } | { kind: 'none' } {
  if (spoken) return { kind: 'spoken', text: timelineSpokenPreview(spoken) }
  return { kind: 'none' }
}

export function timelineShowAdvanced(
  activeStoryId: string | null
): boolean {
  return Boolean(activeStoryId)
}


export function timelineMakeAdvance(ops: {
  getList: () => Array<{
    id: string
    startTime: number
    endTime: number
    mediaStatus: string
    mediaPath?: string | null
  }>
  getTotal: () => number
  isPlaying: () => boolean
  setPlaying: (v: boolean) => void
  setPlayhead: (n: number) => void
  setSelected: (id: string) => void
}): (fromTime: number) => boolean {
  const advance = (fromTime: number): boolean =>
    timelineDoAdvance({
      list: ops.getList(),
      fromTime,
      totalDuration: ops.getTotal(),
      isPlaying: ops.isPlaying,
      setPlaying: ops.setPlaying,
      setPlayhead: ops.setPlayhead,
      setSelected: ops.setSelected,
      scheduleSkip: (from, again) =>
        timelineScheduleSkip(from, again, ops.isPlaying),
      again: (from) => advance(from)
    })
  return advance
}

export function timelineMakePipelineDone(
  reload: () => void | Promise<void>,
  refreshStories: () => void | Promise<void>,
  refreshAiStatus: () => void | Promise<void>,
  loadCast: () => void | Promise<void>
): () => void {
  return () =>
    timelineOnPipelineDone(reload, refreshStories, refreshAiStatus, loadCast)
}

export function timelineMakeSuggestSlot(): (
  entries: unknown[],
  duration: number
) => { startTime: number; order: number } {
  return (e, d) =>
    timelineSuggestSlot(e, d, (x, y) =>
      TimelineService.suggestNextSlot(x as never, y)
    )
}

export function timelineMakeDangerConfirm(
  confirm: (opts: {
    message: string
    confirmLabel: string
    variant: 'danger'
  }) => Promise<boolean>,
  message: string,
  deleteLabel: string
): () => Promise<boolean> {
  return () => timelineDialogDanger(confirm, message, deleteLabel)
}

export function timelineMakeOkConfirm(
  confirm: (opts: { message: string; confirmLabel: string }) => Promise<boolean>,
  okLabel: string
): (message: string) => Promise<boolean> {
  return (message) => timelineDialogOk(confirm, message, okLabel)
}

export function timelineMakeMediaClock(
  isPlaying: () => boolean,
  setPlayhead: (n: number) => void
): (globalTime: number) => void {
  return (globalTime) =>
    timelineMediaClockTick(isPlaying(), globalTime, setPlayhead)
}

export function timelineMakeClipEnded(ops: {
  isPlaying: () => boolean
  getEntries: () => Array<{ id: string; endTime: number }>
  getSelected: () => string | null
  getPlayhead: () => number
  advance: (from: number) => void
}): () => void {
  return () =>
    timelineClipEndedTick(
      ops.isPlaying(),
      ops.getEntries(),
      ops.getSelected(),
      ops.getPlayhead(),
      ops.advance
    )
}

export function timelineMakeScrub(
  entries: Array<{ id: string; startTime: number; endTime: number }>,
  selectedId: string | null,
  setPlaying: (v: boolean) => void,
  setPlayhead: (n: number) => void,
  setSelected: (id: string) => void
): (t: number) => void {
  return (t) =>
    timelineScrubTo(
      t,
      entries,
      selectedId,
      setPlaying,
      setPlayhead,
      setSelected
    )
}

export function timelineMakeMaybeClose(
  isBusy: () => boolean,
  close: () => void
): () => void {
  return () => timelineMaybeCloseExport(isBusy(), close)
}


export function timelineHeaderSubtitle(
  story: { title: string } | null | undefined,
  base: string
): string {
  return story ? `${base} · ${story.title}` : base
}

export function timelineStepSuffix(
  currentStepLabel: string | null | undefined,
  stepIndex: number,
  stepTotal: number
): string {
  const a = currentStepLabel ? ` · ${currentStepLabel}` : ''
  const b =
    stepTotal > 0
      ? ` (${Math.min(stepIndex, stepTotal)}/${stepTotal})`
      : ''
  return `${a}${b}`
}

export function timelineErrorVisible(
  errorMessage: string | undefined,
  actionError: string | null
): string {
  return timelineErrorBannerText(errorMessage, actionError) ?? ''
}


export function timelineShouldShowError(
  error: { message?: string } | null | undefined,
  actionError: string | null
): boolean {
  return Boolean(error || actionError)
}

export function timelineSpokenDisplay(
  spoken: string | null | undefined,
  spokenMsg: (text: string) => string,
  noneMsg: string
): string {
  if (spoken) return spokenMsg(timelineSpokenPreview(spoken))
  return noneMsg
}

export function timelineAdvancedClosed(): null {
  return null
}


export function timelineErrorBannerElement(
  error: { message?: string } | null | undefined,
  actionError: string | null,
  format: (m: string) => string
): React.ReactElement | null {
  if (!timelineShouldShowError(error, actionError)) return null
  return (
    <p className="mb-2 shrink-0 rounded-xl border border-rose-900/40 bg-rose-950/40 px-3 py-2 text-sm text-rose-200">
      {format(timelineErrorVisible(error?.message, actionError))}
    </p>
  )
}

export function timelineAdvancedSlot(
  show: boolean,
  studio: React.ReactNode
): React.ReactNode {
  return show ? studio : timelineAdvancedClosed()
}

export function timelineMaybeAdvanced(
  storyId: string | null,
  render: (id: string) => React.ReactNode
): React.ReactNode {
  if (!timelineShowAdvanced(storyId)) return timelineAdvancedClosed()
  return render(storyId!)
}
