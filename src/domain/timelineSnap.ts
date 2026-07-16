export interface SnapOptions {
  grid?: number
  anchors?: readonly number[]
  enabled?: boolean
}

/** Snap time to grid and/or nearest anchor (clip edges). */
export function snapTime(t: number, opts: SnapOptions = {}): number {
  if (opts.enabled === false) return Math.max(0, t)
  const grid = opts.grid ?? 0.5
  let candidate = Math.max(0, t)

  if (grid > 0) {
    candidate = Math.round(candidate / grid) * grid
  }

  if (opts.anchors && opts.anchors.length > 0) {
    const threshold = Math.max(grid / 2, 0.15)
    let best = candidate
    let bestDist = Infinity
    for (const a of opts.anchors) {
      const d = Math.abs(t - a)
      if (d < bestDist && d <= threshold) {
        bestDist = d
        best = a
      }
    }
    // Prefer anchor if closer than grid snap distance
    if (bestDist <= threshold) candidate = best
  }

  // avoid -0
  return Math.max(0, Math.round(candidate * 1000) / 1000)
}

export function anchorsFromEntries(
  entries: readonly { startTime: number; endTime: number }[]
): number[] {
  const set = new Set<number>([0])
  for (const e of entries) {
    set.add(e.startTime)
    set.add(e.endTime)
  }
  return [...set].sort((a, b) => a - b)
}
