/**
 * Unified generation wait (chat / stills / video).
 * UI uses minutes; storage keeps chat+image as ms and video as seconds.
 */

export type RequestWaitPreset = 'fast' | 'standard' | 'patient' | 'custom'

export const REQUEST_WAIT_PRESET_IDS = [
  'fast',
  'standard',
  'patient',
  'custom'
] as const satisfies readonly RequestWaitPreset[]

export const CHAT_TIMEOUT_MS_MIN = 15_000
export const CHAT_TIMEOUT_MS_MAX = 1_800_000
export const IMAGE_TIMEOUT_MS_MIN = 30_000
export const IMAGE_TIMEOUT_MS_MAX = 1_800_000
export const VIDEO_TIMEOUT_SEC_MIN = 60
export const VIDEO_TIMEOUT_SEC_MAX = 2_700

export type RequestWaitValues = {
  chatTimeoutMs: number
  imageTimeoutMs: number
  videoTimeoutSec: number
}

export const REQUEST_WAIT_PRESETS: Record<
  Exclude<RequestWaitPreset, 'custom'>,
  RequestWaitValues
> = {
  fast: {
    chatTimeoutMs: 60_000,
    imageTimeoutMs: 120_000,
    videoTimeoutSec: 180
  },
  standard: {
    chatTimeoutMs: 120_000,
    imageTimeoutMs: 300_000,
    videoTimeoutSec: 300
  },
  patient: {
    chatTimeoutMs: 300_000,
    imageTimeoutMs: 600_000,
    videoTimeoutSec: 900
  }
}

export function isRequestWaitPreset(v: unknown): v is RequestWaitPreset {
  return (
    v === 'fast' || v === 'standard' || v === 'patient' || v === 'custom'
  )
}

export function coerceRequestWaitPreset(
  v: unknown,
  fallback: RequestWaitPreset = 'standard'
): RequestWaitPreset {
  return isRequestWaitPreset(v) ? v : fallback
}

export function clampChatTimeoutMs(ms: number): number {
  if (!Number.isFinite(ms)) return REQUEST_WAIT_PRESETS.standard.chatTimeoutMs
  return Math.min(CHAT_TIMEOUT_MS_MAX, Math.max(CHAT_TIMEOUT_MS_MIN, Math.round(ms)))
}

export function clampImageTimeoutMs(ms: number): number {
  if (!Number.isFinite(ms)) return REQUEST_WAIT_PRESETS.standard.imageTimeoutMs
  return Math.min(
    IMAGE_TIMEOUT_MS_MAX,
    Math.max(IMAGE_TIMEOUT_MS_MIN, Math.round(ms))
  )
}

export function clampVideoTimeoutSec(sec: number): number {
  if (!Number.isFinite(sec)) return REQUEST_WAIT_PRESETS.standard.videoTimeoutSec
  return Math.min(
    VIDEO_TIMEOUT_SEC_MAX,
    Math.max(VIDEO_TIMEOUT_SEC_MIN, Math.round(sec))
  )
}

export function clampRequestWait(v: RequestWaitValues): RequestWaitValues {
  return {
    chatTimeoutMs: clampChatTimeoutMs(v.chatTimeoutMs),
    imageTimeoutMs: clampImageTimeoutMs(v.imageTimeoutMs),
    videoTimeoutSec: clampVideoTimeoutSec(v.videoTimeoutSec)
  }
}

export function applyRequestWaitPreset(
  id: Exclude<RequestWaitPreset, 'custom'>
): RequestWaitValues {
  return { ...REQUEST_WAIT_PRESETS[id] }
}

export function detectRequestWaitPreset(v: RequestWaitValues): RequestWaitPreset {
  const c = clampRequestWait(v)
  for (const id of ['fast', 'standard', 'patient'] as const) {
    const p = REQUEST_WAIT_PRESETS[id]
    if (
      p.chatTimeoutMs === c.chatTimeoutMs &&
      p.imageTimeoutMs === c.imageTimeoutMs &&
      p.videoTimeoutSec === c.videoTimeoutSec
    ) {
      return id
    }
  }
  return 'custom'
}

export function minutesFromMs(ms: number): number {
  return Math.round((ms / 60_000) * 2) / 2
}

export function minutesFromSec(sec: number): number {
  return Math.round((sec / 60) * 2) / 2
}

export function msFromMinutes(min: number): number {
  return Math.round(min * 60_000)
}

export function secFromMinutes(min: number): number {
  return Math.round(min * 60)
}

/** Single-request POST / upload abort. Floor 60s so slow creates still work. */
export function videoCreateAbortMs(timeoutSec: number): number {
  return Math.max(60_000, clampVideoTimeoutSec(timeoutSec) * 1000)
}

/** Status poll GET. Cap 120s so a hung poll does not eat the whole budget. */
export function videoPollAbortMs(timeoutSec: number): number {
  const wait = clampVideoTimeoutSec(timeoutSec) * 1000
  return Math.max(30_000, Math.min(wait, 120_000))
}

/** Content download / legacy generate. */
export function videoDownloadAbortMs(timeoutSec: number): number {
  return Math.max(60_000, clampVideoTimeoutSec(timeoutSec) * 1000)
}
