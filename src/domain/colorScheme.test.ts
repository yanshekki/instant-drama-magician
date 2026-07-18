import { describe, expect, it } from 'vitest'
import {
  coerceColorScheme,
  isColorSchemePref,
  resolveColorScheme
} from './colorScheme'

describe('colorScheme', () => {
  it('coerces invalid to system', () => {
    expect(coerceColorScheme(undefined)).toBe('system')
    expect(coerceColorScheme('nope')).toBe('system')
    expect(coerceColorScheme('light')).toBe('light')
    expect(coerceColorScheme('dark')).toBe('dark')
    expect(isColorSchemePref('system')).toBe(true)
  })

  it('resolves explicit prefs without media', () => {
    expect(resolveColorScheme('light')).toBe('light')
    expect(resolveColorScheme('dark')).toBe('dark')
  })
})
