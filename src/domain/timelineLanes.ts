/**
 * Derived condition lanes for the director-desk timeline.
 * Lanes visualise TimelineEntry bindings; they are not compositing tracks.
 */
import type { TimelineEntry } from '../types/domain'
import {
  extractSpokenLines,
  parseBeatContent
} from './beatContent'
import { timelineGraphBindIds } from './timelineGraph'

export type TimelineLaneId =
  | 'shot'
  | 'character'
  | 'scene'
  | 'asset'
  | 'keyframe'

export const TIMELINE_LANE_ORDER: TimelineLaneId[] = [
  'shot',
  'character',
  'scene',
  'asset',
  'keyframe'
]

export const TIMELINE_LANE_HEIGHT: Record<TimelineLaneId, number> = {
  shot: 48,
  character: 26,
  scene: 26,
  asset: 26,
  keyframe: 22
}

export const TIMELINE_LANE_GAP = 4
export const TIMELINE_LANE_LABEL_W = 76

export type TimelineLaneFill =
  | 'ready'
  | 'failed'
  | 'generating'
  | 'character'
  | 'scene'
  | 'prop'
  | 'action'
  | 'empty'
  | 'keyframe'

export type TimelineLaneClip = {
  id: string
  entryId: string
  lane: TimelineLaneId
  startTime: number
  endTime: number
  label: string
  badge: string | null
  pictureNo: number | null
  entityId: string | null
  imagePath: string | null
  fill: TimelineLaneFill
}

export type TimelineLane = {
  id: TimelineLaneId
  clips: TimelineLaneClip[]
}

export type TimelineLaneNamed = {
  id: string
  name?: string | null
  title?: string | null
  refImagePath?: string | null
}

export type BuildTimelineLanesInput = {
  entries: readonly TimelineEntry[]
  labels?: Record<string, string>
  characters?: TimelineLaneNamed[]
  scenes?: TimelineLaneNamed[]
  props?: TimelineLaneNamed[]
  actions?: TimelineLaneNamed[]
  stillByEntryId?: Record<string, string | null | undefined>
  pictureByKey?: Record<string, number>
}

export function timelineLaneStackHeight(): number {
  return TIMELINE_LANE_ORDER.reduce(
    (h, id, i) =>
      h + TIMELINE_LANE_HEIGHT[id] + (i > 0 ? TIMELINE_LANE_GAP : 0),
    0
  )
}

export function timelineLaneOffsetY(lane: TimelineLaneId): number {
  let y = 0
  for (const id of TIMELINE_LANE_ORDER) {
    if (id === lane) return y
    y += TIMELINE_LANE_HEIGHT[id] + TIMELINE_LANE_GAP
  }
  return y
}

export function pictureKey(
  kind: 'character' | 'scene' | 'prop' | 'action' | 'still',
  id: string
): string {
  return `${kind}:${id}`
}

export function numberMediaPool(
  items: Array<{ key: string }>
): Record<string, number> {
  const out: Record<string, number> = {}
  let n = 1
  for (const item of items) {
    const k = item.key.trim()
    if (!k || out[k]) continue
    out[k] = n
    n += 1
  }
  return out
}

function lookupName(
  list: TimelineLaneNamed[] | undefined,
  id: string
): TimelineLaneNamed | undefined {
  return list?.find((row) => row.id === id)
}

function displayName(row: TimelineLaneNamed | undefined, fallback: string): string {
  return (row?.name || row?.title || '').trim() || fallback
}

export function shotDialogueBadge(entry: TimelineEntry): string | null {
  const spoken = extractSpokenLines(
    parseBeatContent(entry.dialogue, entry.beatContentJson)
  ).trim()
  if (spoken) {
    const first = spoken.split('\n')[0]?.trim() || spoken
    return first.slice(0, 28)
  }
  const raw = (entry.dialogue || '').replace(/\s+/g, ' ').trim()
  return raw ? raw.slice(0, 28) : null
}

function shotFill(entry: TimelineEntry): TimelineLaneFill {
  if (entry.mediaStatus === 'READY') return 'ready'
  if (entry.mediaStatus === 'FAILED') return 'failed'
  if (entry.mediaStatus === 'GENERATING' || entry.mediaStatus === 'QUEUED') {
    return 'generating'
  }
  if (entry.characterId || (entry.characterIds && entry.characterIds[0])) {
    return 'character'
  }
  if (entry.sceneId || (entry.sceneIds && entry.sceneIds[0])) return 'scene'
  if (entry.propId || (entry.propIds && entry.propIds[0])) return 'prop'
  if (entry.actionId || (entry.actionIds && entry.actionIds[0])) return 'action'
  return 'empty'
}

