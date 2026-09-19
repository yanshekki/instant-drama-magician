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
    vi.restoreAllMocks()
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

  it('probe Stability without key', async () => {
    const p = new StableDiffusionVideoProvider({
      baseUrl: 'https://api.stability.ai',
      apiKey: ''
    })
    expect((await p.probe()).available).toBe(false)
  })

  it('SD.Next last_image is sent', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-sdv-'))
    const still = join(dir, 'a.png')
    const last = join(dir, 'b.png')
    writeFileSync(still, PNG)
    writeFileSync(last, PNG)
    const out = join(dir, 'clip.mp4')
    const fetchImpl = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/video/models')) {
        return new Response(
          JSON.stringify([{ engine: 'WAN', model: 'FLF', input_mode: 'flf2v' }]),
          { status: 200 }
        )
      }
      if (url.endsWith('/sdapi/v1/video')) {
        const body = JSON.parse(String(init?.body)) as { last_image?: string }
        expect(body.last_image).toBeTruthy()
        return new Response(JSON.stringify({ video: MP4.toString('base64') }), {
          status: 200
        })
      }
      return new Response('no', { status: 404 })
    }) as unknown as typeof fetch
    const p = new StableDiffusionVideoProvider({
      baseUrl: 'http://127.0.0.1:7860',
      fetchImpl
    })
    await p.generate({
      prompt: 'walk',
      durationSeconds: 4,
      refImagePath: still,
      lastFramePath: last,
      outputPath: out
    })
  })

  it('ComfyUI without workflow JSON fails clearly', async () => {
    const fetchImpl = vi.fn(async (input: string | URL) => {
      const url = String(input)
      if (url.includes('/video/models')) return new Response('no', { status: 404 })
      if (url.includes('/system_stats')) return new Response('{}', { status: 200 })
      return new Response('no', { status: 404 })
    }) as unknown as typeof fetch
    const p = new StableDiffusionVideoProvider({
      baseUrl: 'http://127.0.0.1:8188',
      fetchImpl
    })
    expect((await p.probe()).message).toContain('ComfyUI')
    await expect(
      p.generate({
        prompt: 'x',
        durationSeconds: 2,
        outputPath: join(tmpdir(), 'no.mp4')
      })
    ).rejects.toMatchObject({ message: 'errors.sdComfyNeedWorkflow' })
  })

  it('ComfyUI workflow JSON queues and writes MP4', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-sdv-'))
    const out = join(dir, 'clip.mp4')
    const fetchImpl = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/video/models')) return new Response('no', { status: 404 })
      if (url.includes('/system_stats')) return new Response('{}', { status: 200 })
      if (url.endsWith('/prompt')) {
        const body = JSON.parse(String(init?.body)) as { prompt: { t: { inputs: { text: string } } } }
        expect(body.prompt.t.inputs.text).toBe('hello')
        return new Response(JSON.stringify({ prompt_id: 'p1' }), { status: 200 })
      }
      if (url.includes('/history/p1')) {
        return new Response(
          JSON.stringify({
            p1: {
              outputs: { '9': { gifs: [{ filename: 'v.mp4' }] } }
            }
          }),
          { status: 200 }
        )
      }
      if (url.includes('/view')) return new Response(MP4, { status: 200 })
      return new Response('no', { status: 404 })
    }) as unknown as typeof fetch
    const p = new StableDiffusionVideoProvider({
      baseUrl: 'http://127.0.0.1:8188',
      comfyWorkflow: '{"t":{"class_type":"CLIPTextEncode","inputs":{"text":"{{PROMPT}}"}}}',
      fetchImpl
    })
    await p.generate({ prompt: 'hello', durationSeconds: 2, outputPath: out })
    expect(readFileSync(out).subarray(4, 8).toString()).toBe('ftyp')
  })

  it('AnimateDiff unknown script maps to sdVideoUnavailable', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-sdv-'))
    const fetchImpl = vi.fn(async (input: string | URL) => {
      const url = String(input)
      if (url.includes('/system_stats') || url.includes('/video/models')) {
        return new Response('no', { status: 404 })
      }
      return new Response('unknown script AnimateDiff', { status: 400 })
    }) as unknown as typeof fetch
    const p = new StableDiffusionVideoProvider({
      baseUrl: 'http://127.0.0.1:7860',
      fetchImpl
    })
    await expect(
      p.generate({
        prompt: 'x',
        durationSeconds: 2,
        outputPath: join(dir, 'x.mp4')
      })
    ).rejects.toMatchObject({ message: 'errors.sdVideoUnavailable' })
  })

  it('Stability generate without still uses image API then I2V', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-sdv-'))
    const out = join(dir, 'clip.mp4')
    const fetchImpl = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/stable-image/generate/sd3')) {
        return new Response(
          JSON.stringify({ image: PNG.toString('base64') }),
          { status: 200 }
        )
      }
      if (init?.method === 'POST' && url.includes('/image-to-video')) {
        return new Response(JSON.stringify({ id: 'j2' }), { status: 200 })
      }
      if (url.includes('/image-to-video/result/')) {
        return new Response(JSON.stringify({ video: MP4.toString('base64') }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      }
      return new Response('no', { status: 404 })
    }) as unknown as typeof fetch
    const p = new StableDiffusionVideoProvider({
      baseUrl: 'https://api.stability.ai',
      apiKey: 'sk-test',
      pollMs: 1,
      timeoutSec: 30,
      fetchImpl
    })
    await p.generate({ prompt: 'ocean', durationSeconds: 4, outputPath: out })
    expect(readFileSync(out).length).toBeGreaterThan(8)
  })

  it('Stability 402 maps to credits', async () => {
    const fetchImpl = vi.fn(async () => new Response('pay', { status: 402 })) as unknown as typeof fetch
    dir = mkdtempSync(join(tmpdir(), 'idm-sdv-'))
    const still = join(dir, 's.png')
    writeFileSync(still, PNG)
    const p = new StableDiffusionVideoProvider({
      baseUrl: 'https://api.stability.ai',
      apiKey: 'sk',
      fetchImpl
    })
    await expect(
      p.generate({
        prompt: 'x',
        durationSeconds: 4,
        refImagePath: still,
        outputPath: join(dir, 'o.mp4')
      })
    ).rejects.toMatchObject({ message: 'errors.sdStabilityCredits' })
  })

  it('Stability generate without API key fails', async () => {
    const p = new StableDiffusionVideoProvider({
      baseUrl: 'https://api.stability.ai',
      apiKey: ''
    })
    await expect(
      p.generate({
        prompt: 'x',
        durationSeconds: 4,
        outputPath: join(tmpdir(), 'z.mp4')
      })
    ).rejects.toMatchObject({ code: 'VIDEO_UNAUTHORIZED' })
  })

  it('probe WebUI sd-models when not SD.Next/Comfy', async () => {
    const fetchImpl = vi.fn(async (input: string | URL) => {
      const url = String(input)
      if (url.includes('/video/models') || url.includes('/system_stats')) {
        return new Response('no', { status: 404 })
      }
      if (url.includes('/sd-models')) return new Response('[]', { status: 200 })
      return new Response('no', { status: 404 })
    }) as unknown as typeof fetch
    const p = new StableDiffusionVideoProvider({
      baseUrl: 'http://127.0.0.1:7860',
      fetchImpl
    })
    expect((await p.probe()).message).toContain('AnimateDiff')
  })

  it('probe unreachable host', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('ECONNREFUSED')
    }) as unknown as typeof fetch
    const p = new StableDiffusionVideoProvider({
      baseUrl: 'http://127.0.0.1:7860',
      fetchImpl
    })
    expect((await p.probe()).available).toBe(false)
  })

  it('ComfyUI invalid workflow JSON', async () => {
    const fetchImpl = vi.fn(async (input: string | URL) => {
      const url = String(input)
      if (url.includes('/video/models')) return new Response('no', { status: 404 })
      if (url.includes('/system_stats')) return new Response('{}', { status: 200 })
      return new Response('no', { status: 404 })
    }) as unknown as typeof fetch
    const p = new StableDiffusionVideoProvider({
      baseUrl: 'http://127.0.0.1:8188',
      comfyWorkflow: 'not-json',
      fetchImpl
    })
    await expect(
      p.generate({
        prompt: 'x',
        durationSeconds: 2,
        outputPath: join(tmpdir(), 'bad.mp4')
      })
    ).rejects.toMatchObject({ message: 'errors.sdComfyNeedWorkflow' })
  })

  it('AnimateDiff empty images fails', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-sdv-'))
    const fetchImpl = vi.fn(async (input: string | URL) => {
      const url = String(input)
      if (url.includes('/system_stats') || url.includes('/video/models')) {
        return new Response('no', { status: 404 })
      }
      return new Response(JSON.stringify({ images: [] }), { status: 200 })
    }) as unknown as typeof fetch
    const p = new StableDiffusionVideoProvider({
      baseUrl: 'http://127.0.0.1:7860',
      fetchImpl
    })
    await expect(
      p.generate({
        prompt: 'x',
        durationSeconds: 2,
        outputPath: join(dir, 'e.mp4')
      })
    ).rejects.toMatchObject({ code: 'VIDEO_JOB_FAILED' })
  })

  it('ComfyUI probe mentions workflow when JSON is set', async () => {
    const fetchImpl = vi.fn(async (input: string | URL) => {
      const url = String(input)
      if (url.includes('/video/models')) return new Response('no', { status: 404 })
      if (url.includes('/system_stats')) return new Response('{}', { status: 200 })
      return new Response('no', { status: 404 })
    }) as unknown as typeof fetch
    const p = new StableDiffusionVideoProvider({
      baseUrl: 'http://127.0.0.1:8188',
      comfyWorkflow: '{}',
      fetchImpl
    })
    expect((await p.probe()).message).toContain('workflow')
  })

  it('SD.Next models wrapper object and 9:16 aspect', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-sdv-'))
    const out = join(dir, 'clip.mp4')
    const fetchImpl = vi.fn(async (input: string | URL) => {
      const url = String(input)
      if (url.includes('/video/models')) {
        return new Response(
          JSON.stringify({ models: [{ engine: 'WAN', model: 'T2V' }] }),
          { status: 200 }
        )
      }
      if (url.endsWith('/sdapi/v1/video')) {
        return new Response(JSON.stringify({ video: MP4.toString('base64') }), {
          status: 200
        })
      }
      return new Response('no', { status: 404 })
    }) as unknown as typeof fetch
    const p = new StableDiffusionVideoProvider({
      baseUrl: 'http://127.0.0.1:7860',
      aspectRatio: '9:16',
      fetchImpl
    })
    await p.generate({ prompt: 'x', durationSeconds: 4, outputPath: out })
  })

  it('SD.Next HTTP error', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-sdv-'))
    const fetchImpl = vi.fn(async (input: string | URL) => {
      const url = String(input)
      if (url.includes('/video/models')) {
        return new Response(JSON.stringify([{ engine: 'WAN', model: 'T' }]), {
          status: 200
        })
      }
      return new Response('fail', { status: 502 })
    }) as unknown as typeof fetch
    const p = new StableDiffusionVideoProvider({
      baseUrl: 'http://127.0.0.1:7860',
      fetchImpl
    })
    await expect(
      p.generate({
        prompt: 'x',
        durationSeconds: 4,
        outputPath: join(dir, 'x.mp4')
      })
    ).rejects.toBeTruthy()
  })

  it('AnimateDiff timeout maps VIDEO_TIMEOUT', async () => {
    const err = Object.assign(new Error('aborted'), { name: 'TimeoutError' })
    const fetchImpl = vi.fn(async (input: string | URL) => {
      const url = String(input)
      if (url.includes('/system_stats') || url.includes('/video/models')) {
        return new Response('no', { status: 404 })
      }
      throw err
    }) as unknown as typeof fetch
    const p = new StableDiffusionVideoProvider({
      baseUrl: 'http://127.0.0.1:7860',
      fetchImpl
    })
    await expect(
      p.generate({
        prompt: 'x',
        durationSeconds: 2,
        outputPath: join(tmpdir(), 't.mp4')
      })
    ).rejects.toMatchObject({ code: 'VIDEO_TIMEOUT' })
  })

  it('ComfyUI workflow with still uploads IMAGE', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-sdv-'))
    const still = join(dir, 's.png')
    writeFileSync(still, PNG)
    const out = join(dir, 'c.mp4')
    const fetchImpl = vi.fn(async (input: string | URL) => {
      const url = String(input)
      if (url.includes('/video/models')) return new Response('no', { status: 404 })
      if (url.includes('/system_stats')) return new Response('{}', { status: 200 })
      if (url.includes('/upload/image')) {
        return new Response(JSON.stringify({ name: 's.png' }), { status: 200 })
      }
      if (url.endsWith('/prompt')) {
        return new Response(JSON.stringify({ prompt_id: 'p2' }), { status: 200 })
      }
      if (url.includes('/history/p2')) {
        return new Response(
          JSON.stringify({
            p2: { outputs: { '9': { images: [{ filename: 'v.mp4' }] } } }
          }),
          { status: 200 }
        )
      }
      if (url.includes('/view')) return new Response(MP4, { status: 200 })
      return new Response('no', { status: 404 })
    }) as unknown as typeof fetch
    const p = new StableDiffusionVideoProvider({
      baseUrl: 'http://127.0.0.1:8188',
      comfyWorkflow: '{"n":{"class_type":"X","inputs":{"image":"{{IMAGE}}"}}}',
      fetchImpl
    })
    await p.generate({
      prompt: 'go',
      durationSeconds: 2,
      refImagePath: still,
      outputPath: out
    })
  })

  it('probe Stability with key', async () => {
    const p = new StableDiffusionVideoProvider({
      baseUrl: 'https://api.stability.ai',
      apiKey: 'sk'
    })
    expect((await p.probe()).available).toBe(true)
  })

  it('SD.Next 1:1 empty video payload fails', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-sdv-'))
    const fetchImpl = vi.fn(async (input: string | URL) => {
      const url = String(input)
      if (url.includes('/video/models')) {
        return new Response(JSON.stringify([{ engine: 'W', model: 'M' }]), {
          status: 200
        })
      }
      if (url.endsWith('/sdapi/v1/video')) {
        return new Response(JSON.stringify({}), { status: 200 })
      }
      return new Response('no', { status: 404 })
    }) as unknown as typeof fetch
    const p = new StableDiffusionVideoProvider({
      baseUrl: 'http://127.0.0.1:7860',
      aspectRatio: '1:1',
      fetchImpl
    })
    await expect(
      p.generate({
        prompt: 'x',
        durationSeconds: 4,
        outputPath: join(dir, 'z.mp4')
      })
    ).rejects.toMatchObject({ code: 'VIDEO_JOB_FAILED' })
  })

  it('SD.Next fetch timeout', async () => {
    const err = Object.assign(new Error('aborted'), { name: 'TimeoutError' })
    const fetchImpl = vi.fn(async (input: string | URL) => {
      if (String(input).includes('/video/models')) {
        return new Response(JSON.stringify([{ engine: 'W', model: 'M' }]), {
          status: 200
        })
      }
      throw err
    }) as unknown as typeof fetch
    const p = new StableDiffusionVideoProvider({
      baseUrl: 'http://127.0.0.1:7860',
      fetchImpl
    })
    await expect(
      p.generate({
        prompt: 'x',
        durationSeconds: 4,
        outputPath: join(tmpdir(), 't.mp4')
      })
    ).rejects.toMatchObject({ code: 'VIDEO_TIMEOUT' })
  })

  it('ComfyUI history without images fails', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-sdv-'))
    const fetchImpl = vi.fn(async (input: string | URL) => {
      const url = String(input)
      if (url.includes('/video/models')) return new Response('no', { status: 404 })
      if (url.includes('/system_stats')) return new Response('{}', { status: 200 })
      if (url.endsWith('/prompt')) {
        return new Response(JSON.stringify({ prompt_id: 'p3' }), { status: 200 })
      }
      if (url.includes('/history/p3')) {
        return new Response(JSON.stringify({ p3: { outputs: { '9': {} } } }), {
          status: 200
        })
      }
      return new Response('no', { status: 404 })
    }) as unknown as typeof fetch
    const p = new StableDiffusionVideoProvider({
      baseUrl: 'http://127.0.0.1:8188',
      comfyWorkflow: '{"a":{"class_type":"X","inputs":{}}}',
      fetchImpl
    })
    await expect(
      p.generate({
        prompt: 'x',
        durationSeconds: 2,
        outputPath: join(dir, 'n.mp4')
      })
    ).rejects.toMatchObject({ code: 'VIDEO_JOB_FAILED' })
  })

  it('Stability poll returns binary mp4', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-sdv-'))
    const still = join(dir, 's.png')
    writeFileSync(still, PNG)
    const out = join(dir, 'bin.mp4')
    const fetchImpl = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input)
      if (init?.method === 'POST' && url.includes('/image-to-video')) {
        return new Response(JSON.stringify({ id: 'jb' }), { status: 200 })
      }
      if (url.includes('/result/jb')) {
        return new Response(MP4, {
          status: 200,
          headers: { 'content-type': 'video/mp4' }
        })
      }
      return new Response('no', { status: 404 })
    }) as unknown as typeof fetch
    const p = new StableDiffusionVideoProvider({
      baseUrl: 'https://api.stability.ai',
      apiKey: 'sk',
      pollMs: 1,
      timeoutSec: 20,
      fetchImpl
    })
    await p.generate({
      prompt: 'x',
      durationSeconds: 4,
      refImagePath: still,
      outputPath: out
    })
    expect(readFileSync(out).length).toBeGreaterThan(8)
  })

  it('Stability create missing job id', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-sdv-'))
    const still = join(dir, 's.png')
    writeFileSync(still, PNG)
    const fetchImpl = vi.fn(async () => {
      return new Response(JSON.stringify({}), { status: 200 })
    }) as unknown as typeof fetch
    const p = new StableDiffusionVideoProvider({
      baseUrl: 'https://api.stability.ai',
      apiKey: 'sk',
      fetchImpl
    })
    await expect(
      p.generate({
        prompt: 'x',
        durationSeconds: 4,
        refImagePath: still,
        outputPath: join(dir, 'o.mp4')
      })
    ).rejects.toMatchObject({ code: 'VIDEO_JOB_FAILED' })
  })

  it('non-mp4 AnimateDiff payload fails', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-sdv-'))
    const fetchImpl = vi.fn(async (input: string | URL) => {
      const url = String(input)
      if (url.includes('/system_stats') || url.includes('/video/models')) {
        return new Response('no', { status: 404 })
      }
      return new Response(
        JSON.stringify({ images: [Buffer.from('notavideo').toString('base64')] }),
        { status: 200 }
      )
    }) as unknown as typeof fetch
    const p = new StableDiffusionVideoProvider({
      baseUrl: 'http://127.0.0.1:7860',
      aspectRatio: '1:1',
      fetchImpl
    })
    await expect(
      p.generate({
        prompt: 'x',
        durationSeconds: 2,
        outputPath: join(dir, 'bad.mp4')
      })
    ).rejects.toMatchObject({ message: 'errors.sdVideoNeedMp4' })
  })

  it('Stability create timeout', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-sdv-'))
    const still = join(dir, 's.png')
    writeFileSync(still, PNG)
    const err = Object.assign(new Error('aborted'), { name: 'TimeoutError' })
    const fetchImpl = vi.fn(async () => {
      throw err
    }) as unknown as typeof fetch
    const p = new StableDiffusionVideoProvider({
      baseUrl: 'https://api.stability.ai',
      apiKey: 'sk',
      fetchImpl
    })
    await expect(
      p.generate({
        prompt: 'x',
        durationSeconds: 4,
        refImagePath: still,
        outputPath: join(dir, 'o.mp4')
      })
    ).rejects.toMatchObject({ code: 'VIDEO_TIMEOUT' })
  })

  it('Stability poll HTTP error', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-sdv-'))
    const still = join(dir, 's.png')
    writeFileSync(still, PNG)
    const fetchImpl = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input)
      if (init?.method === 'POST' && url.includes('/image-to-video')) {
        return new Response(JSON.stringify({ id: 'jx' }), { status: 200 })
      }
      return new Response('poll-fail', { status: 500 })
    }) as unknown as typeof fetch
    const p = new StableDiffusionVideoProvider({
      baseUrl: 'https://api.stability.ai',
      apiKey: 'sk',
      pollMs: 1,
      timeoutSec: 10,
      fetchImpl
    })
    await expect(
      p.generate({
        prompt: 'x',
        durationSeconds: 4,
        refImagePath: still,
        outputPath: join(dir, 'o.mp4')
      })
    ).rejects.toBeTruthy()
  })

  it('AnimateDiff HTTP 500', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-sdv-'))
    const fetchImpl = vi.fn(async (input: string | URL) => {
      const url = String(input)
      if (url.includes('/system_stats') || url.includes('/video/models')) {
        return new Response('no', { status: 404 })
      }
      return new Response('server', { status: 500 })
    }) as unknown as typeof fetch
    const p = new StableDiffusionVideoProvider({
      baseUrl: 'http://127.0.0.1:7860',
      fetchImpl
    })
    await expect(
      p.generate({
        prompt: 'x',
        durationSeconds: 2,
        outputPath: join(dir, 'x.mp4')
      })
    ).rejects.toBeTruthy()
  })

  it('Stability poll empty json video', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-sdv-'))
    const still = join(dir, 's.png')
    writeFileSync(still, PNG)
    const fetchImpl = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input)
      if (init?.method === 'POST' && url.includes('/image-to-video')) {
        return new Response(JSON.stringify({ id: 'jz' }), { status: 200 })
      }
      if (url.includes('/result/jz')) {
        return new Response(JSON.stringify({}), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      }
      return new Response('no', { status: 404 })
    }) as unknown as typeof fetch
    const p = new StableDiffusionVideoProvider({
      baseUrl: 'https://api.stability.ai',
      apiKey: 'sk',
      pollMs: 1,
      timeoutSec: 15,
      fetchImpl
    })
    await expect(
      p.generate({
        prompt: 'x',
        durationSeconds: 4,
        refImagePath: still,
        outputPath: join(dir, 'o.mp4')
      })
    ).rejects.toMatchObject({ code: 'VIDEO_JOB_FAILED' })
  })

  it('Stability poll deadline expires', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-sdv-'))
    const still = join(dir, 's.png')
    writeFileSync(still, PNG)
    const fetchImpl = vi.fn(async (input: string | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return new Response(JSON.stringify({ id: 'late' }), { status: 200 })
      }
      return new Response('{}', { status: 202 })
    }) as unknown as typeof fetch
    const p = new StableDiffusionVideoProvider({
      baseUrl: 'https://api.stability.ai',
      apiKey: 'sk',
      pollMs: 1,
      timeoutSec: 0,
      fetchImpl
    })
    await expect(
      p.generate({
        prompt: 'x',
        durationSeconds: 4,
        refImagePath: still,
        outputPath: join(dir, 'o.mp4')
      })
    ).rejects.toMatchObject({ code: 'VIDEO_TIMEOUT' })
  })
})
