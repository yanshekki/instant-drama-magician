import { describe, expect, it } from 'vitest'
import {
  appendRevisionToClipPrompt,
  buildClipPrompt,
  charactersMissingRef,
  previousClipContext,
  resolveClipRefImage
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

  it('resolves clip ref priority character → scene → prop', () => {
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
})
