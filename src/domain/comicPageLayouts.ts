/**
 * Comic full-page panel templates (格數).
 * One generated image per page; panel count and geometry are locked in the prompt.
 */
import { PromptCatalog } from '../prompts'
import type { PromptCopyKey } from '../prompts/copy/keys'

export type ComicPageLayoutId =
  | 'splash-1'
  | 'strip-2'
  | 'strip-3'
  | 'yonkoma'
  | 'grid-2x2'
  | 'strip-4'
  | 'grid-2x3'
  | 'grid-3x3'
  | 'wide-plus-two'
  | 'two-plus-wide'
  | 'tall-left-two'
  | 'hero-plus-three'
  | 'focus-quad'
  | 'stagger-four'
  | 'diag-pair-plus'
  | 'hero-plus-four'

export type ComicLayoutGroup = 'even' | 'manga'

/** One panel on a 12×12 page board. */
export interface ComicPanelCell {
  i: number
  x: number
  y: number
  w: number
  h: number
  /** Optional polygon in the same 12×12 space (diagonal / wedge panels). */
  poly?: [number, number][]
}

export interface ComicPageLayoutDef {
  id: ComicPageLayoutId
  labelKey: string
  promptLayout: string
  panelCount: number
  sizeClass: 'wide' | 'square' | 'tall'
  beatLabels: string[]
  group: ComicLayoutGroup
  cells: ComicPanelCell[]
  layoutCopyKey: PromptCopyKey
  lockCopyKey: PromptCopyKey
  readingCopyKey: PromptCopyKey
}

const U = 12

function rect(
  i: number,
  x: number,
  y: number,
  w: number,
  h: number
): ComicPanelCell {
  return { i, x, y, w, h }
}

function evenRow(count: number): ComicPanelCell[] {
  const w = U / count
  return Array.from({ length: count }, (_, i) =>
    rect(i, i * w, 0, w, U)
  )
}

function evenCol(count: number): ComicPanelCell[] {
  const h = U / count
  return Array.from({ length: count }, (_, i) =>
    rect(i, 0, i * h, U, h)
  )
}

function evenGrid(rows: number, cols: number): ComicPanelCell[] {
  const w = U / cols
  const h = U / rows
  const cells: ComicPanelCell[] = []
  let i = 0
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push(rect(i, c * w, r * h, w, h))
      i += 1
    }
  }
  return cells
}

