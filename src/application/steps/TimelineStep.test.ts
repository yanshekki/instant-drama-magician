import { describe, expect, it, vi } from 'vitest'
import { TimelineStep } from './TimelineStep'

describe('TimelineStep', () => {
  const step = new TimelineStep()

  it('summarizes existing timeline', async () => {
    const r = await step.run({
      story: {
        id: 's1',
        title: 'T',
        characters: [],
        scenes: [],
        timeline: [
          {
            id: 'e1',
            order: 1,
            startTime: 6,
            endTime: 12,
            characterId: 'c1',
            sceneId: 'sc1',
            propId: 'p1',
            dialogue: 'hi'
          },
          {
            id: 'e0',
            order: 0,
            startTime: 0,
            endTime: 6,
            characterId: null,
            sceneId: null,
            propId: null,
            dialogue: null
          }
        ]
      },
      artifacts: {}
    } as never)
    expect(r.success).toBe(true)
    expect(r.output).toMatch(/Existing linear timeline/)
    expect(r.output).toMatch(/char:c1/)
    expect(r.output).toMatch(/12\.0s/)
  })

  it('suggests timeline from scenes and persists', async () => {
    const replaceTimelineSuggestions = vi.fn()
    const r = await step.run({
      story: {
        id: 's1',
        title: 'T',
        characters: [{ id: 'c1', name: 'Ming' }],
        scenes: [
          {
            id: 'sc1',
            sceneNumber: 1,
            description: 'alley',
            script: '\n\nHello line\n'
          },
          {
            id: 'sc2',
            sceneNumber: 2,
            description: 'door',
            script: null
          }
        ],
        timeline: []
      },
      persistence: { replaceTimelineSuggestions },
      artifacts: {}
    } as never)
    expect(r.output).toMatch(/Suggested linear timeline/)
    expect(replaceTimelineSuggestions).toHaveBeenCalledWith(
      's1',
      expect.arrayContaining([
        expect.objectContaining({
          sceneId: 'sc1',
          characterId: 'c1',
          dialogue: 'Hello line',
          order: 0
        })
      ])
    )
  })

  it('empty scenes yields empty schedule', async () => {
    const r = await step.run({
      story: {
        id: 's1',
        title: 'T',
        characters: [],
        scenes: [],
        timeline: []
      },
      artifacts: {}
    } as never)
    expect(r.output).toMatch(/schedule empty/)
  })

  it('suggestions without persistence still report lines', async () => {
    const r = await step.run({
      story: {
        id: 's1',
        title: 'T',
        characters: [],
        scenes: [{ id: 'sc1', sceneNumber: 1, description: 'x', script: null }],
        timeline: []
      },
      artifacts: {}
    } as never)
    expect(r.output).toMatch(/scene=sc1/)
  })
})
