import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { TimelineEntry } from '../../../types/domain'
import { TimelineService } from '../../../application/TimelineService'

const PX_PER_SEC = 48
const TRACK_H = 64
const MAX_CLIP = TimelineService.DEFAULT_MAX_CLIP_SECONDS

export type AssetDropPayload =
  | { kind: 'character'; id: string; label: string }
  | { kind: 'scene'; id: string; label: string }
  | { kind: 'prop'; id: string; label: string }
  | { kind: 'action'; id: string; label: string }

interface TimelineCanvasProps {
  entries: TimelineEntry[]
  labels: Record<string, string>
  onMove: (id: string, startTime: number, endTime: number) => void
  onResize: (id: string, startTime: number, endTime: number) => void
  onDropAsset: (payload: AssetDropPayload, atTime: number) => void
  onSelect: (id: string | null) => void
  selectedId: string | null
}

function clipColor(entry: TimelineEntry): string {
  if (entry.characterId) return '#7c3aed'
  if (entry.sceneId) return '#0891b2'
  if (entry.propId) return '#ca8a04'
  if (entry.actionId) return '#db2777'
  return '#475569'
}

export function TimelineCanvas({
  entries,
  labels,
  onMove,
  onResize,
  onDropAsset,
  onSelect,
  selectedId
}: TimelineCanvasProps): JSX.Element {
  const trackRef = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState<Record<string, { startTime: number; endTime: number }>>(
    {}
  )
  const [drag, setDrag] = useState<
    | {
        mode: 'move' | 'resize'
        id: string
        originX: number
        start: number
        end: number
      }
    | null
  >(null)

  const total = Math.max(TimelineService.totalDuration(entries), 20)
  const width = Math.max(total * PX_PER_SEC + 120, 640)
  const ticks = useMemo(() => {
    const arr: number[] = []
    for (let s = 0; s <= Math.ceil(total); s += 1) arr.push(s)
    return arr
  }, [total])

  const display = (entry: TimelineEntry): { startTime: number; endTime: number } =>
    draft[entry.id] ?? { startTime: entry.startTime, endTime: entry.endTime }

  const clientXToTime = (clientX: number): number => {
    const el = trackRef.current
    if (!el) return 0
    const rect = el.getBoundingClientRect()
    const x = clientX - rect.left + el.scrollLeft
    return Math.max(0, x / PX_PER_SEC)
  }

  const handlePointerMove = (e: ReactPointerEvent): void => {
    if (!drag) return
    const dx = e.clientX - drag.originX
    const dt = dx / PX_PER_SEC
    if (drag.mode === 'move') {
      const next = TimelineService.moveClip(drag.start, drag.end, dt, MAX_CLIP)
      setDraft((d) => ({ ...d, [drag.id]: next }))
    } else {
      const next = TimelineService.resizeClipEnd(drag.start, drag.end + dt, MAX_CLIP)
      setDraft((d) => ({ ...d, [drag.id]: next }))
    }
  }

  const endDrag = (): void => {
    if (drag) {
      const d = draft[drag.id]
      if (d) {
        if (drag.mode === 'move') onMove(drag.id, d.startTime, d.endTime)
        else onResize(drag.id, d.startTime, d.endTime)
      }
      setDraft((prev) => {
        const next = { ...prev }
        delete next[drag.id]
        return next
      })
    }
    setDrag(null)
  }

  return (
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
          onDropAsset(payload, clientXToTime(e.clientX))
        } catch {
          // ignore malformed
        }
      }}
    >
      <div className="relative border-b border-ink-800 px-2 py-1" style={{ width }}>
        <div className="relative h-5">
          {ticks.map((s) => (
            <span
              key={s}
              className="absolute top-0 text-[10px] text-ink-500"
              style={{ left: s * PX_PER_SEC }}
            >
              {s}s
            </span>
          ))}
        </div>
      </div>

      <div
        ref={trackRef}
        className="relative select-none px-2 py-3"
        style={{ width, height: TRACK_H + 24 }}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onClick={() => onSelect(null)}
      >
        <div
          className="absolute left-2 right-2 top-6 rounded-md bg-ink-900/80 ring-1 ring-ink-800"
          style={{ height: TRACK_H }}
        />

        {entries.map((entry) => {
          const range = display(entry)
          const left = range.startTime * PX_PER_SEC + 8
          const widthPx = Math.max(28, (range.endTime - range.startTime) * PX_PER_SEC)
          const label = labels[entry.id] || entry.dialogue || `#${entry.order + 1}`
          const selected = selectedId === entry.id
          return (
            <div
              key={entry.id}
              role="button"
              tabIndex={0}
              className={[
                'absolute top-8 flex h-12 cursor-grab items-center overflow-hidden rounded-md px-2 text-[11px] font-medium text-white shadow active:cursor-grabbing',
                selected ? 'ring-2 ring-white/80' : ''
              ].join(' ')}
              style={{
                left,
                width: widthPx,
                backgroundColor: clipColor(entry)
              }}
              onClick={(e) => {
                e.stopPropagation()
                onSelect(entry.id)
              }}
              onPointerDown={(e) => {
                e.stopPropagation()
                ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
                setDrag({
                  mode: 'move',
                  id: entry.id,
                  originX: e.clientX,
                  start: range.startTime,
                  end: range.endTime
                })
              }}
            >
              <span className="truncate pr-3">{label}</span>
              <span
                className="absolute right-0 top-0 h-full w-2 cursor-ew-resize bg-black/20"
                onPointerDown={(e) => {
                  e.stopPropagation()
                  setDrag({
                    mode: 'resize',
                    id: entry.id,
                    originX: e.clientX,
                    start: range.startTime,
                    end: range.endTime
                  })
                }}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function makeAssetDragData(payload: AssetDropPayload): string {
  return JSON.stringify(payload)
}
