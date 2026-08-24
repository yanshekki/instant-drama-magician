import { describe, expect, it } from 'vitest'
import {
  APPEARANCE_PART_IDS,
  APPEARANCE_TEMPLATES,
  appearanceKitHasSelection,
  appearancePartLabel,
  appearanceTemplateSearchHaystack,
  assembleAppearancePrompt,
  countAppearanceKitParts,
  emptyAppearanceKit,
  getAppearanceTemplate,
  listAppearanceTemplates,
  paginateItems,
  mergeAppearanceKitIntoProfileJson,
  parseAppearanceKit,
  sanitizeAppearanceKit,
  setAppearanceKitPart
} from './characterAppearanceKit'

describe('characterAppearanceKit', () => {
  it('catalogs every part with unique ids', () => {
    expect(APPEARANCE_PART_IDS).toHaveLength(8)
    for (const part of APPEARANCE_PART_IDS) {
      const list = listAppearanceTemplates(part)
      expect(list.length).toBeGreaterThanOrEqual(50)
      const ids = list.map((d) => d.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
    expect(APPEARANCE_TEMPLATES.length).toBeGreaterThanOrEqual(400)
    const p1 = paginateItems(listAppearanceTemplates('eyes'), 1)
    expect(p1.items[0]?.id).toBe('phoenix')
    expect(p1.totalPages).toBeGreaterThan(1)
    expect(paginateItems(listAppearanceTemplates('eyes'), 2).items[0]?.id).not.toBe(
      'phoenix'
    )
  })

  it('assembles zh-HK formula in part order and skips empty', () => {
    const text = assembleAppearancePrompt(
      {
        face: 'seed',
        eyes: 'phoenix',
        nose: 'sword',
        mouth: 'cherry',
        hair: 'long_straight_black',
        skin: 'cool_porcelain',
        body: 'slim_tall',
        mark: 'tear_mole',
        notes: '左眼尾淚痣偏上'
      },
      'zh-HK'
    )
    expect(text).toMatch(/^臉型：瓜子臉/)
    expect(text.indexOf('臉型')).toBeLessThan(text.indexOf('眼型'))
    expect(text.indexOf('眼型')).toBeLessThan(text.indexOf('鼻型'))
    expect(text.indexOf('鼻型')).toBeLessThan(text.indexOf('嘴型'))
    expect(text).toMatch(/丹鳳眼/)
    expect(text).toMatch(/phoenix eyes, narrow long eye slit/)
    expect(text).toMatch(/氣場：/)
    expect(text).toMatch(/備註：左眼尾淚痣偏上/)
    expect(text.endsWith('。')).toBe(true)
  })

  it('omits skipped parts and mark=none', () => {
    const text = assembleAppearancePrompt(
      { eyes: 'fox', mark: 'none' },
      'zh-HK'
    )
    expect(text).toMatch(/狐狸眼/)
    expect(text).not.toMatch(/辨識/)
    expect(text).not.toMatch(/臉型/)
  })

  it('assembles English when locale is not Chinese', () => {
    const text = assembleAppearancePrompt(
      { eyes: 'phoenix', hair: 'short_textured', notes: 'old scar' },
      'en'
    )
    expect(text).toMatch(/^Eyes: Phoenix eyes/)
    expect(text).toMatch(/Hair: Short textured crop/)
    expect(text).toMatch(/Aura:/)
    expect(text).toMatch(/Notes: old scar/)
    expect(text).not.toMatch(/眼型/)
  })

  it('uses simplified part headers for zh-CN', () => {
    const text = assembleAppearancePrompt({ hair: 'hanfu_updo' }, 'zh-CN')
    expect(text).toMatch(/发型：/)
    expect(text).not.toMatch(/髮型：/)
  })

  it('returns empty string when nothing selected', () => {
    expect(assembleAppearancePrompt({}, 'zh-HK')).toBe('')
    expect(appearanceKitHasSelection(emptyAppearanceKit())).toBe(false)
    expect(countAppearanceKitParts({})).toBe(0)
  })

  it('ignores unknown ids', () => {
    const text = assembleAppearancePrompt(
      { eyes: 'not-real', face: 'seed' },
      'zh-HK'
    )
    expect(text).toMatch(/瓜子臉/)
    expect(text).not.toMatch(/not-real/)
  })

  it('parses appearanceKit from profileJson and ignores top-level profile', () => {
    const kit = parseAppearanceKit(
      JSON.stringify({
        name: '阿明',
        appearance: '短髮',
        appearanceKit: { eyes: 'phoenix', notes: '  x  ' }
      })
    )
    expect(kit).toEqual({ eyes: 'phoenix', notes: 'x' })
    expect(parseAppearanceKit('not-json')).toEqual({})
    expect(parseAppearanceKit('[]')).toEqual({})
    expect(parseAppearanceKit('{"appearanceKit":"x"}')).toEqual({})
  })

  it('merges kit into existing profileJson without wiping other keys', () => {
    const next = mergeAppearanceKitIntoProfileJson(
      JSON.stringify({ name: '阿明', appearance: '短髮' }),
      { eyes: 'deer', notes: 'campus' }
    )
    const obj = JSON.parse(next ?? '{}') as {
      name: string
      appearanceKit: { eyes: string; notes: string }
    }
    expect(obj.name).toBe('阿明')
    expect(obj.appearanceKit).toEqual({ eyes: 'deer', notes: 'campus' })
  })

  it('drops appearanceKit when selection is empty', () => {
    const next = mergeAppearanceKitIntoProfileJson(
      JSON.stringify({ appearanceKit: { eyes: 'fox' }, name: 'N' }),
      {}
    )
    expect(JSON.parse(next ?? '{}')).toEqual({ name: 'N' })
    expect(mergeAppearanceKitIntoProfileJson('{}', {})).toBeNull()
    expect(mergeAppearanceKitIntoProfileJson('not-json', {})).toBeNull()
  })

  it('setAppearanceKitPart toggles and sanitizes', () => {
    const a = setAppearanceKitPart({}, 'eyes', 'phoenix')
    expect(a.eyes).toBe('phoenix')
    expect(setAppearanceKitPart(a, 'eyes', 'nope')).toEqual({})
    expect(setAppearanceKitPart(a, 'eyes', null)).toEqual({})
    expect(getAppearanceTemplate('eyes', 'phoenix')?.id).toBe('phoenix')
    expect(sanitizeAppearanceKit({ eyes: 'phoenix', extra: 1 })).toEqual({
      eyes: 'phoenix'
    })
  })

  it('search haystack includes both languages', () => {
    const def = getAppearanceTemplate('eyes', 'phoenix')
    expect(def).toBeTruthy()
    const hay = appearanceTemplateSearchHaystack(def!, 'zh-HK')
    expect(hay).toMatch(/丹鳳眼/)
    expect(hay).toMatch(/phoenix/)
    expect(appearancePartLabel('face', 'en')).toBe('Face')
    expect(countAppearanceKitParts({ eyes: 'fox', nose: 'sword' })).toBe(2)
    expect(appearanceKitHasSelection({ notes: 'only' })).toBe(true)
  })
})
