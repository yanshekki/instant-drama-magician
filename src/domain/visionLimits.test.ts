import { describe, expect, it } from 'vitest'
import { MULTI_VISION_MAX_IMAGES } from './visionLimits'

describe('visionLimits', () => {
  it('caps multi-vision stills at 8', () => {
    expect(MULTI_VISION_MAX_IMAGES).toBe(8)
  })
})