export const COMIC_PAGE_LAYOUTS: ComicPageLayoutDef[] = [
  {
    id: 'splash-1',
    labelKey: 'layoutSplash1',
    panelCount: 1,
    sizeClass: 'tall',
    beatLabels: ['1'],
    group: 'even',
    cells: [rect(0, 0, 0, U, U)],
    layoutCopyKey: 'comic.layoutSplash1',
    lockCopyKey: 'comic.lockSplash',
    readingCopyKey: 'comic.readingOrder',
    promptLayout:
      'ONE single tall comic PAGE: EXACTLY 1 full-bleed splash panel filling the page, no gutters, no extra frames'
  },
  {
    id: 'strip-2',
    labelKey: 'layoutStrip2',
    panelCount: 2,
    sizeClass: 'wide',
    beatLabels: ['1', '2'],
    group: 'even',
    cells: evenRow(2),
    layoutCopyKey: 'comic.layoutStrip2',
    lockCopyKey: 'comic.lockStrip',
    readingCopyKey: 'comic.readingOrder',
    promptLayout:
      'ONE single landscape comic PAGE: a horizontal strip with EXACTLY 2 equal panels side-by-side (1 row × 2 columns), thick white gutters'
  },
  {
    id: 'strip-3',
    labelKey: 'layoutStrip3',
    panelCount: 3,
    sizeClass: 'wide',
    beatLabels: ['1', '2', '3'],
    group: 'even',
    cells: evenRow(3),
    layoutCopyKey: 'comic.layoutStrip3',
    lockCopyKey: 'comic.lockStrip',
    readingCopyKey: 'comic.readingOrder',
    promptLayout:
      'ONE single landscape comic PAGE: a horizontal strip with EXACTLY 3 equal panels in ONE row (1 row × 3 columns), thick white gutters'
  },
  {
    id: 'yonkoma',
    labelKey: 'layoutYonkoma',
    panelCount: 4,
    sizeClass: 'tall',
    beatLabels: ['1', '2', '3', '4'],
    group: 'even',
    cells: evenCol(4),
    layoutCopyKey: 'comic.layoutYonkoma',
    lockCopyKey: 'comic.lockYonkoma',
    readingCopyKey: 'comic.readingYonkoma',
    promptLayout:
      'ONE single tall comic PAGE: a VERTICAL 4-koma strip with EXACTLY 4 equal panels stacked (4 rows × 1 column), thick white gutters, reading top to bottom'
  },
  {
    id: 'grid-2x2',
    labelKey: 'layoutGrid2x2',
    panelCount: 4,
    sizeClass: 'square',
    beatLabels: ['1', '2', '3', '4'],
    group: 'even',
    cells: evenGrid(2, 2),
    layoutCopyKey: 'comic.layoutGrid2x2',
    lockCopyKey: 'comic.lockGrid2x2',
    readingCopyKey: 'comic.readingOrder',
    promptLayout:
      'ONE single square comic PAGE: a 2×2 grid with EXACTLY 4 equal panels (2 rows × 2 columns), thick white gutters, reading left-to-right then top-to-bottom'
  },
  {
    id: 'strip-4',
    labelKey: 'layoutStrip4',
    panelCount: 4,
    sizeClass: 'wide',
    beatLabels: ['1', '2', '3', '4'],
    group: 'even',
    cells: evenRow(4),
    layoutCopyKey: 'comic.layoutStrip4',
    lockCopyKey: 'comic.lockStrip',
    readingCopyKey: 'comic.readingOrder',
    promptLayout:
      'ONE single wide landscape comic PAGE: a horizontal strip with EXACTLY 4 equal panels in ONE row (1 row × 4 columns), thick white gutters'
  },
  {
    id: 'grid-2x3',
    labelKey: 'layoutGrid2x3',
    panelCount: 6,
    sizeClass: 'wide',
    beatLabels: ['1', '2', '3', '4', '5', '6'],
    group: 'even',
    cells: evenGrid(2, 3),
    layoutCopyKey: 'comic.layoutGrid2x3',
    lockCopyKey: 'comic.lockGrid2x3',
    readingCopyKey: 'comic.readingOrder',
    promptLayout:
      'ONE single landscape comic PAGE: EXACTLY 6 equal panels as 2 ROWS × 3 COLUMNS (top 1-2-3, bottom 4-5-6), thick white gutters, left-to-right then top-to-bottom'
  },
  {
    id: 'grid-3x3',
    labelKey: 'layoutGrid3x3',
    panelCount: 9,
    sizeClass: 'square',
    beatLabels: ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
    group: 'even',
    cells: evenGrid(3, 3),
    layoutCopyKey: 'comic.layoutGrid3x3',
    lockCopyKey: 'comic.lockGrid3x3',
    readingCopyKey: 'comic.readingOrder',
    promptLayout:
      'ONE single square comic PAGE: a 3×3 grid with EXACTLY 9 equal panels (3 rows × 3 columns), thick white gutters, reading left-to-right then top-to-bottom'
  },
  {
    id: 'wide-plus-two',
    labelKey: 'layoutWidePlusTwo',
    panelCount: 3,
    sizeClass: 'tall',
    beatLabels: ['1', '2', '3'],
    group: 'manga',
    cells: [rect(0, 0, 0, 12, 7), rect(1, 0, 7, 6, 5), rect(2, 6, 7, 6, 5)],
    layoutCopyKey: 'comic.layoutWidePlusTwo',
    lockCopyKey: 'comic.lockWidePlusTwo',
    readingCopyKey: 'comic.readingWidePlusTwo',
    promptLayout:
      'ONE tall comic PAGE: a WIDE hero panel on the top ~60% of the page, then TWO equal smaller panels side by side on the bottom. Thick white gutters. Not an equal 3-strip.'
  },
  {
    id: 'two-plus-wide',
    labelKey: 'layoutTwoPlusWide',
    panelCount: 3,
    sizeClass: 'tall',
    beatLabels: ['1', '2', '3'],
    group: 'manga',
    cells: [rect(0, 0, 0, 6, 5), rect(1, 6, 0, 6, 5), rect(2, 0, 5, 12, 7)],
    layoutCopyKey: 'comic.layoutTwoPlusWide',
    lockCopyKey: 'comic.lockTwoPlusWide',
    readingCopyKey: 'comic.readingTwoPlusWide',
    promptLayout:
      'ONE tall comic PAGE: TWO equal smaller panels side by side on the top, then ONE wide closer panel on the bottom ~60%. Thick white gutters. Not an equal 3-strip.'
  },
  {
    id: 'tall-left-two',
    labelKey: 'layoutTallLeftTwo',
    panelCount: 3,
    sizeClass: 'tall',
    beatLabels: ['1', '2', '3'],
    group: 'manga',
    cells: [rect(0, 0, 0, 6, 12), rect(1, 6, 0, 6, 6), rect(2, 6, 6, 6, 6)],
    layoutCopyKey: 'comic.layoutTallLeftTwo',
    lockCopyKey: 'comic.lockTallLeftTwo',
    readingCopyKey: 'comic.readingTallLeftTwo',
    promptLayout:
      'ONE tall comic PAGE: a TALL full-height panel on the LEFT half, and TWO stacked panels on the RIGHT. Thick white gutters. Not a 2×2 grid.'
  },
  {
    id: 'hero-plus-three',
    labelKey: 'layoutHeroPlusThree',
    panelCount: 4,
    sizeClass: 'tall',
    beatLabels: ['1', '2', '3', '4'],
    group: 'manga',
    cells: [
      rect(0, 0, 0, 12, 6),
      rect(1, 0, 6, 4, 6),
      rect(2, 4, 6, 4, 6),
      rect(3, 8, 6, 4, 6)
    ],
    layoutCopyKey: 'comic.layoutHeroPlusThree',
    lockCopyKey: 'comic.lockHeroPlusThree',
    readingCopyKey: 'comic.readingHeroPlusThree',
    promptLayout:
      'ONE tall comic PAGE: a WIDE hero panel on the top half, then THREE equal smaller panels in one row on the bottom. Thick white gutters. Not a 2×2 grid.'
  },
  {
    id: 'focus-quad',
    labelKey: 'layoutFocusQuad',
    panelCount: 4,
    sizeClass: 'tall',
    beatLabels: ['1', '2', '3', '4'],
    group: 'manga',
    cells: [
      rect(0, 0, 0, 8, 6),
      rect(1, 8, 0, 4, 3),
      rect(2, 8, 3, 4, 3),
      rect(3, 0, 6, 12, 6)
    ],
    layoutCopyKey: 'comic.layoutFocusQuad',
    lockCopyKey: 'comic.lockFocusQuad',
    readingCopyKey: 'comic.readingFocusQuad',
    promptLayout:
      'ONE tall comic PAGE: medium panel top-left, TWO stacked small panels top-right, ONE large wide panel on the bottom half. Thick white gutters. Not a 2×2 grid.'
  },
  {
    id: 'stagger-four',
    labelKey: 'layoutStaggerFour',
    panelCount: 4,
    sizeClass: 'tall',
    beatLabels: ['1', '2', '3', '4'],
    group: 'manga',
    cells: [
      rect(0, 0, 0, 8, 6),
      rect(1, 8, 0, 4, 6),
      rect(2, 0, 6, 4, 6),
      rect(3, 4, 6, 8, 6)
    ],
    layoutCopyKey: 'comic.layoutStaggerFour',
    lockCopyKey: 'comic.lockStaggerFour',
    readingCopyKey: 'comic.readingStaggerFour',
    promptLayout:
      'ONE tall comic PAGE: staggered 2+2 — top row wide-then-narrow, bottom row narrow-then-wide. Thick white gutters. Not equal 2×2 squares.'
  },
  {
    id: 'diag-pair-plus',
    labelKey: 'layoutDiagPairPlus',
    panelCount: 3,
    sizeClass: 'tall',
    beatLabels: ['1', '2', '3'],
    group: 'manga',
    cells: [
      {
        i: 0,
        x: 0,
        y: 0,
        w: 12,
        h: 6,
        poly: [
          [0, 0],
          [12, 0],
          [0, 6]
        ]
      },
      {
        i: 1,
        x: 0,
        y: 0,
        w: 12,
        h: 6,
        poly: [
          [12, 0],
          [12, 6],
          [0, 6]
        ]
      },
      rect(2, 0, 6, 12, 6)
    ],
    layoutCopyKey: 'comic.layoutDiagPairPlus',
    lockCopyKey: 'comic.lockDiagPairPlus',
    readingCopyKey: 'comic.readingDiagPairPlus',
    promptLayout:
      'ONE tall comic PAGE: the TOP HALF is split by a DIAGONAL gutter into TWO wedge panels; the BOTTOM HALF is ONE wide rectangular panel. Thick white gutters. Not three equal strips.'
  },
  {
    id: 'hero-plus-four',
    labelKey: 'layoutHeroPlusFour',
    panelCount: 5,
    sizeClass: 'tall',
    beatLabels: ['1', '2', '3', '4', '5'],
    group: 'manga',
    cells: [
      rect(0, 0, 0, 12, 6),
      rect(1, 0, 6, 6, 3),
      rect(2, 6, 6, 6, 3),
      rect(3, 0, 9, 6, 3),
      rect(4, 6, 9, 6, 3)
    ],
    layoutCopyKey: 'comic.layoutHeroPlusFour',
    lockCopyKey: 'comic.lockHeroPlusFour',
    readingCopyKey: 'comic.readingHeroPlusFour',
    promptLayout:
      'ONE tall comic PAGE: a WIDE hero panel on the top half, then FOUR smaller equal panels as a 2×2 grid on the bottom half. Thick white gutters. Five panels total. Not a 3×3 or 2×2 page.'
  }
]

