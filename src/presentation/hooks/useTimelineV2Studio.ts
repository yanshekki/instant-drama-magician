import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { TimelineService } from '../../application/TimelineService'
import { charactersMissingRef } from '../../domain/promptContinuity'
import {
  beatContentForEditor,
  commitBeatScriptEdit
} from '../../domain/beatContent'
import { getAiLocale } from '../../lib/aiLocale'
import { suggestedClipExportName } from '../../domain/clipExportName'
import { buildVideoPrepDraftKey } from '../../domain/videoPrep'
import {
  snapClipRange,
  snapVideoSeconds,
  type GrokVideoSeconds
} from '../../domain/videoDuration'
import { getApi } from '../../lib/api'
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
import { useOptionalPromptTemplate } from '../context/PromptTemplateContext'
import { useTimeline } from './useTimeline'
import { useTimelineHistory } from './useTimelineHistory'
import {
  sceneCastLabel,
  type StoryCastScene
} from '../components/timeline/timelineLabels'
import type { AssetDropPayload } from '../components/timeline/TimelineCanvas'
import type { AdvancedPrepSnapshot } from '../components/timeline/TimelineAdvancedStudio'
import {
  defaultExportFinalOptions,
  type ExportFinalOptions
} from '../../domain/exportOptions'
import {
  buildTimelineGraph,
  findTimelineGraphPrepCell,
  layoutTimelineGraph,
  previousStillPath,
  TIMELINE_GRAPH_COL_MAX_H
} from '../../domain/timelineGraph'
import {
  timelineApplySettingsSnap,
  timelineAutoSelectFirst,
  timelineBindDeleteExport,
  timelineBindExportFinal,
  timelineBindNavigate,
  timelineBindExportClip,
  timelineBindOpenClip,
  timelineBindUndoRedo,
  timelineClipGenerateLabel,
  timelineCollectEntryIds,
  timelineConfirmGenerate,
  timelineDialogOk,
  timelineErrorBannerElement,
  timelineFailedOrEmptyIds,
  timelineFindClipBusyId,
  timelineGeneratingLabel,
  timelineHandleKeyUndo,
  timelineHeaderSubtitle,
  timelineLabelForEntry,
  timelineLoadCast,
  timelineMakeAdvance,
  timelineMakeClipEnded,
  timelineMakeDangerConfirm,
  timelineMakeMaybeClose,
  timelineMakeMediaClock,
  timelineMakeOkConfirm,
  timelineMakePipelineDone,
  timelineMakeScrub,
  timelineMakeSuggestSlot,
  timelineMaybeAdvanced,
  timelineOnVideoPrepDone,
  timelinePersistMove,
  timelinePersistSnap,
  timelinePipelineSummary,
  timelineProgressStepLabel,
  timelineRefreshExports,
  timelineRunCancelJobs,
  timelineRunClip,
  timelineRunClipDuration,
  timelineRunDeleteClip,
  timelineRunPackAbut,
  timelineRunSaveDialogue,
  timelineSelectClipState,
  timelineShouldReloadOnProgress,
  timelineStartClipPrep,
  timelineStepSuffix,
  timelineSubtitleOrFallback,
  timelineTogglePlayState,
  timelineAddAsset
} from '../pages/TimelinePage'
import type { ChannelPickerValue } from '../components/ProviderChannelPicker'

const STEP_I18N: Record<string, string> = {
  script: 'pipeline.script',
  character: 'pipeline.character',
  scene: 'pipeline.scene',
  props: 'pipeline.props',
  timeline: 'pipeline.timeline',
  video: 'pipeline.video',
  export: 'pipeline.export'
}

