import { describe, expect, it, vi, beforeEach } from 'vitest'

const isWebRuntime = vi.fn(() => false)

vi.mock('../../lib/api', () => ({
  isWebRuntime: () => isWebRuntime()
}))

import { canUse, isWebUi } from './webCapability'

describe('webCapability', () => {
  beforeEach(() => {
    isWebRuntime.mockReturnValue(false)
  })

  it('desktop allows all caps', () => {
    expect(canUse('filePickUpload')).toBe(true)
    expect(canUse('openExportFolder')).toBe(true)
    expect(canUse('nativeUpdates')).toBe(true)
    expect(isWebUi()).toBe(false)
  })

  it('web allows upload; blocks folder/updates/server admin', () => {
    isWebRuntime.mockReturnValue(true)
    expect(canUse('filePickUpload')).toBe(true)
    expect(canUse('openExportFolder')).toBe(false)
    expect(canUse('nativeUpdates')).toBe(false)
    expect(canUse('webServerAdmin')).toBe(false)
    expect(canUse('rebuildMenu')).toBe(false)
    expect(isWebUi()).toBe(true)
  })
})
