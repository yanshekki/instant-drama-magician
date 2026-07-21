import { describe, expect, it } from 'vitest'
import {
  coerceSceneNumber,
  isSceneStatus,
  nextSceneNumber,
  validateSceneDescription,
  validateSceneNumber
} from './scene'

describe('isSceneStatus', () => {
  it('accepts known statuses only', () => {
    expect(isSceneStatus('PENDING')).toBe(true)
    expect(isSceneStatus('GENERATING')).toBe(true)
    expect(isSceneStatus('COMPLETED')).toBe(true)
    expect(isSceneStatus('FAILED')).toBe(true)
    expect(isSceneStatus('pending')).toBe(false)
    expect(isSceneStatus('DONE')).toBe(false)
    expect(isSceneStatus('')).toBe(false)
  })
})

describe('validateSceneNumber', () => {
  it('rejects non-integers and < 1', () => {
    expect(validateSceneNumber(1)).toBeNull()
    expect(validateSceneNumber(10)).toBeNull()
    expect(validateSceneNumber(0)).toBe('errors.sceneNumberInvalid')
    expect(validateSceneNumber(-1)).toBe('errors.sceneNumberInvalid')
    expect(validateSceneNumber(1.5)).toBe('errors.sceneNumberInvalid')
    expect(validateSceneNumber(NaN)).toBe('errors.sceneNumberInvalid')
  })
})

describe('validateSceneDescription', () => {
  it('requires non-blank description', () => {
    expect(validateSceneDescription('alley rain')).toBeNull()
    expect(validateSceneDescription('  x  ')).toBeNull()
    expect(validateSceneDescription('')).toBe('errors.descriptionRequired')
    expect(validateSceneDescription('   ')).toBe('errors.descriptionRequired')
  })
})

describe('nextSceneNumber', () => {
  it('starts at 1 when empty', () => {
    expect(nextSceneNumber([])).toBe(1)
  })

  it('ignores undefined/NaN from global library rows', () => {
    expect(nextSceneNumber([undefined as unknown as number, NaN, null])).toBe(1)
    expect(nextSceneNumber([1, undefined as unknown as number, 3, NaN])).toBe(4)
    expect(nextSceneNumber([0, -2, 2.5 as unknown as number])).toBe(1)
  })

  it('returns max + 1', () => {
    expect(nextSceneNumber([2, 5, 1])).toBe(6)
  })
})

describe('coerceSceneNumber', () => {
  it('returns null for absent / invalid', () => {
    expect(coerceSceneNumber(undefined)).toBeNull()
    expect(coerceSceneNumber(null)).toBeNull()
    expect(coerceSceneNumber('')).toBeNull()
    expect(coerceSceneNumber(NaN)).toBeNull()
    expect(coerceSceneNumber(1.5)).toBeNull()
    expect(coerceSceneNumber(0)).toBeNull()
    expect(coerceSceneNumber(-3)).toBeNull()
    expect(coerceSceneNumber('nope')).toBeNull()
  })

  it('coerces valid numbers and numeric strings', () => {
    expect(coerceSceneNumber(3)).toBe(3)
    expect(coerceSceneNumber('7')).toBe(7)
  })
})
