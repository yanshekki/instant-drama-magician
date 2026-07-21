import { afterEach, describe, expect, it, vi } from 'vitest'
import { writeFileSync, mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { GrokCliClient, OpenAiCompatibleClient } from './GrokCliClient'
import { DEFAULT_SETTINGS } from '../../types/settings'
import { AppError } from '../../types/errors'

function client(partial: Partial<typeof DEFAULT_SETTINGS> = {}) {
  return new GrokCliClient({
    ...DEFAULT_SETTINGS,
    apiKey: 'gk_live_test',
    baseUrl: 'http://127.0.0.1:3847/v1',
    llmProvider: 'openai',
    imageProvider: 'openai',
    imageApiKey: 'sk-img',
    imageBaseUrl: 'https://api.openai.com/v1',
    chatTimeoutMs: 2000,
    imageTimeoutMs: 2000,
    ...partial
  })
}

describe('GrokCliClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('aliases OpenAiCompatibleClient and videoProvider modes', () => {
    expect(OpenAiCompatibleClient).toBe(GrokCliClient)
    const seed = new GrokCliClient({
      ...DEFAULT_SETTINGS,
      videoProvider: 'seedance',
      videoApiKey: 'k',
      videoBaseUrl: 'http://v'
    })
    expect(seed.videoProvider.id).toContain('seedance')
    expect(client().videoProvider).toBeTruthy()
  })

  it('probeImage seedream and http', async () => {
    const seed = client({
      imageProvider: 'seedream',
      imageApiKey: 'ark',
      imageBaseUrl: 'https://ark.example/v1'
    })
    expect(await seed.probeImage()).toMatchObject({ available: true })
    // resolveImageEndpoint falls back to chat apiKey when imageApiKey empty
    expect(
      await client({
        imageProvider: 'seedream',
        imageApiKey: '',
        apiKey: '',
        imageBaseUrl: 'https://ark.example/v1'
      }).probeImage()
    ).toMatchObject({ available: false })

    // no key + non-local
    expect(
      await client({
        imageProvider: 'openai',
        imageApiKey: '',
        imageBaseUrl: 'https://api.openai.com/v1',
        apiKey: ''
      }).probeImage()
    ).toMatchObject({ available: false })

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, text: async () => '' }))
    )
    expect(await client().probeImage()).toMatchObject({ available: true })

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 500, text: async () => 'x' }))
    )
    expect(await client().probeImage()).toMatchObject({ available: false })

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('down')
      })
    )
    expect(await client().probeImage()).toMatchObject({ message: 'down' })
  })

  it('getStatus and listModels', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (String(url).includes('/health')) return { ok: true, status: 200 }
        if (String(url).includes('/models')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ data: [{ id: 'm1' }] }),
            text: async () => ''
          }
        }
        return { ok: true, status: 200, json: async () => ({}), text: async () => '' }
      })
    )
    const st = await client({
      imageProvider: 'openai',
      videoProvider: 'stub'
    }).getStatus()
    expect(st.video?.provider).toBe('stub')

    const c = client({ model: 'custom-m' })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 429, text: async () => 'rate' }))
    )
    expect((await c.listModels()).some((m) => m.id === 'custom-m')).toBe(true)

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ data: [] })
      }))
    )
    expect((await c.listModels())[0].ownedBy).toBe('fallback')

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 401,
        text: async () => 'unauthorized'
      }))
    )
    await expect(c.listModels()).rejects.toBeInstanceOf(AppError)

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('timeout abort')
      })
    )
    expect((await c.listModels()).length).toBeGreaterThan(0)
  })

  it('probeChat and testChat', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (String(url).includes('/health')) throw new Error('no')
        return {
          ok: true,
          json: async () => ({ data: [{ id: 'm' }] })
        }
      })
    )
    const p = await client({ apiKey: '' }).probeChat()
    expect(p.available).toBe(false)

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          model: 'm',
          choices: [{ message: { content: 'OK' } }]
        }),
        text: async () => ''
      }))
    )
    await expect(client({ apiKey: '' }).testChat()).rejects.toMatchObject({
      code: 'AI_UNAUTHORIZED'
    })
    const r = await client().testChat()
    expect(r.ok).toBe(true)
  })

  it('chat rejects missing api key', async () => {
    await expect(
      client({ apiKey: '' }).chat({ messages: [{ role: 'user', content: 'x' }] })
    ).rejects.toMatchObject({ code: 'AI_UNAUTHORIZED' })
  })

  it('chat maps abort/timeout and network errors', async () => {
    // Non-local base avoids tryEnsureLocalGateway recovery hang
    const remote = {
      llmProvider: 'openai' as const,
      baseUrl: 'https://api.openai.com/v1',
      chatTimeoutMs: 500
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('aborted by timeout')
      })
    )
    await expect(
      client(remote).chat({
        messages: [{ role: 'user', content: 'x' }]
      })
    ).rejects.toMatchObject({ message: 'errors.chatTimedOut' })

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed')
      })
    )
    await expect(
      client(remote).chat({
        messages: [{ role: 'user', content: 'x' }]
      })
    ).rejects.toMatchObject({ code: 'AI_UNAVAILABLE' })
  })

  it('chat gateway retries once then succeeds; maps http 403', async () => {
    let calls = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        calls++
        if (calls === 1) throw new TypeError('fetch failed')
        return {
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'ok-retry' } }]
          })
        }
      })
    )
    const gw = client({
      llmProvider: 'grok-gateway',
      baseUrl: 'http://127.0.0.1:3847/v1',
      chatTimeoutMs: 1000
    })
    // @ts-expect-error private — avoid real gateway spawn
    gw.tryEnsureLocalGateway = async () => undefined
    const res = await gw.chat({
      messages: [{ role: 'user', content: 'hi' }],
      max_tokens: 8
    })
    expect(res.choices[0]?.message?.content).toBe('ok-retry')

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 403,
        text: async () => 'forbidden'
      }))
    )
    await expect(
      client({ llmProvider: 'openai' }).chat({
        messages: [{ role: 'user', content: 'x' }]
      })
    ).rejects.toMatchObject({ code: 'AI_KEY_MODE' })
  })

  it('generateVideo and generateImage', async () => {
    const c = client()
    vi.spyOn(c.videoProvider, 'generate').mockResolvedValue({
      path: '/v.mp4',
      provider: 'stub'
    } as never)
    await expect(
      c.generateVideo({
        prompt: 'p',
        outputPath: '/o.mp4',
        durationSeconds: 6
      })
    ).resolves.toMatchObject({ path: '/v.mp4' })

    await expect(
      client({ imageApiKey: '', apiKey: '' }).generateImage({ prompt: 'p' })
    ).rejects.toBeTruthy()

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ data: [{ b64_json: 'AAA' }] }),
        text: async () => ''
      }))
    )
    await expect(
      c.generateImage({ prompt: 'p', size: '1024x1024' })
    ).resolves.toMatchObject({ b64: 'AAA' })
    await expect(
      c.generateImage({ prompt: 'p', size: '1024x1792' })
    ).resolves.toMatchObject({ aspectUsed: '9:16' })

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ data: [{}] })
      }))
    )
    await expect(c.generateImage({ prompt: 'p' })).rejects.toMatchObject({
      message: 'errors.imageApiNoB64'
    })
  })

  it('editImage', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'img-'))
    const png = join(dir, 'r.png')
    writeFileSync(png, Buffer.alloc(100))
    const c = client()
    await expect(
      c.editImage({ prompt: 'p', imagePath: join(dir, 'no.png') })
    ).rejects.toMatchObject({ code: 'VALIDATION' })

    const vision = await import('../../domain/chatVision')
    vi.spyOn(vision, 'loadImageBytesForAi').mockReturnValue({
      bytes: Buffer.from([1, 2, 3]),
      mime: 'image/png',
      resized: true,
      width: 10,
      height: 10
    } as never)

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ data: [{ b64_json: 'BBB' }] })
      }))
    )
    await expect(
      c.editImage({ prompt: 'p', imagePath: png, size: '1024x1024' })
    ).resolves.toMatchObject({ b64: 'BBB' })
    rmSync(dir, { recursive: true, force: true })
  })
})
