import { describe, expect, it } from 'vitest'
import {
  applyCostumeSelection,
  applyGallerySelection,
  buildCastCardModel,
  buildClipPrepHash,
  canSkipStillToReview,
  clipStillStatus,
  collectTimelineCharacterIds,
  emptyStoryCastPrep,
  orderedTimelineEntries,
  parseEntryStillPromptCache,
  parseStoryCastPrep,
  resolveCastRefFromPrep,
  serializeEntryStillPromptCache,
  serializeStoryCastPrep,
  simplePromptHash
} from './advancedPrep'
import type { Character, TimelineEntry } from '../types/domain'

const entry = (
  partial: Partial<TimelineEntry> & { id: string }
): TimelineEntry => ({
  storyId: 's1',
  startTime: 0,
  endTime: 6,
  characterId: null,
  sceneId: null,
  propId: null,
  characterIds: [],
  sceneIds: [],
  propIds: [],
  dialogue: null,
  beatContentJson: null,
  order: 0,
  mediaPath: null,
  mediaStatus: 'EMPTY',
  mediaError: null,
  videoJobId: null,
  ...partial
})

describe('advancedPrep', () => {
  it('hashes and detects stale stills', () => {
    const h1 = buildClipPrepHash({
      entryId: 'e1',
      dialogue: 'hi',
      characterIds: ['c1'],
      sceneIds: [],
      propIds: []
    })
    const h2 = buildClipPrepHash({
      entryId: 'e1',
      dialogue: 'bye',
      characterIds: ['c1'],
      sceneIds: [],
      propIds: []
    })
    expect(h1).not.toBe(h2)
    expect(
      clipStillStatus({
        stillFileExists: true,
        cache: {
          version: 1,
          professionalPrompt: 'p',
          stillPath: '/x.png',
          promptHash: h1,
          updatedAt: new Date().toISOString()
        },
        currentHash: h2
      })
    ).toBe('stale')
    expect(
      clipStillStatus({
        stillFileExists: false,
        cache: null,
        currentHash: h1
      })
    ).toBe('missing')
    expect(
      canSkipStillToReview({
        stillFileExists: true,
        cache: null,
        currentHash: h1
      })
    ).toBe(true)
  })

  it('collects character ids from timeline', () => {
    const ids = collectTimelineCharacterIds([
      entry({ id: 'a', characterId: 'c1', characterIds: ['c1', 'c2'] as never }),
      entry({ id: 'b', characterId: 'c3' })
    ])
    expect(ids.sort()).toEqual(['c1', 'c2', 'c3'])
  })

  it('applies cast and costume selections', () => {
    let prep = emptyStoryCastPrep()
    prep = applyCostumeSelection(prep, 'c1', 'cos1', '/cos.png')
    expect(prep.characters.c1?.costumeId).toBe('cos1')
    prep = applyGallerySelection(prep, 'c1', '/g.png')
    // Gallery pick clears costume so the chosen still is the ref
    expect(prep.characters.c1?.refImagePath).toBe('/g.png')
    expect(prep.characters.c1?.costumeId).toBeNull()
    prep = applyCostumeSelection(prep, 'c1', 'cos1', '/cos.png')
    expect(prep.characters.c1?.costumeId).toBe('cos1')
    expect(prep.characters.c1?.refImagePath).toBe('/cos.png')
    const round = parseStoryCastPrep(JSON.stringify(prep))
    expect(round.characters.c1?.costumeId).toBe('cos1')
  })

  it('simple hash is stable', () => {
    expect(simplePromptHash(['a', 'b'])).toBe(simplePromptHash(['a', 'b']))
  })

  it('parses story cast prep edge cases', () => {
    expect(parseStoryCastPrep(null).characters).toEqual({})
    expect(parseStoryCastPrep('not-json').characters).toEqual({})
    expect(parseStoryCastPrep('null').characters).toEqual({})
    expect(parseStoryCastPrep('[]').characters).toEqual({})
    const raw = JSON.stringify({
      version: 99,
      characters: {
        c1: { refImagePath: '/a.png', costumeId: 'cos' },
        c2: { refImagePath: '', costumeId: '' },
        bad: null,
        '': { refImagePath: '/x' }
      }
    })
    const prep = parseStoryCastPrep(raw)
    expect(prep.characters.c1).toEqual({
      refImagePath: '/a.png',
      costumeId: 'cos'
    })
    expect(prep.characters.c2).toEqual({
      refImagePath: null,
      costumeId: null
    })
    expect(prep.characters.bad).toBeUndefined()
    expect(serializeStoryCastPrep(prep)).toContain('c1')
  })

  it('parses and serializes entry still prompt cache', () => {
    expect(parseEntryStillPromptCache(null)).toBeNull()
    expect(parseEntryStillPromptCache('{}')).toBeNull()
    expect(parseEntryStillPromptCache('not-json')).toBeNull()
    expect(
      parseEntryStillPromptCache(
        JSON.stringify({ professionalPrompt: 'p', stillPath: '' })
      )
    ).toBeNull()

    const cache = parseEntryStillPromptCache(
      JSON.stringify({
        professionalPrompt: '  pro  ',
        stillPath: ' /s.png ',
        userExtraPrompt: 'extra',
        materialsSummary: 'mats',
        sourceImagePath: '/src.png',
        promptHash: 'abc',
        durationSeconds: 6,
        aspectRatio: '9:16'
      })
    )
    expect(cache?.professionalPrompt).toBe('pro')
    expect(cache?.stillPath).toBe('/s.png')
    expect(cache?.userExtraPrompt).toBe('extra')
    expect(cache?.durationSeconds).toBe(6)
    const serialized = JSON.parse(serializeEntryStillPromptCache(cache!))
    expect(serialized.version).toBe(1)
    expect(serialized.stillPath).toBe('/s.png')
  })

  it('clipStillStatus ready when hash matches', () => {
    const h = buildClipPrepHash({
      entryId: 'e1',
      characterIds: [],
      sceneIds: [],
      propIds: [],
      dialogue: 'x',
      beatContentJson: '{}',
      castRefPath: '/r.png',
      styleNote: 'mood',
      seconds: 5
    })
    expect(
      clipStillStatus({
        stillFileExists: true,
        cache: {
          version: 1,
          professionalPrompt: 'p',
          stillPath: '/x.png',
          promptHash: h,
          updatedAt: new Date().toISOString()
        },
        currentHash: h
      })
    ).toBe('ready')
    expect(
      canSkipStillToReview({
        stillFileExists: false,
        cache: null,
        currentHash: h
      })
    ).toBe(false)
  })

  it('collects character ids from string characterIds json', () => {
    const ids = collectTimelineCharacterIds([
      entry({
        id: 'a',
        characterId: 'fallback',
        characterIds: '["c9","c8"]' as never
      }),
      entry({ id: 'b', characterId: 'only', characterIds: [] as never })
    ])
    expect(ids).toContain('c9')
    expect(ids).toContain('c8')
    expect(ids).toContain('only')
  })

  it('buildCastCardModel resolves costume and gallery defaults', () => {
    const character = {
      id: 'c1',
      name: 'Ming',
      description: 'hero',
      refImagePath: '/face.png',
      refSheetPath: '/sheet.png',
      refGalleryJson: JSON.stringify([
        {
          id: 'g1',
          path: '/g1.png',
          kind: 'gen',
          label: 'G',
          createdAt: '2020-01-01'
        }
      ]),
      costumesJson: JSON.stringify([
        {
          id: 'cos1',
          name: 'Coat',
          description: 'red',
          imagePath: '/cos.png',
          createdAt: '2020-01-01',
          updatedAt: '2020-01-01'
        },
        {
          id: 'cos2',
          name: 'No img',
          description: 'x',
          imagePath: null,
          createdAt: '2020-01-01',
          updatedAt: '2020-01-01'
        }
      ])
    } as unknown as Character

    const withCos = buildCastCardModel(character, {
      refImagePath: null,
      costumeId: 'cos1'
    })
    expect(withCos.selectedCostumeId).toBe('cos1')
    expect(withCos.selectedRefImagePath).toBe('/cos.png')
    expect(withCos.hasAnyImage).toBe(true)

    const missingCos = buildCastCardModel(character, {
      refImagePath: null,
      costumeId: 'gone'
    })
    expect(missingCos.selectedCostumeId).toBeNull()
    expect(missingCos.selectedRefImagePath).toBe('/sheet.png')

    const galleryPick = buildCastCardModel(character, {
      refImagePath: '/g1.png',
      costumeId: null
    })
    expect(galleryPick.selectedRefImagePath).toBe('/g1.png')
  })

  it('resolveCastRefFromPrep and orderedTimelineEntries', () => {
    const prep = applyGallerySelection(emptyStoryCastPrep(), 'c1', '/r.png')
    expect(resolveCastRefFromPrep('c1', prep)).toBe('/r.png')
    expect(resolveCastRefFromPrep(null, prep)).toBeNull()
    expect(resolveCastRefFromPrep('missing', prep)).toBeNull()

    const ordered = orderedTimelineEntries([
      entry({ id: 'b', order: 2, startTime: 10 }),
      entry({ id: 'a', order: 1, startTime: 0 })
    ])
    expect(ordered[0].id).toBe('a')
  })

  it('applyCostumeSelection clears costume id', () => {
    let prep = applyCostumeSelection(emptyStoryCastPrep(), 'c1', 'cos', '/c.png')
    prep = applyCostumeSelection(prep, 'c1', null, null)
    expect(prep.characters.c1?.costumeId).toBeNull()
    expect(prep.characters.c1?.refImagePath).toBe('/c.png')
  })
})
