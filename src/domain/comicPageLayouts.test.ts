import { describe, expect, it } from 'vitest'
import {
  COMIC_PAGE_LAYOUTS,
  buildComicGeometryLock,
  buildComicPanelInstructions,
  coerceComicPageLayout,
  comicLayoutCellArea,
  comicLayoutCells,
  comicLayoutGrid,
  comicLayoutsByGroup,
  comicPanelSvgPath,
  getComicPageLayout,
  buildComicIntroVideoPrompt,
  buildComicDramaVideoPrompt,
  coerceComicVideoScheme
} from './comicPageLayouts'
import {
  boundTimelineIdsFromSlots,
  captionFromTimelineBeat,
  captionsFromSlots,
  normalizePanelSlots,
  paginateTimelineBeats,
  parsePanelScriptJson,
  serializePanelScript
} from './comicPanelScript'

describe('comicPageLayouts', () => {
  it('lists sixteen templates and coerces unknown ids', () => {
    expect(COMIC_PAGE_LAYOUTS).toHaveLength(16)
    expect(comicLayoutsByGroup('even')).toHaveLength(8)
    expect(comicLayoutsByGroup('manga')).toHaveLength(8)
    expect(getComicPageLayout('grid-2x2').panelCount).toBe(4)
    expect(getComicPageLayout('yonkoma').sizeClass).toBe('tall')
    expect(getComicPageLayout('grid-3x3').panelCount).toBe(9)
    expect(getComicPageLayout('focus-quad').panelCount).toBe(4)
    expect(getComicPageLayout('hero-plus-four').panelCount).toBe(5)
    expect(getComicPageLayout('diag-pair-plus').group).toBe('manga')
    expect(coerceComicPageLayout('nope')).toBe('grid-2x2')
    expect(coerceComicPageLayout('splash-1')).toBe('splash-1')
    expect(coerceComicPageLayout('wide-plus-two')).toBe('wide-plus-two')
    expect(comicLayoutGrid(getComicPageLayout('yonkoma'))).toEqual({
      rows: 4,
      cols: 1
    })
    expect(comicLayoutGrid(getComicPageLayout('grid-2x3'))).toEqual({
      rows: 2,
      cols: 3
    })
    expect(comicLayoutGrid(getComicPageLayout('splash-1'))).toEqual({
      rows: 1,
      cols: 1
    })
    expect(comicLayoutGrid(getComicPageLayout('strip-2'))).toEqual({
      rows: 1,
      cols: 2
    })
    expect(comicLayoutGrid(getComicPageLayout('strip-3'))).toEqual({
      rows: 1,
      cols: 3
    })
    expect(comicLayoutGrid(getComicPageLayout('strip-4'))).toEqual({
      rows: 1,
      cols: 4
    })
    expect(comicLayoutGrid(getComicPageLayout('grid-3x3'))).toEqual({
      rows: 3,
      cols: 3
    })
    expect(buildComicGeometryLock(getComicPageLayout('splash-1'), 'en')).toMatch(
      /full-page splash/i
    )
    expect(buildComicGeometryLock(getComicPageLayout('grid-2x3'), 'en')).toMatch(
      /2 rows/
    )
    expect(buildComicGeometryLock(getComicPageLayout('grid-3x3'), 'en')).toMatch(
      /nine/i
    )
    expect(buildComicGeometryLock(getComicPageLayout('strip-3'), 'en')).toMatch(
      /horizontal/i
    )
    expect(
      buildComicPanelInstructions(getComicPageLayout('splash-1'), ['英雄登場'])
    ).toContain('英雄登場')
  })

  it('locks geometry in prompts', () => {
    const y = buildComicGeometryLock(getComicPageLayout('yonkoma'), 'en')
    expect(y).toMatch(/exactly 4/i)
    expect(y).toMatch(/4 rows/i)
    const g = buildComicPanelInstructions(
      getComicPageLayout('grid-2x2'),
      ['開門', '', '對打', '收勢'],
      'zh-HK'
    )
    expect(g).toContain('開門')
    expect(g).toContain('對打')
    expect(g).toMatch(/剛好 4 格|必須剛好 4/)
    expect(g).not.toMatch(/EXACTLY 4|GEOMETRY LOCK/)
  })

  it('manga templates have irregular cells covering the page', () => {
    for (const layout of COMIC_PAGE_LAYOUTS) {
      expect(layout.cells).toHaveLength(layout.panelCount)
      expect(comicLayoutCellArea(layout)).toBeCloseTo(144, 5)
      expect(comicLayoutCells(layout)[0].i).toBe(0)
    }
    const focus = getComicPageLayout('focus-quad')
    expect(focus.cells[0]).toMatchObject({ x: 0, y: 0, w: 8, h: 6 })
    expect(focus.cells[3]).toMatchObject({ y: 6, w: 12, h: 6 })
    const diag = getComicPageLayout('diag-pair-plus')
    expect(diag.cells[0].poly?.length).toBe(3)
    expect(comicPanelSvgPath(diag.cells[0])).toMatch(/^M/)
    const lock = buildComicGeometryLock(focus, 'zh-HK')
    expect(lock).toMatch(/左上中格|中格/)
    expect(lock).not.toMatch(/GEOMETRY LOCK|2×2 grid/)
    const read = buildComicPanelInstructions(focus, ['開門'], 'zh-HK')
    expect(read).toMatch(/左上中格|先讀左上/)
  })

  it('builds a locale-aware comic intro video prompt', () => {
    const zh = buildComicIntroVideoPrompt({
      locale: 'zh-HK',
      storyTitle: '夜巴',
      pageOrder: 1,
      panelCount: 4,
      layoutLabel: '中／小／大'
    })
    expect(zh).toMatch(/圖生影片/)
    expect(zh).toContain('夜巴')
    expect(zh).not.toMatch(/IMAGE-TO-VIDEO|GEOMETRY LOCK/)
  })

  it('builds a timeline-style drama video prompt and coerces scheme', () => {
    expect(coerceComicVideoScheme('drama')).toBe('drama')
    expect(coerceComicVideoScheme('nope')).toBe('page')
    const zh = buildComicDramaVideoPrompt({
      locale: 'zh-HK',
      storyTitle: '夜巴',
      pageOrder: 2,
      beatText: '開門',
      prevSnippet: '上一頁'
    })
    expect(zh).toMatch(/短劇時間軸/)
    expect(zh).toMatch(/真人短劇|不是在印刷格/)
    expect(zh).toContain('開門')
    expect(zh).toContain('上一頁')
    expect(zh).not.toMatch(/IMAGE-TO-VIDEO|GEOMETRY LOCK/)
  })
})

