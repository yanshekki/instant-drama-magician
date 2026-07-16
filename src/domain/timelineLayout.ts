/** Pure time ↔ pixel layout helpers for the timeline canvas */

export function timeToX(timeSeconds: number, pxPerSec: number, offsetX = 0): number {
  return offsetX + Math.max(0, timeSeconds) * pxPerSec
}

export function xToTime(x: number, pxPerSec: number, offsetX = 0): number {
  if (pxPerSec <= 0) return 0
  return Math.max(0, (x - offsetX) / pxPerSec)
}

export function durationToWidth(durationSeconds: number, pxPerSec: number): number {
  return Math.max(1, durationSeconds * pxPerSec)
}

export function clampPxPerSec(pxPerSec: number, min = 12, max = 120): number {
  return Math.min(max, Math.max(min, pxPerSec))
}

export function tickTimes(totalSeconds: number, step = 1): number[] {
  const end = Math.max(0, Math.ceil(totalSeconds))
  const ticks: number[] = []
  for (let t = 0; t <= end; t += step) ticks.push(t)
  return ticks
}
