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
})
