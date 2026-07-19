import { describe, expect, it } from 'vitest'
import { PROP_PLATE_VARIANTS } from './propPlateVariants'

describe('PROP_PLATE_VARIANTS', () => {
  it('includes hero and detail variants', () => {
    const ids = PROP_PLATE_VARIANTS.map((v) => v.id)
    expect(ids).toContain('hero')
    expect(ids).toContain('detail')
    expect(PROP_PLATE_VARIANTS.length).toBeGreaterThanOrEqual(3)
  })

  it('each variant has layout and labelKey', () => {
    for (const v of PROP_PLATE_VARIANTS) {
      expect(v.layout.length).toBeGreaterThan(10)
      expect(v.labelKey.length).toBeGreaterThan(0)
      expect(['wide', 'square', 'tall']).toContain(v.sizeClass)
    }
  })
})
