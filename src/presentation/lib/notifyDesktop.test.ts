/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getApi = vi.fn()
const isElectron = vi.fn(() => true)

vi.mock('../../lib/api', () => ({
  getApi: () => getApi(),
  isElectron: () => isElectron()
}))

import {
  desktopNotifyKindFromJob,
  isAppForeground,
  notifyJobSettled,
  notifyJobSettledSafe
} from './notifyDesktop'

const prefs = {
  desktopNotifyEnabled: true,
  desktopNotifyWhenUnfocusedOnly: true,
  desktopNotifyOnFailure: true,
  desktopNotifySound: true
}

describe('notifyDesktop', () => {
  beforeEach(() => {
    isElectron.mockReturnValue(true)
    getApi.mockReset()
    vi.spyOn(document, 'hasFocus').mockReturnValue(false)
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible'
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('isAppForeground requires visible + focus', () => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(true)
    expect(isAppForeground()).toBe(true)
    vi.spyOn(document, 'hasFocus').mockReturnValue(false)
    expect(isAppForeground()).toBe(false)
  })

  it('skips when the app is focused and unfocused-only is on', async () => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(true)
    const show = vi.fn()
    getApi.mockReturnValue({ desktopNotify: { show } })
    const r = await notifyJobSettled({
      outcome: 'succeeded',
      kind: 'text',
      label: 'AI',
      startedAt: Date.now() - 10_000,
      settings: prefs
    })
    expect(r.reason).toBe('focused')
    expect(show).not.toHaveBeenCalled()
  })

  it('shows via Electron IPC for a long unfocused success', async () => {
    const show = vi.fn(async () => ({ ok: true }))
    getApi.mockReturnValue({ desktopNotify: { show } })
    const r = await notifyJobSettled({
      outcome: 'succeeded',
      kind: 'video',
      label: 'Clip',
      startedAt: Date.now() - 12_000,
      settings: prefs,
      tagScope: 'e1'
    })
    expect(r.ok).toBe(true)
    expect(show).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.any(String),
        body: expect.stringContaining('Clip'),
        tag: 'idm-video-e1',
        silent: false,
        unfocusedOnly: true
      })
    )
  })

  it('test button forces a notification while focused', async () => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(true)
    const show = vi.fn(async () => ({ ok: true }))
    getApi.mockReturnValue({ desktopNotify: { show } })
    const r = await notifyJobSettled({
      outcome: 'succeeded',
      kind: 'test',
      startedAt: Date.now(),
      force: true,
      settings: prefs
    })
    expect(r.ok).toBe(true)
    expect(show.mock.calls[0][0].unfocusedOnly).toBe(false)
  })

  it('uses Web Notification when not Electron', async () => {
    isElectron.mockReturnValue(false)
    const requestPermission = vi.fn(async () => 'granted')
    const Ctor = vi.fn()
    Object.assign(Ctor, { permission: 'default', requestPermission })
    vi.stubGlobal('Notification', Ctor)
    const r = await notifyJobSettled({
      outcome: 'failed',
      kind: 'export',
      startedAt: Date.now() - 9_000,
      settings: prefs
    })
    expect(r.ok).toBe(true)
    expect(Ctor).toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('maps job kinds to notify kinds', () => {
    expect(desktopNotifyKindFromJob('character-intro-video')).toBe('video')
    expect(desktopNotifyKindFromJob('timeline-clip')).toBe('video')
    expect(desktopNotifyKindFromJob('character-sheet')).toBe('image')
    expect(desktopNotifyKindFromJob('story-cover')).toBe('image')
    expect(desktopNotifyKindFromJob('story-ai-script')).toBe('text')
  })

  it('notifyJobSettledSafe swallows errors', () => {
    getApi.mockImplementation(() => {
      throw new Error('no api')
    })
    expect(() =>
      notifyJobSettledSafe({
        outcome: 'succeeded',
        kind: 'text',
        startedAt: 0,
        settings: prefs
      })
    ).not.toThrow()
  })

  it('isAppForeground is false when hasFocus throws', () => {
    vi.spyOn(document, 'hasFocus').mockImplementation(() => {
      throw new Error('no focus')
    })
    expect(isAppForeground()).toBe(false)
  })

  it('returns disabled / cancelled / too-soon reasons', async () => {
    expect(
      (
        await notifyJobSettled({
          outcome: 'succeeded',
          kind: 'text',
          startedAt: Date.now() - 10_000,
          settings: { ...prefs, desktopNotifyEnabled: false }
        })
      ).reason
    ).toBe('disabled')
    expect(
      (
        await notifyJobSettled({
          outcome: 'cancelled',
          kind: 'text',
          startedAt: Date.now() - 10_000,
          settings: prefs
        })
      ).reason
    ).toBe('cancelled')
    expect(
      (
        await notifyJobSettled({
          outcome: 'succeeded',
          kind: 'text',
          startedAt: Date.now(),
          settings: prefs
        })
      ).reason
    ).toBe('too-soon')
  })

  it('loads settings from the API and uses image / degraded copy', async () => {
    const show = vi.fn(async () => ({ ok: true }))
    getApi.mockReturnValue({
      settings: { get: vi.fn(async () => ({ ...prefs, desktopNotifySound: false })) },
      desktopNotify: { show }
    })
    const r = await notifyJobSettled({
      outcome: 'degraded',
      kind: 'image',
      startedAt: Date.now() - 9_000
    })
    expect(r.ok).toBe(true)
    expect(show.mock.calls[0][0].silent).toBe(true)
    expect(String(show.mock.calls[0][0].body)).toBeTruthy()
  })

  it('treats a missing settings.get as defaults', async () => {
    const show = vi.fn(async () => ({ ok: true }))
    getApi.mockReturnValue({ desktopNotify: { show } })
    const r = await notifyJobSettled({
      outcome: 'succeeded',
      kind: 'text',
      startedAt: Date.now() - 9_000
    })
    expect(r.ok).toBe(true)
  })

  it('returns error when Electron show throws', async () => {
    getApi.mockReturnValue({
      desktopNotify: {
        show: vi.fn(async () => {
          throw new Error('ipc')
        })
      }
    })
    const r = await notifyJobSettled({
      outcome: 'succeeded',
      kind: 'video',
      startedAt: Date.now() - 9_000,
      settings: prefs
    })
    expect(r).toEqual({ ok: false, reason: 'error' })
  })

  it('falls back to unsupported when Electron has no show and Notification is missing', async () => {
    getApi.mockReturnValue({})
    const prev = (globalThis as { Notification?: unknown }).Notification
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).Notification
    const r = await notifyJobSettled({
      outcome: 'succeeded',
      kind: 'text',
      startedAt: Date.now() - 9_000,
      settings: prefs
    })
    expect(r.reason).toBe('unsupported')
    if (prev) (globalThis as { Notification?: unknown }).Notification = prev
  })

  it('web path reports denied and constructor errors', async () => {
    isElectron.mockReturnValue(false)
    const denied = vi.fn()
    Object.assign(denied, {
      permission: 'denied',
      requestPermission: vi.fn(async () => 'denied')
    })
    vi.stubGlobal('Notification', denied)
    expect(
      (
        await notifyJobSettled({
          outcome: 'succeeded',
          kind: 'export',
          startedAt: Date.now() - 9_000,
          settings: prefs
        })
      ).reason
    ).toBe('denied')

    const boom = vi.fn(() => {
      throw new Error('ctor')
    })
    Object.assign(boom, {
      permission: 'granted',
      requestPermission: vi.fn(async () => 'granted')
    })
    vi.stubGlobal('Notification', boom)
    expect(
      (
        await notifyJobSettled({
          outcome: 'failed',
          kind: 'export',
          startedAt: Date.now() - 9_000,
          settings: prefs
        })
      ).reason
    ).toBe('error')
    vi.unstubAllGlobals()
  })
})
