import { useMemo, useRef, useState, type PointerEvent, type WheelEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { TimelineGraphLayout } from '../../../domain/timelineGraph'
import { Button } from '../ui'
import { TimelineGraphNode, type TimelineGraphNodeHandlers } from './TimelineGraphNode'
import { TimelineGraphWires } from './TimelineGraphWires'

/** Zoom only via ctrl/meta+wheel, and never while scrolling a field. */
export function timelineGraphShouldZoomWheel(e: {
  ctrlKey?: boolean
  metaKey?: boolean
  target: EventTarget | null
}): boolean {
  if (!e.ctrlKey && !e.metaKey) return false
  if (!(e.target instanceof Element)) return true
  return !e.target.closest('textarea, input, select, [contenteditable="true"]')
}

interface TimelineGraphCanvasProps {
  layout: TimelineGraphLayout
  selectedNodeId?: string | null
  onSelectNode?: (id: string) => void
  handlers: TimelineGraphNodeHandlers
}

export function TimelineGraphCanvas({
  layout,
  selectedNodeId,
  onSelectNode,
  handlers
}: TimelineGraphCanvasProps): JSX.Element {
  const { t } = useTranslation()
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [scale, setScale] = useState(1)
  const drag = useRef<{ x: number; y: number; panX: number; panY: number } | null>(
    null
  )

  const empty = layout.nodes.length === 0

  const onPointerDown = (e: PointerEvent<HTMLDivElement>): void => {
    if ((e.target as HTMLElement).closest('article,button,textarea,input,a')) {
      return
    }
    drag.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>): void => {
    if (!drag.current) return
    setPan({
      x: drag.current.panX + (e.clientX - drag.current.x),
      y: drag.current.panY + (e.clientY - drag.current.y)
    })
  }

  const onPointerUp = (): void => {
    drag.current = null
  }

  const onWheel = (e: WheelEvent<HTMLDivElement>): void => {
    if (!timelineGraphShouldZoomWheel(e)) return
    e.preventDefault()
    const next = Math.min(1.4, Math.max(0.6, scale + (e.deltaY > 0 ? -0.08 : 0.08)))
    setScale(next)
  }

  const stackOrder = useMemo(() => {
    const col0 = layout.nodes.filter((n) => n.column === 0)
    const mid = layout.nodes.filter((n) => n.column === 1)
    const seq = layout.nodes
      .filter((n) => n.kind === 'video' || n.kind === 'clip')
      .sort((a, b) => (a.seq ?? a.column) - (b.seq ?? b.column))
    return [...col0, ...mid, ...seq]
  }, [layout.nodes])

  if (empty) {
    return (
      <div
        data-testid="timeline-graph-canvas"
        className="flex min-h-[16rem] flex-1 items-center justify-center rounded-2xl border border-dashed border-ink-800/80 bg-ink-900/20 px-6 text-center text-sm text-ink-500"
      >
        {t('timeline.graph.emptyClip')}
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <div className="mb-2 hidden justify-end lg:flex">
        <Button
          variant="ghost"
          className="!px-2 !py-1 !text-[11px]"
          onClick={() => {
            setPan({ x: 0, y: 0 })
            setScale(1)
          }}
        >
          {t('timeline.graph.zoomReset')}
        </Button>
      </div>

      <div className="flex flex-col gap-3 lg:hidden" data-testid="timeline-graph-stack">
        {stackOrder.map((node) => (
          <TimelineGraphNode
            key={node.id}
            node={node}
            positioned={false}
            active={selectedNodeId === node.id}
            handlers={handlers}
            onSelect={() => onSelectNode?.(node.id)}
          />
        ))}
      </div>

      <div
        data-testid="timeline-graph-canvas"
        className="relative hidden overflow-auto rounded-2xl border border-ink-800/80 bg-ink-900/20 lg:block"
        style={{
          height: Math.min(Math.max(layout.height + 12, 360), 880)
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      >
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{
            width: layout.width,
            height: layout.height,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`
          }}
        >
          <TimelineGraphWires layout={layout} />
          {layout.nodes.map((node) => (
            <TimelineGraphNode
              key={node.id}
              node={node}
              active={selectedNodeId === node.id}
              handlers={handlers}
              onSelect={() => onSelectNode?.(node.id)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
