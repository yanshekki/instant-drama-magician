import { describe, expect, it, vi } from 'vitest'
import { CharacterStep } from './CharacterStep'

describe('CharacterStep', () => {
  const step = new CharacterStep()

  it('skips when no characters', async () => {
    const r = await step.run({
      story: { id: 's1', title: 'T', characters: [] },
      ai: { getStatus: vi.fn(), chat: vi.fn() },
      artifacts: {}
    } as never)
    expect(r.success).toBe(true)
    expect(r.output).toMatch(/No characters/)
  })

  it('offline degraded returns bible', async () => {
    const r = await step.run({
      story: {
        id: 's1',
        title: 'T',
        characters: [
          { id: 'c1', name: 'Ming', description: 'courier', soulMdPath: '/soul.md' }
        ]
      },
      ai: {
        getStatus: vi.fn().mockResolvedValue({ available: false, message: 'off' }),
        chat: vi.fn()
      },
      artifacts: {}
    } as never)
    expect(r.degraded).toBe(true)
    expect(r.output).toMatch(/Ming/)
    expect(r.output).toMatch(/soul\.md/)
  })

  it('online uses chat output', async () => {
    const r = await step.run({
      story: {
        id: 's1',
        title: 'T',
        characters: [{ id: 'c1', name: 'Ming', description: 'courier' }]
      },
      ai: {
        getStatus: vi.fn().mockResolvedValue({ available: true }),
        chat: vi.fn().mockResolvedValue({
          choices: [{ message: { content: 'refined bible' } }]
        })
      },
      artifacts: {}
    } as never)
    expect(r.success).toBe(true)
    expect(r.output).toBe('refined bible')
  })

  it('falls back to bible when chat empty', async () => {
    const r = await step.run({
      story: {
        id: 's1',
        title: 'T',
        characters: [{ id: 'c1', name: 'Ming', description: 'courier' }]
      },
      ai: {
        getStatus: vi.fn().mockResolvedValue({ available: true }),
        chat: vi.fn().mockResolvedValue({
          choices: [{ message: { content: '' } }]
        })
      },
      artifacts: {}
    } as never)
    expect(r.output).toMatch(/Ming/)
  })

  it('returns failure on throw', async () => {
    const r = await step.run({
      story: {
        id: 's1',
        title: 'T',
        characters: [{ id: 'c1', name: 'Ming', description: 'x' }]
      },
      ai: {
        getStatus: vi.fn().mockRejectedValue(new Error('boom'))
      },
      artifacts: {}
    } as never)
    expect(r.success).toBe(false)
    expect(r.error).toMatch(/boom/)
  })
})
