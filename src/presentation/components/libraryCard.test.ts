import { describe, expect, it } from 'vitest'
import {
  libraryBodyClass,
  libraryCardClass,
  libraryGridClass,
  libraryMediaClass
} from './libraryCard'

describe('libraryCard classes', () => {
  it('exports non-empty layout tokens', () => {
    expect(libraryGridClass).toContain('grid')
    expect(libraryCardClass).toContain('rounded')
    expect(libraryMediaClass).toContain('aspect')
    expect(libraryBodyClass).toContain('flex')
  })
})
