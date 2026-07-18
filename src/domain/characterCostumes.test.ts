import { describe, expect, it } from 'vitest'
import {
  createCostumeEntry,
  ensureCostumeInLibrary,
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
  })
})
