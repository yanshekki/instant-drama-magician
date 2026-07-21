import { describe, expect, it } from 'vitest'
import {
  persistJobsSafe,
  loadDraftStoreSafe,
  pipelineProgressPct,
  optionalEl
} from './aiJobsPure'

describe('aiJobsPure', () => {
  it('covers all residual branches', () => {
    expect(() => persistJobsSafe(() => undefined)).not.toThrow()
    expect(() =>
      persistJobsSafe(() => {
        throw new Error('quota')
      })
    ).not.toThrow()

    expect(loadDraftStoreSafe(() => ({ a: 1 }), {})).toEqual({ a: 1 })
    expect(
      loadDraftStoreSafe(() => {
        throw new Error('x')
      }, {})
    ).toEqual({})

    expect(pipelineProgressPct(0, 0, 42)).toBe(42)
    expect(pipelineProgressPct(4, 1, 0)).toBe(50)

    expect(optionalEl(true)).toBe('show')
    expect(optionalEl(false)).toBe('hide')
  })
})