export const DEFAULT_COMIC_PAGE_LAYOUT: ComicPageLayoutId = 'grid-2x2'

export function getComicPageLayout(
  id?: string | null
): ComicPageLayoutDef {
  const hit = COMIC_PAGE_LAYOUTS.find((l) => l.id === id)
  return (
    hit ??
    COMIC_PAGE_LAYOUTS.find((l) => l.id === DEFAULT_COMIC_PAGE_LAYOUT)!
  )
}

export function coerceComicPageLayout(
  id?: string | null
): ComicPageLayoutId {
  return getComicPageLayout(id).id
}

export function comicLayoutGrid(
  layout: ComicPageLayoutDef
): { rows: number; cols: number } {
  switch (layout.id) {
    case 'splash-1':
      return { rows: 1, cols: 1 }
    case 'strip-2':
      return { rows: 1, cols: 2 }
    case 'strip-3':
      return { rows: 1, cols: 3 }
    case 'strip-4':
      return { rows: 1, cols: 4 }
    case 'yonkoma':
      return { rows: 4, cols: 1 }
    case 'grid-2x2':
      return { rows: 2, cols: 2 }
    case 'grid-2x3':
      return { rows: 2, cols: 3 }
    case 'grid-3x3':
      return { rows: 3, cols: 3 }
    default:
      return { rows: 1, cols: layout.panelCount }
  }
}

