import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Stage, Layer, Rect, Text, Line, Group } from 'react-konva'
import type Konva from 'konva'
import type { TimelineEntry } from '../../../types/domain'
import { TimelineService } from '../../../application/TimelineService'
import {
  clampPxPerSec,
  durationToWidth,
  tickTimes,
  timeToX,
  xToTime
} from '../../../domain/timelineLayout'
import { anchorsFromEntries, snapTime } from '../../../domain/timelineSnap'
import { snapClipRange } from '../../../domain/videoDuration'
import {
  buildTimelineLanes,
  clampWorkArea,
  TIMELINE_LANE_HEIGHT,
  TIMELINE_LANE_LABEL_W,
  TIMELINE_LANE_ORDER,
  timelineLaneOffsetY,
  timelineLaneStackHeight,
  type BuildTimelineLanesInput,
  type TimelineLaneClip,
  type TimelineLaneFill,
  type TimelineLaneId
} from '../../../domain/timelineLanes'
import type { AssetDropPayload } from './TimelineCanvas'
import { timelineTrackLabel } from './timelineLabels'

const SHOT_H = TIMELINE_LANE_HEIGHT.shot
const RULER_H = 24
const PAD = 8
const LANE_PAD = TIMELINE_LANE_LABEL_W + PAD

interface KonvaTimelineProps {
  entries: TimelineEntry[]
  labels: Record<string, string>
  selectedId: string | null
  playhead: number
  pxPerSec: number
  onPxPerSecChange: (v: number) => void
  onPlayheadChange: (t: number) => void
  onSelect: (id: string | null) => void
  onMove: (id: string, startTime: number, endTime: number) => void
  onDropAsset: (payload: AssetDropPayload, atTime: number) => void
  /** Pack all clips end-to-end (no gaps), preserving duration. */
  onPackAbut?: () => void
  packAbutBusy?: boolean
  width: number
  snapEnabled?: boolean
  snapGridSec?: number
  onSnapEnabledChange?: (v: boolean) => void
  onSnapGridSecChange?: (v: number) => void
  showLanes?: boolean
  workStart?: number
  workEnd?: number
  onWorkAreaChange?: (start: number, end: number) => void
  stillByEntryId?: Record<string, string | null | undefined>
  characters?: BuildTimelineLanesInput['characters']
  scenes?: BuildTimelineLanesInput['scenes']
  props?: BuildTimelineLanesInput['props']
  actions?: BuildTimelineLanesInput['actions']
  pictureByKey?: Record<string, number>
}

function clipFill(entry: TimelineEntry): string {
  if (entry.mediaStatus === 'READY') return '#059669'
  if (entry.mediaStatus === 'FAILED') return '#e11d48'
  if (entry.mediaStatus === 'GENERATING') return '#d97706'
  if (entry.characterId) return '#7c3aed'
  if (entry.sceneId) return '#0891b2'
  if (entry.propId) return '#ca8a04'
  if (entry.actionId) return '#db2777'
  return '#475569'
}

function laneFillColor(fill: TimelineLaneFill): string {
  if (fill === 'ready') return '#059669'
  if (fill === 'failed') return '#e11d48'
  if (fill === 'generating') return '#d97706'
  if (fill === 'character') return '#6d28d9'
  if (fill === 'scene') return '#0e7490'
  if (fill === 'prop') return '#a16207'
  if (fill === 'action') return '#be185d'
  if (fill === 'keyframe') return '#4f46e5'
  return '#334155'
}

function laneI18nKey(id: TimelineLaneId): string {
  return `timeline.lanes.${id}`
}

