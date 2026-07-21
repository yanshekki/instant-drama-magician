import { describe, expect, it } from 'vitest'
import {
  createCostumeEntry,
  ensureCostumeInLibrary,
  findCostumeByDescription,
  parseCharacterCostumes,
  removeCostume,
  serializeCharacterCostumes,
  upsertCostume
} from './characterCostumes'

describe('characterCostumes', () => {
  it('round-trips JSON', () => {
    const e = createCostumeEntry({
      name: 'Rain',
      description: 'black raincoat, red scarf'
    })
    const json = serializeCharacterCostumes([e])
    const again = parseCharacterCostumes(json)
    expect(again).toHaveLength(1)
    expect(again[0].description).toMatch(/raincoat/)
  })

  it('ensureCostumeInLibrary adds default once', () => {
    let lib = ensureCostumeInLibrary([], 'blue dress')
    expect(lib).toHaveLength(1)
    lib = ensureCostumeInLibrary(lib, 'blue dress')
    expect(lib).toHaveLength(1)
    lib = ensureCostumeInLibrary(lib, 'red armor')
    expect(lib).toHaveLength(2)
  })

  it('upsert and remove', () => {
    const a = createCostumeEntry({ description: 'A' })
    let lib = [a]
    lib = upsertCostume(lib, { ...a, name: 'Renamed' })
    expect(lib[0].name).toBe('Renamed')
    lib = removeCostume(lib, a.id)
    expect(lib).toHaveLength(0)
  })

  it('ignores corrupt JSON', () => {
    expect(parseCharacterCostumes('not-json')).toEqual([])
    expect(parseCharacterCostumes(null)).toEqual([])
    expect(parseCharacterCostumes('{}')).toEqual([])
  })

  it('parse skips empty descriptions and fills defaults', () => {
    const items = parseCharacterCostumes(
      JSON.stringify([
        {
          description: '  red coat  ',
          artStyle: ' anime ',
          imagePath: '/x.png',
          createdAt: '2020-01-01',
          updatedAt: '2020-01-02'
        },
        { description: '' },
        null,
        { name: '  ', description: 'only desc' }
      ])
    )
    expect(items).toHaveLength(2)
    expect(items[0].description).toBe('red coat')
    expect(items[0].artStyle).toBe('anime')
    expect(items[0].imagePath).toBe('/x.png')
    expect(items[0].name).toBe('red coat')
    expect(items[1].name).toBe('only desc')
  })

  it('createCostumeEntry rejects empty and uses name fallback', () => {
    expect(() => createCostumeEntry({ description: '  ' })).toThrow()
    const e = createCostumeEntry({
      description: 'blue',
      artStyle: ' photo_cinematic ',
      imagePath: '/i.png'
    })
    expect(e.name).toBe('blue')
    expect(e.artStyle).toBe('photo_cinematic')
  })

  it('findCostumeByDescription and ensure with artStyle update', () => {
    const a = createCostumeEntry({ description: 'Blue Dress', artStyle: null })
    expect(findCostumeByDescription([a], 'blue dress')?.id).toBe(a.id)
    expect(findCostumeByDescription([a], '')).toBeNull()
    const next = ensureCostumeInLibrary([a], 'Blue Dress', {
      artStyle: 'anime_modern'
    })
    expect(next[0].artStyle).toBe('anime_modern')
    expect(ensureCostumeInLibrary([a], '  ')).toEqual([a])
    const named = ensureCostumeInLibrary([], 'new look', { name: 'Custom' })
    expect(named[0].name).toBe('Custom')
  })

  it('upsert inserts when id missing', () => {
    const a = createCostumeEntry({ description: 'A' })
    const b = createCostumeEntry({ description: 'B' })
    const next = upsertCostume([a], b)
    expect(next.map((x) => x.id)).toEqual([b.id, a.id])
  })
})
