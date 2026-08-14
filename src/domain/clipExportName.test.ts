import { describe, expect, it } from 'vitest'
import { suggestedClipExportName } from './clipExportName'

describe('suggestedClipExportName', () => {
  it('uses story title and 1-based clip index', () => {
    expect(suggestedClipExportName({ storyTitle: '受戒下山', clipIndex: 1 })).toBe(
      '受戒下山-第1段.mp4'
    )
  })

  it('strips path-illegal characters and defaults title/ext', () => {
    expect(
      suggestedClipExportName({ storyTitle: 'a/b:c*', clipIndex: 0, ext: '.mov' })
    ).toBe('a_b_c_-第1段.mov')
    expect(suggestedClipExportName({ storyTitle: '   ', clipIndex: 3 })).toBe(
      'clip-第3段.mp4'
    )
  })
})
