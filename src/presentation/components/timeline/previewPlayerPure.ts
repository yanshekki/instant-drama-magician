/**
 * Pure helpers for PreviewPlayer residual branches.
 */

export function safeSeekCurrentTime(
  set: (t: number) => void,
  target: number
): boolean {
  try {
    set(target)
    return true
  } catch {
    return false
  }
}

export function shouldStartPlay(playReq: number, req: number): boolean {
  return playReq === req
}

export function isNearClipEnd(
  local: number,
  clipLen: number,
  duration: number,
  eps = 0.08
): boolean {
  return (
    local >= clipLen - eps ||
    (Number.isFinite(duration) && duration > 0 && local >= duration - eps)
  )
}

export function shouldFireEnded(
  isPlaying: boolean,
  endedGuard: boolean
): boolean {
  return isPlaying && !endedGuard
}

export function playVideoSafe(play: () => Promise<unknown>): void {
  void play().catch(() => undefined)
}
