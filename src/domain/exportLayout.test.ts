import { describe, expect, it } from 'vitest'
import {
  buildDuckVolumeExpression,
  buildXfadeFilterChain,
  resolutionForAspect,
  scalePadFilter,
  xfadeTotalDuration
} from './exportLayout'

describe('exportLayout', () => {
  it('maps aspect ratios to even frame sizes', () => {
    expect(resolutionForAspect('16:9')).toEqual({ width: 1280, height: 720 })
    expect(resolutionForAspect('9:16')).toEqual({ width: 720, height: 1280 })
    expect(resolutionForAspect('1:1')).toEqual({ width: 1080, height: 1080 })
  })

  it('builds scale/pad filter for target size', () => {
    const f = scalePadFilter({ width: 720, height: 1280 })
    expect(f).toContain('scale=720:1280')
    expect(f).toContain('pad=720:1280')
  })

  it('builds xfade chain for multiple clips', () => {
    const f = buildXfadeFilterChain({
      clipDurations: [6, 6],
      transitionSec: 0.3
    })
    expect(f).toContain('xfade=transition=fade')
    expect(f).toContain('duration=0.300')
    expect(f).toContain('offset=5.700')
    expect(f).toContain('[vout]')
  })

  it('single clip xfade is null pass', () => {
    expect(
      buildXfadeFilterChain({ clipDurations: [6], transitionSec: 0.3 })
    ).toBe('[0:v]null[vout]')
  })

  it('computes total duration with overlaps', () => {
    expect(xfadeTotalDuration([6, 6], 0.3)).toBeCloseTo(11.7, 5)
  })

  it('builds duck volume expression with windows', () => {
    const expr = buildDuckVolumeExpression({
      baseVolume: 0.25,
      duckRatio: 0.35,
      windows: [{ startSeconds: 0, endSeconds: 2 }, { startSeconds: 6, endSeconds: 8 }]
    })
    expect(expr).toContain('0.25*if(')
    expect(expr).toContain('between(t\\,0.000\\,2.000)')
    expect(expr).toContain('0.35')
  })

  it('duck with no windows is constant base', () => {
    expect(
      buildDuckVolumeExpression({
        baseVolume: 0.25,
        duckRatio: 0.35,
        windows: []
      })
    ).toBe('0.25')
  })
})
