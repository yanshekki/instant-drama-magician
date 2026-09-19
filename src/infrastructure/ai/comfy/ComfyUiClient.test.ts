import { describe, expect, it, vi } from 'vitest'
import {
  ComfyUiClient,
  defaultImg2ImgGraph,
  defaultTxt2ImgGraph
} from './ComfyUiClient'
import { applyComfyPlaceholders } from '../../../domain/stableDiffusion'

describe('ComfyUiClient', () => {
  it('queues a prompt and reads history image', async () => {
    const fetchImpl = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/system_stats')) {
        return new Response('{}', { status: 200 })
      }
      if (url.endsWith('/prompt') && init?.method === 'POST') {
        return new Response(JSON.stringify({ prompt_id: 'p1' }), { status: 200 })
      }
      if (url.includes('/history/p1')) {
        return new Response(
          JSON.stringify({
            p1: {
              outputs: {
                '9': { images: [{ filename: 'idm.png', subfolder: '', type: 'output' }] }
              }
            }
          }),
          { status: 200 }
        )
      }
      if (url.includes('/view')) {
        return new Response(Buffer.from('PNG'), { status: 200 })
      }
      return new Response('no', { status: 404 })
    }) as unknown as typeof fetch
    const c = ComfyUiClient.from('http://127.0.0.1:8188', '', fetchImpl, 5000)
    expect(await c.isComfy()).toBe(true)
    const id = await c.queue(defaultTxt2ImgGraph({
      ckpt: 'x.safetensors',
      prompt: 'hi',
      negative: 'bad',
      width: 1024,
      height: 1024,
      steps: 20,
      cfg: 7,
      sampler: 'dpmpp_2m'
    }))
    expect(id).toBe('p1')
    const outputs = await c.waitHistory('p1')
    const ref = c.firstImageRef(outputs)
    expect(ref?.filename).toBe('idm.png')
    const buf = await c.downloadView(ref!)
    expect(buf.toString()).toBe('PNG')
  })

  it('isComfy false on network error', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('offline')
    }) as unknown as typeof fetch
    const c = ComfyUiClient.from('http://127.0.0.1:8188', 'sk-x', fetchImpl, 1000)
    expect(await c.isComfy()).toBe(false)
  })

  it('queue errors without prompt_id', async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(JSON.stringify({}), { status: 200 })
    }) as unknown as typeof fetch
    const c = ComfyUiClient.from('http://x', '', fetchImpl, 1000)
    await expect(c.queue({ '1': { class_type: 'X', inputs: {} } })).rejects.toMatchObject({
      code: 'AI_FAILED'
    })
  })

  it('queue timeout', async () => {
    const err = Object.assign(new Error('aborted'), { name: 'TimeoutError' })
    const fetchImpl = vi.fn(async () => {
      throw err
    }) as unknown as typeof fetch
    const c = ComfyUiClient.from('http://x', '', fetchImpl, 1000)
    await expect(c.queue({ '1': { class_type: 'X', inputs: {} } })).rejects.toMatchObject({
      code: 'AI_TIMEOUT'
    })
  })

  it('queue generic network error', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('down')
    }) as unknown as typeof fetch
    const c = ComfyUiClient.from('http://x', '', fetchImpl, 1000)
    await expect(c.queue({ '1': { class_type: 'X', inputs: {} } })).rejects.toThrow('down')
  })

  it('queue HTTP error', async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response('bad graph', { status: 400 })
    }) as unknown as typeof fetch
    const c = ComfyUiClient.from('http://x', '', fetchImpl, 1000)
    await expect(c.queue({ '1': { class_type: 'X', inputs: {} } })).rejects.toMatchObject({
      code: 'AI_FAILED'
    })
  })

  it('firstImageRef reads gifs and downloadView fails', async () => {
    const c = ComfyUiClient.from(
      'http://x',
      '',
      vi.fn(async () => new Response('no', { status: 404 })) as unknown as typeof fetch,
      1000
    )
    expect(
      c.firstImageRef({ n: { gifs: [{ filename: 'a.webp', subfolder: 's', type: 'output' }] } })
        ?.filename
    ).toBe('a.webp')
    expect(c.firstImageRef({ n: {} })).toBeNull()
    await expect(
      c.downloadView({ filename: 'x', subfolder: '', type: 'output' })
    ).rejects.toMatchObject({ code: 'AI_FAILED' })
  })

  it('defaultImg2ImgGraph has LoadImage', () => {
    const g = defaultImg2ImgGraph({
      ckpt: 'c',
      prompt: 'p',
      negative: 'n',
      imageName: 'in.png',
      steps: 10,
      cfg: 7,
      sampler: 'euler',
      denoise: 0.45
    })
    expect(g['10'].class_type).toBe('LoadImage')
    expect(g['11'].class_type).toBe('VAEEncode')
  })

  it('uploadImage posts multipart', async () => {
    const { mkdtempSync, writeFileSync, rmSync } = await import('fs')
    const { join } = await import('path')
    const { tmpdir } = await import('os')
    const dir = mkdtempSync(join(tmpdir(), 'idm-cui-'))
    const img = join(dir, 'a.png')
    writeFileSync(img, 'x')
    const fetchImpl = vi.fn(async (input: string | URL) => {
      expect(String(input)).toContain('/upload/image')
      return new Response(JSON.stringify({ name: 'a.png' }), { status: 200 })
    }) as unknown as typeof fetch
    const c = ComfyUiClient.from('http://127.0.0.1:8188', '', fetchImpl, 5000)
    expect(await c.uploadImage(img)).toBe('a.png')
    rmSync(dir, { recursive: true, force: true })
  })

  it('uploadImage HTTP error', async () => {
    const { mkdtempSync, writeFileSync, rmSync } = await import('fs')
    const { join } = await import('path')
    const { tmpdir } = await import('os')
    const dir = mkdtempSync(join(tmpdir(), 'idm-cui-'))
    const img = join(dir, 'a.png')
    writeFileSync(img, 'x')
    const fetchImpl = vi.fn(async () => new Response('no', { status: 500 })) as unknown as typeof fetch
    const c = ComfyUiClient.from('http://x', '', fetchImpl, 1000)
    await expect(c.uploadImage(img)).rejects.toMatchObject({ code: 'AI_FAILED' })
    rmSync(dir, { recursive: true, force: true })
  })

  it('waitHistory times out', async () => {
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 200 })) as unknown as typeof fetch
    const c = ComfyUiClient.from('http://x', '', fetchImpl, 1)
    await expect(c.waitHistory('never')).rejects.toMatchObject({ code: 'AI_TIMEOUT' })
  })

  it('applyComfyPlaceholders fills slots', () => {
    expect(
      applyComfyPlaceholders('{"t":"{{PROMPT}}","w":{{WIDTH}}}', {
        PROMPT: 'a cat',
        WIDTH: 1024
      })
    ).toBe('{"t":"a cat","w":1024}')
  })
})
