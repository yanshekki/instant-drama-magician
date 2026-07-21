import { describe, expect, it, vi } from 'vitest'
import { AppError } from '../../types/errors'
import type { AIProvider } from '../../types/domain'
import { polishThenGenerateVideo } from './polishVideoPrompt'

function makeAi(opts: {
  chat?: AIProvider['chat']
  generateVideo?: AIProvider['generateVideo']
}): AIProvider {
  return {
    chat:
      opts.chat ??
      (async () => ({
        choices: [{ message: { content: 'x'.repeat(50) } }]
      })),
    generateImage: async () => ({ b64: '' }),
    editImage: async () => ({ b64: '' }),
    generateVideo: opts.generateVideo
  }
}

describe('polishThenGenerateVideo', () => {
  it('throws when fallback empty or video unavailable', async () => {
    await expect(
      polishThenGenerateVideo({
        ai: makeAi({ generateVideo: async () => ({ path: '/v.mp4' }) }),
        fallbackPrompt: '  ',
        polishUserContent: 'x',
        videoRequest: { durationSeconds: 6, aspectRatio: '16:9' }
      })
    ).rejects.toBeInstanceOf(AppError)

    await expect(
      polishThenGenerateVideo({
        ai: makeAi({ generateVideo: undefined }),
        fallbackPrompt: 'fallback prompt long enough',
        polishUserContent: 'x',
        videoRequest: { durationSeconds: 6, aspectRatio: '16:9' }
      })
    ).rejects.toMatchObject({ message: 'errors.videoUnavailable' })
  })

  it('uses polished prompt when LLM returns long text', async () => {
    const polished = 'POLISHED DIRECTOR PROMPT ' + 'word '.repeat(20)
    const gen = vi.fn(async (req: { prompt: string }) => {
      expect(req.prompt).toContain('POLISHED')
      return { path: '/out.mp4' }
    })
    const phases: string[] = []
    const r = await polishThenGenerateVideo({
      ai: makeAi({
        chat: async () => ({
          choices: [{ message: { content: polished } }]
        }),
        generateVideo: gen
      }),
      fallbackPrompt: 'FALLBACK_TEMPLATE_PROMPT_HERE',
      polishUserContent: 'materials',
      locale: 'en',
      videoRequest: { durationSeconds: 8, aspectRatio: '9:16' },
      hardRules: 'NO logo',
      onPhase: (p) => phases.push(p)
    })
    expect(r.polished).toBe(true)
    expect(r.promptUsed).toMatch(/POLISHED|NO logo|HARD/)
    expect(r.path).toBe('/out.mp4')
    expect(phases).toEqual(['llm', 'generate'])
    expect(gen).toHaveBeenCalled()
  })

  it('falls back when chat fails or extract too short', async () => {
    const gen = vi.fn(async () => ({ path: '/v.mp4' }))
    const r1 = await polishThenGenerateVideo({
      ai: makeAi({
        chat: async () => {
          throw new Error('network')
        },
        generateVideo: gen
      }),
      fallbackPrompt: 'FALLBACK_OK_LONG_ENOUGH_TEMPLATE',
      polishUserContent: 'x',
      videoRequest: { durationSeconds: 6, aspectRatio: '16:9' }
    })
    expect(r1.polished).toBe(false)
    expect(r1.promptUsed).toContain('FALLBACK')

    const r2 = await polishThenGenerateVideo({
      ai: makeAi({
        chat: async () => ({
          choices: [{ message: { content: 'short' } }]
        }),
        generateVideo: gen
      }),
      fallbackPrompt: 'FALLBACK_OK_LONG_ENOUGH_TEMPLATE',
      polishUserContent: 'x',
      videoRequest: { durationSeconds: 6, aspectRatio: '16:9' }
    })
    expect(r2.polished).toBe(false)
  })

  it('throws CANCELLED when signal aborted', async () => {
    const ac = new AbortController()
    ac.abort()
    await expect(
      polishThenGenerateVideo({
        ai: makeAi({ generateVideo: async () => ({ path: '/v.mp4' }) }),
        fallbackPrompt: 'FALLBACK_OK_LONG_ENOUGH_TEMPLATE',
        polishUserContent: 'x',
        videoRequest: { durationSeconds: 6, aspectRatio: '16:9' },
        signal: ac.signal
      })
    ).rejects.toMatchObject({ code: 'CANCELLED' })
  })
})
