import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type WheelEvent
} from 'react'
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
  onViewportHeight?: (h: number, top?: number) => void
  handlers: TimelineGraphNodeHandlers
}

export function TimelineGraphCanvas({
  layout,
  selectedNodeId,
  onSelectNode,
  onViewportHeight,
  handlers
}: TimelineGraphCanvasProps): JSX.Element {
  const { t } = useTranslation()
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [scale, setScale] = useState(1)
  const hostRef = useRef<HTMLDivElement | null>(null)
  const lastReport = useRef({ h: 0, top: 0 })
  const drag = useRef<{ x: number; y: number; panX: number; panY: number } | null>(
    null
  )

  useEffect(() => {
    const el = hostRef.current
    if (!el || !onViewportHeight) return
    const apply = (): void => {
      const rect = el.getBoundingClientRect()
      const h = Math.floor(rect.height || el.clientHeight || 0)
      const top = rect.top
      if (h < 80 && !(top > 0)) return
      const reportH = h >= 80 ? h : 0
      const prev = lastReport.current
      if (Math.abs(reportH - prev.h) < 8 && Math.abs(top - prev.top) < 8) return
      lastReport.current = { h: reportH, top }
      onViewportHeight(reportH, top)
    }
    apply()
    const ro =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => apply())
    ro?.observe(el)
    window.addEventListener('resize', apply)
    const raf = window.requestAnimationFrame(apply)
    const late = window.setTimeout(apply, 120)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', apply)
      window.cancelAnimationFrame(raf)
      window.clearTimeout(late)
    }
  }, [onViewportHeight])

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

  const stackOrder = useMemo(
    () => [...layout.nodes].sort((a, b) => a.column - b.column),
    [layout.nodes]
  )

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
    <div className="flex min-h-0 flex-1 flex-col">
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
        ref={hostRef}
        data-testid="timeline-graph-canvas"
        className="relative hidden min-h-[22rem] flex-1 overflow-auto rounded-2xl border border-ink-800/80 bg-ink-900/20 lg:block lg:min-h-0"
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
