import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TimelineService } from '../../application/TimelineService'
import { snapVideoSeconds } from '../../domain/videoDuration'
import { getApi } from '../../lib/api'
import { parseIpcError } from '../../lib/ipc'
import type { GenerationResult, MediaStatus } from '../../types/domain'
import type { AppSettings } from '../../types/settings'
import { useApp } from '../context/AppContext'
import { useCharacters } from '../hooks/useCharacters'
import { useProps } from '../hooks/useProps'
import { useScenes } from '../hooks/useScenes'
import { useTimeline } from '../hooks/useTimeline'
import { PageHeader } from '../components/PageHeader'
import { AssetLibrary } from '../components/timeline/AssetLibrary'
import type { AssetDropPayload } from '../components/timeline/TimelineCanvas'
import { KonvaTimeline } from '../components/timeline/KonvaTimeline'
import { PreviewPlayer } from '../components/timeline/PreviewPlayer'
import { useTimelineHistory } from '../hooks/useTimelineHistory'
import { Button, EmptyState, Label, Textarea } from '../components/ui'

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
  const { t } = useTranslation()
  const { activeStoryId, refreshStories, refreshAiStatus } = useApp()
  const { items: characters } = useCharacters(activeStoryId)
  const { items: scenes } = useScenes(activeStoryId)
  const { items: props } = useProps(activeStoryId)
  const {
    entries,
    loading,
    error,
    totalDuration,
    create,
    update,
    remove,
    reorder,
    reload
  } = useTimeline(activeStoryId)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dialogue, setDialogue] = useState('')
  const [generating, setGenerating] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [progressLog, setProgressLog] = useState<string[]>([])
  const [stepIndex, setStepIndex] = useState(0)
  const [stepTotal, setStepTotal] = useState(7)
  const [genResult, setGenResult] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [playhead, setPlayhead] = useState(0)
  const [pxPerSec, setPxPerSec] = useState(40)
  const [isPlaying, setIsPlaying] = useState(false)
  const history = useTimelineHistory()
  const [banner, setBanner] = useState<string | null>(null)
  const [clipSeconds, setClipSeconds] = useState<6 | 10>(6)
  const [videoMode, setVideoMode] = useState<string>('auto')
  const [lastExportPath, setLastExportPath] = useState<string | null>(null)
  const [currentStepLabel, setCurrentStepLabel] = useState<string | null>(null)

  const selected = entries.find((e) => e.id === selectedId) ?? null

  useEffect(() => {
    void getApi()
      .settings.get()
      .then((s: AppSettings) => setVideoMode(s.videoMode))
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        void (async () => {
          if (e.shiftKey) {
            if (await history.redo()) {
              setBanner(t('timeline.redoDone'))
              await reload()
            }
          } else if (await history.undo()) {
            setBanner(t('timeline.undoDone'))
            await reload()
          }
        })()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [history, t, reload])

  useEffect(() => {
    setDialogue(selected?.dialogue ?? '')
  }, [selected?.id, selected?.dialogue])

  useEffect(() => {
    if (!isPlaying) return
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
        // Auto-select clip under playhead
        const hit = entries.find((e) => next >= e.startTime && next < e.endTime)
        if (hit && hit.id !== selectedId) setSelectedId(hit.id)
        return next
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [isPlaying, totalDuration, entries, selectedId])

  useEffect(() => {
    return getApi().generation.onProgress((payload) => {
      setStepIndex(payload.index + 1)
      setStepTotal(payload.total)
      const stepKey = STEP_I18N[payload.step]
      const human = stepKey ? t(stepKey) : payload.step
      setCurrentStepLabel(human)
      const line = payload.entryId
        ? `${human} · clip ${payload.entryId.slice(0, 6)} → ${payload.mediaStatus ?? ''}${
            payload.jobId ? ` job=${payload.jobId.slice(0, 8)}` : ''
          }`
        : payload.result?.success
          ? `✓ [${payload.index + 1}/${payload.total}] ${human}`
          : `… [${payload.index + 1}/${payload.total}] ${human}${
              payload.result?.error ? `: ${payload.result.error}` : ''
            }`
      setProgressLog((prev) => [...prev, line])
      if (payload.entryId) void reload()
    })
  }, [reload, t])

  const labels = useMemo(() => {
    const map: Record<string, string> = {}
    const charMap = new Map(characters.map((c) => [c.id, c.name]))
    const sceneMap = new Map(scenes.map((s) => [s.id, `#${s.sceneNumber}`]))
    const propMap = new Map(props.map((p) => [p.id, p.name]))
    for (const e of entries) {
      map[e.id] =
        e.dialogue ||
        (e.characterId && charMap.get(e.characterId)) ||
        (e.sceneId && sceneMap.get(e.sceneId)) ||
        (e.propId && propMap.get(e.propId)) ||
        `#${e.order + 1}`
    }
    return map
  }, [entries, characters, scenes, props])

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

  const handleUndoLocal = async (): Promise<void> => {
    if (await history.undo()) {
      setBanner(t('timeline.undoDone'))
      await reload()
    }
  }

  const handleRedoLocal = async (): Promise<void> => {
    if (await history.redo()) {
      setBanner(t('timeline.redoDone'))
      await reload()
    }
  }

  const handleSaveDialogue = async (): Promise<void> => {
    if (!selectedId) return
    await update(selectedId, { dialogue: dialogue.trim() || null })
  }

  const handleReorderByStart = async (): Promise<void> => {
    const ordered = [...entries]
      .sort((a, b) => a.startTime - b.startTime)
      .map((e) => e.id)
    await reorder(ordered)
  }

  const handleGenerate = async (onlyFailed = false): Promise<void> => {
    if (!activeStoryId) return
    const modeHint =
      videoMode === 'stub'
        ? t('pipeline.confirmStub')
        : videoMode === 'http'
          ? t('pipeline.confirmHttp')
          : t('pipeline.confirmAuto')
    if (!confirm(modeHint)) return
    setGenerating(true)
    setProgressLog([])
    setGenResult(null)
    setActionError(null)
    setStepIndex(0)
    try {
      const result = (await getApi().generation.run(activeStoryId, {
        onlyFailedVideos: onlyFailed
      })) as GenerationResult
      const lines = result.steps.map((s) => {
        const human = STEP_I18N[s.step] ? t(STEP_I18N[s.step]) : s.step
        return s.success
          ? `✓ ${human}${s.degraded ? ` (${t('pipeline.degraded')})` : ''}\n${s.output ?? ''}`
          : `✗ ${human}: ${s.error ?? 'failed'}`
      })
      setGenResult(lines.join('\n\n'))
      const anyDegraded = result.steps.some((s) => s.degraded)
      setBanner(
        result.success
          ? anyDegraded
            ? t('pipeline.doneStub')
            : t('pipeline.doneOk')
          : t('pipeline.doneFail')
      )
      await reload()
      await refreshStories()
      await refreshAiStatus()
    } catch (e) {
      const err = parseIpcError(e)
      setActionError(
        `${err.message}${err.code === 'FFMPEG_UNAVAILABLE' ? ` — ${t('pipeline.needFfmpeg')}` : ` — ${t('pipeline.checkGateway')}`}`
      )
      setBanner(t('pipeline.doneFail'))
    } finally {
      setGenerating(false)
    }
  }

  const handleCancel = async (): Promise<void> => {
    await getApi().generation.cancel()
  }

  const handleExport = async (mode: 'board' | 'final'): Promise<void> => {
    if (!activeStoryId) return
    setExporting(true)
    setActionError(null)
    try {
      const { outputPath } =
        mode === 'final'
          ? await getApi().media.exportFinal(activeStoryId)
          : await getApi().media.exportStoryboard(activeStoryId)
      setLastExportPath(outputPath)
      setBanner(t('pipeline.exportOk', { path: outputPath }))
      setGenResult((prev) =>
        [prev, `Export: ${outputPath}`].filter(Boolean).join('\n\n')
      )
    } catch (e) {
      const err = parseIpcError(e)
      setActionError(
        err.code === 'FFMPEG_UNAVAILABLE' || /ffmpeg/i.test(err.message)
          ? t('pipeline.needFfmpeg')
          : err.message
      )
    } finally {
      setExporting(false)
    }
  }

  const handleImportClip = async (): Promise<void> => {
    if (!activeStoryId || !selectedId) return
    const result = await getApi().media.importClip(activeStoryId, selectedId)
    if (result) await reload()
  }

  const handleOpenClip = async (): Promise<void> => {
    if (!selected?.mediaPath) return
    await getApi().media.openClip(selected.mediaPath)
  }

  if (!activeStoryId) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title={t('timeline.title')} subtitle={t('timeline.subtitle')} />
        <div className="p-8">
          <EmptyState message={t('common.selectStory')} />
        </div>
      </div>
    )
  }

  const progressPct =
    stepTotal > 0 ? Math.round((stepIndex / stepTotal) * 100) : 0

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        title={t('timeline.title')}
        subtitle={t('timeline.subtitle')}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => void handleReorderByStart()}>
              {t('timeline.reorder')}
            </Button>
            <Button
              variant="ghost"
              onClick={() => void handleUndoLocal()}
              disabled={!history.canUndo}
            >
              Undo
            </Button>
            <Button
              variant="ghost"
              onClick={() => void handleRedoLocal()}
              disabled={!history.canRedo}
            >
              Redo
            </Button>
            <Button
              variant="secondary"
              onClick={() => setIsPlaying((p) => !p)}
            >
              {isPlaying ? t('timeline.pause') : t('timeline.play')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => void handleExport('board')}
              disabled={exporting}
            >
              {t('common.exportBoard')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => void handleExport('final')}
              disabled={exporting}
            >
              {exporting ? t('common.exporting') : t('common.export')}
            </Button>
            {generating ? (
              <Button variant="danger" onClick={() => void handleCancel()}>
                {t('common.cancelGen')}
              </Button>
            ) : (
              <>
                <Button
                  variant="secondary"
                  onClick={() => void handleGenerate(true)}
                >
                  {t('common.retryFailed')}
                </Button>
                <Button onClick={() => void handleGenerate(false)}>
                  {t('common.generate')}
                </Button>
              </>
            )}
          </div>
        }
      />

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden border-r border-ink-800">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-800 px-6 py-3 text-xs text-ink-400">
            <span>
              {t('timeline.duration', { seconds: totalDuration.toFixed(1) })}
            </span>
            <span className="rounded-full bg-ink-800 px-2 py-0.5 text-amber-200">
              {t('timeline.aiClipHint')}
            </span>
            <span className="rounded-full bg-ink-800 px-2 py-0.5 text-brand-200">
              Video: {videoMode}
            </span>
          </div>

          {generating && (
            <div className="border-b border-ink-800 px-6 py-2">
              <div className="mb-1 flex justify-between text-[11px] text-ink-400">
                <span>
                  {t('common.generating')}
                  {currentStepLabel ? ` · ${currentStepLabel}` : ''} ({stepIndex}/
                  {stepTotal})
                </span>
                <span>{progressPct}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-ink-800">
                <div
                  className="h-full bg-brand-500 transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}

          <div className="border-b border-ink-800 px-6 py-4">
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
              }}
              onSelect={setSelectedId}
              onMove={(id, s, e) => void persistMove(id, s, e)}
              onDropAsset={(payload, at) => void addAsset(payload, at)}
              width={900}
            />
            <div className="mt-3 max-w-xl">
              <PreviewPlayer
                entry={selected}
                playhead={playhead}
                isPlaying={isPlaying}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {banner && (
              <div className="mb-3 rounded-lg bg-brand-950/40 px-3 py-2 text-sm text-brand-200">
                <p>{banner}</p>
                {lastExportPath && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => void getApi().shell.openPath(lastExportPath)}
                    >
                      {t('pipeline.openFile')}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() =>
                        void getApi().shell.showItemInFolder(lastExportPath)
                      }
                    >
                      {t('pipeline.openFolder')}
                    </Button>
                  </div>
                )}
              </div>
            )}
            {(error || actionError) && (
              <p className="mb-3 rounded-lg bg-rose-950/50 px-3 py-2 text-sm text-rose-200">
                {error?.message ?? actionError}
              </p>
            )}

            {selected && (
              <div className="mb-4 rounded-xl border border-ink-800 bg-ink-900/50 p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-brand-300">
                    {selected.startTime.toFixed(1)}s → {selected.endTime.toFixed(1)}s
                  </span>
                  <span
                    className={[
                      'rounded-full px-2 py-0.5 text-[10px] uppercase',
                      mediaBadge[selected.mediaStatus]
                    ].join(' ')}
                  >
                    {selected.mediaStatus}
                  </span>
                </div>
                <Label>{t('timeline.dialogue')}</Label>
                <Textarea
                  rows={2}
                  value={dialogue}
                  onChange={(e) => setDialogue(e.target.value)}
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button onClick={() => void handleSaveDialogue()}>
                    {t('common.save')}
                  </Button>
                  <Button variant="secondary" onClick={() => void handleImportClip()}>
                    {t('timeline.importClip')}
                  </Button>
                  {selected.mediaPath && (
                    <Button variant="secondary" onClick={() => void handleOpenClip()}>
                      {t('timeline.openClip')}
                    </Button>
                  )}
                  <Button
                    variant="danger"
                    onClick={() => {
                      if (confirm(t('common.confirmDelete'))) {
                        void remove(selected.id)
                        setSelectedId(null)
                      }
                    }}
                  >
                    {t('common.delete')}
                  </Button>
                </div>
                {selected.mediaError && (
                  <p className="mt-2 text-xs text-rose-300">{selected.mediaError}</p>
                )}
              </div>
            )}

            {loading ? (
              <p className="text-sm text-ink-400">{t('common.loading')}</p>
            ) : entries.length === 0 ? (
              <EmptyState message={t('timeline.noEntries')} />
            ) : (
              <ul className="space-y-2 text-sm">
                {entries.map((e) => (
                  <li
                    key={e.id}
                    className={[
                      'cursor-pointer rounded-lg border px-3 py-2',
                      selectedId === e.id
                        ? 'border-brand-500 bg-brand-950/30'
                        : 'border-ink-800 bg-ink-900/40'
                    ].join(' ')}
                    onClick={() => setSelectedId(e.id)}
                  >
                    <span className="font-mono text-xs text-brand-300">
                      {e.startTime.toFixed(1)}–{e.endTime.toFixed(1)}s
                    </span>{' '}
                    <span className="rounded bg-ink-800 px-1 text-[10px] text-ink-300">
                      {snapVideoSeconds(e.endTime - e.startTime)}s
                    </span>{' '}
                    <span className="text-ink-200">{labels[e.id]}</span>{' '}
                    <span
                      className={[
                        'rounded px-1.5 py-0.5 text-[10px]',
                        mediaBadge[e.mediaStatus]
                      ].join(' ')}
                    >
                      {e.mediaStatus}
                    </span>
                    {e.videoJobId && (
                      <span className="ml-1 font-mono text-[10px] text-ink-500">
                        job:{e.videoJobId.slice(0, 8)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {progressLog.length > 0 && (
              <pre className="mt-4 max-h-32 overflow-auto rounded-xl border border-ink-800 bg-ink-950 p-3 text-xs text-ink-300">
                {progressLog.join('\n')}
              </pre>
            )}
            {genResult && (
              <pre className="mt-3 max-h-64 overflow-auto rounded-xl border border-ink-800 bg-ink-950 p-4 text-xs text-ink-300">
                {genResult}
              </pre>
            )}
          </div>
        </div>

        <aside className="w-72 shrink-0 overflow-y-auto bg-ink-900/40 p-5">
          <div className="mb-4">
            <Label>{t('timeline.clipLength')}</Label>
            <div className="mt-1 flex gap-2">
              <Button
                variant={clipSeconds === 6 ? 'primary' : 'secondary'}
                onClick={() => setClipSeconds(6)}
              >
                6s
              </Button>
              <Button
                variant={clipSeconds === 10 ? 'primary' : 'secondary'}
                onClick={() => setClipSeconds(10)}
              >
                10s
              </Button>
            </div>
          </div>
          <AssetLibrary
            characters={characters}
            scenes={scenes}
            props={props}
            onAdd={(p) => void addAsset(p)}
          />
        </aside>
      </div>
    </div>
  )
}
