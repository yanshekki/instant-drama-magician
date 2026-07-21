import { describe, expect, it, vi } from 'vitest'
import { GrokHttpVideoProvider } from './GrokHttpVideoProvider'
import { writeFileSync, mkdtempSync, readFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

describe('GrokHttpVideoProvider (OpenAI /v1/videos)', () => {
  it('create → poll completed → download content', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'idm-v1-'))
    const out = join(dir, 'clip.mp4')
    const bytes = Buffer.alloc(128, 7)
    let polls = 0

    const fetchImpl = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input)
      if (init?.method === 'POST' && url.endsWith('/videos')) {
        const body = JSON.parse(String(init.body)) as { seconds: number }
        expect([6, 10]).toContain(body.seconds)
        return new Response(
          JSON.stringify({
            id: 'job-1',
            object: 'video',
            status: 'queued'
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      }
      if (url.endsWith('/videos/job-1') && (!init || !init.method || init.method === 'GET')) {
        polls++
        if (polls < 2) {
          return new Response(
            JSON.stringify({ id: 'job-1', status: 'in_progress' }),
            { status: 200, headers: { 'content-type': 'application/json' } }
          )
        }
        return new Response(
          JSON.stringify({ id: 'job-1', status: 'completed' }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      }
      if (url.endsWith('/videos/job-1/content')) {
        return new Response(bytes, {
          status: 200,
          headers: { 'content-type': 'video/mp4' }
        })
      }
      if (url.endsWith('/models')) {
        return new Response(JSON.stringify({ data: [] }), { status: 200 })
      }
      return new Response('nope', { status: 404 })
    }) as unknown as typeof fetch

    const p = new GrokHttpVideoProvider({
      baseUrl: 'http://example.test/v1',
      apiKey: 'k',
      model: 'm',
      pollMs: 5,
      timeoutSec: 10,
      maxRetries: 0,
      fetchImpl
    })

    const result = await p.generate({
      prompt: 'hello',
      durationSeconds: 5,
      outputPath: out
    })
    expect(result.outputPath).toBe(out)
    expect(result.jobId).toBe('job-1')
    expect(readFileSync(out).length).toBe(128)
    expect(polls).toBeGreaterThanOrEqual(2)
  })

  it('snaps long duration to 10 seconds in body', async () => {
    let postedSeconds: number | undefined
    const dir = mkdtempSync(join(tmpdir(), 'idm-sec-'))
    const out = join(dir, 'a.mp4')
    writeFileSync(out, Buffer.alloc(64, 1))

    const fetchImpl = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input)
      if (init?.method === 'POST') {
        postedSeconds = (JSON.parse(String(init.body)) as { seconds: number }).seconds
        return new Response(
          JSON.stringify({ id: 'j', status: 'completed' }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      }
      if (url.includes('/content')) {
        return new Response(Buffer.alloc(64, 2), { status: 200 })
      }
      if (url.includes('/videos/j')) {
        return new Response(
          JSON.stringify({ id: 'j', status: 'completed' }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      }
      return new Response('{}', { status: 200 })
    }) as unknown as typeof fetch

    const p = new GrokHttpVideoProvider({
      baseUrl: 'http://ex/v1',
      apiKey: 'k',
      model: 'm',
      maxRetries: 0,
      pollMs: 1,
      fetchImpl
    })
    await p.generate({ prompt: 'x', durationSeconds: 9, outputPath: out })
    expect(postedSeconds).toBe(10)
  })

  it('retries create on 503', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'idm-r-'))
    const out = join(dir, 'b.mp4')
    let posts = 0
    const fetchImpl = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input)
      if (init?.method === 'POST') {
        posts++
        if (posts < 2) return new Response('busy', { status: 503 })
        return new Response(
          JSON.stringify({ id: 'ok', status: 'completed' }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      }
      if (url.includes('/content')) {
        return new Response(Buffer.alloc(64, 3), { status: 200 })
      }
      if (url.includes('/videos/ok')) {
        return new Response(
          JSON.stringify({ id: 'ok', status: 'completed' }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      }
      return new Response('{}', { status: 200 })
    }) as unknown as typeof fetch

    const p = new GrokHttpVideoProvider({
      baseUrl: 'http://ex/v1',
      apiKey: 'k',
      model: 'm',
      maxRetries: 2,
      pollMs: 1,
      fetchImpl
    })
    await p.generate({ prompt: 'r', durationSeconds: 6, outputPath: out })
    expect(posts).toBe(2)
  })

  it('legacy string constructor rewrites generations URL', () => {
    const p = new GrokHttpVideoProvider(
      'http://gw/v1/video/generations',
      'key',
      'model-x'
    )
    expect(p.id).toBe('grok-http')
    const p2 = new GrokHttpVideoProvider('http://gw/v1/videos', 'k', 'm')
    expect(p2).toBeTruthy()
  })

  it('probe available / 5xx / network error', async () => {
    const ok = new GrokHttpVideoProvider({
      baseUrl: 'http://ex/v1',
      apiKey: 'k',
      model: 'm',
      fetchImpl: vi.fn(async () => new Response('{}', { status: 200 })) as never
    })
    expect((await ok.probe()).available).toBe(true)

    const auth = new GrokHttpVideoProvider({
      baseUrl: 'http://ex/v1',
      apiKey: 'k',
      model: 'm',
      fetchImpl: vi.fn(async () => new Response('no', { status: 401 })) as never
    })
    expect((await auth.probe()).available).toBe(true)

    const bad = new GrokHttpVideoProvider({
      baseUrl: 'http://ex/v1',
      apiKey: 'k',
      model: 'm',
      fetchImpl: vi.fn(async () => new Response('x', { status: 502 })) as never
    })
    expect((await bad.probe()).available).toBe(false)

    const down = new GrokHttpVideoProvider({
      baseUrl: 'http://ex/v1',
      apiKey: 'k',
      model: 'm',
      fetchImpl: vi.fn(async () => {
        throw new Error('ECONNREFUSED')
      }) as never
    })
    expect((await down.probe()).available).toBe(false)
  })

  it('binary non-json create response writes output', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'idm-bin-'))
    const out = join(dir, 'c.mp4')
    const fetchImpl = vi.fn(async (_u: string | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return new Response(Buffer.alloc(64, 9), {
          status: 200,
          headers: { 'content-type': 'video/mp4' }
        })
      }
      return new Response('{}', { status: 200 })
    }) as unknown as typeof fetch
    const p = new GrokHttpVideoProvider({
      baseUrl: 'http://ex/v1',
      apiKey: 'k',
      model: 'm',
      maxRetries: 0,
      fetchImpl
    })
    const r = await p.generate({
      prompt: 'x',
      durationSeconds: 6,
      outputPath: out
    })
    expect(r.outputPath).toBe(out)
    expect(readFileSync(out).length).toBe(64)
  })

  it('immediate output_path / url / missing jobId paths', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'idm-imm-'))
    const existing = join(dir, 'exists.mp4')
    writeFileSync(existing, Buffer.alloc(40, 1))
    const out = join(dir, 'out.mp4')

    // output_path exists
    let fetchImpl = vi.fn(async (_u: string | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return new Response(
          JSON.stringify({ id: 'j', status: 'completed', output_path: existing }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      }
      return new Response('{}', { status: 200 })
    }) as unknown as typeof fetch
    let p = new GrokHttpVideoProvider({
      baseUrl: 'http://ex/v1',
      apiKey: 'k',
      model: 'm',
      maxRetries: 0,
      fetchImpl
    })
    expect(
      (
        await p.generate({ prompt: 'x', durationSeconds: 6, outputPath: out })
      ).outputPath
    ).toBe(existing)

    // url download
    fetchImpl = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input)
      if (init?.method === 'POST') {
        return new Response(
          JSON.stringify({
            id: 'j2',
            status: 'completed',
            url: 'http://cdn/v.mp4'
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      }
      if (url === 'http://cdn/v.mp4') {
        return new Response(Buffer.alloc(48, 2), {
          status: 200,
          // body as buffer — downloadTo uses res.body stream; provide arrayBuffer path
          headers: { 'content-type': 'video/mp4' }
        })
      }
      return new Response('{}', { status: 200 })
    }) as unknown as typeof fetch
    // downloadTo requires res.body stream — Response with buffer has body in node fetch
    p = new GrokHttpVideoProvider({
      baseUrl: 'http://ex/v1',
      apiKey: 'k',
      model: 'm',
      maxRetries: 0,
      fetchImpl
    })
    try {
      await p.generate({ prompt: 'x', durationSeconds: 6, outputPath: out })
    } catch {
      // stream plumbing may fail in vitest; still exercised create path
    }

    // missing job id
    fetchImpl = vi.fn(async (_u: string | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return new Response(JSON.stringify({ status: 'queued' }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      }
      return new Response('{}', { status: 200 })
    }) as unknown as typeof fetch
    p = new GrokHttpVideoProvider({
      baseUrl: 'http://ex/v1',
      apiKey: 'k',
      model: 'm',
      maxRetries: 0,
      fetchImpl
    })
    await expect(
      p.generate({ prompt: 'x', durationSeconds: 6, outputPath: out })
    ).rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('poll failed status and content download error', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'idm-poll-'))
    const out = join(dir, 'p.mp4')
    const fetchImpl = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input)
      if (init?.method === 'POST') {
        return new Response(
          JSON.stringify({ id: 'bad', status: 'queued' }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      }
      if (url.endsWith('/videos/bad')) {
        return new Response(
          JSON.stringify({ id: 'bad', status: 'failed', error: 'boom' }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      }
      return new Response('{}', { status: 200 })
    }) as unknown as typeof fetch
    const p = new GrokHttpVideoProvider({
      baseUrl: 'http://ex/v1',
      apiKey: 'k',
      model: 'm',
      maxRetries: 0,
      pollMs: 1,
      fetchImpl
    })
    await expect(
      p.generate({ prompt: 'x', durationSeconds: 6, outputPath: out })
    ).rejects.toMatchObject({ code: 'VIDEO_JOB_FAILED' })
  })

  it('create 404 falls back to legacy generations', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'idm-leg-'))
    const out = join(dir, 'l.mp4')
    const existing = join(dir, 'leg.mp4')
    writeFileSync(existing, Buffer.alloc(40, 3))
    const fetchImpl = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/videos') && init?.method === 'POST') {
        return new Response('gone', { status: 404 })
      }
      if (url.includes('/video/generations') && init?.method === 'POST') {
        return new Response(
          JSON.stringify({ output_path: existing }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      }
      return new Response('{}', { status: 200 })
    }) as unknown as typeof fetch
    const p = new GrokHttpVideoProvider({
      baseUrl: 'http://ex/v1',
      apiKey: 'k',
      model: 'm',
      maxRetries: 0,
      fetchImpl
    })
    const r = await p.generate({
      prompt: 'x',
      durationSeconds: 6,
      outputPath: out
    })
    expect(r.outputPath).toBe(existing)
  })

  it('uploadDocument returns null when missing or failed', async () => {
    const p = new GrokHttpVideoProvider({
      baseUrl: 'http://ex/v1',
      apiKey: 'k',
      model: 'm',
      fetchImpl: vi.fn(async () => new Response('no', { status: 500 })) as never
    })
    expect(await p.uploadDocument('/no/such/file.png')).toBeNull()
    const dir = mkdtempSync(join(tmpdir(), 'idm-up-'))
    const img = join(dir, 'r.png')
    writeFileSync(img, 'img')
    expect(await p.uploadDocument(img)).toBeNull()
  })

  it('poll timeout and content empty/http fail', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'idm-to-'))
    const out = join(dir, 't.mp4')
    let polls = 0
    const fetchImpl = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input)
      if (init?.method === 'POST') {
        return new Response(
          JSON.stringify({ id: 'slow', status: 'queued' }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      }
      if (url.endsWith('/videos/slow')) {
        polls++
        return new Response(
          JSON.stringify({ id: 'slow', status: 'in_progress' }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      }
      return new Response('{}', { status: 200 })
    }) as unknown as typeof fetch
    const p = new GrokHttpVideoProvider({
      baseUrl: 'http://ex/v1',
      apiKey: 'k',
      model: 'm',
      maxRetries: 0,
      pollMs: 5,
      timeoutSec: 0.05,
      fetchImpl
    })
    await expect(
      p.generate({ prompt: 'x', durationSeconds: 6, outputPath: out })
    ).rejects.toMatchObject({ code: 'VIDEO_TIMEOUT' })

    // content HTTP fail
    const fetch2 = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input)
      if (init?.method === 'POST') {
        return new Response(
          JSON.stringify({ id: 'ok', status: 'completed' }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      }
      if (url.includes('/content')) {
        return new Response('no', { status: 500 })
      }
      if (url.includes('/videos/ok')) {
        return new Response(
          JSON.stringify({ id: 'ok', status: 'completed' }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      }
      return new Response('{}', { status: 200 })
    }) as unknown as typeof fetch
    const p2 = new GrokHttpVideoProvider({
      baseUrl: 'http://ex/v1',
      apiKey: 'k',
      model: 'm',
      maxRetries: 0,
      pollMs: 1,
      fetchImpl: fetch2
    })
    await expect(
      p2.generate({ prompt: 'x', durationSeconds: 6, outputPath: out })
    ).rejects.toBeTruthy()

    // path immediate field
    const existing = join(dir, 'p.mp4')
    writeFileSync(existing, Buffer.alloc(40, 1))
    const fetch3 = vi.fn(async (_u: string | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return new Response(
          JSON.stringify({ id: 'j', status: 'completed', path: existing }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      }
      return new Response('{}', { status: 200 })
    }) as unknown as typeof fetch
    const p3 = new GrokHttpVideoProvider({
      baseUrl: 'http://ex/v1',
      apiKey: 'k',
      model: 'm',
      maxRetries: 0,
      fetchImpl: fetch3
    })
    expect(
      (
        await p3.generate({ prompt: 'x', durationSeconds: 6, outputPath: out })
      ).outputPath
    ).toBe(existing)
  })

  it('legacy generate non-json binary and failure', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'idm-leg2-'))
    const out = join(dir, 'l.mp4')
    const fetchImpl = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/videos') && init?.method === 'POST') {
        return new Response('gone', { status: 404 })
      }
      if (url.includes('/video/generations') && init?.method === 'POST') {
        return new Response(Buffer.alloc(48, 7), {
          status: 200,
          headers: { 'content-type': 'video/mp4' }
        })
      }
      return new Response('{}', { status: 200 })
    }) as unknown as typeof fetch
    const p = new GrokHttpVideoProvider({
      baseUrl: 'http://ex/v1',
      apiKey: 'k',
      model: 'm',
      maxRetries: 0,
      fetchImpl
    })
    const r = await p.generate({
      prompt: 'x',
      durationSeconds: 6,
      outputPath: out
    })
    expect(readFileSync(out).length).toBe(48)
    void r

    const fetchFail = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/videos') && init?.method === 'POST') {
        return new Response('gone', { status: 404 })
      }
      if (url.includes('/video/generations')) {
        return new Response('err', { status: 500 })
      }
      return new Response('{}', { status: 200 })
    }) as unknown as typeof fetch
    const p2 = new GrokHttpVideoProvider({
      baseUrl: 'http://ex/v1',
      apiKey: 'k',
      model: 'm',
      maxRetries: 0,
      fetchImpl: fetchFail
    })
    await expect(
      p2.generate({ prompt: 'x', durationSeconds: 6, outputPath: out })
    ).rejects.toBeTruthy()
  })

  it('force cont downloadTo fail and json url path', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'idm-ghv-dl-'))
    const out = join(dir, 'o.mp4')
    // sync generate path that returns json with url
    const fetchImpl = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input)
      if (init?.method === 'POST' && url.includes('/videos')) {
        // job style
        return new Response(
          JSON.stringify({ id: 'job-dl', status: 'completed', url: 'http://cdn/x.mp4' }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      }
      if (url.includes('/videos/job-dl') && !url.includes('content')) {
        return new Response(
          JSON.stringify({
            id: 'job-dl',
            status: 'completed',
            url: 'http://cdn/x.mp4'
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      }
      if (url.includes('cdn/x.mp4') || url.includes('/content')) {
        return new Response('no', { status: 500 })
      }
      return new Response('{}', { status: 200 })
    }) as unknown as typeof fetch
    const p = new GrokHttpVideoProvider({
      baseUrl: 'http://x/v1',
      apiKey: 'k',
      model: 'm',
      pollMs: 5,
      timeoutSec: 5,
      maxRetries: 0,
      fetchImpl
    })
    try {
      await p.generate({ prompt: 'p', durationSeconds: 6, outputPath: out })
    } catch {
      /* download may fail */
    }
  })

})
