import { describe, expect, it, vi } from 'vitest'
import { PropsStep } from './PropsStep'

describe('PropsStep', () => {
  const step = new PropsStep()

  it('skips when no props', async () => {
    const r = await step.run({
      story: { id: 's1', title: 'T', props: [] },
      ai: { getStatus: vi.fn() },
      artifacts: {}
    } as never)
    expect(r.output).toMatch(/No props/)
  })

  it('offline degraded', async () => {
    const r = await step.run({
      story: {
        id: 's1',
        title: 'T',
        props: [{ id: 'p1', name: 'Bag', description: 'red' }]
      },
      ai: {
        getStatus: vi.fn().mockResolvedValue({ available: false })
      },
      artifacts: {}
    } as never)
    expect(r.degraded).toBe(true)
    expect(r.output).toMatch(/Bag/)
  })

  it('online chat and empty fallback', async () => {
    const story = {
      id: 's1',
      title: 'T',
      props: [{ id: 'p1', name: 'Bag', description: 'red' }]
    }
    const r = await step.run({
      story,
      ai: {
        getStatus: vi.fn().mockResolvedValue({ available: true }),
        chat: vi.fn().mockResolvedValue({
          choices: [{ message: { content: 'notes' } }]
        })
      },
      artifacts: {}
    } as never)
    expect(r.output).toBe('notes')

    const r2 = await step.run({
      story,
      ai: {
        getStatus: vi.fn().mockResolvedValue({ available: true }),
        chat: vi.fn().mockResolvedValue({
          choices: [{ message: { content: '' } }]
        })
      },
      artifacts: {}
    } as never)
    expect(r2.output).toMatch(/Bag/)
  })

  it('failure', async () => {
    const r = await step.run({
      story: {
        id: 's1',
        title: 'T',
        props: [{ id: 'p1', name: 'Bag', description: 'x' }]
      },
      ai: { getStatus: vi.fn().mockRejectedValue(new Error('x')) },
      artifacts: {}
    } as never)
    expect(r.success).toBe(false)
  })
})
