import { describe, expect, it } from 'vitest'
import {
  DESKTOP_NOTIFY_MIN_ELAPSED_MS,
  desktopNotifyTag,
  shouldNotify
} from './desktopNotify'

const base = {
  enabled: true,
  unfocusedOnly: true,
  notifyOnFailure: true,
  appFocused: false,
  outcome: 'succeeded' as const,
  elapsedMs: 8_000
}

describe('shouldNotify', () => {
  it('allows a long unfocused success', () => {
    expect(shouldNotify(base)).toBe(true)
  })

  it('blocks when the master switch is off', () => {
    expect(shouldNotify({ ...base, enabled: false })).toBe(false)
  })

  it('blocks cancelled jobs', () => {
    expect(shouldNotify({ ...base, outcome: 'cancelled' })).toBe(false)
  })

  it('blocks short waits', () => {
    expect(
      shouldNotify({ ...base, elapsedMs: DESKTOP_NOTIFY_MIN_ELAPSED_MS - 1 })
    ).toBe(false)
    expect(
      shouldNotify({ ...base, elapsedMs: DESKTOP_NOTIFY_MIN_ELAPSED_MS })
    ).toBe(true)
  })

  it('blocks when unfocused-only and the app is focused', () => {
    expect(shouldNotify({ ...base, appFocused: true })).toBe(false)
    expect(
      shouldNotify({ ...base, unfocusedOnly: false, appFocused: true })
    ).toBe(true)
  })

  it('respects the failure switch for failed and degraded', () => {
    expect(shouldNotify({ ...base, outcome: 'failed' })).toBe(true)
    expect(shouldNotify({ ...base, outcome: 'degraded' })).toBe(true)
    expect(
      shouldNotify({ ...base, outcome: 'failed', notifyOnFailure: false })
    ).toBe(false)
    expect(
      shouldNotify({ ...base, outcome: 'degraded', notifyOnFailure: false })
    ).toBe(false)
  })

  it('force skips duration and focus gates when enabled', () => {
    expect(
      shouldNotify({
        ...base,
        force: true,
        appFocused: true,
        elapsedMs: 0,
        outcome: 'cancelled'
      })
    ).toBe(true)
    expect(
      shouldNotify({
        ...base,
        force: true,
        enabled: false,
        appFocused: true,
        elapsedMs: 0
      })
    ).toBe(false)
  })
})

describe('desktopNotifyTag', () => {
  it('builds a stable tag', () => {
    expect(desktopNotifyTag('video')).toBe('idm-video')
    expect(desktopNotifyTag('video', ' entry-1 ')).toBe('idm-video-entry-1')
    expect(desktopNotifyTag('text', null)).toBe('idm-text')
  })
})
