import { describe, expect, it } from 'vitest'
import {
  makeActionCastRefId,
  parseActionCastRefs,
  serializeActionCastRefs,
  type ActionCastRef
} from './actionCastRefs'

describe('actionCastRefs', () => {
  it('parses empty / invalid as []', () => {
    expect(parseActionCastRefs(null)).toEqual([])
    expect(parseActionCastRefs('')).toEqual([])
    expect(parseActionCastRefs('not-json')).toEqual([])
    expect(parseActionCastRefs('{}')).toEqual([])
  })

  it('parses valid refs and drops bad rows', () => {
    const refs = parseActionCastRefs(
      JSON.stringify([
        {
          id: 'a1',
          entityType: 'character',
          entityId: 'c1',
          imagePath: '/x.png',
          entityName: 'Hero',
          roleHint: 'lead'
        },
        { entityType: 'nope', entityId: 'x', imagePath: '/y.png' },
        { entityType: 'prop', entityId: 'p1', imagePath: '/p.png' }
      ])
    )
    expect(refs).toHaveLength(2)
    expect(refs[0]).toMatchObject({
      id: 'a1',
      entityType: 'character',
      entityId: 'c1',
      entityName: 'Hero',
      roleHint: 'lead'
    })
    expect(refs[1].entityType).toBe('prop')
    expect(refs[1].id).toMatch(/^aref_/)
  })

  it('round-trips serialize', () => {
    const refs: ActionCastRef[] = [
      {
        id: 'a',
        entityType: 'scene',
        entityId: 's1',
        imagePath: '/s.png'
      }
    ]
    expect(parseActionCastRefs(serializeActionCastRefs(refs))).toEqual(refs)
  })

  it('makeActionCastRefId is unique-ish', () => {
    expect(makeActionCastRefId()).toMatch(/^aref_/)
    expect(makeActionCastRefId()).not.toBe(makeActionCastRefId())
  })
})
