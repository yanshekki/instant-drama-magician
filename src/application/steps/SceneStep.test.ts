import { describe, expect, it, vi } from 'vitest'
import { SceneStep } from './SceneStep'

describe('SceneStep', () => {
  const step = new SceneStep()

  it('skips when no scenes', async () => {
    const r = await step.run({
      story: { id: 's1', title: 'T', scenes: [] },
      ai: { getStatus: vi.fn() },
      artifacts: {}
    } as never)
    expect(r.output).toMatch(/No scenes/)
  })

  it('offline degraded', async () => {
    const r = await step.run({
      story: {
        id: 's1',
        title: 'T',
        scenes: [
          {
            id: 'sc1',
            sceneNumber: 1,
            status: 'PENDING',
            description: 'alley',
            script: 'go left'
          }
        ]
      },
      ai: {
        getStatus: vi.fn().mockResolvedValue({ available: false })
      },
      artifacts: {}
    } as never)
    expect(r.degraded).toBe(true)
    expect(r.output).toMatch(/alley/)
  })

  it('online chat success and empty fallback', async () => {
    const story = {
      id: 's1',
      title: 'T',
      scenes: [
        { id: 'sc1', sceneNumber: 1, status: 'PENDING', description: 'alley' }
      ]
    }
    const r = await step.run({
      story,
      ai: {
        getStatus: vi.fn().mockResolvedValue({ available: true }),
        chat: vi.fn().mockResolvedValue({
          choices: [{ message: { content: 'beats' } }]
        })
      },
      artifacts: {}
    } as never)
    expect(r.output).toBe('beats')

    const r2 = await step.run({
      story,
      ai: {
        getStatus: vi.fn().mockResolvedValue({ available: true }),
        chat: vi.fn().mockResolvedValue({
          choices: [{ message: { content: null } }]
        })
      },
      artifacts: {}
    } as never)
    expect(r2.output).toMatch(/alley/)
  })

  it('failure path', async () => {
    const r = await step.run({
      story: {
        id: 's1',
        title: 'T',
        scenes: [{ id: 'sc1', sceneNumber: 1, status: 'PENDING', description: 'x' }]
      },
      ai: { getStatus: vi.fn().mockRejectedValue('fail') },
      artifacts: {}
    } as never)
    expect(r.success).toBe(false)
  })
})