export function buildTimelineLanes(input: BuildTimelineLanesInput): TimelineLane[] {
  const lanes: Record<TimelineLaneId, TimelineLaneClip[]> = {
    shot: [],
    character: [],
    scene: [],
    asset: [],
    keyframe: []
  }
  const pics = input.pictureByKey || {}

  for (const entry of input.entries) {
    const start = Number(entry.startTime) || 0
    const end = Math.max(start, Number(entry.endTime) || start)
    const shotLabel =
      (input.labels && input.labels[entry.id]) || `#${(entry.order ?? 0) + 1}`
    lanes.shot.push({
      id: `shot:${entry.id}`,
      entryId: entry.id,
      lane: 'shot',
      startTime: start,
      endTime: end,
      label: shotLabel,
      badge: shotDialogueBadge(entry),
      pictureNo: null,
      entityId: null,
      imagePath: null,
      fill: shotFill(entry)
    })

    const charIds = timelineGraphBindIds(entry.characterIds, entry.characterId)
    for (const id of charIds) {
      const row = lookupName(input.characters, id)
      lanes.character.push({
        id: `character:${entry.id}:${id}`,
        entryId: entry.id,
        lane: 'character',
        startTime: start,
        endTime: end,
        label: displayName(row, id),
        badge: null,
        pictureNo: pics[pictureKey('character', id)] ?? null,
        entityId: id,
        imagePath: row?.refImagePath?.trim() || null,
        fill: 'character'
      })
    }

    const sceneIds = timelineGraphBindIds(entry.sceneIds, entry.sceneId)
    for (const id of sceneIds) {
      const row = lookupName(input.scenes, id)
      lanes.scene.push({
        id: `scene:${entry.id}:${id}`,
        entryId: entry.id,
        lane: 'scene',
        startTime: start,
        endTime: end,
        label: displayName(row, id),
        badge: null,
        pictureNo: pics[pictureKey('scene', id)] ?? null,
        entityId: id,
        imagePath: row?.refImagePath?.trim() || null,
        fill: 'scene'
      })
    }

    const propIds = timelineGraphBindIds(entry.propIds, entry.propId)
    for (const id of propIds) {
      const row = lookupName(input.props, id)
      lanes.asset.push({
        id: `prop:${entry.id}:${id}`,
        entryId: entry.id,
        lane: 'asset',
        startTime: start,
        endTime: end,
        label: displayName(row, id),
        badge: null,
        pictureNo: pics[pictureKey('prop', id)] ?? null,
        entityId: id,
        imagePath: row?.refImagePath?.trim() || null,
        fill: 'prop'
      })
    }
    const actionIds = timelineGraphBindIds(entry.actionIds, entry.actionId)
    for (const id of actionIds) {
      const row = lookupName(input.actions, id)
      lanes.asset.push({
        id: `action:${entry.id}:${id}`,
        entryId: entry.id,
        lane: 'asset',
        startTime: start,
        endTime: end,
        label: displayName(row, id),
        badge: null,
        pictureNo: pics[pictureKey('action', id)] ?? null,
        entityId: id,
        imagePath: row?.refImagePath?.trim() || null,
        fill: 'action'
      })
    }

    const still = input.stillByEntryId?.[entry.id]?.trim() || null
    if (still) {
      lanes.keyframe.push({
        id: `keyframe:${entry.id}`,
        entryId: entry.id,
        lane: 'keyframe',
        startTime: start,
        endTime: end,
        label: '',
        badge: null,
        pictureNo: pics[pictureKey('still', entry.id)] ?? null,
        entityId: entry.id,
        imagePath: still,
        fill: 'keyframe'
      })
    }
  }

  return TIMELINE_LANE_ORDER.map((id) => ({ id, clips: lanes[id] }))
}

export type TimeRange = { start: number; end: number }

/** Inclusive overlap: clip intersects [start, end). */
export function entriesIntersectingRange<T extends { startTime: number; endTime: number }>(
  entries: readonly T[],
  start: number,
  end: number
): T[] {
  const a = Math.min(start, end)
  const b = Math.max(start, end)
  if (!(b > a)) return []
  return entries.filter((e) => e.endTime > a && e.startTime < b)
}

export function clampWorkArea(
  start: number,
  end: number,
  total: number
): TimeRange {
  const max = Math.max(0, total)
  let a = Number.isFinite(start) ? start : 0
  let b = Number.isFinite(end) ? end : max
  a = Math.min(max, Math.max(0, a))
  b = Math.min(max, Math.max(0, b))
  if (b < a) {
    const t = a
    a = b
    b = t
  }
  if (b - a < 0.1 && max > 0) {
    b = Math.min(max, a + 0.1)
  }
  return { start: a, end: b }
}

export function workAreaCoversAll(
  start: number,
  end: number,
  total: number
): boolean {
  return start <= 0.001 && end >= Math.max(0, total) - 0.001
}
