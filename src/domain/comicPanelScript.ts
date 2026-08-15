/**
 * Per-panel script slots on a comic page (JSON on ComicPage.panelScriptJson).
 */
import { getComicPageLayout } from './comicPageLayouts'

export interface ComicPanelSlot {
  caption: string
  timelineEntryId?: string | null
  characterIds?: string[]
  sceneId?: string | null
  propId?: string | null
  actionId?: string | null
}

export function emptyPanelSlot(): ComicPanelSlot {
  return {
    caption: '',
    timelineEntryId: null,
    characterIds: [],
    sceneId: null,
    propId: null,
    actionId: null
  }
}

export function normalizePanelSlots(
  raw: unknown,
  panelCount: number
): ComicPanelSlot[] {
  const n = Math.max(1, panelCount)
  const list = Array.isArray(raw) ? raw : []
  const out: ComicPanelSlot[] = []
  for (let i = 0; i < n; i++) {
    const row = list[i]
    if (!row || typeof row !== 'object') {
      out.push(emptyPanelSlot())
      continue
    }
    const o = row as Record<string, unknown>
    const ids = Array.isArray(o.characterIds)
      ? o.characterIds.filter((x): x is string => typeof x === 'string' && Boolean(x.trim()))
      : []
    out.push({
      caption: typeof o.caption === 'string' ? o.caption : '',
      timelineEntryId:
        typeof o.timelineEntryId === 'string' && o.timelineEntryId.trim()
          ? o.timelineEntryId.trim()
          : null,
      characterIds: ids,
      sceneId:
        typeof o.sceneId === 'string' && o.sceneId.trim()
          ? o.sceneId.trim()
          : null,
      propId:
        typeof o.propId === 'string' && o.propId.trim()
          ? o.propId.trim()
          : null,
      actionId:
        typeof o.actionId === 'string' && o.actionId.trim()
          ? o.actionId.trim()
          : null
    })
  }
  return out
}

export function parsePanelScriptJson(
  json: string | null | undefined,
  panelLayout?: string | null
): ComicPanelSlot[] {
  const n = getComicPageLayout(panelLayout).panelCount
  if (!json?.trim()) return normalizePanelSlots([], n)
  try {
    return normalizePanelSlots(JSON.parse(json) as unknown, n)
  } catch {
    return normalizePanelSlots([], n)
  }
}

export function serializePanelScript(slots: ComicPanelSlot[]): string {
  return JSON.stringify(slots)
}

export function captionsFromSlots(slots: ComicPanelSlot[]): string[] {
  return slots.map((s) => s.caption.trim())
}

export function paginateTimelineBeats<T extends { id: string }>(
  entries: T[],
  panelCount: number,
  alreadyBoundIds?: Iterable<string>
): T[][] {
  const bound = new Set(alreadyBoundIds ?? [])
  const leftover = entries.filter((e) => e.id && !bound.has(e.id))
  const n = Math.max(1, panelCount)
  const pages: T[][] = []
  for (let i = 0; i < leftover.length; i += n) {
    pages.push(leftover.slice(i, i + n))
  }
  return pages
}

export function boundTimelineIdsFromSlots(
  slots: ComicPanelSlot[]
): string[] {
  return slots
    .map((s) => s.timelineEntryId?.trim())
    .filter((id): id is string => Boolean(id))
}

export function captionFromTimelineBeat(entry: {
  dialogue?: string | null
  beatContentJson?: string | null
}): string {
  const spoken = entry.dialogue?.trim()
  if (spoken) return spoken
  const raw = entry.beatContentJson?.trim()
  if (!raw) return ''
  try {
    const parsed = JSON.parse(raw) as {
      units?: Array<{ type?: string; line?: string; text?: string }>
    }
    const units = Array.isArray(parsed.units) ? parsed.units : []
    for (const u of units) {
      if (u.type === 'dialogue' && u.line?.trim()) return u.line.trim()
    }
    for (const u of units) {
      if (u.text?.trim()) return u.text.trim()
    }
  } catch {
    /* ignore */
  }
  return ''
}
