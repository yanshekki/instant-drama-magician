import { describe, expect, it } from 'vitest'
import type { StoryStatus, MediaStatus } from './index'

describe('types/domain', () => {
  it('status unions accept known values', () => {
    const s: StoryStatus = 'DRAFT'
    const m: MediaStatus = 'READY'
    expect(s).toBe('DRAFT')
    expect(m).toBe('READY')
  })
})
