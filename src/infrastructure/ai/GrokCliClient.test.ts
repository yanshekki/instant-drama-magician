import { afterEach, describe, expect, it, vi } from 'vitest'
import { GrokCliClient } from './GrokCliClient'
import { DEFAULT_SETTINGS } from '../../types/settings'
import { AppError } from '../../types/errors'

describe('GrokCliClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('constructs with settings', () => {
    const c = new GrokCliClient({
      ...DEFAULT_SETTINGS,
      apiKey: '',
      baseUrl: 'http://127.0.0.1:9'
    })
    expect(c).toBeTruthy()
  })

  it('getStatus returns structure when offline', async () => {
    const c = new GrokCliClient({
      ...DEFAULT_SETTINGS,
      apiKey: '',
      baseUrl: 'http://127.0.0.1:1'
    })
    const st = await c.getStatus()
    expect(st).toHaveProperty('available')
  }, 15_000)

  it('chat retries once after network error when ensureRunning succeeds', async () => {
    const ensureRunning = vi.fn().mockResolvedValue({ state: 'ready', healthOk: true })
    vi.doMock('../gateway/GrokGatewayService', () => ({
      getGrokGatewayService: () => ({ ensureRunning })
    }))
    // Dynamic import path used inside client — spy via module mock on next import
    // Instead: mock fetch fail then success; mock ensure via prototype path
    let calls = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        calls += 1
        if (calls === 1) {
          throw new TypeError('fetch failed')
        }
        return {
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'ok-retry' } }]
          })
        }
      })
    )

    // Patch tryEnsureLocalGateway to no-op success without real gateway
    const c = new GrokCliClient({
      ...DEFAULT_SETTINGS,
      llmProvider: 'grok-gateway',
      apiKey: 'gk_live_test',
      baseUrl: 'http://127.0.0.1:3847/v1'
    })
    // @ts-expect-error access private for test
    c.tryEnsureLocalGateway = async () => {
      ensureRunning()
    }

    const res = await c.chat({
      messages: [{ role: 'user', content: 'hi' }],
      max_tokens: 8
    })
    expect(calls).toBe(2)
    expect(ensureRunning).toHaveBeenCalled()
    expect(res.choices[0]?.message?.content).toBe('ok-retry')
  })

  it('chat maps persistent network failure to i18n keys', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed')
      })
    )
    const c = new GrokCliClient({
      ...DEFAULT_SETTINGS,
      llmProvider: 'openai',
      apiKey: 'sk-test',
      baseUrl: 'https://api.openai.com/v1'
    })
    // openai omitSampling false → no ensureRunning retry
    await expect(
      c.chat({ messages: [{ role: 'user', content: 'x' }] })
    ).rejects.toMatchObject({
      code: 'AI_UNAVAILABLE',
      message: 'errors.networkFailed',
      details: 'errors.aiUnavailable'
    } satisfies Partial<AppError>)
  })
})
