import { describe, expect, it } from 'vitest'
import type { CharacterGalleryItem } from './characterGallery'
import {
  buildCostumeIntroVideoPrompt,
  buildCostumeSwapPrompt,
  costumePosesByGroup,
  costumeSwapGalleryLabel,
  COSTUME_SWAP_POSES,
  getCostumeSwapPose,
  inferGalleryLayer,
  pickBestBaseImage
} from './costumeSwap'

function item(
  partial: Partial<CharacterGalleryItem> & { path: string }
): CharacterGalleryItem {
  return {
    id: partial.id ?? partial.path,
    path: partial.path,
    kind: partial.kind ?? 'sheet',
    label: partial.label ?? 'Image',
    createdAt: partial.createdAt ?? '2026-01-01',
    ...(partial.layer ? { layer: partial.layer } : {})
  }
}

describe('costumeSwap', () => {
  it('infers layer from explicit field or label heuristics', () => {
    expect(
      inferGalleryLayer(item({ path: '/a', layer: 'base', label: 'x' }))
    ).toBe('base')
    expect(
      inferGalleryLayer(
        item({ path: '/b', label: 'Body nude turnaround' })
      )
    ).toBe('nude')
    expect(
      inferGalleryLayer(item({ path: '/b2', label: 'Body plate front' }))
    ).toBe('nude')
    expect(
      inferGalleryLayer(item({ path: '/c', label: 'Base layer hero' }))
    ).toBe('base')
    expect(
      inferGalleryLayer(item({ path: '/d', label: 'Costume hero' }))
    ).toBe('costume')
  })

  it('picks nude → base → costume → any; skips nude for minors', () => {
    const g = [
      item({ path: '/costume.png', label: 'Costume hero', layer: 'costume' }),
      item({ path: '/base.png', label: 'Base layer hero', layer: 'base' }),
      item({ path: '/nude.png', label: 'Body nude front', layer: 'nude' })
    ]
    // gallery is newest-first; pickBestBase prefers layer order not array order
    expect(pickBestBaseImage(g).reason).toBe('nude')
    expect(pickBestBaseImage(g).item?.path).toBe('/nude.png')

    expect(pickBestBaseImage(g, { ageRange: '15 years' }).reason).toBe('base')
    expect(pickBestBaseImage(g, { ageRange: '15' }).item?.path).toBe(
      '/base.png'
    )

    expect(
      pickBestBaseImage(g, { preferredPath: '/costume.png' }).reason
    ).toBe('manual')

    // minor + preferred nude falls back to safe base
    expect(
      pickBestBaseImage(g, {
        ageRange: 'child',
        preferredPath: '/nude.png'
      }).item?.path
    ).toBe('/base.png')
  })

  it('returns none when gallery empty', () => {
    expect(pickBestBaseImage([]).reason).toBe('none')
    expect(pickBestBaseImage([]).item).toBeNull()
  })

  it('lists expanded pose packages with size classes', () => {
    expect(COSTUME_SWAP_POSES.length).toBeGreaterThanOrEqual(6)
    expect(getCostumeSwapPose('bust').sizeClass).toBe('tall')
    expect(getCostumeSwapPose('turnaround').sizeClass).toBe('wide')
    expect(getCostumeSwapPose('detail_fabric').sizeClass).toBe('square')
    expect(getCostumeSwapPose('unknown_pose').id).toBe('hero_front')
  })

  it('builds prompt that locks identity and replaces wardrobe', () => {
    const p = buildCostumeSwapPrompt({
      name: 'Aiko',
      newCostume: 'red qipao with gold trim',
      artStyle: 'anime_modern',
      appearance: 'black bob hair',
      pose: 'hero_front'
    })
    expect(p).toMatch(/COSTUME SWAP|REPLACE/i)
    expect(p).toMatch(/red qipao/i)
    expect(p).toMatch(/IDENTITY LOCK|identity/i)
    expect(p).toMatch(/MANDATORY MEDIUM|anime/i)
    expect(p).toMatch(/COMPLETELY REPLACE|strip away/i)
    expect(p).toMatch(/Aiko/)
  })

  it('throws when costume empty', () => {
    expect(() =>
      buildCostumeSwapPrompt({ name: 'X', newCostume: '  ' })
    ).toThrow(/required/i)
  })

  it('labels gallery entries with short costume text', () => {
    expect(costumeSwapGalleryLabel('blue raincoat')).toBe(
      'Costume swap · blue raincoat'
    )
  })

  it('buildCostumeIntroVideoPrompt locks wardrobe', () => {
    const zh = buildCostumeIntroVideoPrompt(
      { name: '雨褸', description: '黑色皮褸長版' },
      'zh-HK'
    )
    expect(zh).toMatch(/服裝鎖定/)
    expect(zh).toContain('雨褸')
    expect(zh).toContain('黑色皮褸')

    const en = buildCostumeIntroVideoPrompt(
      {
        name: 'Coat',
        description: 'black leather',
        fabric: 'leather',
        colorNotes: 'matte black',
        hardRules: 'NO logo'
      },
      'en'
    )
    expect(en).toMatch(/WARDROBE|costume|Coat/i)
    expect(en).toContain('leather')
  })

  it('costumePosesByGroup groups all poses', () => {
    const groups = costumePosesByGroup()
    const all = Object.values(groups).flat()
    expect(all.length).toBe(COSTUME_SWAP_POSES.length)
    expect(Object.keys(groups).length).toBeGreaterThan(0)
  })

  it('inferGalleryLayer more heuristics and pick when only costume', () => {
    expect(
      inferGalleryLayer(item({ path: '/i', label: 'Identity lock still' }))
    ).toBe('identity')
    expect(
      inferGalleryLayer(item({ path: '/d', label: 'Fabric detail close-up' }))
    ).toBe('detail')
    // sheet/upload/gen without wardrobe keywords default to costume
    expect(
      inferGalleryLayer(item({ path: '/x', label: 'misc', kind: 'sheet' }))
    ).toBe('costume')
    expect(
      inferGalleryLayer(
        item({ path: '/e', label: 'misc', kind: 'external' })
      )
    ).toBeNull()

    const onlyCostume = [
      item({ path: '/c.png', label: 'Costume', layer: 'costume' })
    ]
    expect(pickBestBaseImage(onlyCostume).reason).toBe('costume')
  })

  it('buildCostumeSwapPrompt with hard rules and default pose', () => {
    const p = buildCostumeSwapPrompt({
      name: 'Ming',
      newCostume: 'yellow raincoat',
      hardRules: '【禁止】水印',
      appearance: 'short hair'
    })
    expect(p).toContain('yellow raincoat')
    expect(p).toMatch(/禁止|水印/)
  })
})
