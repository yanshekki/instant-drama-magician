import { describe, expect, it } from 'vitest'
import {
  buildScenePlateImagePrompt,
  getScenePlateVariant,
  SCENE_PLATE_VARIANTS
} from './scenePlateVariants'

describe('scenePlateVariants', () => {
  it('has core establishing and empty-set language', () => {
    expect(SCENE_PLATE_VARIANTS.some((v) => v.id === 'establishing')).toBe(
      true
    )
    const p = buildScenePlateImagePrompt(
      { description: 'neon alley tea shop' },
      'establishing',
      'photo_cinematic'
    )
    expect(p).toMatch(/EMPTY LOCATION|NO hero/i)
    expect(p).toMatch(/neon alley/i)
    expect(p).toMatch(/MANDATORY MEDIUM|photo/i)
  })

  it('defaults unknown variant', () => {
    expect(getScenePlateVariant('nope').id).toBe('establishing')
  })
})
