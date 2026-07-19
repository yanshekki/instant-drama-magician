import { describe, expect, it } from 'vitest'
import {
  applyCostumeSelection,
  applyGallerySelection,
  buildClipPrepHash,
  canSkipStillToReview,
  clipStillStatus,
  collectTimelineCharacterIds,
  emptyStoryCastPrep,
  parseStoryCastPrep,
  simplePromptHash
} from './advancedPrep'
import type { TimelineEntry } from '../types/domain'

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
})
