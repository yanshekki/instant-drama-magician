import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { StableDiffusionVideoProvider } from './StableDiffusionVideoProvider'

const MP4 = Buffer.concat([
  Buffer.from([0, 0, 0, 0x18]),
  Buffer.from('ftypisom'),
  Buffer.alloc(24, 1)
])
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
)

describe('StableDiffusionVideoProvider', () => {
  let dir: string
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true })
  })

  it('AnimateDiff txt2img enables alwayson_scripts and writes MP4', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-sdv-'))
    const out = join(dir, 'clip.mp4')
    const fetchImpl = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/system_stats') || url.endsWith('/sdapi/v1/video/models')) {
        return new Response('not found', { status: 404 })
      }
      if (url.endsWith('/sdapi/v1/txt2img')) {
        const body = JSON.parse(String(init?.body)) as {
          alwayson_scripts: { AnimateDiff: { args: Array<{ enable: boolean; format: string[] }> } }
        }
        expect(body.alwayson_scripts.AnimateDiff.args[0].enable).toBe(true)
        expect(body.alwayson_scripts.AnimateDiff.args[0].format).toContain('MP4')
        expect((init?.headers as Record<string, string>).Authorization).toBeUndefined()
        return new Response(
          JSON.stringify({ images: [MP4.toString('base64')] }),
          { status: 200 }
        )
      }
      return new Response('no', { status: 404 })
    }) as unknown as typeof fetch
    const p = new StableDiffusionVideoProvider({
      baseUrl: 'http://127.0.0.1:7860',
      fetchImpl
    })
    const r = await p.generate({
      prompt: 'walk',
      durationSeconds: 2,
      outputPath: out
    })
    expect(r.outputPath).toBe(out)
    expect(readFileSync(out).subarray(4, 8).toString()).toBe('ftyp')
  })

  it('img2vid uses img2img + init_images', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-sdv-'))
    const still = join(dir, 'still.png')
    writeFileSync(still, PNG)
    const out = join(dir, 'clip.mp4')
    const fetchImpl = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/system_stats') || url.includes('/video/models')) {
        return new Response('[]', { status: 404 })
      }
      expect(url).toContain('/sdapi/v1/img2img')
      const body = JSON.parse(String(init?.body)) as { init_images: string[] }
      expect(body.init_images.length).toBe(1)
      return new Response(
        JSON.stringify({ images: [MP4.toString('base64')] }),
        { status: 200 }
      )
    }) as unknown as typeof fetch
    const p = new StableDiffusionVideoProvider({
      baseUrl: 'http://127.0.0.1:7860',
      fetchImpl
    })
    await p.generate({
      prompt: 'pan',
      durationSeconds: 2,
      refImagePath: still,
      outputPath: out
    })
  })

  it('prefers SD.Next /sdapi/v1/video when models list is present', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-sdv-'))
    const out = join(dir, 'clip.mp4')
    const fetchImpl = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/sdapi/v1/video/models')) {
        return new Response(
          JSON.stringify([{ engine: 'WAN Video', model: 'WAN T2V', input_mode: 't2v' }]),
          { status: 200 }
        )
      }
      if (url.endsWith('/sdapi/v1/video') && init?.method === 'POST') {
        return new Response(
          JSON.stringify({ video: MP4.toString('base64') }),
          { status: 200 }
        )
      }
      throw new Error(url)
    }) as unknown as typeof fetch
    const p = new StableDiffusionVideoProvider({
      baseUrl: 'http://127.0.0.1:7860',
      fetchImpl
    })
    const st = await p.probe()
    expect(st.message).toContain('SD.Next')
    await p.generate({ prompt: 'cat', durationSeconds: 4, outputPath: out })
    expect(readFileSync(out).length).toBeGreaterThan(8)
  })

  it('Stability I2V posts then polls result', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-sdv-'))
    const still = join(dir, 'still.png')
    writeFileSync(still, PNG)
    const out = join(dir, 'clip.mp4')
    let polls = 0
    const fetchImpl = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input)
      if (init?.method === 'POST' && url.includes('/v2beta/image-to-video')) {
        expect((init.headers as Record<string, string>).Authorization).toBe(
          'Bearer sk-test'
        )
        return new Response(JSON.stringify({ id: 'job-1' }), { status: 200 })
      }
      if (url.includes('/image-to-video/result/job-1')) {
        polls += 1
        if (polls === 1) return new Response('{}', { status: 202 })
        return new Response(JSON.stringify({ video: MP4.toString('base64') }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      }
      throw new Error(url)
    }) as unknown as typeof fetch
    const p = new StableDiffusionVideoProvider({
      baseUrl: 'https://api.stability.ai',
      apiKey: 'sk-test',
      pollMs: 1,
      timeoutSec: 30,
      fetchImpl
    })
    const r = await p.generate({
      prompt: 'wind',
      durationSeconds: 6,
      refImagePath: still,
      outputPath: out
    })
    expect(r.degraded).toBe(true)
    expect(r.jobId).toBe('job-1')
  })
})
