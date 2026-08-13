/** @vitest-environment happy-dom */
import { describe, expect, it, beforeEach } from 'vitest'
import {
  TIMELINE_PAGE_PREF_KEY,
  readTimelinePagePref,
  writeTimelinePagePref
} from './timelinePagePref'

describe('timelinePagePref', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('defaults to classic', () => {
    expect(readTimelinePagePref()).toBe('classic')
  })

  it('round-trips v2', () => {
    writeTimelinePagePref('v2')
    expect(localStorage.getItem(TIMELINE_PAGE_PREF_KEY)).toBe('v2')
    expect(readTimelinePagePref()).toBe('v2')
    writeTimelinePagePref('classic')
    expect(readTimelinePagePref()).toBe('classic')
  })
})
