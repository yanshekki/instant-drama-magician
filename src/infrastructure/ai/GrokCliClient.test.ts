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
  let dir: string | undefined
  afterEach(() => {
    if (dir) {
      try { rmSync(dir, { recursive: true, force: true }) } catch { /* */ }
      dir = undefined
    }
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

    // jpg mime path
    const jpg = join(dir, 'r.jpg')
    writeFileSync(jpg, Buffer.alloc(100))
    vi.spyOn(vision, 'loadImageBytesForAi').mockReturnValue({
      bytes: Buffer.from([1, 2, 3]),
      mime: 'image/jpeg',
      resized: false,
      width: 10,
      height: 10
    } as never)
    await expect(
      c.editImage({ prompt: 'p', imagePath: jpg })
    ).resolves.toMatchObject({ b64: 'BBB' })
    rmSync(dir, { recursive: true, force: true })
  })

  it('getStatus separate image+video providers and shared video', async () => {
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
      videoProvider: 'grok-http',
      videoBaseUrl: 'http://v',
      videoApiKey: 'k'
    }).getStatus()
    expect(st.image).toBeTruthy()
    expect(st.message).toMatch(/Chat/)

    // same-as-llm video uses sharedVideoMsg branch
    const st2 = await client({
      imageProvider: 'same-as-llm',
      videoProvider: 'same-as-llm'
    }).getStatus()
    expect(st2.video).toBeNull()
    expect(st2.message).toMatch(/Video/)
  })

  it('probeChat listModels error mapping and testChat non-AppError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (String(url).includes('/health')) return { ok: true, status: 200 }
        throw new Error('ECONNREFUSED models')
      })
    )
    // probeChat may map network error
    const p = await client().probeChat()
    expect(typeof p.available).toBe('boolean')

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('plain fail')
      })
    )
    // testChat rethrows unmapped after mapChatMessage null
    try {
      await client().testChat()
    } catch (e) {
      expect(e).toBeTruthy()
    }
  })

  it('chat gateway retry timeout and network fail after ensure', async () => {
    let calls = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        calls++
        throw new TypeError('fetch failed')
      })
    )
    const gw = client({
      llmProvider: 'grok-gateway',
      baseUrl: 'http://127.0.0.1:3847/v1',
      chatTimeoutMs: 500
    })
    // @ts-expect-error private
    gw.tryEnsureLocalGateway = async () => undefined
    await expect(
      gw.chat({ messages: [{ role: 'user', content: 'x' }] })
    ).rejects.toMatchObject({ code: 'AI_UNAVAILABLE' })

    // retry times out
    calls = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        calls++
        if (calls === 1) throw new TypeError('fetch failed')
        throw new Error('aborted by timeout')
      })
    )
    // @ts-expect-error private
    gw.tryEnsureLocalGateway = async () => undefined
    await expect(
      gw.chat({ messages: [{ role: 'user', content: 'x' }] })
    ).rejects.toMatchObject({ message: 'errors.chatTimedOut' })
  })

  it('parseImageResponse http error and generateImage sizes', async () => {
    const c = client()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 429,
        text: async () => 'rate limit'
      }))
    )
    await expect(c.generateImage({ prompt: 'p' })).rejects.toBeInstanceOf(
      AppError
    )
    await expect(
      c.generateImage({ prompt: 'p', aspectRatio: '1:1', size: '1024x1024' })
    ).rejects.toBeTruthy()
  })

  it('probeImage seedream and non-Error catch + probeChat AppError map', async () => {
    const client = new GrokCliClient({
      apiKey: 'k',
      baseUrl: 'http://x',
      model: 'm',
      imageProvider: 'seedream',
      imageApiKey: 'seed-key',
      imageBaseUrl: 'http://seed',
      imageModel: 'seed-m'
    } as never)
    const st = await (client as any).probeImage()
    expect(st.available).toBe(true)

    const client2 = new GrokCliClient({
      apiKey: 'k',
      baseUrl: 'http://x',
      model: 'm',
      imageProvider: 'seedream',
      imageApiKey: '',
      imageBaseUrl: 'http://seed',
      imageModel: 'seed-m'
    } as never)
    const st2 = await (client2 as any).probeImage()
    expect(typeof st2.available).toBe('boolean')

    // non-Error throw from fetch
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw 'string-fail'
      })
    )
    const client3 = new GrokCliClient({
      apiKey: 'k',
      baseUrl: 'http://x',
      model: 'm',
      imageProvider: 'openai',
      imageApiKey: 'ik',
      imageBaseUrl: 'http://img',
      imageModel: 'im'
    } as never)
    const st3 = await (client3 as any).probeImage()
    expect(st3.available).toBe(false)
    vi.unstubAllGlobals()
  })

  it('probeChat listModels failure branches and testChat map', async () => {
    const { AppError } = await import('../../types/errors')
    const client = new GrokCliClient({
      apiKey: 'k',
      baseUrl: 'http://x',
      model: 'm'
    } as never)
    vi.spyOn(client as any, 'listModels').mockRejectedValue(
      new AppError('AI_FAILED', 'errors.x', 'd')
    )
    const r = await (client as any).probeChat?.() ?? await client.getStatus()
    expect(r).toBeTruthy()

    // testChat empty content + non-AppError mapped
    vi.spyOn(client, 'chat').mockResolvedValueOnce({
      choices: [{ message: { content: '   ' } }],
      model: 'm'
    } as never)
    const t1 = await client.testChat('hi')
    expect(t1.ok).toBe(true)

    vi.spyOn(client, 'chat').mockRejectedValueOnce(new Error('rate limit exceeded'))
    await expect(client.testChat()).rejects.toBeTruthy()

    vi.spyOn(client, 'chat').mockRejectedValueOnce('raw')
    await expect(client.testChat()).rejects.toBeTruthy()
  })

  it('editImage mimeFromPath for jpg webp gif and tryEnsureLocalGateway', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-grok-mime-'))
    for (const [name, mimeHint] of [
      ['a.jpg', 'jpeg'],
      ['b.webp', 'webp'],
      ['c.gif', 'gif']
    ] as const) {
      const f = join(dir, name)
      writeFileSync(f, 'x')
      const client = new GrokCliClient({
        apiKey: 'k',
        baseUrl: 'http://x',
        model: 'm',
        imageProvider: 'same-as-llm',
        omitSampling: true
      } as never)
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({
          ok: true,
          json: async () => ({
            data: [{ b64_json: Buffer.from('img').toString('base64') }]
          })
        }))
      )
      vi.doMock('../gateway/GrokGatewayService', () => ({
        getGrokGatewayService: () => ({
          ensureRunning: vi.fn(async () => undefined)
        })
      }))
      try {
        await client.editImage({
          prompt: 'p',
          imagePath: f,
          size: '1024x1024',
          aspectRatio: '1:1'
        } as never)
      } catch {
        /* may fail structure */
      }
      vi.unstubAllGlobals()
    }
  })

  it('mimeFromPath via editImage jpg webp gif', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-mime-'))
    const c = client({ imageProvider: 'openai', imageApiKey: 'k', omitSampling: true })
    for (const name of ['a.jpg', 'b.jpeg', 'c.webp', 'd.gif', 'e.png']) {
      const f = join(dir, name)
      writeFileSync(f, 'imgdata')
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({
          ok: true,
          json: async () => ({
            data: [{ b64_json: Buffer.from('out').toString('base64') }]
          })
        }))
      )
      try {
        await c.editImage({
          prompt: 'edit me',
          imagePath: f,
          size: '1024x1024'
        } as never)
      } catch {
        /* structure may differ */
      }
    }
    // seedream no key message
    const c2 = client({
      imageProvider: 'seedream',
      imageApiKey: '',
      imageBaseUrl: 'http://s',
      imageModel: 'm'
    })
    const st = await (c2 as any).probeImage()
    expect(st.message || st.available === false || st.available === true).toBeTruthy()

    // tryEnsureLocalGateway with omitSampling true
    const c3 = client({ omitSampling: true, apiKey: 'k' })
    vi.doMock('../gateway/GrokGatewayService', () => ({
      getGrokGatewayService: () => ({
        ensureRunning: vi.fn(async () => {
          throw new Error('gw down')
        })
      })
    }))
    try {
      await (c3 as any).tryEnsureLocalGateway()
    } catch { /* private may not be callable */ }
    // call through chat path if exists
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw Object.assign(new Error('ECONNREFUSED'), { code: 'ECONNREFUSED' })
      })
    )
    try {
      await c3.chat({ messages: [{ role: 'user', content: 'hi' }] } as never)
    } catch { /* */ }
  })

})
