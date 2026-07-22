import { describe, expect, it } from 'vitest'
import {
  mediaGenDraftStorageKey,
  resolveMediaGenQueueHandoff,
  videoPrepDraftToMediaGenResume,
  videoPrepInputToMediaGenOpen
} from './mediaGenFromVideoPrep'

describe('mediaGenFromVideoPrep', () => {
  it('maps start input with source + queue', () => {
    const open = videoPrepInputToMediaGenOpen({
      kind: 'timeline-clip',
      entityIds: { storyId: 's1', entryId: 'e1' },
      sourceImagePath: '/still.png',
      durationSeconds: 8,
      userExtraPrompt: 'more rain',
      skipStillIfExists: true,
      queueIndex: 1,
      queueTotal: 3,
      queueRemaining: ['e2', 'e3']
    })
    expect(open.kind).toBe('timeline-clip')
    expect(open.storyId).toBe('s1')
    expect(open.entryId).toBe('e1')
    expect(open.galleryIdentityPaths).toEqual(['/still.png'])
    expect(open.skipStillIfExists).toBe(true)
    expect(open.userExtraPrompt).toBe('more rain')
    expect(open.queueRemaining).toEqual(['e2', 'e3'])
  })

  it('timeline skip without source path allowed', () => {
    const open = videoPrepInputToMediaGenOpen({
      kind: 'timeline-clip',
      entityIds: { storyId: 's1', entryId: 'e1' },
      skipStillIfExists: true
    })
    expect(open.skipStillIfExists).toBe(true)
  })

  it('maps resume draft to confirm-video', () => {
    const open = videoPrepDraftToMediaGenResume(
      {
        kind: 'character-intro',
        entityIds: { characterId: 'c1' },
        professionalPrompt: 'VIDEO PROMPT LONG ENOUGH',
        userExtraPrompt: 'smile',
        stillPath: '/k.png',
        sourceImagePath: '/k.png',
        durationSeconds: 10,
        aspectRatio: '9:16'
      },
      []
    )
    expect(open.resumeDraft?.phase).toBe('confirm-video')
    expect(open.resumeDraft?.stillPath).toBe('/k.png')
    expect(open.resumeDraft?.videoPrompt).toMatch(/VIDEO/)
    expect(open.characterId).toBe('c1')
    expect(open.skipStillIfExists).toBe(true)
  })

  it('draft storage key matches videoPrep key shape', () => {
    const k = mediaGenDraftStorageKey({
      kind: 'character-intro',
      characterId: 'c1',
      sourceImagePath: '/a.png'
    })
    expect(k).toBe('character-intro:c1:/a.png')
  })

  it('queue handoff preserves skip + revision + duration (B1/B4/R1)', () => {
    const h = resolveMediaGenQueueHandoff({
      nextEntryId: 'e2',
      skipStillIfExists: false,
      userExtraByEntryId: { e2: '  more rain  ', e3: 'other' },
      durationSecondsByEntryId: { e2: 6, e3: 12 }
    })
    expect(h.skipStillIfExists).toBe(false)
    expect(h.userExtraPrompt).toBe('more rain')
    expect(h.durationSeconds).toBe(6)
    expect(
      resolveMediaGenQueueHandoff({
        nextEntryId: 'e9',
        skipStillIfExists: true,
        userExtraByEntryId: {},
        defaultDurationSeconds: 8
      })
    ).toEqual({
      skipStillIfExists: true,
      userExtraPrompt: null,
      durationSeconds: 8
    })
  })
})
