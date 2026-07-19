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
import type { AssetDropPayload } from './TimelineCanvas'

const TRACK_H = 56
const RULER_H = 24
const PAD = 12

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
  onSnapGridSecChange
}: KonvaTimelineProps): JSX.Element {
  const { t } = useTranslation()
  const stageRef = useRef<Konva.Stage>(null)
  const total = Math.max(TimelineService.totalDuration(entries), 12)
  const contentW = Math.max(width - 16, timeToX(total, pxPerSec, PAD) + 80)
  const height = RULER_H + TRACK_H + 28
  const ticks = useMemo(() => tickTimes(total), [total])
  const alreadyPacked = useMemo(
    () => TimelineService.isAlreadyPacked(entries),
    [entries]
  )

  const [dragPreview, setDragPreview] = useState<Record<
    string,
    { start: number; end: number }
  >>({})

  const displayRange = (
    e: TimelineEntry
  ): { start: number; end: number } =>
    dragPreview[e.id] ?? { start: e.startTime, end: e.endTime }

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
            const x = e.clientX - rect.left + (stage.container().parentElement?.scrollLeft ?? 0)
            onDropAsset(payload, xToTime(x, pxPerSec, PAD))
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
            {/* track background */}
            <Rect
              x={PAD}
              y={RULER_H + 4}
              width={contentW - PAD * 2}
              height={TRACK_H}
              fill="#0f172a"
              stroke="#1e293b"
              cornerRadius={6}
            />

            {/* ruler ticks */}
            {ticks.map((t) => {
              const x = timeToX(t, pxPerSec, PAD)
              return (
                <Group key={t}>
                  <Line
                    points={[x, RULER_H - 6, x, RULER_H]}
                    stroke="#64748b"
                    strokeWidth={1}
                  />
                  <Text
                    x={x + 2}
                    y={4}
                    text={`${t}s`}
                    fontSize={10}
                    fill="#94a3b8"
                  />
                </Group>
              )
            })}

            {/* clips */}
            {entries.map((entry) => {
              const range = displayRange(entry)
              const x = timeToX(range.start, pxPerSec, PAD)
              const w = Math.max(
                24,
                durationToWidth(range.end - range.start, pxPerSec)
              )
              const selected = selectedId === entry.id
              return (
                <Group
                  key={entry.id}
                  x={x}
                  y={RULER_H + 10}
                  draggable
                  dragBoundFunc={(pos) => ({
                    x: Math.max(PAD, pos.x),
                    y: RULER_H + 10
                  })}
                  onClick={() => onSelect(entry.id)}
                  onTap={() => onSelect(entry.id)}
                  onDragMove={(evt) => {
                    const nx = evt.target.x()
                    const start = xToTime(nx, pxPerSec, PAD)
                    const dur = range.end - range.start
                    const next = snapClipRange(start, start + dur)
                    setDragPreview((p) => ({
                      ...p,
                      [entry.id]: { start: next.startTime, end: next.endTime }
                    }))
                  }}
                  onDragEnd={() => {
                    const prev = dragPreview[entry.id]
                    if (prev) {
                      const anchors = anchorsFromEntries(
                        entries.filter((e) => e.id !== entry.id)
                      )
                      const start = snapTime(prev.start, {
                        enabled: snapEnabled,
                        grid: snapGridSec,
                        anchors
                      })
                      const range = snapClipRange(start, start + (prev.end - prev.start))
                      onMove(entry.id, range.startTime, range.endTime)
                    }
                    setDragPreview((p) => {
                      const n = { ...p }
                      delete n[entry.id]
                      return n
                    })
                  }}
                >
                  <Rect
                    width={w}
                    height={TRACK_H - 12}
                    fill={clipFill(entry)}
                    cornerRadius={6}
                    stroke={selected ? '#fff' : 'transparent'}
                    strokeWidth={selected ? 2 : 0}
                    shadowBlur={selected ? 8 : 0}
                  />
                  <Text
                    text={(labels[entry.id] || `#${entry.order + 1}`).slice(0, 28)}
                    x={6}
                    y={12}
                    width={w - 12}
                    fontSize={11}
                    fill="#fff"
                    ellipsis
                    wrap="none"
                  />
                  {/* resize handle */}
                  <Rect
                    x={w - 8}
                    y={0}
                    width={8}
                    height={TRACK_H - 12}
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
                        [entry.id]: { start: next.startTime, end: next.endTime }
                      }))
                      evt.target.x(
                        durationToWidth(next.endTime - next.startTime, pxPerSec) - 8
                      )
                    }}
                    onDragEnd={() => {
                      const prev = dragPreview[entry.id]
                      if (prev) {
                        const next = snapClipRange(prev.start, prev.end)
                        onMove(entry.id, next.startTime, next.endTime)
                      }
                      setDragPreview((p) => {
                        const n = { ...p }
                        delete n[entry.id]
                        return n
                      })
                    }}
                  />
                </Group>
              )
            })}

            {/* playhead */}
            <Group
              x={timeToX(playhead, pxPerSec, PAD)}
              y={0}
              draggable
              dragBoundFunc={(pos) => ({
                x: Math.max(PAD, pos.x),
                y: 0
              })}
              onDragMove={(evt) => {
                onPlayheadChange(xToTime(evt.target.x(), pxPerSec, PAD))
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
