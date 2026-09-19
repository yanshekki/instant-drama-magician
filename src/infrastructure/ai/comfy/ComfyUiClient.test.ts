import { describe, expect, it, vi } from 'vitest'
import {
  ComfyUiClient,
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

  it('applyComfyPlaceholders fills slots', () => {
    expect(
      applyComfyPlaceholders('{"t":"{{PROMPT}}","w":{{WIDTH}}}', {
        PROMPT: 'a cat',
        WIDTH: 1024
      })
    ).toBe('{"t":"a cat","w":1024}')
  })
})