export function useTimelineV2Studio() {
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
    startMediaGen,
    setVideoPrepSession,
    hasVideoPrepDraft,
    continueVideoPrepDraft
  } = useAiJobs()
  const { pick } = useOptionalPromptTemplate()
  const { entries, loading, error, totalDuration, create, update, remove, reload } =
    useTimeline(activeStoryId)
  const history = useTimelineHistory()

  const [castCharacters, setCastCharacters] = useState<Character[]>([])
  const [castScenes, setCastScenes] = useState<StoryCastScene[]>([])
  const [castProps, setCastProps] = useState<Prop[]>([])
  const [castActions, setCastActions] = useState<Action[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dialogue, setDialogue] = useState('')
  const [revisionByEntry, setRevisionByEntry] = useState<Record<string, string>>({})
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
  const [clipSeconds, setClipSeconds] = useState<6 | 10>(6)
  const [videoMode, setVideoMode] = useState('auto')
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [exportInitial, setExportInitial] = useState<Partial<ExportFinalOptions> | null>(
    defaultExportFinalOptions()
  )
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
  const [exportDeleteBusyId, setExportDeleteBusyId] = useState<string | null>(null)
  const [currentStepLabel, setCurrentStepLabel] = useState<string | null>(null)
  const [liveClipStatus, setLiveClipStatus] = useState<Record<string, string>>({})
  const [prep, setPrep] = useState<AdvancedPrepSnapshot | null>(null)
  const [stillBusy, setStillBusy] = useState(false)
  const [setupOpen, setSetupOpen] = useState(false)
  const [graphNodeId, setGraphNodeId] = useState<string | null>('video')
  const [graphViewportH, setGraphViewportH] = useState(TIMELINE_GRAPH_COL_MAX_H)
  const setGraphViewportFromCanvas = useCallback((h: number) => {
    const next = Math.max(240, h - 16)
    setGraphViewportH((prev) => (Math.abs(next - prev) < 8 ? prev : next))
  }, [])

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
          getApi().characters.list({ storyId: activeStoryId!, forStory: true }) as Promise<
            Character[]
          >,
          getApi().scenes.list({ storyId: activeStoryId!, forStory: true }) as Promise<
            StoryCastScene[]
          >,
          getApi().props.list({ storyId: activeStoryId!, forStory: true }) as Promise<
            Prop[]
          >,
          getApi().actions.list({ storyId: activeStoryId!, forStory: true }) as Promise<
            Action[]
          >
        ]),
      setAll: (chars, scns, prps, acts) => {
        setCastCharacters(chars as Character[])
        setCastScenes(scns as StoryCastScene[])
        setCastProps(prps as Prop[])
        setCastActions(acts as Action[])
      },
      toastError: (m) => toast.error(formatUserError(m, t))
    })
  }, [activeStoryId, toast, t])

  const loadPrep = useCallback(async (): Promise<void> => {
    if (!activeStoryId) {
      setPrep(null)
      return
    }
    try {
      const data = (await getApi().timeline.getAdvancedPrep(
        activeStoryId
      )) as AdvancedPrepSnapshot
      setPrep(data)
    } catch {
      setPrep(null)
    }
  }, [activeStoryId])

  useEffect(() => {
    void loadCast()
  }, [loadCast])

  useEffect(() => {
    void loadPrep()
  }, [loadPrep])

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
        setSettings(s)
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
      onWarn: (e) => console.warn('[timeline-v2] listExports failed', e)
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
  const playheadRef = useRef(playhead)
  playheadRef.current = playhead
  const revisionByEntryRef = useRef(revisionByEntry)
  revisionByEntryRef.current = revisionByEntry

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
      setCurrentStepLabel(timelineProgressStepLabel(payload.step, STEP_I18N, t))
      if (payload.entryId && payload.mediaStatus) {
        setLiveClipStatus((prev) => ({
          ...prev,
          [payload.entryId!]: payload.mediaStatus!
        }))
      }
      if (timelineShouldReloadOnProgress(payload.entryId, payload.mediaStatus)) {
        void reload()
        void loadPrep()
      }
    })
  }, [reload, t, activeStoryId, loadPrep])

  const labels = useMemo(() => {
    const map: Record<string, string> = {}
    const charMap = new Map(castCharacters.map((c) => [c.id, c.name]))
    const sceneMap = new Map(castScenes.map((s) => [s.id, sceneCastLabel(s)]))
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

  const graphLayout = useMemo(() => {
    const cell = findTimelineGraphPrepCell(prep?.cells, selected?.id)
    const model = buildTimelineGraph({
      entry: selected,
      story: activeStory,
      characters: castCharacters,
      scenes: castScenes,
      props: castProps,
      actions: castActions,
      cell,
      prevStillPath: previousStillPath(prep?.cells, selected?.id),
      castCards: prep?.castCards,
      imageProvider: settings?.imageProvider,
      videoProvider: settings?.videoProvider,
      imageModel: settings?.imageModel,
      videoModel: settings?.videoModel,
      entries: entries.map((e) => ({
        id: e.id,
        order: e.order,
        startTime: e.startTime,
        dialogue: e.dialogue,
        mediaStatus: e.mediaStatus,
        mediaPath: e.mediaPath,
        characterId: e.characterId,
        sceneId: e.sceneId,
        propId: e.propId,
        actionId: e.actionId,
        characterIds: e.characterIds,
        sceneIds: e.sceneIds,
        propIds: e.propIds,
        actionIds: e.actionIds
      })),
      cells: prep?.cells
    })
    return layoutTimelineGraph(model, { maxColumnHeight: graphViewportH })
  }, [
    selected,
    activeStory,
    castCharacters,
    castScenes,
    castProps,
    castActions,
    prep,
    settings,
    entries,
    graphViewportH
  ])

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

  const handlePackAbut = async (): Promise<void> => {
    await timelineRunPackAbut({
      entries,
      needMsg: t('timeline.packAbutNeedClips'),
      alreadyMsg: t('timeline.packAbutAlready'),
      doneMsg: t('timeline.packAbutDone'),
      toastInfo: toast.info,
      toastSuccess: toast.success,
      toastError: (m) => toast.error(formatUserError(m, t)),
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
      locale: i18n.language,
      commit: commitBeatScriptEdit,
      update,
      toastSuccess: () => toast.success(t('common.saved')),
      toastError: (m) => toast.error(formatUserError(m, t))
    })
  }

  const handleClipDuration = async (
    seconds: GrokVideoSeconds,
    entry = selected
  ): Promise<void> => {
    await timelineRunClipDuration({
      selected: entry,
      seconds,
      snapCurrent: (s, e) => snapVideoSeconds(e - s),
      snapRange: (s, e) => snapClipRange(s, e),
      update,
      setPlayhead,
      setClipSeconds: (n) => setClipSeconds(n as GrokVideoSeconds),
      toastSuccess: (n) => toast.success(t('timeline.clipDurationSet', { n })),
      toastError: (m) => toast.error(formatUserError(m, t))
    })
  }

  const handleDeleteClip = async (entry = selected): Promise<void> => {
    await timelineRunDeleteClip({
      selected: entry,
      confirm: () =>
        dialog.confirm({
          message: t('common.confirmDelete'),
          variant: 'danger'
        }),
      remove,
      clearSelected: () => {
        if (entry && selectedIdRef.current === entry.id) setSelectedId(null)
      },
      toastSuccess: () => toast.success(t('common.deleted')),
      toastError: (m) => toast.error(formatUserError(m, t))
    })
  }

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
        start: (args) => {
          void (async () => {
            const { buildIntroMediaGenRequest } = await import(
              '../lib/startIntroMediaGen'
            )
            const wantSkip = args.skipStillIfExists === true
            const batchIds = [args.entryId, ...(args.queueRemaining ?? [])].filter(
              Boolean
            )
            const queueUserExtraByEntryId: Record<string, string> = {}
            const queueDurationSecondsByEntryId: Record<string, number> = {}
            for (const id of batchIds) {
              const rev = revisionByEntryRef.current[id]?.trim()
              if (rev) queueUserExtraByEntryId[id] = rev
              const ent = entriesRef.current.find((e) => e.id === id)
              if (ent) {
                queueDurationSecondsByEntryId[id] = snapVideoSeconds(
                  Number(ent.endTime) - Number(ent.startTime)
                )
              }
            }
            if (
              args.durationSeconds > 0 &&
              !queueDurationSecondsByEntryId[args.entryId]
            ) {
              queueDurationSecondsByEntryId[args.entryId] = args.durationSeconds
            }
            const req = await buildIntroMediaGenRequest({
              kind: 'timeline-clip',
              sourceImagePath: '',
              storyId,
              entryId: args.entryId,
              durationSeconds: args.durationSeconds,
              skipStillIfExists: wantSkip,
              userExtraPrompt: args.revisionPrompt?.trim() || null
            })
            startMediaGen({
              ...req,
              queueIndex: args.queueIndex,
              queueTotal: args.queueTotal,
              queueRemaining: args.queueRemaining ?? [],
              queueSkipStillIfExists: wantSkip,
              queueUserExtraByEntryId,
              queueDurationSecondsByEntryId
            })
          })()
        }
      })
    },
    [clipSeconds, startMediaGen, t, toast]
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

    const promptTemplateId = await pick('copy')
    if (!promptTemplateId) return
    setCurrentStepLabel(t('common.generate'))
    toast.info(t('aiJobs.startedBackground'))
    startJob({
      kind: 'pipeline',
      label: t('common.generate'),
      scope: { storyId },
      run: async ({ setProgress, signal }) => {
        setProgress(5, 'start')
        const result = (await getApi().generation.run(storyId, {
          interactiveVideo: true,
          locale: i18n.language,
          promptTemplateId
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
        toast.success(anyDegraded ? t('pipeline.degraded') : t('aiJobs.pipelineOk'))
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
    toastError: (m) => toast.error(formatUserError(m, t)),
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
    toastError: (m) => toast.error(formatUserError(m, t))
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
        () => {
          void reload()
          void loadPrep()
        },
        (entryId) =>
          setLiveClipStatus((prev) => ({ ...prev, [entryId]: 'READY' })),
        setSelectedId
      )
    }
    const onStill = (): void => {
      void loadPrep()
      void reload()
    }
    window.addEventListener('idm:video-prep-done', onDone)
    window.addEventListener('idm:timeline-still-done', onStill)
    return () => {
      window.removeEventListener('idm:video-prep-done', onDone)
      window.removeEventListener('idm:timeline-still-done', onStill)
    }
  }, [activeStoryId, reload, loadPrep])

  const handleTogglePlay = (): void => {
    const r = timelineTogglePlayState({
      isPlaying,
      playhead,
      totalDuration,
      entries,
      selectedId,
      clipScoped: true
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
      getPlayhead: () => playheadRef.current,
      advance: advanceToNextClip,
      mode: 'stay',
      stop: () => setIsPlaying(false)
    }),
    [advanceToNextClip]
  )

  const selectClip = (id: string | null): void => {
    const r = timelineSelectClipState(id, entries, playhead)
    setSelectedId(r.selectedId)
    if (r.stopPlaying) setIsPlaying(false)
    if (r.playhead != null) setPlayhead(r.playhead)
  }

  const handleImportClip = async (entryId = selectedId): Promise<void> => {
    if (!activeStoryId || !entryId) return
    try {
      await getApi().media.importClip(activeStoryId, entryId)
      await reload()
      toast.success(t('timeline.importClip'))
    } catch (e) {
      toast.error(formatUserError(e instanceof Error ? e.message : String(e), t))
    }
  }

  const handleOpenClip = async (entryId?: string): Promise<void> => {
    const ent = entryId
      ? entriesRef.current.find((e) => e.id === entryId)
      : selected
    await timelineBindOpenClip({
      getPath: () => ent?.mediaPath,
      open: (p) => getApi().media.openClip(p)
    })()
  }

  const handleExportClip = async (entryId?: string): Promise<void> => {
    const ent = entryId
      ? entriesRef.current.find((e) => e.id === entryId)
      : selected
    await timelineBindExportClip({
      getPath: () => ent?.mediaPath,
      suggestedName: () =>
        suggestedClipExportName({
          storyTitle: activeStory?.title,
          clipIndex: (ent?.order ?? 0) + 1
        }),
      saveAs: (path, dest, name) => getApi().media.saveAs(path, dest, name),
      toastSuccess: (path) => toast.success(t('timeline.exportClipOk', { path })),
      toastError: (m) => toast.error(m),
      formatError: (e) =>
        formatUserError(e instanceof Error ? e.message : String(e), t)
    })()
  }

  const playOrSelectClip = (entryId: string): void => {
    if (selectedId === entryId) {
      handleTogglePlay()
      return
    }
    const r = timelineSelectClipState(entryId, entries, playhead)
    setSelectedId(r.selectedId)
    if (r.playhead != null) setPlayhead(r.playhead)
    setIsPlaying(true)
  }

  const genStill = (_force: boolean, entryId = selected?.id): void => {
    const entry = entryId
      ? entries.find((e) => e.id === entryId) ?? selected
      : selected
    if (!activeStoryId || !entry || stillBusy) return
    setStillBusy(true)
    startJob({
      kind: 'storyboard-still',
      label: t('timeline.advanced.jobStillLabel', { n: entry.order + 1 }),
      scope: { storyId: activeStoryId, entryId: entry.id },
      run: async ({ setProgress, signal }) => {
        try {
          setProgress(20, 'start')
          if (signal.cancelled) return
          setProgress(50, 'image')
          // Overwrite the continuity still in place. Do not delete first —
          // a failed regen would otherwise leave a "ready" card with no file.
          await getApi().videoPrep.create({
            kind: 'timeline-clip',
            storyId: activeStoryId,
            entryId: entry.id,
            locale: i18n.language,
            stillOnly: true,
            skipStillIfExists: false
          })
          if (signal.cancelled) return
          setProgress(100, 'done')
          await loadPrep()
          await reload()
          toast.success(t('timeline.advanced.stillGenOk'))
        } finally {
          setStillBusy(false)
        }
      }
    })
  }

  const refineStill = (entryId = selected?.id): void => {
    const entry = entryId
      ? entries.find((e) => e.id === entryId) ?? selected
      : selected
    if (!activeStoryId || !entry) return
    const cell = findTimelineGraphPrepCell(prep?.cells, entry.id)
    void (async () => {
      let aspectRatio: '16:9' | '9:16' = '16:9'
      try {
        const { resolveVideoAspectRatio } = await import('../lib/startIntroMediaGen')
        aspectRatio = await resolveVideoAspectRatio()
      } catch {
        /* default */
      }
      startMediaGen({
        kind: 'timeline-still',
        storyId: activeStoryId,
        entryId: entry.id,
        durationSeconds: snapVideoSeconds(entry.endTime - entry.startTime),
        preferIdentityEdit: true,
        aspectRatio,
        sourceImagePath: cell?.stillPath || undefined
      })
    })()
  }

  const applySetup = async (next: {
    clipSeconds: 6 | 10
    imageProvider: ChannelPickerValue
    videoProvider: ChannelPickerValue
  }): Promise<void> => {
    await handleClipDuration(next.clipSeconds)
    try {
      const saved = (await getApi().settings.set({
        imageProvider: next.imageProvider,
        videoProvider: next.videoProvider
      } as never)) as Partial<AppSettings>
      setSettings((prev) => ({ ...(prev as AppSettings), ...saved }))
      if (next.videoProvider === 'stub') setVideoMode('stub')
      toast.success(t('common.saved'))
    } catch (e) {
      toast.error(formatUserError(e instanceof Error ? e.message : String(e), t))
    }
    setSetupOpen(false)
  }

  const openEntity = (
    kind: 'character' | 'scene' | 'prop' | 'action',
    id: string
  ): void => {
    const path =
      kind === 'character'
        ? '/characters'
        : kind === 'scene'
          ? '/scenes'
          : kind === 'prop'
            ? '/props'
            : '/actions'
    navigate(path, { state: { focusId: id } })
  }

  const progressPct = stepTotal > 0 ? Math.round((stepIndex / stepTotal) * 100) : 0

  return {
    t,
    i18n,
    navigate,
    activeStoryId,
    setActiveStoryId,
    stories,
    activeStory,
    entries,
    loading,
    error,
    totalDuration,
    selected,
    selectedId,
    selectClip,
    dialogue,
    setDialogue,
    revisionByEntry,
    setRevisionByEntry,
    exporting,
    actionError,
    playhead,
    setPlayhead,
    setIsPlaying,
    pxPerSec,
    setPxPerSec,
    snapEnabled,
    snapGridSec,
    persistSnapSettings,
    isPlaying,
    packAbutBusy,
    advancedOpen,
    setAdvancedOpen,
    clipSeconds,
    videoMode,
    settings,
    exportDialogOpen,
    setExportDialogOpen,
    exportInitial,
    lastExportPath,
    exportHistory,
    exportHistoryOpen,
    setExportHistoryOpen,
    exportDeleteBusyId,
    currentStepLabel,
    liveClipStatus,
    labels,
    graphLayout,
    graphNodeId,
    setGraphNodeId,
    setGraphViewportFromCanvas,
    setupOpen,
    setSetupOpen,
    stillBusy,
    prep,
    missingRefs,
    failedCount,
    readyCount,
    busy,
    clipBusyId,
    history,
    progressPct,
    openStoryEditor,
    addAsset,
    persistMove,
    handlePackAbut,
    handleUndoLocal,
    handleRedoLocal,
    handleSaveDialogue,
    handleClipDuration,
    handleDeleteClip,
    handleGenerate,
    handleCancel,
    handleExportFinal,
    handleDeleteExport,
    handleRunClip,
    clipGenerateLabel,
    handleTogglePlay,
    playOrSelectClip,
    handleMediaClock,
    handleClipEnded,
    handleImportClip,
    handleOpenClip,
    handleExportClip,
    genStill,
    refineStill,
    applySetup,
    openEntity,
    refreshExportHistory,
    startClipPrepQueue,
    reload,
    timelineErrorBannerElement,
    timelineMakeScrub,
    timelineMakeMaybeClose,
    timelineGeneratingLabel,
    timelineStepSuffix,
    timelineHeaderSubtitle,
    timelineSubtitleOrFallback,
    timelineMaybeAdvanced,
    formatUserError
  }
}
