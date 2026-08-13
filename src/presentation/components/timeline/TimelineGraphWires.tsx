import type { TimelineGraphEdge, TimelineGraphLayout } from '../../../domain/timelineGraph'
import { timelineGraphEdgePath } from '../../../domain/timelineGraph'

interface TimelineGraphWiresProps {
  layout: TimelineGraphLayout
  edges?: TimelineGraphEdge[]
}

export function TimelineGraphWires({
  layout,
  edges
}: TimelineGraphWiresProps): JSX.Element {
  const list = edges ?? layout.edges
  return (
    <svg
      className="pointer-events-none absolute inset-0 overflow-visible"
      width={layout.width}
      height={layout.height}
      aria-hidden
    >
      {list.map((edge) => {
        const d = timelineGraphEdgePath(layout, edge)
        if (!d) return null
        return (
          <path
            key={edge.id}
            d={d}
            fill="none"
            className="stroke-ink-600"
            strokeWidth={1.75}
            strokeLinecap="round"
          />
        )
      })}
    </svg>
  )
}