export function KonvaTimeline({
  entries,
  labels,
  selectedId,
  playhead,
  pxPerSec,
  onPxPerSecChange,
  onPlayheadChange,
  onSelect,
  onMove,
  onDropAsset,
  onPackAbut,
  packAbutBusy = false,
  width,
  snapEnabled = true,
  snapGridSec = 0.5,
  onSnapEnabledChange,
  onSnapGridSecChange,
  showLanes = true,
  workStart,
  workEnd,
  onWorkAreaChange,
  stillByEntryId,
  characters,
  scenes,
  props,
  actions,
  pictureByKey
}: KonvaTimelineProps): JSX.Element {
  const { t } = useTranslation()
  const stageRef = useRef<Konva.Stage>(null)
  const total = Math.max(TimelineService.totalDuration(entries), 12)
  const contentW = Math.max(width - 16, timeToX(total, pxPerSec, LANE_PAD) + 80)
  const lanesH = showLanes ? timelineLaneStackHeight() : SHOT_H
  const height = RULER_H + lanesH + 16
  const ticks = useMemo(() => tickTimes(total), [total])
  const alreadyPacked = useMemo(
    () => TimelineService.isAlreadyPacked(entries),
    [entries]
  )
  const lanes = useMemo(
    () =>
      showLanes
        ? buildTimelineLanes({
            entries,
            labels,
            characters,
            scenes,
            props,
            actions,
            stillByEntryId,
            pictureByKey
          })
        : [],
    [
      showLanes,
      entries,
      labels,
      characters,
      scenes,
      props,
      actions,
      stillByEntryId,
      pictureByKey
    ]
  )

  const area = clampWorkArea(
    workStart ?? 0,
    workEnd ?? total,
    total
  )
  const showWork = Boolean(onWorkAreaChange)

  const [dragPreview, setDragPreview] = useState<Record<
    string,
    { start: number; end: number }
  >>({})

  const displayRange = (
    e: TimelineEntry
  ): { start: number; end: number } =>
    dragPreview[e.id] ?? { start: e.startTime, end: e.endTime }

  const shotY = RULER_H + 4 + (showLanes ? timelineLaneOffsetY('shot') : 0)

  const renderLaneClip = (clip: TimelineLaneClip, h: number, y: number) => {
    const x = timeToX(clip.startTime, pxPerSec, LANE_PAD)
    const w = Math.max(16, durationToWidth(clip.endTime - clip.startTime, pxPerSec))
    const selected = selectedId === clip.entryId
    const pic = clip.pictureNo != null ? `P${clip.pictureNo}` : ''
    const text = [pic, clip.label].filter(Boolean).join(' ')
    return (
      <Group
        key={clip.id}
        x={x}
        y={y}
        onClick={() => onSelect(clip.entryId)}
        onTap={() => onSelect(clip.entryId)}
      >
        <Rect
          width={w}
          height={h}
          fill={laneFillColor(clip.fill)}
          cornerRadius={4}
          opacity={0.92}
          stroke={selected ? '#fff' : 'transparent'}
          strokeWidth={selected ? 1.5 : 0}
        />
        <Text
          text={timelineTrackLabel(text || '·')}
          x={4}
          y={4}
          width={Math.max(10, w - 8)}
          height={h - 6}
          fontSize={10}
          fill="#fff"
          ellipsis
          wrap="none"
        />
      </Group>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3 text-xs text-ink-400">
        <label className="flex items-center gap-2">
          <span>{t('timeline.zoom')}</span>
          <input
            type="range"
            min={12}
            max={120}
            value={pxPerSec}
            onChange={(e) =>
              onPxPerSecChange(clampPxPerSec(Number(e.target.value)))
            }
            aria-label={t('timeline.zoom')}
          />
          <span className="font-mono">
            {t('timeline.pxPerSec', { n: pxPerSec })}
          </span>
        </label>
        <span className="font-mono">
          {t('timeline.playhead', { time: playhead.toFixed(1) })}
        </span>
        <div
          className="flex flex-wrap items-center gap-2 rounded-lg border border-ink-700 bg-ink-900/80 px-2 py-1"
          title={t('timeline.snapHint')}
        >
          <label className="flex items-center gap-1.5 text-[11px] text-ink-200">
            <input
              type="checkbox"
              className="rounded border-ink-600"
              checked={snapEnabled}
              onChange={(e) => onSnapEnabledChange?.(e.target.checked)}
              disabled={!onSnapEnabledChange}
            />
            <span>{t('timeline.snapEnabled')}</span>
          </label>
          {snapEnabled ? (
            <label className="flex items-center gap-1 border-l border-ink-700 pl-2 text-[11px] text-ink-300">
              <span className="text-ink-500">{t('timeline.snapGridSec')}</span>
              <input
                type="number"
                min={0.1}
                max={5}
                step={0.1}
                className="w-14 rounded-md border border-ink-700 bg-ink-950 px-1.5 py-0.5 font-mono text-[11px] text-ink-100 focus:border-brand-500 focus:outline-none"
                value={snapGridSec}
                disabled={!onSnapGridSecChange}
                onChange={(e) => {
                  const n = Number(e.target.value)
                  if (Number.isFinite(n) && n > 0) {
                    onSnapGridSecChange?.(Math.min(5, Math.max(0.1, n)))
                  }
                }}
                aria-label={t('timeline.snapGridSec')}
              />
            </label>
          ) : null}
        </div>
        {showWork ? (
          <span
            className="rounded-lg border border-indigo-800/80 bg-indigo-950/40 px-2 py-1 font-mono text-[11px] text-indigo-100"
            data-testid="work-area-label"
            title={t('timeline.desk.workAreaHint')}
          >
            {t('timeline.desk.workArea')} {area.start.toFixed(1)}–{area.end.toFixed(1)}s
          </span>
        ) : null}
        {onPackAbut ? (
          <button
            type="button"
            className="rounded-lg border border-ink-700 bg-ink-900 px-2.5 py-1 text-[11px] font-medium text-ink-200 transition hover:border-brand-600 hover:bg-ink-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => onPackAbut()}
            disabled={
              packAbutBusy || entries.length < 2 || alreadyPacked
            }
            title={t('timeline.packAbutHint')}
          >
            {packAbutBusy
              ? t('timeline.packAbutBusy')
              : t('timeline.packAbut')}
          </button>
        ) : null}
      </div>

      <div
        className="overflow-x-auto rounded-xl border border-ink-800 bg-ink-950"
        data-testid="director-lanes"
        onDragOver={(e) => {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'copy'
        }}
        onDrop={(e) => {
          e.preventDefault()
          const raw = e.dataTransfer.getData('application/x-idm-asset')
          if (!raw) return
          try {
            const payload = JSON.parse(raw) as AssetDropPayload
            const stage = stageRef.current
            if (!stage) return
            const rect = stage.container().getBoundingClientRect()
            const x =
              e.clientX -
              rect.left +
              (stage.container().parentElement?.scrollLeft ?? 0)
            onDropAsset(payload, xToTime(x, pxPerSec, LANE_PAD))
          } catch {
            // ignore
          }
        }}
      >
        <Stage
          ref={stageRef}
          width={contentW}
          height={height}
          onMouseDown={(evt) => {
            if (evt.target === evt.target.getStage()) onSelect(null)
          }}
        >
          <Layer>
            {showLanes
              ? TIMELINE_LANE_ORDER.map((id) => {
                  const y = RULER_H + 4 + timelineLaneOffsetY(id)
                  const h = TIMELINE_LANE_HEIGHT[id]
                  return (
                    <Group key={id}>
                      <Rect
                        x={LANE_PAD}
                        y={y}
                        width={contentW - LANE_PAD - PAD}
                        height={h}
                        fill="#0f172a"
                        stroke="#1e293b"
                        cornerRadius={4}
                      />
                      <Text
                        x={6}
                        y={y + Math.max(4, (h - 12) / 2)}
                        width={TIMELINE_LANE_LABEL_W - 10}
                        text={t(laneI18nKey(id))}
                        fontSize={10}
                        fill="#94a3b8"
                      />
                    </Group>
                  )
                })
              : (
                <Rect
                  x={LANE_PAD}
                  y={RULER_H + 4}
                  width={contentW - LANE_PAD - PAD}
                  height={SHOT_H}
                  fill="#0f172a"
                  stroke="#1e293b"
                  cornerRadius={6}
                />
              )}

            {showWork ? (
              <Rect
                x={timeToX(area.start, pxPerSec, LANE_PAD)}
                y={RULER_H}
                width={Math.max(
                  4,
                  durationToWidth(area.end - area.start, pxPerSec)
                )}
                height={lanesH + 8}
                fill="rgba(99,102,241,0.12)"
                stroke="#6366f1"
                strokeWidth={1}
                dash={[4, 4]}
                listening={false}
              />
            ) : null}

            {ticks.map((tick) => {
              const x = timeToX(tick, pxPerSec, LANE_PAD)
              return (
                <Group key={tick}>
                  <Line
                    points={[x, RULER_H - 6, x, RULER_H]}
                    stroke="#64748b"
                    strokeWidth={1}
                  />
                  <Text
                    x={x + 2}
                    y={4}
                    text={`${tick}s`}
                    fontSize={10}
                    fill="#94a3b8"
                  />
                </Group>
              )
            })}

            {entries.map((row) => {
              const range = displayRange(row)
              const x = timeToX(range.start, pxPerSec, LANE_PAD)
              const w = Math.max(
                24,
                durationToWidth(range.end - range.start, pxPerSec)
              )
              const selected = selectedId === row.id
              const badge = showLanes
                ? lanes
                    .find((l) => l.id === 'shot')
                    ?.clips.find((c) => c.entryId === row.id)?.badge
                : null
              return (
                <Group
                  key={row.id}
                  x={x}
                  y={shotY + 4}
                  draggable
                  dragBoundFunc={(pos) => ({
                    x: Math.max(LANE_PAD, pos.x),
                    y: shotY + 4
                  })}
                  onClick={() => onSelect(row.id)}
                  onTap={() => onSelect(row.id)}
                  onDragMove={(evt) => {
                    const nx = evt.target.x()
                    const start = xToTime(nx, pxPerSec, LANE_PAD)
                    const dur = range.end - range.start
                    const next = snapClipRange(start, start + dur)
                    setDragPreview((p) => ({
                      ...p,
                      [row.id]: { start: next.startTime, end: next.endTime }
                    }))
                  }}
                  onDragEnd={() => {
                    const prev = dragPreview[row.id]
                    if (prev) {
                      const anchors = anchorsFromEntries(
                        entries.filter((e) => e.id !== row.id)
                      )
                      const start = snapTime(prev.start, {
                        enabled: snapEnabled,
                        grid: snapGridSec,
                        anchors
                      })
                      const snapped = snapClipRange(
                        start,
                        start + (prev.end - prev.start)
                      )
                      onMove(row.id, snapped.startTime, snapped.endTime)
                    }
                    setDragPreview((p) => {
                      const n = { ...p }
                      delete n[row.id]
                      return n
                    })
                  }}
                >
                  <Rect
                    width={w}
                    height={SHOT_H - 8}
                    fill={clipFill(row)}
                    cornerRadius={6}
                    stroke={selected ? '#fff' : 'transparent'}
                    strokeWidth={selected ? 2 : 0}
                    shadowBlur={selected ? 8 : 0}
                  />
                  <Text
                    text={timelineTrackLabel(
                      labels[row.id] || `#${row.order + 1}`
                    )}
                    x={6}
                    y={5}
                    width={Math.max(16, w - 16)}
                    height={badge ? 14 : SHOT_H - 14}
                    fontSize={11}
                    lineHeight={1.25}
                    fill="#fff"
                    ellipsis
                    wrap="char"
                  />
                  {badge ? (
                    <Text
                      text={badge}
                      x={6}
                      y={20}
                      width={Math.max(16, w - 16)}
                      fontSize={9}
                      fill="#fecdd3"
                      ellipsis
                      wrap="none"
                    />
                  ) : null}
                  <Rect
                    x={w - 8}
                    y={0}
                    width={8}
                    height={SHOT_H - 8}
                    fill="rgba(0,0,0,0.25)"
                    draggable
                    dragBoundFunc={(pos) => ({
                      x: Math.max(24, pos.x),
                      y: 0
                    })}
                    onDragMove={(evt) => {
                      const handleX = evt.target.x()
                      const start = range.start
                      const end = start + handleX / pxPerSec
                      const next = snapClipRange(start, end)
                      setDragPreview((p) => ({
                        ...p,
                        [row.id]: { start: next.startTime, end: next.endTime }
                      }))
                      evt.target.x(
                        durationToWidth(
                          next.endTime - next.startTime,
                          pxPerSec
                        ) - 8
                      )
                    }}
                    onDragEnd={() => {
                      const prev = dragPreview[row.id]
                      if (prev) {
                        const next = snapClipRange(prev.start, prev.end)
                        onMove(row.id, next.startTime, next.endTime)
                      }
                      setDragPreview((p) => {
                        const n = { ...p }
                        delete n[row.id]
                        return n
                      })
                    }}
                  />
                </Group>
              )
            })}

            {showLanes
              ? lanes
                  .filter((lane) => lane.id !== 'shot')
                  .flatMap((lane) => {
                    const y =
                      RULER_H +
                      6 +
                      timelineLaneOffsetY(lane.id)
                    const h = TIMELINE_LANE_HEIGHT[lane.id] - 4
                    return lane.clips.map((clip) =>
                      renderLaneClip(clip, h, y)
                    )
                  })
              : null}

            {showWork ? (
              <>
                {(['start', 'end'] as const).map((which) => {
                  const t0 = which === 'start' ? area.start : area.end
                  return (
                    <Group
                      key={which}
                      x={timeToX(t0, pxPerSec, LANE_PAD)}
                      y={2}
                      draggable
                      dragBoundFunc={(pos) => ({
                        x: Math.max(LANE_PAD, pos.x),
                        y: 2
                      })}
                      onDragMove={(evt) => {
                        const nextT = xToTime(evt.target.x(), pxPerSec, LANE_PAD)
                        const snapped = snapTime(nextT, {
                          enabled: snapEnabled,
                          grid: snapGridSec,
                          anchors: []
                        })
                        const next =
                          which === 'start'
                            ? clampWorkArea(snapped, area.end, total)
                            : clampWorkArea(area.start, snapped, total)
                        onWorkAreaChange?.(next.start, next.end)
                      }}
                    >
                      <Rect
                        x={-4}
                        y={0}
                        width={8}
                        height={RULER_H - 4}
                        fill="#818cf8"
                        cornerRadius={2}
                      />
                    </Group>
                  )
                })}
              </>
            ) : null}

            <Group
              x={timeToX(playhead, pxPerSec, LANE_PAD)}
              y={0}
              draggable
              dragBoundFunc={(pos) => ({
                x: Math.max(LANE_PAD, pos.x),
                y: 0
              })}
              onDragMove={(evt) => {
                onPlayheadChange(xToTime(evt.target.x(), pxPerSec, LANE_PAD))
              }}
            >
              <Line
                points={[0, 0, 0, height]}
                stroke="#f472b6"
                strokeWidth={2}
              />
              <Rect x={-6} y={0} width={12} height={10} fill="#f472b6" />
            </Group>
          </Layer>
        </Stage>
      </div>
    </div>
  )
}
