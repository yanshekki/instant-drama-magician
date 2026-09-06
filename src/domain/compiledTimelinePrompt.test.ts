import { describe, expect, it } from 'vitest'
import type { TimelineEntry } from '../types/domain'
import {
  compileTimelinePrompt,
  formatShotTimestamp
} from './compiledTimelinePrompt'

const entry: TimelineEntry = {
  id: 'e1',
  storyId: 's1',
  startTime: 1.5,
  endTime: 7.5,
  characterId: 'c1',
  sceneId: 'sc1',
  propId: 'p1',
  actionId: null,
  characterIds: ['c1'],
  sceneIds: ['sc1'],
  propIds: ['p1'],
  actionIds: [],
  dialogue: 'I love you',
  beatContentJson: JSON.stringify({
    version: 1,
    sfx: 'rain',
    units: [{ type: 'dialogue', who: 'Nina', line: 'I love you' }]
  }),
  order: 1,
  mediaPath: null,
  mediaStatus: 'EMPTY',
  mediaError: null,
  videoJobId: null
}

describe('compileTimelinePrompt', () => {
  it('formats H3-style timestamps', () => {
    expect(formatShotTimestamp(0)).toBe('00:00.000')
    expect(formatShotTimestamp(1.5)).toBe('00:01.500')
    expect(formatShotTimestamp(75.02)).toBe('01:15.020')
  })

  it('compiles subjects, shot, dialogue and model body', () => {
    const compiled = compileTimelinePrompt({
      entry,
      storyTitle: 'Demo',
      styleNote: 'cinematic rain',
      locale: 'en',
      shotIndex: 2,
      characters: [
        {
          id: 'c1',
          name: 'Nina',
          description: 'lead',
          soulMdPath: null,
          refImagePath: '/n.png'
        } as never
      ],
      scenes: [
        {
          id: 'sc1',
          title: 'Court',
          description: 'tennis court',
          script: null,
          status: 'COMPLETED',
          refImagePath: '/s.png'
        } as never
      ],
      props: [
        {
          id: 'p1',
          name: 'Bag',
          description: 'leather'
        } as never
      ]
    })
    expect(compiled.pictures).toHaveLength(3)
    expect(compiled.pictures[0].index).toBe(1)
    expect(compiled.text).toContain('subject_definitions')
    expect(compiled.text).toContain('<Picture 1>')
    expect(compiled.text).toContain('[Shot 2]')
    expect(compiled.text).toContain('00:01.500')
    expect(compiled.text).toContain('I love you')
    expect(compiled.text).toContain('rain')
    expect(compiled.text).toContain('Short drama clip')
  })

  it('uses Chinese headings for zh locales', () => {
    const compiled = compileTimelinePrompt({
      entry: { ...entry, order: 0, startTime: 0 },
      storyTitle: '試片',
      locale: 'zh-HK',
      shotIndex: 1,
      characters: [
        {
          id: 'c1',
          name: 'Nina',
          description: '',
          soulMdPath: null,
          refImagePath: null
        } as never
      ]
    })
    expect(compiled.text).toContain('主體定義')
    expect(compiled.text).toContain('［鏡頭 1］')
  })

  it('formats invalid timestamps as zero and later zh shots with a clock', () => {
    expect(formatShotTimestamp(Number.NaN)).toBe('00:00.000')
    expect(formatShotTimestamp(-3)).toBe('00:00.000')
    const compiled = compileTimelinePrompt({
      entry: {
        ...entry,
        dialogue: 'fallback line',
        beatContentJson: null,
        characterId: null,
        characterIds: [],
        actionId: 'a1',
        actionIds: ['a1']
      },
      storyTitle: '試片',
      locale: 'zh-HK',
      shotIndex: 3,
      storyHardRules: '不可露臉',
      scenes: [
        {
          id: 'sc1',
          title: '',
          description: '網球場',
          script: null,
          status: 'COMPLETED',
          refImagePath: null
        } as never
      ],
      props: [{ id: 'p1', name: '球袋', description: '' } as never],
      actions: [
        {
          id: 'a1',
          name: '發球',
          description: '',
          refImagePath: '/a.png'
        } as never
      ]
    })
    expect(compiled.pictures.map((p) => p.kind)).toEqual(['scene', 'prop', 'action'])
    expect(compiled.text).toContain('所示場景')
    expect(compiled.text).toContain('所示道具')
    expect(compiled.text).toContain('所示動作參考')
    expect(compiled.text).toContain('［鏡頭 3］')
    expect(compiled.text).toContain('00:01.500')
    expect(compiled.text).toContain('fallback line')
    expect(compiled.text).toContain('不可露臉')
  })

  it('skips missing binds and uses English action copy', () => {
    const compiled = compileTimelinePrompt({
      entry: {
        ...entry,
        characterId: null,
        characterIds: ['missing'],
        sceneId: null,
        sceneIds: [],
        propId: null,
        propIds: [],
        actionId: 'a1',
        actionIds: ['a1']
      },
      storyTitle: 'Demo',
      locale: 'en-US',
      characters: [],
      actions: [{ id: 'a1', name: 'Serve', description: '' } as never]
    })
    expect(compiled.pictures).toHaveLength(1)
    expect(compiled.text).toContain('action reference')
    expect(compiled.text).toContain('[Shot 2]')
  })

  it('adds a spatial contract picture when a white-model is attached', () => {
    const compiled = compileTimelinePrompt({
      entry,
      storyTitle: 'Demo',
      locale: 'en',
      spatialPlayblastPath: '/white.png',
      characters: [
        {
          id: 'c1',
          name: 'Nina',
          description: 'lead',
          soulMdPath: null,
          refImagePath: '/n.png'
        } as never
      ]
    })
    expect(compiled.pictures.some((p) => p.kind === 'spatial')).toBe(true)
    expect(compiled.text).toContain('spatial_contract')
    expect(compiled.text).toContain('SPATIAL CONTRACT')
  })
})
