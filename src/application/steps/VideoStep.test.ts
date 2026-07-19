import { describe, expect, it, vi } from 'vitest'
import { VideoStep } from './VideoStep'

const baseStory = {
  id: 's1',
  title: 'T',
  characters: [],
  scenes: [],
  props: [],
  timeline: []
}

describe('VideoStep', () => {
  it('runs without throw on empty story', async () => {
    const step = new VideoStep()
    const ai = {
      getStatus: vi.fn().mockResolvedValue({ available: false, message: 'off' }),
      chat: vi.fn()
    }
    const ctx = {
      story: baseStory,
      ai,
      signal: undefined,
      artifacts: {},
      media: {},
      persistence: {}
    }
    const r = await step.run(ctx as never)
    expect(r.step).toBe(step.name)
    expect(r.success).toBe(true)
  })
})
