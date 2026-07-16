import { describe, expect, it } from 'vitest'
import { anchorsFromEntries, snapTime } from './timelineSnap'

describe('timelineSnap', () => {
  it('snaps to grid', () => {
    expect(snapTime(1.24, { grid: 0.5 })).toBe(1)
    expect(snapTime(1.3, { grid: 0.5 })).toBe(1.5)
  })

  it('snaps to anchors when close', () => {
    expect(snapTime(4.9, { grid: 0.5, anchors: [0, 5, 10] })).toBe(5)
  })

  it('can disable snap', () => {
    expect(snapTime(1.24, { enabled: false })).toBe(1.24)
  })

  it('builds anchors', () => {
    expect(anchorsFromEntries([{ startTime: 1, endTime: 3 }])).toEqual([0, 1, 3])
  })
})
