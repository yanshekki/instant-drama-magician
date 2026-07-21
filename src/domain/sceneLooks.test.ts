import { describe, expect, it } from 'vitest'
import { AppError } from '../types/errors'
import {
  createSceneLook,
  ensureLookInLibrary,
  parseSceneLooks,
  removeSceneLook,
  serializeSceneLooks,
  upsertSceneLook
} from './sceneLooks'

describe('parseSceneLooks', () => {
  it('returns empty for blank / invalid', () => {
    expect(parseSceneLooks(null)).toEqual([])
    expect(parseSceneLooks(undefined)).toEqual([])
    expect(parseSceneLooks('')).toEqual([])
    expect(parseSceneLooks('   ')).toEqual([])
    expect(parseSceneLooks('not-json')).toEqual([])
    expect(parseSceneLooks('{}')).toEqual([])
    expect(parseSceneLooks('null')).toEqual([])
  })

  it('parses valid looks and skips empty / non-objects', () => {
    const json = JSON.stringify([
      { id: 'a', name: 'Night', description: 'neon rain', artStyle: 'anime' },
      { description: '' },
      null,
      'skip',
      { description: '  dawn mist  ', imagePath: '/x.png' },
      {
        id: '',
        name: '  ',
        description: 'only desc',
        createdAt: '2020-01-01T00:00:00.000Z',
        updatedAt: '2020-01-02T00:00:00.000Z'
      }
    ])
    const looks = parseSceneLooks(json)
    expect(looks).toHaveLength(3)
    expect(looks[0].id).toBe('a')
    expect(looks[0].artStyle).toBe('anime')
    expect(looks[1].description).toBe('dawn mist')
    expect(looks[1].imagePath).toBe('/x.png')
    expect(looks[1].name).toBe('dawn mist')
    expect(looks[2].name).toBe('only desc')
    expect(looks[2].createdAt).toBe('2020-01-01T00:00:00.000Z')
    expect(looks[2].id).toMatch(/^look_/)
  })
})

describe('createSceneLook / upsert / remove', () => {
  it('creates with name fallback and rejects empty description', () => {
    const look = createSceneLook({
      description: '  rain alley  ',
      artStyle: ' photo_cinematic ',
      imagePath: '/i.png'
    })
    expect(look.description).toBe('rain alley')
    expect(look.name).toBe('rain alley')
    expect(look.artStyle).toBe('photo_cinematic')
    expect(look.imagePath).toBe('/i.png')
    expect(look.id).toMatch(/^look_/)
    expect(look.createdAt).toBe(look.updatedAt)

    const named = createSceneLook({ name: ' Neon ', description: 'city' })
    expect(named.name).toBe('Neon')

    expect(() => createSceneLook({ description: '  ' })).toThrow(AppError)
    try {
      createSceneLook({ description: '' })
    } catch (e) {
      expect(e).toBeInstanceOf(AppError)
      expect((e as AppError).message).toBe('errors.lookDescriptionRequired')
    }
  })

  it('upserts insert-first and update-in-place', () => {
    const a = createSceneLook({ name: 'A', description: 'a' })
    const b = createSceneLook({ name: 'B', description: 'b' })
    let items = [a]
    items = upsertSceneLook(items, b)
    expect(items.map((x) => x.id)).toEqual([b.id, a.id])

    const updated = { ...b, description: 'b2', name: 'B2' }
    items = upsertSceneLook(items, updated)
    expect(items).toHaveLength(2)
    expect(items[0].description).toBe('b2')
    expect(items[0].updatedAt >= b.updatedAt).toBe(true)
  })

  it('removes by id', () => {
    const a = createSceneLook({ description: 'a' })
    const b = createSceneLook({ description: 'b' })
    expect(removeSceneLook([a, b], a.id)).toEqual([b])
    expect(removeSceneLook([a], 'missing')).toEqual([a])
  })

  it('serialize round-trips', () => {
    const look = createSceneLook({ name: 'N', description: 'd' })
    const json = serializeSceneLooks([look])
    const parsed = parseSceneLooks(json)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].id).toBe(look.id)
    expect(parsed[0].description).toBe('d')
  })
})

describe('ensureLookInLibrary', () => {
  it('no-ops on blank text', () => {
    const items = [createSceneLook({ description: 'x' })]
    expect(ensureLookInLibrary(items, null)).toBe(items)
    expect(ensureLookInLibrary(items, '  ')).toBe(items)
  })

  it('skips case-insensitive duplicates', () => {
    const items = [createSceneLook({ description: 'Neon Rain' })]
    const next = ensureLookInLibrary(items, 'neon rain')
    expect(next).toBe(items)
  })

  it('prepends new look with opts', () => {
    const items = [createSceneLook({ description: 'old' })]
    const next = ensureLookInLibrary(items, 'new look', {
      name: 'Custom',
      artStyle: 'anime'
    })
    expect(next).toHaveLength(2)
    expect(next[0].description).toBe('new look')
    expect(next[0].name).toBe('Custom')
    expect(next[0].artStyle).toBe('anime')
  })

  it('defaults name to Default when not provided', () => {
    const next = ensureLookInLibrary([], 'solo')
    expect(next[0].name).toBe('Default')
  })
})
