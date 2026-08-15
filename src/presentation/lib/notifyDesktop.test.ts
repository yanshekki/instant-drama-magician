/** @vitest-environment jsdom */
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
})
