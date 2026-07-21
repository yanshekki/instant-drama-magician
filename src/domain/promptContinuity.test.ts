import { describe, expect, it } from 'vitest'
import {
  appendRevisionToClipPrompt,
  buildClipPrompt,
  buildContinuityLockPrompt,
  charactersMissingRef,
  getPreviousTimelineEntry,
  previousClipContext,
  resolveClipRefImage,
  timelineBeatDisplayIndex
} from './promptContinuity'
import type { Character, TimelineEntry } from '../types/domain'

const baseEntry = (partial: Partial<TimelineEntry> & { id: string }): TimelineEntry => ({
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

describe('promptContinuity', () => {
  it('builds prompt with style bible and ref hint', () => {
    const p = buildClipPrompt({
      storyTitle: 'Rain',
      styleNote: 'neon night',
      character: {
        id: 'c1',
        storyId: 's1',
        name: 'Ming',
        description: 'rider',
        soulMdPath: null,
        refImagePath: '/tmp/ming.png'
      },
      dialogue: '【對白｜Ming】Hello',
      seconds: 6
    })
    expect(p).toContain('Style bible: neon night')
    expect(p).toContain('reference image')
    expect(p).toMatch(/SPEECH|Hello/)
    expect(p).toContain('Duration: 6s')
  })

  it('summarises previous clip', () => {
    const entries = [
      baseEntry({
        id: 'e0',
        order: 0,
        characterId: 'c1',
        dialogue: 'Hi'
      }),
      baseEntry({ id: 'e1', order: 1, startTime: 6, endTime: 12 })
    ]
    const chars = new Map<string, Character>([
      [
        'c1',
        {
          id: 'c1',
          storyId: 's1',
          name: 'Ming',
          description: 'x',
          soulMdPath: null,
          refImagePath: null
        }
      ]
    ])
    const ctx = previousClipContext(entries, 'e1', {
      characters: chars,
      scenes: new Map(),
      props: new Map()
    })
    expect(ctx).toContain('Ming')
    expect(ctx).toContain('Hi')
  })

  it('resolves clip ref priority prev-clip → cast → character → scene → prop', () => {
    expect(
      resolveClipRefImage({
        previousContinuityPath: '/prev.png',
        castRefPath: '/cast.png',
        character: {
          id: 'c',
          storyId: 's',
          name: 'A',
          description: 'd',
          soulMdPath: null,
          refImagePath: '/c.png'
        }
      })
    ).toEqual({ path: '/prev.png', source: 'prev-clip' })
    expect(
      resolveClipRefImage({
        castRefPath: '/cast.png',
        character: {
          id: 'c',
          storyId: 's',
          name: 'A',
          description: 'd',
          soulMdPath: null,
          refImagePath: '/c.png'
        }
      })
    ).toEqual({ path: '/cast.png', source: 'cast' })
    expect(
      resolveClipRefImage({
        previousContinuityPath: '/prev.png',
        usePreviousContinuity: false,
        character: {
          id: 'c',
          storyId: 's',
          name: 'A',
          description: 'd',
          soulMdPath: null,
          refImagePath: '/c.png'
        }
      })?.source
    ).toBe('character')
    expect(
      resolveClipRefImage({
        character: {
          id: 'c',
          storyId: 's',
          name: 'A',
          description: 'd',
          soulMdPath: null,
          refImagePath: '/c.png'
        },
        scene: {
          id: 'sc',
          storyId: 's',
          sceneNumber: 1,
          description: 'alley',
          script: null,
          status: 'PENDING',
          refImagePath: '/sc.png'
        },
        prop: {
          id: 'p',
          storyId: 's',
          name: 'watch',
          description: 'silver',
          refImagePath: '/p.png'
        }
      })?.source
    ).toBe('character')
    expect(
      resolveClipRefImage({
        scene: {
          id: 'sc',
          storyId: 's',
          sceneNumber: 1,
          description: 'alley',
          script: null,
          status: 'PENDING',
          refImagePath: '/sc.png'
        },
        prop: {
          id: 'p',
          storyId: 's',
          name: 'watch',
          description: 'silver',
          refImagePath: '/p.png'
        }
      })
    ).toEqual({ path: '/sc.png', source: 'scene' })
    expect(
      resolveClipRefImage({
        prop: {
          id: 'p',
          storyId: 's',
          name: 'watch',
          description: 'silver',
          refImagePath: '/p.png'
        }
      })
    ).toEqual({ path: '/p.png', source: 'prop' })
  })

  it('finds previous timeline entry and builds continuity lock', () => {
    const entries = [
      baseEntry({ id: 'e0', order: 0, characterId: 'c1' }),
      baseEntry({ id: 'e1', order: 1, startTime: 6, endTime: 12 })
    ]
    expect(getPreviousTimelineEntry(entries, 'e1')?.id).toBe('e0')
    expect(getPreviousTimelineEntry(entries, 'e0')).toBeNull()
    const lock = buildContinuityLockPrompt({
      previousBeatIndex: 1,
      sameCharacter: true,
      sameScene: true,
      hasContinuityImage: true
    })
    expect(lock).toMatch(/CONTINUITY LOCK/)
    expect(lock).toMatch(/IDENTITY/)
  })

  it('appends director revision notes for re-generate', () => {
    const base = 'Short drama clip.\nDuration: 6s.'
    expect(appendRevisionToClipPrompt(base, null)).toBe(base)
    expect(appendRevisionToClipPrompt(base, '  ')).toBe(base)
    const withRev = appendRevisionToClipPrompt(base, 'only two hands, no extra limbs')
    expect(withRev).toContain('DIRECTOR REVISION')
    expect(withRev).toContain('only two hands, no extra limbs')
    expect(withRev).toContain('Anatomically correct')
  })

  it('lists characters missing ref that appear on timeline', () => {
    const entries = [baseEntry({ id: 'e0', characterId: 'c1' })]
    const characters: Character[] = [
      {
        id: 'c1',
        storyId: 's1',
        name: 'Ming',
        description: 'x',
        soulMdPath: null,
        refImagePath: null
      },
      {
        id: 'c2',
        storyId: 's1',
        name: 'Yu',
        description: 'y',
        soulMdPath: null,
        refImagePath: '/tmp/y.png'
      }
    ]
    const missing = charactersMissingRef(entries, characters)
    expect(missing.map((c) => c.id)).toEqual(['c1'])
  })

  it('timelineBeatDisplayIndex is 1-based order rank', () => {
    const entries = [
      baseEntry({ id: 'e0', order: 0 }),
      baseEntry({ id: 'e1', order: 1, startTime: 6, endTime: 12 }),
      baseEntry({ id: 'e2', order: 2, startTime: 12, endTime: 18 })
    ]
    expect(timelineBeatDisplayIndex(entries, 'e0')).toBe(1)
    expect(timelineBeatDisplayIndex(entries, 'e2')).toBe(3)
    expect(timelineBeatDisplayIndex(entries, 'missing')).toBe(0)
  })

  it('buildClipPrompt without character and with scene/prop context', () => {
    const p = buildClipPrompt({
      storyTitle: 'Rain',
      styleNote: null,
      character: null,
      scene: {
        id: 'sc',
        storyId: 's',
        sceneNumber: 1,
        title: 'Alley',
        description: 'alley rain',
        script: 'A waits',
        status: 'PENDING',
        refImagePath: '/sc.png',
        locationType: 'exterior',
        mood: 'tense',
        lighting: 'neon',
        weather: 'rain',
        timeOfDay: 'night',
        setDressing: 'puddles',
        cameraNotes: 'handheld'
      } as never,
      prop: {
        id: 'p',
        storyId: 's',
        name: 'umbrella',
        description: 'red',
        material: 'nylon',
        refImagePath: '/p.png'
      } as never,
      dialogue: null,
      seconds: 5,
      previousContext: 'Prev: Ming said hi'
    })
    expect(p).toContain('Rain')
    expect(p).toMatch(/alley|umbrella|Prev|nylon|handheld/i)
    const withRev = appendRevisionToClipPrompt(p, 'darker', 'NO logo')
    expect(withRev).toMatch(/darker|NO logo|DIRECTOR REVISION/)
  })

  it('previousClipContext returns null for first entry', () => {
    const entries = [baseEntry({ id: 'e0', order: 0 })]
    expect(
      previousClipContext(entries, 'e0', {
        characters: new Map(),
        scenes: new Map(),
        props: new Map()
      })
    ).toBeNull()
  })

  it('buildContinuityLockPrompt without image still warns', () => {
    const lock = buildContinuityLockPrompt({
      previousBeatIndex: 2,
      sameCharacter: false,
      sameScene: false,
      hasContinuityImage: false
    })
    expect(lock).toMatch(/CONTINUITY|beat/i)
  })
})
