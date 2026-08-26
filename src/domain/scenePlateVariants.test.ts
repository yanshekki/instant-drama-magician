import { describe, expect, it } from 'vitest'
import {
  SCENE_PLATE_VARIANTS,
  buildScenePlateEditPrompt,
  buildScenePlateImagePrompt,
  getScenePlateVariant,
  isScenePlateVariantId,
  scenePlatesByGroup
} from './scenePlateVariants'

describe('scenePlateVariants', () => {
  it('has core establishing and empty-set language', () => {
    expect(SCENE_PLATE_VARIANTS.some((v) => v.id === 'establishing')).toBe(
      true
    )
    expect(SCENE_PLATE_VARIANTS.length).toBeGreaterThan(8)
    const p = buildScenePlateImagePrompt(
      { description: 'neon alley tea shop' },
      'establishing',
      'photo_cinematic'
    )
    expect(p).toMatch(/空鏡場地板|不要主角臉/)
    expect(p).toMatch(/neon alley/i)
    expect(p).toMatch(/必須媒介|photo_cinematic/)
    expect(p).not.toMatch(/EMPTY LOCATION PLATE|MANDATORY MEDIUM|GEOMETRY LOCK/)
  })

  it('defaults unknown variant', () => {
    expect(getScenePlateVariant('nope').id).toBe('establishing')
    expect(getScenePlateVariant(null).id).toBe('establishing')
    expect(getScenePlateVariant('night_neon').id).toBe('night_neon')
    expect(isScenePlateVariantId('establishing')).toBe(true)
    expect(isScenePlateVariantId('nope')).toBe(false)
    expect(isScenePlateVariantId(1)).toBe(false)
  })

  it('buildScenePlateImagePrompt includes atmosphere fields and hard rules', () => {
    const p = buildScenePlateImagePrompt(
      {
        title: 'Pier',
        description: 'wet docks',
        timeOfDay: 'night',
        weather: 'rain',
        mood: 'tense',
        lighting: 'neon',
        setDressing: 'crates',
        visualTags: 'industrial',
        hardRules: '【禁止】水印'
      },
      'rain_wet',
      'anime_modern'
    )
    expect(p).toContain('Pier')
    expect(p).not.toMatch(/\{\{/)
    expect(p).toContain('rain')
    expect(p).toMatch(/禁止|水印|anime/)
  })

  it('buildScenePlateEditPrompt forces layout change', () => {
    const edit = buildScenePlateEditPrompt(
      { description: 'alley', hardRules: 'NO logo' },
      'hero_plate',
      'photo_cinematic'
    )
    expect(edit).toMatch(/圖像編輯|場地改風格|hero|NO logo/i)
  })

  it('scenePlatesByGroup groups all variants', () => {
    const groups = scenePlatesByGroup()
    const all = Object.values(groups).flat()
    expect(all.length).toBe(SCENE_PLATE_VARIANTS.length)
    expect(Object.keys(groups).length).toBeGreaterThan(0)
  })
})
