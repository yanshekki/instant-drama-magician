/**
 * MediaGen-oriented generation plan (not ComfyUI workflow JSON).
 */
import type { TimelineEntry } from '../types/domain'
import type { CompiledTimelinePrompt } from './compiledTimelinePrompt'
import { entriesIntersectingRange } from './timelineLanes'

export type TimelineWorkflowClip = {
  id: string
  order: number
  startTime: number
  endTime: number
  characterIds: string[]
  sceneIds: string[]
  propIds: string[]
  actionIds: string[]
  mediaStatus: string | null
  compiledPrompt?: string
}

export type TimelineWorkflowPlan = {
  version: 1
  kind: 'idm-timeline-workflow'
  storyId: string
  storyTitle: string
  exportedAt: string
  workArea: { start: number; end: number }
  clips: TimelineWorkflowClip[]
}

export function buildTimelineWorkflowPlan(input: {
  storyId: string
  storyTitle: string
  entries: readonly TimelineEntry[]
  workStart: number
  workEnd: number
  compiledByEntryId?: Record<string, CompiledTimelinePrompt | string | undefined>
  now?: Date
}): TimelineWorkflowPlan {
  const scoped = entriesIntersectingRange(
    input.entries,
    input.workStart,
    input.workEnd
  )
  return {
    version: 1,
    kind: 'idm-timeline-workflow',
    storyId: input.storyId,
    storyTitle: input.storyTitle,
    exportedAt: (input.now ?? new Date()).toISOString(),
    workArea: { start: input.workStart, end: input.workEnd },
    clips: scoped.map((e) => {
      const raw = input.compiledByEntryId?.[e.id]
      const compiledPrompt =
        typeof raw === 'string' ? raw : raw?.text
      return {
        id: e.id,
        order: e.order,
        startTime: e.startTime,
        endTime: e.endTime,
        characterIds: e.characterIds ?? [],
        sceneIds: e.sceneIds ?? [],
        propIds: e.propIds ?? [],
        actionIds: e.actionIds ?? [],
        mediaStatus: e.mediaStatus ?? null,
        ...(compiledPrompt ? { compiledPrompt } : {})
      }
    })
  }
}

export function timelineWorkflowFileName(storyTitle: string): string {
  const slug = (storyTitle || 'timeline')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  return `${slug || 'timeline'}-workflow.json`
}
