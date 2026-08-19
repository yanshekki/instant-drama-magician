import { describe, expect, it } from 'vitest'
import {
  chainEndForcesSequential,
  coerceContinuityMode,
  coerceMotionPriority,
  effectiveVideoConcurrency,
  timelineOwnStillEditPriority
} from './generationModes'

describe('generationModes', () => {
  it('coerces unknown to historical defaults', () => {
    expect(coerceContinuityMode(null)).toBe('storyboard')
    expect(coerceContinuityMode('chain-end')).toBe('chain-end')
    expect(coerceMotionPriority('action')).toBe('action')
    expect(coerceMotionPriority('x')).toBe('default')
  })

  it('forces sequential concurrency in chain-end', () => {
    expect(effectiveVideoConcurrency(4, 'storyboard')).toBe(4)
    expect(effectiveVideoConcurrency(4, 'chain-end')).toBe(1)
    expect(chainEndForcesSequential('chain-end')).toBe(true)
  })

  it('drops own-still edit priority below prev in chain-end', () => {
    expect(timelineOwnStillEditPriority('storyboard')).toBe(220)
    expect(timelineOwnStillEditPriority('chain-end')).toBe(180)
  })
})
