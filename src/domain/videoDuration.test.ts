import { describe, expect, it } from 'vitest'
import { snapVideoSeconds } from './videoDuration'

describe('snapVideoSeconds', () => {
  it('maps short clips to 6s', () => {
    expect(snapVideoSeconds(1)).toBe(6)
    expect(snapVideoSeconds(5)).toBe(6)
    expect(snapVideoSeconds(7.9)).toBe(6)
  })

  it('maps long clips to 10s', () => {
    expect(snapVideoSeconds(8)).toBe(10)
    expect(snapVideoSeconds(10)).toBe(10)
    expect(snapVideoSeconds(15)).toBe(10)
  })
})
