import { describe, expect, it } from 'vitest'
import {
  galleryStripClass,
  mobileSheetOuterClass,
  mobileSheetPanelClass,
  pageRootClass,
  pageScrollClass,
  sheetBodyScrollClass,
  stickyFooterClass,
  timelineBottomBarClass
} from './mobileLayout'

describe('mobileLayout tokens', () => {
  it('exports non-empty layout class strings', () => {
    const tokens = [
      pageRootClass,
      pageScrollClass,
      mobileSheetOuterClass,
      mobileSheetPanelClass,
      stickyFooterClass,
      sheetBodyScrollClass,
      galleryStripClass,
      timelineBottomBarClass
    ]
    for (const c of tokens) {
      expect(typeof c).toBe('string')
      expect(c.trim().length).toBeGreaterThan(0)
    }
  })

  it('page root fills height without nested page scroll', () => {
    expect(pageRootClass).toContain('h-full')
    expect(pageRootClass).toContain('min-h-0')
    expect(pageRootClass).toContain('overflow-hidden')
  })

  it('page scroll is the primary overflow axis', () => {
    expect(pageScrollClass).toContain('overflow-y-auto')
    expect(pageScrollClass).toContain('flex-1')
  })

  it('mobile sheet uses 100dvh and sticky footer tokens', () => {
    expect(mobileSheetPanelClass).toContain('100dvh')
    expect(stickyFooterClass).toContain('shrink-0')
    expect(timelineBottomBarClass).toContain('md:hidden')
  })
})
