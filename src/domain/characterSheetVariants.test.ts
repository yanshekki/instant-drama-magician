import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SHEET_VARIANT,
  getSheetVariant,
  isLikelyMinorAge,
  isSheetVariantId,
  SHEET_VARIANTS,
  sheetRequiresUnclothedSupport,
  sheetVariantsByGroup,
  sheetVariantsByGroupForProfile,
  sheetVariantsForProfile,
  buildSheetIdentityLock
} from './characterSheetVariants'
import { buildCharacterSheetImagePrompt } from './characterMasterPrompt'

describe('characterSheetVariants', () => {
  it('includes wardrobe layers for costume swap', () => {
    expect(SHEET_VARIANTS.some((v) => v.id === 'body_nude_turnaround')).toBe(
      true
    )
    expect(SHEET_VARIANTS.some((v) => v.id === 'body_bare_front')).toBe(true)
    expect(SHEET_VARIANTS.some((v) => v.id === 'body_half_bare_front')).toBe(
      true
    )
    expect(SHEET_VARIANTS.some((v) => v.id === 'base_layer_turnaround')).toBe(
      true
    )
    expect(SHEET_VARIANTS.some((v) => v.id === 'costume_turnaround')).toBe(
      true
    )
    const g = sheetVariantsByGroup()
    expect(g.sheetGroupWardrobe.length).toBeGreaterThanOrEqual(12)
    expect(getSheetVariant('body_nude_front').wardrobeLayer).toBe('nude')
    expect(getSheetVariant('body_half_bare_front').requiresUnclothedSupport).toBe(
      true
    )
    expect(getSheetVariant('body_bare_front').requiresUnclothedSupport).toBe(
      true
    )
    expect(getSheetVariant('body_half_bare_front').layout).toMatch(
      /UPPER-BODY|upper half|UPPER HALF/i
    )
    expect(getSheetVariant('body_half_bare_lower_front').layout).toMatch(
      /LOWER-BODY|lower half|LOWER HALF/i
    )
    expect(
      SHEET_VARIANTS.some((v) => v.id === 'body_half_bare_lower_t_pose')
    ).toBe(true)
    expect(getSheetVariant('body_bare_front').layout).toMatch(
      /FULL anatomical|FULLY garment-free|fully garment-free/i
    )
    expect(
      getSheetVariant('body_nude_front').requiresUnclothedSupport
    ).toBeFalsy()
    expect(getSheetVariant('base_layer_hero').wardrobeLayer).toBe('base')
  })

  it('hides nude sheets for minor ages', () => {
    expect(isLikelyMinorAge('12歲')).toBe(true)
    expect(isLikelyMinorAge('child')).toBe(true)
    expect(isLikelyMinorAge('mid-20s')).toBe(false)
    const forMinor = sheetVariantsForProfile({ ageRange: '10 years old' })
    expect(forMinor.every((v) => v.wardrobeLayer !== 'nude')).toBe(true)
    expect(forMinor.some((v) => v.id === 'body_bare_front')).toBe(false)
  })

  it('nude/base prompts ignore outer costume', () => {
    const p = buildCharacterSheetImagePrompt(
      {
        name: 'Ming',
        appearance: 'short hair',
        costume: 'heavy winter coat with gold trim'
      },
      'body_nude_front',
      'photo_cinematic'
    )
    expect(p).toMatch(/IGNORE for this sheet|body or base-layer only/i)
    expect(p).toMatch(/unitard|body proportion|NO outer costume|body plate/i)
    expect(p).not.toMatch(/heavy winter coat with gold trim/)
    // Must not use hard "nude/bare body" words that trip Grok Imagine filters
    // (layer id stays "nude" in data model; prompts must say "body" / unitard)
    expect(p.toLowerCase()).not.toMatch(/\bnude\b|\bbare body\b/)
    expect(p).toMatch(/Wardrobe layer tag: body/i)

    const base = buildCharacterSheetImagePrompt(
      { name: 'Ming', costume: 'armor set' },
      'base_layer_turnaround',
      'anime_modern'
    )
    expect(base).toMatch(/BASE-LAYER|undergarment|base clothing/i)
    expect(base).not.toMatch(/armor set/)
  })

  it('defaults and id checks still work', () => {
    expect(isSheetVariantId('silhouette')).toBe(true)
    expect(isSheetVariantId(1)).toBe(false)
    expect(getSheetVariant('nope').id).toBe(DEFAULT_SHEET_VARIANT)
    const lock = buildSheetIdentityLock(
      { name: 'X', costume: 'robe' },
      undefined,
      { skipOuterCostume: true }
    )
    expect(lock).toMatch(/IGNORE/)
  })

  it('sheetRequiresUnclothedSupport and minor group filter', () => {
    expect(sheetRequiresUnclothedSupport('body_bare_front')).toBe(true)
    expect(sheetRequiresUnclothedSupport('bible')).toBe(false)
    expect(sheetRequiresUnclothedSupport(null)).toBe(false)

    expect(isLikelyMinorAge(null)).toBe(false)
    expect(isLikelyMinorAge('teen')).toBe(true)
    expect(isLikelyMinorAge('25 years')).toBe(false)

    const g = sheetVariantsByGroupForProfile({ ageRange: '15' })
    expect(
      Object.values(g)
        .flat()
        .every((v) => v.wardrobeLayer !== 'nude')
    ).toBe(true)
    const adult = sheetVariantsByGroupForProfile({ ageRange: '30' })
    expect(Object.values(adult).flat().length).toBe(SHEET_VARIANTS.length)
  })

  it('buildSheetIdentityLock full fields with and without skip', () => {
    const full = buildSheetIdentityLock({
      name: 'Ming',
      ageRange: '20s',
      gender: 'm',
      appearance: 'short hair',
      costume: 'jacket',
      visualTags: 'urban, wet',
      mannerisms: 'touches helmet often when nervous'
    })
    expect(full).toMatch(/Ming|short hair|jacket|urban|helmet/)

    const skip = buildSheetIdentityLock(
      {
        name: 'Ming',
        appearance: 'short hair in coat',
        costume: 'coat',
        visualTags: 'coat, bag'
      },
      'Quality: sharp',
      { skipOuterCostume: true }
    )
    expect(skip).toMatch(/STRIP|IGNORE|Quality: sharp/)
  })
})
