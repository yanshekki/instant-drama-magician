import { describe, expect, it, vi } from 'vitest'
import {
  safeSeekCurrentTime,
  shouldStartPlay,
  isNearClipEnd,
  shouldFireEnded,
  playVideoSafe
} from './previewPlayerPure'

describe('previewPlayerPure', () => {
  it('covers all residual pure branches', () => {
    expect(safeSeekCurrentTime(() => undefined, 1)).toBe(true)
    expect(
      safeSeekCurrentTime(() => {
        throw new Error('seek')
      }, 1)
    ).toBe(false)

    expect(shouldStartPlay(3, 3)).toBe(true)
    expect(shouldStartPlay(3, 2)).toBe(false)

    expect(isNearClipEnd(4.95, 5, NaN)).toBe(true)
    expect(isNearClipEnd(1, 5, 5.0)).toBe(false)
    expect(isNearClipEnd(4.95, 10, 5.0)).toBe(true)
    expect(isNearClipEnd(1, 10, 0)).toBe(false)

    expect(shouldFireEnded(true, false)).toBe(true)
    expect(shouldFireEnded(false, false)).toBe(false)
    expect(shouldFireEnded(true, true)).toBe(false)

    const play = vi.fn(async () => {
      throw new Error('autoplay block')
    })
    expect(() => playVideoSafe(play)).not.toThrow()
    expect(play).toHaveBeenCalled()
  })
})
