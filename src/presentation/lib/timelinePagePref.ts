export const TIMELINE_PAGE_PREF_KEY = 'idm.timeline.page'

export type TimelinePagePref = 'classic' | 'v2'

export function readTimelinePagePref(): TimelinePagePref {
  try {
    return localStorage.getItem(TIMELINE_PAGE_PREF_KEY) === 'v2' ? 'v2' : 'classic'
  } catch {
    return 'classic'
  }
}

export function writeTimelinePagePref(next: TimelinePagePref): void {
  try {
    localStorage.setItem(TIMELINE_PAGE_PREF_KEY, next)
  } catch {
    /* ignore quota / private mode */
  }
}
