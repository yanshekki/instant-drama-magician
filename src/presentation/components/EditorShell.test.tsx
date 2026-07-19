import { describe, expect, it, vi } from 'vitest'
import * as Mod from './EditorShell'

describe('EditorShell module', () => {
  it('exports at least one symbol', () => {
    const keys = Object.keys(Mod)
    expect(keys.length).toBeGreaterThan(0)
  })
})
