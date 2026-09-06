import { describe, expect, it } from 'vitest'
import { defaultSpatialBlocking } from './spatialRef'
import { encodeClayPlayblastPng } from './spatialPlayblast'

describe('spatialPlayblast', () => {
  it('writes a PNG with PNG signature', () => {
    const blocking = defaultSpatialBlocking({
      aspect: '16:9',
      characters: [{ id: 'c1', name: 'A' }]
    })
    const png = encodeClayPlayblastPng(blocking)
    expect(png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBe(
      true
    )
    expect(png.length).toBeGreaterThan(100)
  })
})
