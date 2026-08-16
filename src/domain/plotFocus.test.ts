import { describe, expect, it } from 'vitest'
import {
  isEntireStoryKeys,
  normalizeSegmentKeys,
  PLOT_FOCUS_MAX_CHARS,
  plotFocusUserBlock,
  resolvePlotFocus,
  type PlotFocusStory
} from './plotFocus'

function story(overrides: Partial<PlotFocusStory> = {}): PlotFocusStory {
  return {
    chapters: [
      { id: 'c1', order: 0, title: 'Night', body: 'Rain on the roof. Ming waits.' },
      { id: 'c2', order: 1, title: 'Dawn', body: 'Sun hits the alley.' }
    ],
    storyScenes: [
      {
        sceneId: 'sc1',
        sceneNumber: 1,
        scriptOverride: null,
        scene: {
          title: 'Alley',
          description: 'wet alley',
          script: 'wait',
          mood: 'tense',
          timeOfDay: 'night',
          weather: 'rain'
        }
      }
    ],
    timeline: [
      {
        id: 'e1',
        order: 0,
        sceneId: 'sc1',
        dialogue: '走',
        character: { name: 'Ming' },
        scene: { title: 'Alley', description: 'wet' },
        prop: { name: 'Bag' }
      }
    ],
    ...overrides
  }
}

describe('normalizeSegmentKeys', () => {
  it('merges segmentKeys and legacy segmentKey without duplicates', () => {
    expect(
      normalizeSegmentKeys({
        segmentKeys: ['chapter:a', ' beat:b ', 'chapter:a'],
        segmentKey: 'scene:c'
      })
    ).toEqual(['chapter:a', 'beat:b', 'scene:c'])
  })

  it('treats missing as empty', () => {
    expect(normalizeSegmentKeys({})).toEqual([])
    expect(isEntireStoryKeys([])).toBe(true)
    expect(isEntireStoryKeys(['all'])).toBe(true)
    expect(isEntireStoryKeys(['chapter:a'])).toBe(false)
  })
})

describe('resolvePlotFocus', () => {
  it('merges two chapters', () => {
    const r = resolvePlotFocus(story(), ['chapter:c1', 'chapter:c2'], 'en')
    expect(r.focusSnippets.join('\n')).toMatch(/Rain on the roof/)
    expect(r.focusSnippets.join('\n')).toMatch(/Sun hits the alley/)
    expect(r.segmentLabel).toMatch(/Night/)
    expect(r.segmentLabel).toMatch(/Dawn/)
  })

  it('empty keys uses chapters first', () => {
    const r = resolvePlotFocus(story(), [], 'en')
    expect(r.focusSnippets.join('\n')).toMatch(/Rain on the roof/)
    expect(r.focusSnippets.join('\n')).not.toMatch(/wet alley/)
  })

  it('ignores unknown keys and falls back to entire story when none match', () => {
    const r = resolvePlotFocus(story(), ['weird:x', 'scene:missing'], 'en')
    expect(r.focusSnippets.join('\n')).toMatch(/Rain on the roof/)
  })

  it('resolves scene and beat keys', () => {
    const noCh = story({ chapters: [] })
    const scene = resolvePlotFocus(noCh, ['scene:sc1'], 'en')
    expect(scene.focusSnippets.join('\n')).toMatch(/wet alley/)
    expect(scene.focusSnippets.join('\n')).toMatch(/走/)
    const beat = resolvePlotFocus(noCh, ['beat:e1'], 'en')
    expect(beat.focusSnippets.join('\n')).toMatch(/走/)
  })

  it('empty keys without chapters uses scenes and beats', () => {
    const r = resolvePlotFocus(story({ chapters: [] }), [], 'en')
    expect(r.focusSnippets.join('\n')).toMatch(/wet alley/)
    expect(r.focusSnippets.join('\n')).toMatch(/走/)
  })

  it('clamps total length', () => {
    const huge = 'x'.repeat(PLOT_FOCUS_MAX_CHARS + 200)
    const r = resolvePlotFocus(
      story({
        chapters: [
          { id: 'c1', order: 0, title: 'A', body: huge },
          { id: 'c2', order: 1, title: 'B', body: huge }
        ]
      }),
      ['chapter:c1', 'chapter:c2'],
      'en'
    )
    expect(r.focusSnippets.join('').length).toBeLessThanOrEqual(
      PLOT_FOCUS_MAX_CHARS
    )
  })
})

describe('plotFocusUserBlock', () => {
  it('joins label and snippets', () => {
    expect(
      plotFocusUserBlock({
        segmentLabel: 'Night',
        focusSnippets: ['Rain']
      })
    ).toMatch(/Plot focus: Night[\s\S]*Rain/)
    expect(
      plotFocusUserBlock({ segmentLabel: 'x', focusSnippets: [''] })
    ).toBe('')
  })
})
