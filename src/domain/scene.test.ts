import { describe, expect, it } from 'vitest'
import { coerceSceneNumber, nextSceneNumber } from './scene'

describe('nextSceneNumber', () => {
  it('starts at 1 when empty', () => {
    expect(nextSceneNumber([])).toBe(1)
  })

  it('ignores undefined/NaN from global library rows', () => {
    expect(nextSceneNumber([undefined as unknown as number, NaN, null])).toBe(1)
    expect(nextSceneNumber([1, undefined as unknown as number, 3, NaN])).toBe(4)
  })

  it('returns max + 1', () => {
    expect(nextSceneNumber([2, 5, 1])).toBe(6)
  })
})

describe('coerceSceneNumber', () => {
  it('rejects NaN and non-integers', () => {
    expect(coerceSceneNumber(NaN)).toBeNull()
    expect(coerceSceneNumber(1.5)).toBeNull()
    expect(coerceSceneNumber(0)).toBeNull()
    expect(coerceSceneNumber(3)).toBe(3)
  })
})
