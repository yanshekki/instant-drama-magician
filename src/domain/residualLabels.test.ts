import { describe, expect, it } from 'vitest'
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
  squareOrDefault
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
  })
})
