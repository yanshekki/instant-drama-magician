import { describe, expect, it } from 'vitest'
import * as mod from './libraryCard'

describe('libraryCard classes', () => {
  it('exports all layout tokens as non-empty strings', () => {
    for (const [k, v] of Object.entries(mod)) {
      expect(typeof v, k).toBe('string')
      expect((v as string).length, k).toBeGreaterThan(0)
    }
    expect(mod.libraryGridClass).toContain('grid')
    expect(mod.libraryCardClass).toContain('rounded')
    expect(mod.libraryMediaClass).toContain('aspect')
    expect(mod.libraryBodyClass).toContain('flex')
    expect(mod.libraryMediaBadgeClass).toContain('absolute')
    expect(mod.libraryCardActionsRowClass).toContain('mt-auto')
    expect(mod.libraryCardActionBtnClass).toContain('flex-1')
    expect(mod.libraryCardActionDeleteClass).toBeTruthy()
  })
})
