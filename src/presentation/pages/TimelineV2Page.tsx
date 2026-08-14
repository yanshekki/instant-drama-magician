import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { snapVideoSeconds } from '../../domain/videoDuration'
import { pageRootClass, timelineBottomBarClass } from '../lib/mobileLayout'
import { writeTimelinePagePref } from '../lib/timelinePagePref'
import { PageHeader } from '../components/PageHeader'
import { Button, EmptyState, Select } from '../components/ui'
import { KonvaTimeline } from '../components/timeline/KonvaTimeline'
import { PreviewPlayer } from '../components/timeline/PreviewPlayer'
import { TimelineAdvancedStudio } from '../components/timeline/TimelineAdvancedStudio'
import { TimelineGraphCanvas } from '../components/timeline/TimelineGraphCanvas'
import { TimelineSetupPicker } from '../components/timeline/TimelineSetupPicker'
import { ExportFinalDialog } from '../components/ExportFinalDialog'
import { useTimelineV2Studio } from '../hooks/useTimelineV2Studio'

export function TimelineV2Page(): JSX.Element {
  const s = useTimelineV2Studio()
  const { t } = s
  const konvaHostRef = useRef<HTMLDivElement | null>(null)
  const [konvaWidth, setKonvaWidth] = useState(360)

  useEffect(() => {
    writeTimelinePagePref('v2')
  }, [])

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
  }, [s.activeStoryId])

  const storyPicker = (
    <Select
      aria-label={t('timeline.story')}
      className="!w-[12rem]"
      value={s.activeStoryId ?? ''}
      onChange={(e) => {
        const id = e.target.value || null
        s.setActiveStoryId(id)
        s.selectClip(null)
      }}
      disabled={s.stories.length === 0}
    >
      {s.stories.length === 0 ? (
        <option value="">{t('timeline.noStories')}</option>
      ) : (
        s.stories.map((story) => (
          <option key={story.id} value={story.id}>
            {story.title}
          </option>
        ))
      )}
    </Select>
  )

  const classicLink = (
    <Link
      to="/timeline"
      className="inline-flex h-10 items-center rounded-lg border border-ink-700 bg-ink-900 px-3 text-sm text-ink-200 hover:border-brand-500/40 hover:text-ink-50"
      onClick={() => writeTimelinePagePref('classic')}
    >
      {t('timeline.graph.useClassic')}
    </Link>
  )

  const toolbar = (
    <>
      {storyPicker}
      <Button variant="secondary" onClick={s.handleTogglePlay}>
        {s.isPlaying ? t('timeline.toolbarPause') : t('timeline.toolbarPlay')}
      </Button>
      <Button
        variant="ghost"
        onClick={() => void s.handleUndoLocal()}
        disabled={!s.history.canUndo}
      >
        {t('timeline.undoHint')}
      </Button>
      <Button
        variant="ghost"
        onClick={() => void s.handleRedoLocal()}
        disabled={!s.history.canRedo}
      >
        {t('timeline.redoHint')}
      </Button>
      <Button
        variant="secondary"
        onClick={() => s.setExportDialogOpen(true)}
        disabled={s.exporting}
      >
        {s.exporting ? t('common.exporting') : t('timeline.toolbarExportFinal')}
      </Button>
      <Button
        variant="ghost"
        onClick={() => {
          s.setExportHistoryOpen(true)
          void s.refreshExportHistory()
        }}
      >
        {t('timeline.exportHistory')}
        {s.exportHistory.length > 0 ? (
          <span className="ml-1 rounded-full bg-brand-900/70 px-1.5 text-[10px] text-brand-100">
            {s.exportHistory.length}
          </span>
        ) : null}
      </Button>
      <Button
        variant="secondary"
        disabled={!s.activeStoryId || s.entries.length === 0 || s.busy}
        onClick={() => s.setAdvancedOpen(true)}
      >
        {t('timeline.advanced.open')}
      </Button>
      {s.busy ? (
        <Button variant="danger" onClick={() => void s.handleCancel()}>
          {t('timeline.toolbarCancel')}
        </Button>
      ) : (
        <>
          {s.failedCount > 0 && (
            <Button
              variant="secondary"
              onClick={() => void s.handleGenerate(true)}
              disabled={s.exporting}
            >
              {t('timeline.toolbarRetry')} ({s.failedCount})
            </Button>
          )}
          <Button onClick={() => void s.handleGenerate(false)} disabled={s.exporting}>
            {t('timeline.toolbarGenerate')}
          </Button>
        </>
      )}
    </>
  )

  if (!s.activeStoryId) {
    return (
      <div className={pageRootClass}>
        <PageHeader
          title={t('timeline.graph.title')}
          subtitle={s.timelineSubtitleOrFallback(
            Boolean(s.activeStory),
            s.activeStory?.title,
            t('timeline.graph.subtitle')
          )}
          actions={
            <>
              {classicLink}
              {storyPicker}
            </>
          }
        />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 overflow-y-auto p-6">
          <EmptyState message={t('timeline.pickStoryHint')} />
          {s.stories.length === 0 && (
            <Button variant="secondary" onClick={() => s.navigate('/')}>
              {t('timeline.goStories')}
            </Button>
          )}
        </div>
      </div>
    )
  }

  const selected = s.selected

  return (
    <div className={pageRootClass}>
      <PageHeader
        title={t('timeline.graph.title')}
        subtitle={s.timelineHeaderSubtitle(
          s.activeStory,
          t('timeline.graph.subtitle')
        )}
        actions={
          <>
            <div className="w-full md:hidden">{storyPicker}</div>
            <div className="hidden w-full flex-wrap items-center justify-end gap-2 md:flex">
              {classicLink}
              {toolbar}
            </div>
          </>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex flex-wrap items-center gap-1.5 border-b border-ink-800/80 px-3 py-2 sm:px-6">
          <span className="rounded-full border border-ink-700/80 bg-ink-900/60 px-2.5 py-1 text-[11px] text-ink-300">
            {t('timeline.duration', { seconds: s.totalDuration.toFixed(1) })}
          </span>
          <span className="rounded-full border border-ink-700/80 bg-ink-900/60 px-2.5 py-1 text-[11px] text-emerald-200/90">
            {t('timeline.readyCount', {
              ready: s.readyCount,
              total: s.entries.length
            })}
          </span>
          {s.failedCount > 0 && (
            <span className="rounded-full border border-rose-900/50 bg-rose-950/40 px-2.5 py-1 text-[11px] text-rose-200">
              {t('timeline.failedCount', { n: s.failedCount })}
            </span>
          )}
          <span className="rounded-full border border-ink-700/80 bg-ink-900/60 px-2.5 py-1 text-[11px] text-brand-200">
            {t('timeline.videoMode', { mode: s.videoMode })}
          </span>
        </div>

        {s.missingRefs.length > 0 && s.videoMode !== 'stub' && (
          <div className="border-b border-amber-900/40 bg-amber-950/30 px-6 py-2 text-xs text-amber-100">
            {t('pipeline.missingRefBanner', {
              names: s.missingRefs.map((c) => c.name).join(', ')
            })}
          </div>
        )}

        {s.busy && (
          <div className="border-b border-ink-800/80 px-6 py-3">
            <div className="mb-1.5 flex justify-between text-[11px] text-ink-400">
              <span>
                {t('common.generating')}
                {s.timelineStepSuffix(s.currentStepLabel, 0, 0)}
              </span>
              <span>{s.progressPct}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-ink-800">
              <div
                className="h-full bg-brand-500 transition-all"
                style={{ width: `${Math.max(s.progressPct, 4)}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 py-2 sm:px-6 sm:py-3">
          {s.timelineErrorBannerElement(s.error, s.actionError, (m) =>
            s.formatUserError(m, t)
          )}

          <TimelineGraphCanvas
            layout={s.graphLayout}
            selectedNodeId={s.graphNodeId}
            onSelectNode={(id) => {
              s.setGraphNodeId(id)
              const node = s.graphLayout.nodes.find((n) => n.id === id)
              if (node?.entryId && node.entryId !== s.selectedId) {
                s.selectClip(node.entryId)
              }
            }}
            handlers={{
              promptValue: s.dialogue,
              revisionValue: selected ? s.revisionByEntry[selected.id] ?? '' : '',
              onPromptChange: s.setDialogue,
              onRevisionChange: (v) => {
                if (!selected) return
                s.setRevisionByEntry((prev) => ({ ...prev, [selected.id]: v }))
              },
              onSavePrompt: () => void s.handleSaveDialogue(),
              onGenStill: () => s.genStill(false),
              onRegenStill: () => s.genStill(true),
              onRefineStill: s.refineStill,
              onOpenSetup: () => s.setSetupOpen(true),
              onOpenStoryEditor: s.openStoryEditor,
              onOpenEntity: s.openEntity,
              stillBusy: s.stillBusy,
              videoSlot: (
                <PreviewPlayer
                  className="h-full min-h-[10rem] border-0 shadow-none"
                  entry={selected}
                  playhead={s.playhead}
                  isPlaying={s.isPlaying}
                  onMediaClock={s.handleMediaClock}
                  onClipEnded={s.handleClipEnded}
                  onGenerate={
                    selected && selected.mediaStatus !== 'READY'
                      ? () => void s.handleRunClip(selected.id)
                      : undefined
                  }
                  generateDisabled={s.busy}
                  generateLabel={
                    selected
                      ? s.clipGenerateLabel(selected.id, selected.mediaStatus)
                      : t('timeline.generateClip')
                  }
                />
              ),
              generateVideoSlot: selected ? (
                <>
                  <Button
                    variant="secondary"
                    className="!px-2 !py-1 !text-[11px]"
                    disabled={s.busy}
                    onClick={() => void s.handleRunClip(selected.id)}
                  >
                    {s.timelineGeneratingLabel(
                      s.clipBusyId === selected.id,
                      t('common.generating'),
                      s.clipGenerateLabel(selected.id, selected.mediaStatus)
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    className="!px-2 !py-1 !text-[11px]"
                    onClick={() => void s.handleImportClip()}
                  >
                    {t('timeline.importClip')}
                  </Button>
                  {selected.mediaPath ? (
                    <Button
                      variant="ghost"
                      className="!px-2 !py-1 !text-[11px]"
                      onClick={() => void s.handleOpenClip()}
                    >
                      {t('timeline.openClip')}
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    className="!px-2 !py-1 !text-[11px]"
                    onClick={() => void s.handleClipDuration(6)}
                  >
                    6s
                  </Button>
                  <Button
                    variant="ghost"
                    className="!px-2 !py-1 !text-[11px]"
                    onClick={() => void s.handleClipDuration(10)}
                  >
                    10s
                  </Button>
                  <Button
                    variant="danger"
                    className="!px-2 !py-1 !text-[11px]"
                    onClick={() => void s.handleDeleteClip()}
                  >
                    {t('common.delete')}
                  </Button>
                </>
              ) : null
            }}
          />

          <div
            ref={konvaHostRef}
            className="shrink-0 overflow-x-auto rounded-2xl border border-ink-800/80 bg-ink-900/40 p-2 sm:p-3"
          >
            <KonvaTimeline
              entries={s.entries}
              labels={s.labels}
              selectedId={s.selectedId}
              playhead={s.playhead}
              pxPerSec={s.pxPerSec}
              onPxPerSecChange={s.setPxPerSec}
              onPlayheadChange={(time) => {
                s.timelineMakeScrub(
                  s.entries,
                  s.selectedId,
                  s.setIsPlaying,
                  s.setPlayhead,
                  (id) => s.selectClip(id)
                )(time)
              }}
              onSelect={s.selectClip}
              onMove={(id, start, end) => void s.persistMove(id, start, end)}
              onDropAsset={(payload, at) => void s.addAsset(payload, at)}
              onPackAbut={() => void s.handlePackAbut()}
              packAbutBusy={s.packAbutBusy}
              snapEnabled={s.snapEnabled}
              snapGridSec={s.snapGridSec}
              onSnapEnabledChange={(v) =>
                void s.persistSnapSettings({ snapEnabled: v })
              }
              onSnapGridSecChange={(v) =>
                void s.persistSnapSettings({ snapGridSec: v })
              }
              width={Math.max(konvaWidth - 8, 280)}
            />
          </div>
        </div>
      </div>

      <div className={timelineBottomBarClass}>
        {classicLink}
        {s.busy ? (
          <Button
            variant="danger"
            className="min-h-11 flex-1"
            onClick={() => void s.handleCancel()}
          >
            {t('timeline.toolbarCancel')}
          </Button>
        ) : (
          <>
            <Button
              className="min-h-11 flex-1"
              disabled={s.exporting}
              onClick={() => void s.handleGenerate(false)}
            >
              {t('timeline.toolbarGenerate')}
            </Button>
            <Button
              variant="secondary"
              className="min-h-11 flex-1"
              disabled={s.exporting}
              onClick={() => s.setExportDialogOpen(true)}
            >
              {t('timeline.toolbarExportFinal')}
            </Button>
          </>
        )}
      </div>

      <ExportFinalDialog
        open={s.exportDialogOpen}
        initial={s.exportInitial}
        busy={s.exporting}
        onCancel={s.timelineMakeMaybeClose(
          () => s.exporting,
          () => s.setExportDialogOpen(false)
        )}
        onConfirm={(opts) => void s.handleExportFinal(opts)}
      />

      <TimelineSetupPicker
        open={s.setupOpen}
        clipSeconds={
          selected
            ? (snapVideoSeconds(selected.endTime - selected.startTime) as 6 | 10)
            : s.clipSeconds
        }
        settings={s.settings}
        busy={s.busy}
        onClose={() => s.setSetupOpen(false)}
        onApply={(next) => void s.applySetup(next)}
      />

      {s.exportHistoryOpen ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-overlay/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={t('timeline.exportHistory')}
          onClick={s.timelineMakeMaybeClose(
            () => Boolean(s.exportDeleteBusyId),
            () => s.setExportHistoryOpen(false)
          )}
        >
          <div
            className="flex max-h-[min(85vh,36rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-ink-700 bg-ink-950 shadow-theme-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-ink-800 px-5 py-4">
              <h2 className="text-base font-semibold text-ink-50">
                {t('timeline.exportHistory')}
              </h2>
              <button
                type="button"
                className="rounded-lg px-2 py-1 text-sm text-ink-400 hover:bg-ink-800"
                onClick={() => s.setExportHistoryOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
              {s.exportHistory.length === 0 ? (
                <p className="px-2 py-8 text-center text-xs text-ink-500">
                  {t('timeline.exportHistoryEmpty')}
                </p>
              ) : (
                <ul className="space-y-2">
                  {s.exportHistory.map((item) => (
                    <li
                      key={item.id}
                      className="rounded-xl border border-ink-800/80 bg-ink-900/50 px-3 py-2.5"
                    >
                      <p className="truncate font-mono text-[12px] text-ink-100">
                        {item.fileName}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {s.timelineMaybeAdvanced(s.activeStoryId, (id) => (
        <TimelineAdvancedStudio
          storyId={id}
          open={s.advancedOpen}
          onClose={() => s.setAdvancedOpen(false)}
          onRefreshTimeline={() => void s.reload()}
          onStartVideoQueue={(entryIds, opts) => {
            s.startClipPrepQueue(id, entryIds, {
              skipStillIfExists: opts?.skipStill !== false
            })
          }}
        />
      ))}
    </div>
  )
}
