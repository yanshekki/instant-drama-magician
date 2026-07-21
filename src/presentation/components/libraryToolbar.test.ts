import { describe, expect, it } from 'vitest'
import { libraryToolbar } from './libraryToolbar'

describe('libraryToolbar', () => {
  it('exports all control tokens', () => {
    expect(libraryToolbar.panel).toContain('rounded')
    expect(libraryToolbar.controlH).toBe('h-10')
    expect(libraryToolbar.searchInput).toContain('h-10')
    expect(libraryToolbar.select).toContain('appearance-none')
    expect(libraryToolbar.selectActive).toContain('brand')
    expect(libraryToolbar.label).toContain('text-[11px]')
    expect(libraryToolbar.sectionTitle).toContain('uppercase')
    expect(libraryToolbar.filterGrid).toContain('grid')
    expect(libraryToolbar.clearBtn).toContain('h-10')
    expect(libraryToolbar.clearBtnActive).toContain('brand')
  })
})
