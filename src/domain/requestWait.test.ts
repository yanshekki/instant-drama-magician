import { describe, expect, it } from 'vitest'
import {
  applyRequestWaitPreset,
  clampChatTimeoutMs,
  clampImageTimeoutMs,
  clampRequestWait,
  clampVideoTimeoutSec,
  coerceRequestWaitPreset,
  detectRequestWaitPreset,
  minutesFromMs,
  minutesFromSec,
  msFromMinutes,
  REQUEST_WAIT_PRESETS,
  secFromMinutes,
  videoCreateAbortMs,
  videoDownloadAbortMs,
  videoPollAbortMs
} from './requestWait'

describe('requestWait', () => {
  it('applies named presets', () => {
    expect(applyRequestWaitPreset('standard')).toEqual(
      REQUEST_WAIT_PRESETS.standard
    )
    expect(applyRequestWaitPreset('fast').chatTimeoutMs).toBe(60_000)
    expect(applyRequestWaitPreset('patient').videoTimeoutSec).toBe(900)
  })

  it('detects presets and custom mixes', () => {
    expect(detectRequestWaitPreset(REQUEST_WAIT_PRESETS.fast)).toBe('fast')
    expect(detectRequestWaitPreset(REQUEST_WAIT_PRESETS.standard)).toBe(
      'standard'
    )
    expect(detectRequestWaitPreset(REQUEST_WAIT_PRESETS.patient)).toBe(
      'patient'
    )
    expect(
      detectRequestWaitPreset({
        chatTimeoutMs: 90_000,
        imageTimeoutMs: 300_000,
        videoTimeoutSec: 300
      })
    ).toBe('custom')
  })

  it('clamps out of range and non-finite', () => {
    expect(clampChatTimeoutMs(10)).toBe(15_000)
    expect(clampChatTimeoutMs(9_000_000)).toBe(1_800_000)
    expect(clampChatTimeoutMs(Number.NaN)).toBe(120_000)
    expect(clampImageTimeoutMs(1)).toBe(30_000)
    expect(clampVideoTimeoutSec(5)).toBe(60)
    expect(clampVideoTimeoutSec(99_999)).toBe(2_700)
    expect(
      clampRequestWait({
        chatTimeoutMs: 1,
        imageTimeoutMs: 1,
        videoTimeoutSec: 1
      }).videoTimeoutSec
    ).toBe(60)
  })

  it('converts minutes for the UI', () => {
    expect(minutesFromMs(120_000)).toBe(2)
    expect(minutesFromMs(90_000)).toBe(1.5)
    expect(minutesFromSec(180)).toBe(3)
    expect(msFromMinutes(2.5)).toBe(150_000)
    expect(secFromMinutes(15)).toBe(900)
  })

  it('derives video HTTP aborts from the user wait', () => {
    expect(videoCreateAbortMs(300)).toBe(300_000)
    expect(videoCreateAbortMs(30)).toBe(60_000)
    expect(videoPollAbortMs(900)).toBe(120_000)
    expect(videoPollAbortMs(40)).toBe(60_000)
    expect(videoDownloadAbortMs(180)).toBe(180_000)
    expect(coerceRequestWaitPreset('nope')).toBe('standard')
    expect(coerceRequestWaitPreset('patient')).toBe('patient')
  })
})
