import { describe, expect, it } from 'vitest'
import {
  clampPxPerSec,
  durationToWidth,
  tickTimes,
  timeToX,
  xToTime
} from './timelineLayout'

describe('timelineLayout', () => {
  it('converts time to x and back', () => {
    const x = timeToX(5, 40, 8)
    expect(x).toBe(8 + 200)
    expect(xToTime(x, 40, 8)).toBeCloseTo(5)
  })

  it('clamps zoom', () => {
    expect(clampPxPerSec(5)).toBe(12)
    expect(clampPxPerSec(200)).toBe(120)
  })

  it('maps duration to width', () => {
    expect(durationToWidth(2.5, 40)).toBe(100)
  })

  it('builds tick marks', () => {
    expect(tickTimes(3)).toEqual([0, 1, 2, 3])
  })
})
