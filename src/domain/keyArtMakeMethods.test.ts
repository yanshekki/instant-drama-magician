import { describe, expect, it } from 'vitest'
import {
  KEY_ART_MAKE_METHODS,
  coerceKeyArtMakeMethod,
  getKeyArtMakeMethod
} from './keyArtMakeMethods'

describe('keyArtMakeMethods', () => {
  it('defaults to fresh and flags edit/continue', () => {
    expect(KEY_ART_MAKE_METHODS).toHaveLength(4)
    expect(coerceKeyArtMakeMethod('')).toBe('fresh')
    expect(coerceKeyArtMakeMethod('edit')).toBe('edit')
    expect(getKeyArtMakeMethod('edit').usesOwnEditBase).toBe(true)
    expect(getKeyArtMakeMethod('continue').usesPreviousShot).toBe(true)
    expect(getKeyArtMakeMethod('identity').usesOwnEditBase).toBe(false)
  })
})
