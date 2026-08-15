import { describe, expect, it } from 'vitest'
import { recipePickerCardClass } from './PromptTemplateContext'

describe('recipePickerCardClass', () => {
  it('marks the selected recipe with brand tokens, not missing accent colors', () => {
    const on = recipePickerCardClass(true)
    const off = recipePickerCardClass(false)
    expect(on).toMatch(/border-brand-600/)
    expect(on).toMatch(/bg-brand-950/)
    expect(on).toMatch(/ring-2/)
    expect(on).not.toMatch(/accent-/)
    expect(off).toMatch(/border-ink-700/)
    expect(off).not.toMatch(/border-brand-600/)
    expect(off).not.toMatch(/accent-/)
  })
})
