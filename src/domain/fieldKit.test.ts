import { describe, expect, it } from 'vitest'
import {
  assembleFieldKitPrompt,
  defineFieldKit,
  emptyFieldKit,
  fieldKitHasSelection,
  listFieldKitTemplates,
  mergeFieldKitsIntoProfileJson,
  paginateItems,
  parseFieldKit
} from './fieldKit'
import {
  CAMERA_KIT,
  COSTUME_KIT,
  HARDRULES_KIT,
  LOCATION_KIT,
  MANNERISM_KIT,
  MOTION_KIT,
  PROPLOOK_KIT,
  SETDRESSING_KIT,
  STYLENOTE_KIT,
  VOICE_KIT
} from './kits'

const SAMPLE = defineFieldKit({
  key: 'sampleKit',
  parts: ['a', 'b'] as const,
  partLabels: {
    a: { zhHK: '甲', zhCN: '甲', en: 'A' },
    b: { zhHK: '乙', zhCN: '乙', en: 'B' }
  },
  rows: {
    a: [
      ['one', '一號', 'One', '熱、快', 'hot, fast', '結構甲', 'struct A', 'block a']
    ],
    b: [
      ['two', '二號', 'Two', '冷、慢', 'cold, slow', '結構乙', 'struct B', 'block b']
    ]
  }
})

describe('fieldKit', () => {
  it('assembles zh and en clauses and merges profile keys', () => {
    const zh = assembleFieldKitPrompt(SAMPLE, { a: 'one', notes: '備' }, 'zh-HK')
    expect(zh).toMatch(/^甲：一號/)
    expect(zh).toMatch(/block a/)
    expect(zh).toMatch(/備註：備/)
    const en = assembleFieldKitPrompt(SAMPLE, { a: 'one' }, 'en')
    expect(en).toMatch(/^A: One/)
    expect(fieldKitHasSelection(SAMPLE, emptyFieldKit())).toBe(false)
    const json = mergeFieldKitsIntoProfileJson('{"name":"N"}', [
      { spec: SAMPLE, kit: { a: 'one' } }
    ])
    expect(JSON.parse(json ?? '{}')).toEqual({
      name: 'N',
      sampleKit: { a: 'one' }
    })
    expect(parseFieldKit(SAMPLE, json).a).toBe('one')
    expect(paginateItems(['x', 'y', 'z'], 2, 2).items).toEqual(['z'])
  })

  it('catalogs every visual kit with 50+ unique ids per part', () => {
    const all = [
      COSTUME_KIT,
      VOICE_KIT,
      MANNERISM_KIT,
      LOCATION_KIT,
      SETDRESSING_KIT,
      CAMERA_KIT,
      PROPLOOK_KIT,
      MOTION_KIT,
      STYLENOTE_KIT,
      HARDRULES_KIT
    ]
    for (const spec of all) {
      for (const part of spec.parts) {
        const list = listFieldKitTemplates(spec, part)
        expect(list.length, `${spec.key}.${part}`).toBeGreaterThanOrEqual(50)
        const ids = list.map((d) => d.id)
        expect(new Set(ids).size).toBe(ids.length)
      }
    }
    const rules = assembleFieldKitPrompt(
      HARDRULES_KIT,
      { faceLock: listFieldKitTemplates(HARDRULES_KIT, 'faceLock')[0]?.id },
      'en'
    )
    expect(rules).toMatch(/^\[MUST\]/)
  })

  it('clears a kit key when AI fill overwrites the field (empty selection)', () => {
    const first = listFieldKitTemplates(COSTUME_KIT, 'silhouette')[0]
    expect(first).toBeTruthy()
    const stored = mergeFieldKitsIntoProfileJson(null, [
      { spec: COSTUME_KIT, kit: { silhouette: first!.id } }
    ])
    expect(stored).toMatch(/costumeKit/)
    const cleared = mergeFieldKitsIntoProfileJson(stored, [
      { spec: COSTUME_KIT, kit: emptyFieldKit() }
    ])
    expect(cleared ?? '').not.toMatch(/costumeKit/)
  })
})
