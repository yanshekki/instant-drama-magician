import { describe, expect, it } from 'vitest'
import {
  ACTION_PANEL_LAYOUTS,
  DEFAULT_ACTION_PANEL,
  coerceActionPanelLayout,
  getActionPanelLayout
} from './actionPlateVariants'

describe('actionPlateVariants', () => {
  it('defines unique layouts with panel counts', () => {
    const ids = new Set(ACTION_PANEL_LAYOUTS.map((l) => l.id))
    expect(ids.size).toBe(ACTION_PANEL_LAYOUTS.length)
    for (const l of ACTION_PANEL_LAYOUTS) {
      expect(l.panelCount).toBeGreaterThan(0)
      expect(l.beatLabels.length).toBe(l.panelCount)
      expect(l.promptLayout.length).toBeGreaterThan(10)
      expect(l.labelKey).toBeTruthy()
    }
  })

  it('includes common layout ids', () => {
    const ids = ACTION_PANEL_LAYOUTS.map((l) => l.id)
    expect(ids).toContain('strip-3')
    expect(ids).toContain('grid-2x2')
  })

  it('getActionPanelLayout / coerce defaults', () => {
    expect(getActionPanelLayout('strip-2')?.panelCount).toBe(2)
    expect(getActionPanelLayout('nope')?.id).toBe(DEFAULT_ACTION_PANEL)
    expect(coerceActionPanelLayout(null)).toBe(DEFAULT_ACTION_PANEL)
    expect(coerceActionPanelLayout('grid-2x2')).toBe('grid-2x2')
  })
})

