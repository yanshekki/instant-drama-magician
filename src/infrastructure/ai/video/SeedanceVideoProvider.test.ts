import { describe, expect, it, vi } from 'vitest'
import { unlinkSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { SeedanceVideoProvider } from './SeedanceVideoProvider'

describe('SeedanceVideoProvider', () => {
  it('probe fails without API key', async () => {
    const p = new SeedanceVideoProvider({
      baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
      apiKey: ''
    })
    const s = await p.probe()
    expect(s.available).toBe(false)
  })

  it('create → poll → download happy path', async () => {
    const out = join(tmpdir(), `seedance-test-${Date.now()}.mp4`)
    const fakeVideo = Buffer.from('fake-mp4-bytes-long-enough-xxxxx')
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url)
      if (u.endsWith('/contents/generations/tasks') && init?.method === 'POST') {
        return new Response(JSON.stringify({ id: 'task-1', status: 'queued' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      if (u.includes('/contents/generations/tasks/task-1')) {
        return new Response(
          JSON.stringify({
            id: 'task-1',
            status: 'succeeded',
            content: { video_url: 'https://cdn.example/v.mp4' }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }
      if (u === 'https://cdn.example/v.mp4') {
        return new Response(fakeVideo, { status: 200 })
      }
      return new Response('not found', { status: 404 })
    })

    const p = new SeedanceVideoProvider({
      baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
      apiKey: 'ark-test',
      model: 'doubao-seedance-1-0-pro',
      pollMs: 10,
      timeoutSec: 5,
      fetchImpl: fetchImpl as unknown as typeof fetch
    })

    const result = await p.generate({
      prompt: 'A cat walks',
      durationSeconds: 6,
      outputPath: out
    })
    expect(result.jobId).toBe('task-1')
    expect(existsSync(out)).toBe(true)
    try {
      unlinkSync(out)
    } catch {
      /* ignore */
    }
  })

  it('generate throws without API key', async () => {
    const p = new SeedanceVideoProvider({
      baseUrl: 'https://ark.example/api/v3',
      apiKey: '   '
    })
    await expect(
      p.generate({
        prompt: 'x',
        durationSeconds: 6,
        outputPath: join(tmpdir(), 'x.mp4')
      })
    ).rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('probe available when key set', async () => {
    const p = new SeedanceVideoProvider({
      baseUrl: 'https://ark.example/api/v3',
      apiKey: 'ark'
    })
    expect((await p.probe()).available).toBe(true)
  })

  it('create error and missing task id', async () => {
    const out = join(tmpdir(), `seed-err-${Date.now()}.mp4`)
    let p = new SeedanceVideoProvider({
      baseUrl: 'https://ark.example/api/v3',
      apiKey: 'ark',
      maxRetries: 0,
      fetchImpl: vi.fn(async () => new Response('nope', { status: 429 })) as never
    })
    await expect(
      p.generate({ prompt: 'x', durationSeconds: 6, outputPath: out })
    ).rejects.toBeTruthy()

    p = new SeedanceVideoProvider({
      baseUrl: 'https://ark.example/api/v3',
      apiKey: 'ark',
      maxRetries: 0,
      fetchImpl: vi.fn(
        async () =>
          new Response(JSON.stringify({ status: 'queued' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
      ) as never
    })
    await expect(
      p.generate({ prompt: 'x', durationSeconds: 6, outputPath: out })
    ).rejects.toMatchObject({ code: 'VIDEO_JOB_FAILED' })
  })

  it('poll failed and no video url', async () => {
    const out = join(tmpdir(), `seed-poll-${Date.now()}.mp4`)
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url)
      if (u.endsWith('/tasks') && init?.method === 'POST') {
        return new Response(JSON.stringify({ id: 't1' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      if (u.includes('/tasks/t1')) {
        return new Response(
          JSON.stringify({
            id: 't1',
            status: 'failed',
            error: { message: 'bad' }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }
      return new Response('x', { status: 404 })
    })
    const p = new SeedanceVideoProvider({
      baseUrl: 'https://ark.example/api/v3',
      apiKey: 'ark',
      pollMs: 5,
      maxRetries: 0,
      fetchImpl: fetchImpl as never
    })
    await expect(
      p.generate({ prompt: 'x', durationSeconds: 6, outputPath: out })
    ).rejects.toMatchObject({ code: 'VIDEO_JOB_FAILED' })
  })

  it('includes ref image data url and downloads data: video', async () => {
    const dir = join(tmpdir(), `seed-ref-${Date.now()}`)
    const { mkdirSync, writeFileSync } = await import('fs')
    mkdirSync(dir, { recursive: true })
    const ref = join(dir, 'r.png')
    writeFileSync(ref, Buffer.from([1, 2, 3, 4]))
    const out = join(dir, 'o.mp4')
    const b64 = Buffer.from('videobytes-long-enough-zzzz').toString('base64')
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url)
      if (init?.method === 'POST') {
        const body = JSON.parse(String(init.body)) as {
          content: Array<{ type: string }>
        }
        expect(body.content.some((c) => c.type === 'image_url')).toBe(true)
        return new Response(JSON.stringify({ id: 't2' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      if (u.includes('/tasks/t2')) {
        return new Response(
          JSON.stringify({
            id: 't2',
            status: 'succeeded',
            content: { video_url: `data:video/mp4;base64,${b64}` }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }
      return new Response('x', { status: 404 })
    })
    const p = new SeedanceVideoProvider({
      baseUrl: 'https://ark.example/api/v3',
      apiKey: 'ark',
      pollMs: 5,
      maxRetries: 0,
      fetchImpl: fetchImpl as never
    })
    const r = await p.generate({
      prompt: 'cat',
      durationSeconds: 6,
      outputPath: out,
      refImagePath: ref
    })
    expect(r.jobId).toBe('t2')
    expect(existsSync(out)).toBe(true)
  })
})