export function comicLayoutCells(
  layout: ComicPageLayoutDef
): ComicPanelCell[] {
  return layout.cells
}

export function comicLayoutsByGroup(
  group: ComicLayoutGroup
): ComicPageLayoutDef[] {
  return COMIC_PAGE_LAYOUTS.filter((l) => l.group === group)
}

/** SVG path in 12×12 user units. */
export function comicPanelSvgPath(cell: ComicPanelCell): string {
  if (cell.poly && cell.poly.length >= 3) {
    return (
      cell.poly
        .map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]} ${p[1]}`)
        .join(' ') + ' Z'
    )
  }
  return `M${cell.x} ${cell.y} h${cell.w} v${cell.h} h${-cell.w} Z`
}

export function comicPanelCentroid(cell: ComicPanelCell): {
  x: number
  y: number
} {
  if (cell.poly && cell.poly.length >= 3) {
    const n = cell.poly.length
    const sx = cell.poly.reduce((a, p) => a + p[0], 0)
    const sy = cell.poly.reduce((a, p) => a + p[1], 0)
    return { x: sx / n, y: sy / n }
  }
  return { x: cell.x + cell.w / 2, y: cell.y + cell.h / 2 }
}

export type ComicVideoScheme = 'page' | 'drama'

export function coerceComicVideoScheme(
  v?: string | null
): ComicVideoScheme {
  return v === 'drama' ? 'drama' : 'page'
}

export function buildComicDramaVideoPrompt(opts: {
  locale?: string | null
  storyTitle: string
  pageOrder: number
  beatText?: string | null
  prevSnippet?: string | null
}): string {
  const locale = PromptCatalog.locale(opts.locale)
  return [
    PromptCatalog.t(locale, 'clip.task'),
    PromptCatalog.t(locale, 'clip.hasRef'),
    PromptCatalog.t(locale, 'comic.dramaStillLock'),
    PromptCatalog.t(locale, 'comic.profileLine', {
      title: opts.storyTitle,
      n: opts.pageOrder
    }),
    opts.beatText?.trim()
      ? `${PromptCatalog.t(locale, 'clip.beat')}\n${opts.beatText.trim()}`
      : null,
    opts.prevSnippet?.trim()
      ? `${PromptCatalog.t(locale, 'clip.prev')}\n${opts.prevSnippet.trim()}`
      : null,
    PromptCatalog.t(locale, 'comic.dramaCamera')
  ]
    .filter(Boolean)
    .join('\n')
}

export function buildComicIntroVideoPrompt(opts: {
  locale?: string | null
  storyTitle: string
  pageOrder: number
  panelCount: number
  layoutLabel: string
}): string {
  const locale = PromptCatalog.locale(opts.locale)
  return [
    PromptCatalog.t(locale, 'comic.introTask', {
      title: opts.storyTitle,
      n: opts.pageOrder,
      count: opts.panelCount
    }),
    PromptCatalog.t(locale, 'comic.introLock'),
    PromptCatalog.t(locale, 'comic.introLayout', { layout: opts.layoutLabel }),
    PromptCatalog.t(locale, 'comic.introCamera'),
    PromptCatalog.t(locale, 'comic.introClose')
  ].join('\n')
}

export function comicLayoutPrompt(
  layout: ComicPageLayoutDef,
  locale?: string | null
): string {
  return PromptCatalog.t(locale, layout.layoutCopyKey)
}

export function buildComicGeometryLock(
  layout: ComicPageLayoutDef,
  locale?: string | null
): string {
  const n = layout.panelCount
  return [
    PromptCatalog.t(locale, 'comic.panelCount', { n }),
    PromptCatalog.t(locale, layout.lockCopyKey, { n })
  ].join('\n')
}

export function buildComicPanelInstructions(
  layout: ComicPageLayoutDef,
  captions: string[],
  locale?: string | null
): string {
  const n = layout.panelCount
  const lines = layout.beatLabels.map((label, i) => {
    const cap = (captions[i] || '').trim()
    return cap
      ? PromptCatalog.t(locale, 'comic.panelLine', {
          i: i + 1,
          n,
          label,
          cap
        })
      : PromptCatalog.t(locale, 'comic.panelEmpty', {
          i: i + 1,
          n,
          label
        })
  })
  return [
    PromptCatalog.t(locale, 'comic.layoutLead', {
      layout: comicLayoutPrompt(layout, locale)
    }),
    buildComicGeometryLock(layout, locale),
    PromptCatalog.t(locale, layout.readingCopyKey),
    PromptCatalog.t(locale, 'comic.panelNumbers', { n }),
    ...lines,
    PromptCatalog.t(locale, 'comic.identity'),
    PromptCatalog.t(locale, 'comic.finished')
  ].join('\n')
}

/** Area coverage in unit²; even layouts should be 144, diagonal pair shares a band. */
export function comicLayoutCellArea(layout: ComicPageLayoutDef): number {
  return layout.cells.reduce((sum, c) => {
    if (c.poly && c.poly.length >= 3) {
      let a = 0
      for (let i = 0; i < c.poly.length; i++) {
        const [x1, y1] = c.poly[i]
        const [x2, y2] = c.poly[(i + 1) % c.poly.length]
        a += x1 * y2 - x2 * y1
      }
      return sum + Math.abs(a) / 2
    }
    return sum + c.w * c.h
  }, 0)
}
