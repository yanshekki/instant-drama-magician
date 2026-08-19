/**
 * Opt-in generation flags. Defaults match historical behaviour
 * (storyboard-prefer stills, parallel clips allowed, action plates last).
 */

export const CONTINUITY_MODES = ['storyboard', 'chain-end'] as const
export type ContinuityMode = (typeof CONTINUITY_MODES)[number]

export const MOTION_PRIORITIES = ['default', 'action'] as const
export type MotionPriority = (typeof MOTION_PRIORITIES)[number]

export function coerceContinuityMode(
  v?: string | null
): ContinuityMode {
  return v === 'chain-end' ? 'chain-end' : 'storyboard'
}

export function coerceMotionPriority(
  v?: string | null
): MotionPriority {
  return v === 'action' ? 'action' : 'default'
}

/** Chain-end must wait for the previous beat's end-frame before starting. */
export function chainEndForcesSequential(mode: ContinuityMode): boolean {
  return mode === 'chain-end'
}

export function effectiveVideoConcurrency(
  requested: number | undefined,
  continuityMode: ContinuityMode
): number {
  if (chainEndForcesSequential(continuityMode)) return 1
  return Math.max(1, requested ?? 1)
}

/** Storyboard still vs previous end-frame as MediaGen pixel edit base. */
export function timelineOwnStillEditPriority(
  mode: ContinuityMode
): number {
  // storyboard: own still 220 > prev 200 (existing refine UX)
  // chain-end: prev 200 > own 180 (strict continue)
  return mode === 'chain-end' ? 180 : 220
}
