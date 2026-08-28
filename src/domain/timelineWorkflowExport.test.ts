import { describe, expect, it } from 'vitest'
import type { TimelineEntry } from '../types/domain'
import {
  buildTimelineWorkflowPlan,
  timelineWorkflowFileName
} from './timelineWorkflowExport'

const clip = (id: string, start: number, end: number): TimelineEntry => ({
  id,
  storyId: 's1',
  startTime: start,
  endTime: end,
  characterId: null,
  sceneId: null,
  propId: null,
  actionId: null,
  characterIds: [],
  sceneIds: [],
  propIds: [],
  actionIds: [],
  dialogue: null,
  beatContentJson: null,
  order: 0,
  mediaPath: null,
  mediaStatus: 'EMPTY',
  mediaError: null,
  videoJobId: null
})

describe('timelineWorkflowExport', () => {
  it('exports only clips in the work area with compiled text', () => {
    const plan = buildTimelineWorkflowPlan({
      storyId: 's1',
      storyTitle: 'Demo',
      entries: [clip('a', 0, 3), clip('b', 7, 9)],
      workStart: 6,
      workEnd: 10,
      compiledByEntryId: { b: { text: 'hello', sections: [], pictures: [] } },
      now: new Date('2026-08-28T00:00:00.000Z')
    })
    expect(plan.kind).toBe('idm-timeline-workflow')
    expect(plan.clips).toHaveLength(1)
    expect(plan.clips[0].id).toBe('b')
    expect(plan.clips[0].compiledPrompt).toBe('hello')
    expect(plan.exportedAt).toBe('2026-08-28T00:00:00.000Z')
  })

  it('slugs the download name', () => {
    expect(timelineWorkflowFileName('我的 短劇!!!')).toMatch(/workflow\.json$/)
    expect(timelineWorkflowFileName('')).toBe('timeline-workflow.json')
  })
})
