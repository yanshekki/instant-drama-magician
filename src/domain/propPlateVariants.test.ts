import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PROP_PLATE,
  PROP_PLATE_VARIANTS,
  buildPropPlateEditPrompt,
  buildPropPlateImagePrompt,
  getPropPlateVariant
} from './propPlateVariants'

const profile = {
  name: 'Red umbrella',
  description: 'vintage collapsible umbrella with brass tip',
  material: 'nylon + wood',
  sizeNotes: 'hand-held',
  condition: 'worn edges',
  visualTags: 'wet, rain',
  hardRules: '【禁止】品牌 logo'
}

describe('PROP_PLATE_VARIANTS', () => {
  it('includes hero and detail variants', () => {
    const ids = PROP_PLATE_VARIANTS.map((v) => v.id)
    expect(ids).toContain('hero')
    expect(ids).toContain('detail')
    expect(ids).toContain('three_quarter')
    expect(ids).toContain('material')
    expect(ids).toContain('in_hand_scale')
    expect(PROP_PLATE_VARIANTS.length).toBeGreaterThanOrEqual(3)
    expect(DEFAULT_PROP_PLATE).toBe('hero')
  })

  it('each variant has layout and labelKey', () => {
    for (const v of PROP_PLATE_VARIANTS) {
      expect(v.layout.length).toBeGreaterThan(10)
      expect(v.labelKey.length).toBeGreaterThan(0)
      expect(v.galleryLabel.length).toBeGreaterThan(0)
      expect(['wide', 'square', 'tall']).toContain(v.sizeClass)
    }
  })
})

describe('getPropPlateVariant', () => {
  it('returns known id and falls back to hero', () => {
    expect(getPropPlateVariant('detail').id).toBe('detail')
    expect(getPropPlateVariant('material').id).toBe('material')
    expect(getPropPlateVariant(null).id).toBe('hero')
    expect(getPropPlateVariant(undefined).id).toBe('hero')
    expect(getPropPlateVariant('nope').id).toBe('hero')
    expect(getPropPlateVariant('').id).toBe('hero')
  })
})

describe('buildPropPlateImagePrompt', () => {
  it('includes profile fields, layout, style, and hard rules', () => {
    const prompt = buildPropPlateImagePrompt(profile, 'detail', 'photo_cinematic')
    expect(prompt).toContain('Red umbrella')
    expect(prompt).toContain('vintage collapsible')
    expect(prompt).toContain('nylon + wood')
    expect(prompt).toContain('hand-held')
    expect(prompt).toContain('worn edges')
    expect(prompt).toContain('wet, rain')
    expect(prompt).toMatch(/LAYOUT/i)
    expect(prompt).toMatch(/close-up|detail/i)
    expect(prompt).toMatch(/禁止|品牌|logo/)
    expect(prompt).toMatch(/photo_cinematic|cinematic/i)
  })

  it('omits optional empty fields and uses defaults', () => {
    const prompt = buildPropPlateImagePrompt({
      name: 'Cup',
      description: 'white mug'
    })
    expect(prompt).toContain('Cup')
    expect(prompt).toContain('white mug')
    expect(prompt).not.toMatch(/Material:/)
    expect(prompt).not.toMatch(/Size notes:/)
    expect(prompt).toMatch(/LAYOUT/i)
  })

  it('uses variant layout for scale plate', () => {
    const prompt = buildPropPlateImagePrompt(
      { name: 'Sword', description: 'katana' },
      'in_hand_scale'
    )
    expect(prompt).toMatch(/scale|hand|silhouette/i)
  })
})

describe('buildPropPlateEditPrompt', () => {
  it('prefixes image-edit restyle instructions', () => {
    const edit = buildPropPlateEditPrompt(profile, 'hero', 'anime')
    expect(edit).toMatch(/IMAGE EDIT|PROP RESTYLE/i)
    expect(edit).toContain('SAME prop identity')
    expect(edit).toContain('Red umbrella')
    expect(edit).toMatch(/anime|medium/i)
  })
})
