import { describe, expect, it, vi } from 'vitest'
import {
  sceneLinkLabel,
  beatSegmentLabel,
  unknownCharacterName,
  defaultStoryTitle,
  whereFromScene,
  locationSnippet,
  imageSizeForClass,
  imageSizeForAspect,
  defaultDuration,
  draftHasNameOrDescription,
  mergeCostumeRaw,
  aspectOrDefault,
  multiActionBoundNote,
  errorMessageOf,
  squareOrDefault,
  clipEndSeconds,
  multiSubjectClipNote,
  appearanceOrDescription,
  onlineChipClass,
  dragTransition,
  providerTitle,
  llmPresetTitle,
  continuityBadgeKey,
  shouldAutoCreateVideoPrep,
  patchIfRequestIdMatch,
  assertFfmpegOutputExists,
  onSystemSchemeChange,
  swallow,
  maybeAppendMultiRef
} from './residualLabels'

describe('residualLabels', () => {
  it('covers all locale and ternary branches', () => {
    expect(sceneLinkLabel('en', 1, 'T', 'd')).toMatch(/^Scene 1/)
    expect(sceneLinkLabel('zh', 2, null, 'longdesc')).toMatch(/^第 2/)
    expect(beatSegmentLabel('en', 0, 'A', 'W')).toMatch(/Beat 1/)
    expect(beatSegmentLabel('zh', 1, 'A', '')).toMatch(/段落/)
    expect(unknownCharacterName('en')).toBe('Unknown')
    expect(unknownCharacterName('zh')).toBe('未指定')
    expect(defaultStoryTitle('en')).toBe('Story')
    expect(defaultStoryTitle('zh')).toBe('故事')
    expect(whereFromScene({ title: 'T' })).toBe('T')
    expect(whereFromScene({ description: 'abcdefghij' })).toBe('abcdefghij')
    expect(whereFromScene(null)).toBe('')
    expect(locationSnippet(true, 'd')).toMatch(/Location/)
    expect(locationSnippet(false, 'd')).toBe('')
    expect(
      imageSizeForClass('tall', { tall: 't', square: 's', wide: 'w' })
    ).toBe('t')
    expect(
      imageSizeForClass('square', { tall: 't', square: 's', wide: 'w' })
    ).toBe('s')
    expect(
      imageSizeForClass('wide', { tall: 't', square: 's', wide: 'w' })
    ).toBe('w')
    expect(imageSizeForAspect('9:16', { tall: 't', wide: 'w' })).toBe('t')
    expect(imageSizeForAspect('16:9', { tall: 't', wide: 'w' })).toBe('w')
    expect(defaultDuration(null)).toBe(6)
    expect(defaultDuration(8)).toBe(8)
    expect(draftHasNameOrDescription({ name: 'x' })).toBe(true)
    expect(draftHasNameOrDescription({ description: ' d ' })).toBe(true)
    expect(draftHasNameOrDescription({})).toBe(false)
    expect(mergeCostumeRaw('t', 'raw')).toMatch(/missing-fill/)
    expect(mergeCostumeRaw('t', null)).toBe('t')
    expect(aspectOrDefault(null)).toBe('16:9')
    expect(aspectOrDefault('9:16')).toBe('9:16')
    expect(multiActionBoundNote([])).toBeNull()
    expect(multiActionBoundNote([{ name: 'A' }])).toMatch(/Motion/)
    expect(errorMessageOf(new Error('e'))).toBe('e')
    expect(errorMessageOf('s')).toBe('s')
    expect(squareOrDefault(null)).toBe('1024x1024')
    expect(squareOrDefault('1x1')).toBe('1x1')

    expect(clipEndSeconds({ startSeconds: 1 })).toBe(5)
    expect(clipEndSeconds({ startSeconds: 1, endSeconds: 3 })).toBe(3)

    expect(
      multiSubjectClipNote({
        charNames: ['A'],
        sceneLabels: ['S'],
        propNames: ['P']
      })
    ).toBeNull()
    expect(
      multiSubjectClipNote({
        charNames: ['A', 'B'],
        sceneLabels: ['S1', 'S2'],
        propNames: ['P1', 'P2']
      })
    ).toMatch(/MULTI-SUBJECT|Locations|Props/)
    expect(
      multiSubjectClipNote({
        charNames: [],
        sceneLabels: ['S1', 'S2'],
        propNames: []
      })
    ).toMatch(/Locations/)

    expect(appearanceOrDescription(null, 'd')).toBe('d')
    expect(appearanceOrDescription('a', 'd')).toBe('a')
    expect(appearanceOrDescription(null, null)).toBeUndefined()

    expect(onlineChipClass(true)).toMatch(/emerald/)
    expect(onlineChipClass(false)).toMatch(/ink-800/)
    expect(dragTransition(true)).toBe('none')
    expect(dragTransition(false)).toMatch(/transform/)
    expect(providerTitle('same-as-llm', 'same-as-llm', 'LLM')).toBe('LLM')
    expect(providerTitle('openai', 'same-as-llm', 'LLM')).toBe('openai')
    expect(llmPresetTitle(true, 'preset', 'custom')).toBe('custom')
    expect(llmPresetTitle(false, 'preset', 'custom')).toBe('preset')
    expect(continuityBadgeKey('continuity: LOCKED x')).toBe('locked')
    expect(continuityBadgeKey('continuity: text only')).toBe('textOnly')
    expect(continuityBadgeKey('continuity: first beat')).toBe('firstBeat')
    expect(continuityBadgeKey('none')).toBeNull()
    expect(shouldAutoCreateVideoPrep('review')).toBe(false)
    expect(shouldAutoCreateVideoPrep('loading-extract')).toBe(true)
    expect(shouldAutoCreateVideoPrep('loading-materials')).toBe(true)
    expect(shouldAutoCreateVideoPrep('loading-extract', true)).toBe(false)
    expect(
      patchIfRequestIdMatch({ requestId: 'a', phase: 'x' }, 'a', {
        phase: 'review'
      })
    ).toEqual({ requestId: 'a', phase: 'review' })
    expect(
      patchIfRequestIdMatch({ requestId: 'a', phase: 'x' }, 'b', {
        phase: 'review'
      })
    ).toEqual({ requestId: 'a', phase: 'x' })
    expect(patchIfRequestIdMatch(null, 'a', { phase: 'x' } as never)).toBeNull()
    class AE extends Error {
      constructor(public code: string, public key: string) {
        super(key)
      }
    }
    expect(() =>
      assertFfmpegOutputExists('/no', () => false, AE as never)
    ).toThrow()
    expect(() =>
      assertFfmpegOutputExists('/yes', () => true, AE as never)
    ).not.toThrow()
    const sync = vi.fn()
    onSystemSchemeChange('dark', sync)
    expect(sync).not.toHaveBeenCalled()
    onSystemSchemeChange('system', sync)
    expect(sync).toHaveBeenCalled()
    expect(() => swallow(new Error('x'))).not.toThrow()
    expect(() => swallow()).not.toThrow()
    expect(
      maybeAppendMultiRef('p', [1, 2], 'en', (p, r, l) => p + '-multi')
    ).toBe('p-multi')
    expect(maybeAppendMultiRef('p', [1], 'en', (p) => p + '-x')).toBe('p')
  })
})