describe('comicPanelScript', () => {
  it('pads and serializes slots', () => {
    const slots = normalizePanelSlots(
      [{ caption: 'a', timelineEntryId: 'e1' }],
      4
    )
    expect(slots).toHaveLength(4)
    expect(slots[0].caption).toBe('a')
    expect(slots[0].timelineEntryId).toBe('e1')
    expect(slots[3].caption).toBe('')
    const json = serializePanelScript(slots)
    expect(parsePanelScriptJson(json, 'grid-2x2')).toHaveLength(4)
    expect(parsePanelScriptJson('not-json', 'strip-2')).toHaveLength(2)
    expect(captionsFromSlots(slots)[0]).toBe('a')
  })

  it('paginates leftover beats and reads captions', () => {
    const pages = paginateTimelineBeats(
      [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      2,
      ['a']
    )
    expect(pages).toHaveLength(1)
    expect(pages[0].map((e) => e.id)).toEqual(['b', 'c'])
    expect(
      boundTimelineIdsFromSlots([{ caption: 'a', timelineEntryId: 'e1' }])
    ).toEqual(['e1'])
    expect(captionFromTimelineBeat({ dialogue: '  hi  ' })).toBe('hi')
    expect(
      captionFromTimelineBeat({
        dialogue: '',
        beatContentJson: JSON.stringify({
          units: [{ type: 'dialogue', line: '喂' }]
        })
      })
    ).toBe('喂')
    expect(
      captionFromTimelineBeat({
        dialogue: '',
        beatContentJson: JSON.stringify({
          units: [{ type: 'action', text: '開門' }]
        })
      })
    ).toBe('開門')
    expect(captionFromTimelineBeat({ dialogue: '', beatContentJson: 'nope' })).toBe(
      ''
    )
  })
})
