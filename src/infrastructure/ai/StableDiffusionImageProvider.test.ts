import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { StableDiffusionImageProvider } from './StableDiffusionImageProvider'

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
)

describe('StableDiffusionImageProvider', () => {
  let dir: string
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true })
  })

  it('WebUI txt2img posts /sdapi/v1/txt2img without Bearer when no key', async () => {
    const fetchImpl = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/system_stats')) {
        return new Response('no', { status: 404 })
      }
      expect(url).toContain('/sdapi/v1/txt2img')
      expect((init?.headers as Record<string, string>).Authorization).toBeUndefined()
      const body = JSON.parse(String(init?.body)) as {
        width: number
        height: number
        override_settings?: { sd_model_checkpoint?: string }
        negative_prompt: string
      }
      expect(body.width).toBe(1344)
      expect(body.height).toBe(768)
      expect(body.override_settings?.sd_model_checkpoint).toBe('sdxl.safetensors')
      expect(body.negative_prompt).toContain('blurry')
      return new Response(JSON.stringify({ images: [PNG.toString('base64')] }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    }) as unknown as typeof fetch
    const p = new StableDiffusionImageProvider({
      baseUrl: 'http://127.0.0.1:7860',
      apiKey: '',
      model: 'sdxl.safetensors',
      fetchImpl
    })
    const r = await p.generate({ prompt: 'a hero', size: '1792x1024' })
    expect(r.b64.length).toBeGreaterThan(10)
    expect(r.aspectUsed).toBe('16:9')
  })

  it('WebUI img2img sends init_images and denoising 0.45', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-sd-'))
    const img = join(dir, 'base.png')
    writeFileSync(img, PNG)
    const fetchImpl = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/system_stats')) {
        return new Response('no', { status: 404 })
      }
      expect(url).toContain('/sdapi/v1/img2img')
      const body = JSON.parse(String(init?.body)) as {
        init_images: string[]
        denoising_strength: number
      }
      expect(body.init_images.length).toBe(1)
      expect(body.denoising_strength).toBe(0.45)
      return new Response(JSON.stringify({ images: [PNG.toString('base64')] }), {
        status: 200
      })
    }) as unknown as typeof fetch
    const p = new StableDiffusionImageProvider({
      baseUrl: 'http://127.0.0.1:7860',
      fetchImpl
    })
    await p.edit({ prompt: 'red coat', imagePath: img, size: '1024x1024' })
  })

  it('Stability generate sends Bearer and aspect_ratio', async () => {
    const fetchImpl = vi.fn(async (input: string | URL, init?: RequestInit) => {
      expect(String(input)).toContain(
        '/v2beta/stable-image/generate/sd3'
      )
      const h = init?.headers as Record<string, string>
      expect(h.Authorization).toBe('Bearer sk-test')
      return new Response(JSON.stringify({ image: PNG.toString('base64') }), {
        status: 200
      })
    }) as unknown as typeof fetch
    const p = new StableDiffusionImageProvider({
      baseUrl: 'https://api.stability.ai',
      apiKey: 'sk-test',
      fetchImpl
    })
    const r = await p.generate({ prompt: 'a lake', size: '1024x1024' })
    expect(r.b64).toBeTruthy()
    expect(p.requiresKey()).toBe(true)
  })

  it('probe WebUI hits sd-models', async () => {
    const fetchImpl = vi.fn(async (input: string | URL) => {
      const url = String(input)
      if (url.includes('/system_stats')) {
        return new Response('no', { status: 404 })
      }
      expect(url).toContain('/sdapi/v1/sd-models')
      return new Response('[]', { status: 200 })
    }) as unknown as typeof fetch
    const p = new StableDiffusionImageProvider({
      baseUrl: 'http://127.0.0.1:7860',
      fetchImpl
    })
    const s = await p.probe()
    expect(s.available).toBe(true)
  })

  it('Basic auth when key is user:pass', async () => {
    const fetchImpl = vi.fn(async (input: string | URL, init?: RequestInit) => {
      if (String(input).includes('/system_stats')) {
        return new Response('no', { status: 404 })
      }
      const h = init?.headers as Record<string, string>
      expect(h.Authorization.startsWith('Basic ')).toBe(true)
      return new Response(JSON.stringify({ images: [PNG.toString('base64')] }), {
        status: 200
      })
    }) as unknown as typeof fetch
    const p = new StableDiffusionImageProvider({
      baseUrl: 'http://127.0.0.1:7860',
      apiKey: 'user:secret',
      fetchImpl
    })
    await p.generate({ prompt: 'x', size: '1024x1024' })
  })

  it('probe Stability without key', async () => {
    const p = new StableDiffusionImageProvider({
      baseUrl: 'https://api.stability.ai',
      apiKey: ''
    })
    const s = await p.probe()
    expect(s.available).toBe(false)
  })

  it('probe ComfyUI via system_stats', async () => {
    const fetchImpl = vi.fn(async (input: string | URL) => {
      if (String(input).includes('/system_stats')) {
        return new Response('{}', { status: 200 })
      }
      return new Response('no', { status: 404 })
    }) as unknown as typeof fetch
    const p = new StableDiffusionImageProvider({
      baseUrl: 'http://127.0.0.1:8188',
      fetchImpl
    })
    expect((await p.probe()).message).toContain('ComfyUI')
  })

  it('listCheckpoints from WebUI titles', async () => {
    const fetchImpl = vi.fn(async (input: string | URL) => {
      if (String(input).includes('/system_stats')) {
        return new Response('no', { status: 404 })
      }
      return new Response(
        JSON.stringify([{ model_name: 'a.safetensors', title: 'A' }]),
        { status: 200 }
      )
    }) as unknown as typeof fetch
    const p = new StableDiffusionImageProvider({
      baseUrl: 'http://127.0.0.1:7860',
      fetchImpl
    })
    expect(await p.listCheckpoints()).toContain('a.safetensors')
  })

  it('listCheckpoints Stability catalog', async () => {
    const p = new StableDiffusionImageProvider({
      baseUrl: 'https://api.stability.ai',
      apiKey: 'sk'
    })
    expect(await p.listCheckpoints()).toContain('sd3.5-large')
  })

  it('WebUI 404 maps to sdWebuiNoApi', async () => {
    const fetchImpl = vi.fn(async (input: string | URL) => {
      if (String(input).includes('/system_stats')) {
        return new Response('no', { status: 404 })
      }
      return new Response('missing', { status: 404 })
    }) as unknown as typeof fetch
    const p = new StableDiffusionImageProvider({
      baseUrl: 'http://127.0.0.1:7860',
      fetchImpl
    })
    await expect(p.generate({ prompt: 'x', size: '1024x1024' })).rejects.toMatchObject({
      message: 'errors.sdWebuiNoApi'
    })
  })

  it('empty WebUI images array fails', async () => {
    const fetchImpl = vi.fn(async (input: string | URL) => {
      if (String(input).includes('/system_stats')) {
        return new Response('no', { status: 404 })
      }
      return new Response(JSON.stringify({ images: [] }), { status: 200 })
    }) as unknown as typeof fetch
    const p = new StableDiffusionImageProvider({
      baseUrl: 'http://127.0.0.1:7860',
      fetchImpl
    })
    await expect(p.generate({ prompt: 'x', size: '1024x1024' })).rejects.toMatchObject({
      code: 'AI_FAILED'
    })
  })

  it('ComfyUI generate uses /prompt and /view', async () => {
    const fetchImpl = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/system_stats')) return new Response('{}', { status: 200 })
      if (url.endsWith('/prompt')) {
        return new Response(JSON.stringify({ prompt_id: 'p1' }), { status: 200 })
      }
      if (url.includes('/history/')) {
        return new Response(
          JSON.stringify({
            p1: { outputs: { '9': { images: [{ filename: 'a.png' }] } } }
          }),
          { status: 200 }
        )
      }
      if (url.includes('/view')) return new Response(PNG, { status: 200 })
      return new Response('no', { status: 404 })
    }) as unknown as typeof fetch
    const p = new StableDiffusionImageProvider({
      baseUrl: 'http://127.0.0.1:8188',
      fetchImpl
    })
    const r = await p.generate({ prompt: 'lamp', size: '1024x1024' })
    expect(r.b64).toBeTruthy()
  })

  it('edit missing file throws VALIDATION', async () => {
    const p = new StableDiffusionImageProvider({
      baseUrl: 'http://127.0.0.1:7860'
    })
    await expect(
      p.edit({ prompt: 'x', imagePath: '/no/such.png', size: '1024x1024' })
    ).rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('Stability 402 maps to credits error', async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response('no credits', { status: 402 })
    }) as unknown as typeof fetch
    const p = new StableDiffusionImageProvider({
      baseUrl: 'https://api.stability.ai',
      apiKey: 'sk',
      fetchImpl
    })
    await expect(p.generate({ prompt: 'x', size: '1024x1024' })).rejects.toMatchObject({
      message: 'errors.sdStabilityCredits'
    })
  })

  it('probe Stability with key is available', async () => {
    const p = new StableDiffusionImageProvider({
      baseUrl: 'https://api.stability.ai',
      apiKey: 'sk-live'
    })
    const s = await p.probe()
    expect(s.available).toBe(true)
    expect(s.message).toContain('Stability')
  })

  it('listCheckpoints falls back to Comfy /models/checkpoints', async () => {
    const fetchImpl = vi.fn(async (input: string | URL) => {
      const url = String(input)
      if (url.includes('/sd-models')) return new Response('no', { status: 500 })
      if (url.includes('/models/checkpoints')) {
        return new Response(JSON.stringify(['b.safetensors']), { status: 200 })
      }
      return new Response('no', { status: 404 })
    }) as unknown as typeof fetch
    const p = new StableDiffusionImageProvider({
      baseUrl: 'http://127.0.0.1:8188',
      fetchImpl
    })
    expect(await p.listCheckpoints()).toEqual(['b.safetensors'])
  })

  it('ComfyUI edit uploads then queues img2img graph', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-sdi-'))
    const img = join(dir, 'base.png')
    writeFileSync(img, PNG)
    const fetchImpl = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/system_stats')) return new Response('{}', { status: 200 })
      if (url.includes('/upload/image')) {
        return new Response(JSON.stringify({ name: 'base.png' }), { status: 200 })
      }
      if (url.endsWith('/prompt')) {
        return new Response(JSON.stringify({ prompt_id: 'e1' }), { status: 200 })
      }
      if (url.includes('/history/e1')) {
        return new Response(
          JSON.stringify({
            e1: { outputs: { '9': { images: [{ filename: 'o.png' }] } } }
          }),
          { status: 200 }
        )
      }
      if (url.includes('/view')) return new Response(PNG, { status: 200 })
      return new Response('no', { status: 404 })
    }) as unknown as typeof fetch
    const p = new StableDiffusionImageProvider({
      baseUrl: 'http://127.0.0.1:8188',
      fetchImpl
    })
    const r = await p.edit({ prompt: 'red', imagePath: img, size: '1024x1024' })
    expect(r.b64).toBeTruthy()
  })

  it('Stability response without image fails', async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(JSON.stringify({}), { status: 200 })
    }) as unknown as typeof fetch
    const p = new StableDiffusionImageProvider({
      baseUrl: 'https://api.stability.ai',
      apiKey: 'sk',
      fetchImpl
    })
    await expect(p.generate({ prompt: 'x', size: '1024x1024' })).rejects.toMatchObject({
      code: 'AI_FAILED'
    })
  })

  it('WebUI HTTP 500 maps via mapChatHttpStatus', async () => {
    const fetchImpl = vi.fn(async (input: string | URL) => {
      if (String(input).includes('/system_stats')) return new Response('no', { status: 404 })
      return new Response('boom', { status: 500 })
    }) as unknown as typeof fetch
    const p = new StableDiffusionImageProvider({
      baseUrl: 'http://127.0.0.1:7860',
      fetchImpl
    })
    await expect(p.generate({ prompt: 'x', size: '1024x1024' })).rejects.toBeTruthy()
  })

  it('probe reports HTTP status when sd-models is not ok', async () => {
    const fetchImpl = vi.fn(async (input: string | URL) => {
      const url = String(input)
      if (url.includes('/system_stats')) return new Response('no', { status: 404 })
      return new Response('denied', { status: 401 })
    }) as unknown as typeof fetch
    const p = new StableDiffusionImageProvider({
      baseUrl: 'http://127.0.0.1:7860',
      fetchImpl
    })
    const s = await p.probe()
    expect(s.available).toBe(false)
    expect(s.message).toContain('401')
  })

  it('probe catch on network error', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('offline')
    }) as unknown as typeof fetch
    const p = new StableDiffusionImageProvider({
      baseUrl: 'http://127.0.0.1:7860',
      fetchImpl
    })
    expect((await p.probe()).message).toContain('offline')
  })

  it('listCheckpoints empty when both endpoints fail', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('x')
    }) as unknown as typeof fetch
    const p = new StableDiffusionImageProvider({
      baseUrl: 'http://127.0.0.1:7860',
      fetchImpl
    })
    expect(await p.listCheckpoints()).toEqual([])
  })

  it('Stability edit uses image-to-image', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-sdi-'))
    const img = join(dir, 'b.png')
    writeFileSync(img, PNG)
    const fetchImpl = vi.fn(async () => {
      return new Response(JSON.stringify({ image: PNG.toString('base64') }), {
        status: 200
      })
    }) as unknown as typeof fetch
    const p = new StableDiffusionImageProvider({
      baseUrl: 'https://api.stability.ai',
      apiKey: 'sk',
      fetchImpl
    })
    const r = await p.edit({ prompt: 'blue', imagePath: img, size: '1024x1792' })
    expect(r.aspectUsed).toBe('9:16')
  })

  it('WebUI fetch timeout maps to imageTimedOut', async () => {
    const err = Object.assign(new Error('aborted'), { name: 'TimeoutError' })
    const fetchImpl = vi.fn(async (input: string | URL) => {
      if (String(input).includes('/system_stats')) return new Response('no', { status: 404 })
      throw err
    }) as unknown as typeof fetch
    const p = new StableDiffusionImageProvider({
      baseUrl: 'http://127.0.0.1:7860',
      fetchImpl
    })
    await expect(p.generate({ prompt: 'x', size: '1024x1024' })).rejects.toMatchObject({
      code: 'AI_TIMEOUT'
    })
  })

  it('Stability generate without key throws unauthorized', async () => {
    const p = new StableDiffusionImageProvider({
      baseUrl: 'https://api.stability.ai',
      apiKey: ''
    })
    await expect(p.generate({ prompt: 'x', size: '1024x1024' })).rejects.toMatchObject({
      code: 'AI_UNAUTHORIZED'
    })
  })

  it('WebUI fetch generic error bubbles', async () => {
    const fetchImpl = vi.fn(async (input: string | URL) => {
      if (String(input).includes('/system_stats')) return new Response('no', { status: 404 })
      throw new Error('boom')
    }) as unknown as typeof fetch
    const p = new StableDiffusionImageProvider({
      baseUrl: 'http://127.0.0.1:7860',
      fetchImpl
    })
    await expect(p.generate({ prompt: 'x', size: '1024x1024' })).rejects.toThrow('boom')
  })

  it('img2img with checkpoint override', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-sdi-'))
    const img = join(dir, 'c.png')
    writeFileSync(img, PNG)
    const fetchImpl = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/system_stats')) return new Response('no', { status: 404 })
      const body = JSON.parse(String(init?.body)) as {
        override_settings?: { sd_model_checkpoint?: string }
      }
      expect(body.override_settings?.sd_model_checkpoint).toBe('ckpt.safetensors')
      return new Response(JSON.stringify({ images: [PNG.toString('base64')] }), {
        status: 200
      })
    }) as unknown as typeof fetch
    const p = new StableDiffusionImageProvider({
      baseUrl: 'http://127.0.0.1:7860',
      model: 'ckpt.safetensors',
      fetchImpl
    })
    await p.edit({ prompt: 'x', imagePath: img, size: '1024x1024' })
  })

  it('probe non-Error throw uses Unreachable message', async () => {
    const fetchImpl = vi.fn(async () => {
      throw 'offline'
    }) as unknown as typeof fetch
    const p = new StableDiffusionImageProvider({
      baseUrl: 'http://127.0.0.1:7860',
      fetchImpl
    })
    expect((await p.probe()).message).toContain('Unreachable')
  })
})
