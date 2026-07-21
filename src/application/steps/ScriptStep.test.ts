import { describe, expect, it, vi } from 'vitest'
import { ScriptStep } from './ScriptStep'

describe('ScriptStep', () => {
  const step = new ScriptStep()

  it('offline writes placeholders', async () => {
    const updateSceneScript = vi.fn()
    const r = await step.run({
      story: {
        id: 's1',
        title: 'Rain',
        characters: [],
        props: [],
        scenes: [
          { id: 'sc1', sceneNumber: 1, description: 'alley' },
          { id: 'sc2', sceneNumber: 2, description: 'door' }
        ]
      },
      ai: {
        getStatus: vi.fn().mockResolvedValue({ available: false, message: 'offline' })
      },
      persistence: { updateSceneScript },
      artifacts: {}
    } as never)
    expect(r.degraded).toBe(true)
    expect(updateSceneScript).toHaveBeenCalledTimes(2)
    expect(r.output).toMatch(/Placeholder|offline/i)
  })

  it('offline with no scenes', async () => {
    const r = await step.run({
      story: {
        id: 's1',
        title: 'T',
        characters: [],
        props: [],
        scenes: []
      },
      ai: {
        getStatus: vi.fn().mockResolvedValue({ available: false, message: 'down' })
      },
      artifacts: {}
    } as never)
    expect(r.output).toMatch(/no scenes|down/i)
  })

  it('online parses scene blocks and updates scripts', async () => {
    const updateSceneScript = vi.fn()
    const script = [
      '### SCENE 1 | id=sc1',
      'INT. ALLEY — night',
      'Ming walks.',
      '',
      '### SCENE 2 | id=sc2',
      'EXT. DOOR',
      'Yau waits.'
    ].join('\n')
    const r = await step.run({
      story: {
        id: 's1',
        title: 'Rain',
        characters: [{ name: 'Ming', description: 'courier' }],
        props: [{ name: 'Bag' }],
        scenes: [
          { id: 'sc1', sceneNumber: 1, description: 'alley' },
          { id: 'sc2', sceneNumber: 2, description: 'door' }
        ]
      },
      ai: {
        getStatus: vi.fn().mockResolvedValue({ available: true }),
        chat: vi.fn().mockResolvedValue({
          choices: [{ message: { content: script } }]
        })
      },
      persistence: { updateSceneScript },
      artifacts: {}
    } as never)
    expect(r.success).toBe(true)
    expect(updateSceneScript).toHaveBeenCalledWith(
      'sc1',
      expect.stringContaining('ALLEY'),
      'COMPLETED'
    )
    expect(updateSceneScript).toHaveBeenCalledWith(
      'sc2',
      expect.stringContaining('DOOR'),
      'COMPLETED'
    )
  })

  it('online matches alt scene header without id', async () => {
    const updateSceneScript = vi.fn()
    const script = '### SCENE 1\nbody only\n'
    await step.run({
      story: {
        id: 's1',
        title: 'T',
        characters: [],
        props: [],
        scenes: [{ id: 'sc1', sceneNumber: 1, description: 'x' }]
      },
      ai: {
        getStatus: vi.fn().mockResolvedValue({ available: true }),
        chat: vi.fn().mockResolvedValue({
          choices: [{ message: { content: script } }]
        })
      },
      persistence: { updateSceneScript },
      artifacts: {}
    } as never)
    expect(updateSceneScript).toHaveBeenCalledWith(
      'sc1',
      'body only',
      'COMPLETED'
    )
  })

  it('failure returns error', async () => {
    const r = await step.run({
      story: {
        id: 's1',
        title: 'T',
        characters: [],
        props: [],
        scenes: []
      },
      ai: { getStatus: vi.fn().mockRejectedValue(new Error('net')) },
      artifacts: {}
    } as never)
    expect(r.success).toBe(false)
    expect(r.error).toMatch(/net/)
  })
})
