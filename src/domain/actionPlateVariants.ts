/**
 * Multi-panel motion instruction plate layouts ("出圖方案").
 * Panel 1 = first action beat … Panel N = last action beat.
 */

import { PromptCatalog } from '../prompts'
import type { PromptCopyKey } from '../prompts/copy/keys'

export type ActionPanelLayoutId =
  | 'strip-2'
  | 'strip-3'
  | 'grid-2x2'
  | 'strip-4'
  | 'strip-5'
  | 'grid-2x3'

export interface ActionPanelLayoutDef {
  id: ActionPanelLayoutId
  /** i18n key under actions.* */
  labelKey: string
  /** English prompt fragment for grid geometry */
  promptLayout: string
  galleryLabel: string
  panelCount: number
  /** Canvas size class — wide for multi-col strips / 2×3 so models don't collapse to 2×2 */
  sizeClass: 'wide' | 'square' | 'tall'
  /**
   * Short beat labels for prompts (Traditional Chinese OK in EN prompt
   * as on-image captions; English used for structure).
   */
  beatLabels: string[]
}

export const ACTION_PANEL_LAYOUTS: ActionPanelLayoutDef[] = [
  {
    id: 'strip-2',
    labelKey: 'panelLayout_strip-2',
    panelCount: 2,
    sizeClass: 'wide',
    galleryLabel: 'Instruction strip ×2',
    beatLabels: ['1 起勢', '2 結果'],
    promptLayout:
      'ONE single landscape image: a horizontal STORYBOARD STRIP with EXACTLY 2 equal panels side-by-side (1 row × 2 columns), thick clear gutters between panels'
  },
  {
    id: 'strip-3',
    labelKey: 'panelLayout_strip-3',
    panelCount: 3,
    sizeClass: 'wide',
    galleryLabel: 'Instruction strip ×3',
    beatLabels: ['1 起勢', '2 過程', '3 結果'],
    promptLayout:
      'ONE single landscape image: a horizontal STORYBOARD STRIP with EXACTLY 3 equal panels in ONE row (1 row × 3 columns), thick clear gutters'
  },
  {
    id: 'grid-2x2',
    labelKey: 'panelLayout_grid-2x2',
    panelCount: 4,
    sizeClass: 'square',
    galleryLabel: 'Instruction board 2×2',
    beatLabels: ['1 起勢', '2 過程', '3 高潮', '4 結果'],
    promptLayout:
      'ONE single square image: a 2×2 comic storyboard grid with EXACTLY 4 equal panels (2 rows × 2 columns), thick clear gutters, reading order left-to-right then top-to-bottom'
  },
  {
    id: 'strip-4',
    labelKey: 'panelLayout_strip-4',
    panelCount: 4,
    sizeClass: 'wide',
    galleryLabel: 'Instruction strip ×4',
    beatLabels: ['1 起勢', '2 過程', '3 高潮', '4 結果'],
    promptLayout:
      'ONE single wide landscape image: a horizontal STORYBOARD STRIP with EXACTLY 4 equal panels in ONE row (1 row × 4 columns), thick clear gutters'
  },
  {
    id: 'strip-5',
    labelKey: 'panelLayout_strip-5',
    panelCount: 5,
    sizeClass: 'wide',
    galleryLabel: 'Instruction strip ×5',
    beatLabels: ['1 起勢', '2 蓄力', '3 過程', '4 高潮', '5 結果'],
    promptLayout:
      'ONE single wide landscape image: a horizontal STORYBOARD STRIP with EXACTLY 5 equal panels in ONE row (1 row × 5 columns), thick clear gutters'
  },
  {
    id: 'grid-2x3',
    labelKey: 'panelLayout_grid-2x3',
    panelCount: 6,
    sizeClass: 'wide',
    galleryLabel: 'Instruction board 2×3',
    beatLabels: [
      '1 起勢',
      '2 蓄力',
      '3 過程',
      '4 高潮',
      '5 收勢',
      '6 結果'
    ],
    promptLayout:
      'ONE single landscape image: a comic storyboard grid with EXACTLY 6 equal panels arranged as 2 ROWS × 3 COLUMNS (top row panels 1-2-3, bottom row panels 4-5-6), thick clear gutters, reading order left-to-right then top-to-bottom'
  }
]

export const DEFAULT_ACTION_PANEL: ActionPanelLayoutId = 'grid-2x2'

export function getActionPanelLayout(
  id?: string | null
): ActionPanelLayoutDef {
  const hit = ACTION_PANEL_LAYOUTS.find((l) => l.id === id)
  return hit ?? ACTION_PANEL_LAYOUTS.find((l) => l.id === DEFAULT_ACTION_PANEL)!
}

export function coerceActionPanelLayout(
  id?: string | null
): ActionPanelLayoutId {
  return getActionPanelLayout(id).id
}

export function actionLayoutPrompt(
  layout: ActionPanelLayoutDef,
  locale?: string | null
): string {
  return PromptCatalog.t(
    locale,
    `action.geometry.layout.${layout.id}` as PromptCopyKey
  )
}

function actionGeometryLock(
  layout: ActionPanelLayoutDef,
  locale?: string | null
): string {
  const n = layout.panelCount
  if (layout.id === 'grid-2x3') {
    return PromptCatalog.t(locale, 'action.geometry.lockGrid2x3')
  }
  if (layout.id === 'grid-2x2') {
    return PromptCatalog.t(locale, 'action.geometry.lockGrid2x2')
  }
  return PromptCatalog.t(locale, 'action.geometry.lockStrip', { n })
}

/** Prompt block: which panel is action beat 1…N */
export function buildPanelBeatInstructions(
  layout: ActionPanelLayoutDef,
  locale: string = 'zh-HK'
): string {
  const n = layout.panelCount
  const list = Array.from({ length: n }, (_, i) => i + 1).join(', ')
  const lines = layout.beatLabels.map((label, i) =>
    PromptCatalog.t(locale, 'action.geometry.panelLine', {
      i: i + 1,
      n,
      label
    })
  )

  return [
    PromptCatalog.t(locale, 'action.geometry.panelCount', { n, list }),
    PromptCatalog.t(locale, 'sheet.scaffold.layoutLead', {
      layout: actionLayoutPrompt(layout, locale)
    }),
    actionGeometryLock(layout, locale),
    PromptCatalog.t(locale, 'action.geometry.order', { n }),
    PromptCatalog.t(locale, 'action.geometry.reading'),
    PromptCatalog.t(locale, 'action.geometry.numbers', { n }),
    ...lines,
    PromptCatalog.t(locale, 'action.geometry.caption'),
    PromptCatalog.t(locale, 'action.geometry.identity')
  ].join('\n')
}
