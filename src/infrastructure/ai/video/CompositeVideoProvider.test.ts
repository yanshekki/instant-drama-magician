import { describe, expect, it, vi } from 'vitest'
import { CompositeVideoProvider } from './CompositeVideoProvider'
import { mkdtempSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

describe('CompositeVideoProvider', () => {
  it('constructs and probes (stub path when offline)', async () => {
    const p = new CompositeVideoProvider(
      'auto',
      'http://127.0.0.1:1',
      '',
      'test-model'
    )
    const st = await p.probe()
    expect(st).toHaveProperty('available')
    expect(p.id).toBe('composite')
  }, 15_000)

  it('stub mode uses stub probe and generate', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'idm-comp-'))
    const out = join(dir, 's.mp4')
    const stub = {
      id: 'stub',
      name: 'stub',
      probe: vi.fn(async () => ({
        id: 'stub',
        available: true,
        message: 'ok'
      })),
      generate: vi.fn(async () => ({ outputPath: out, jobId: 'stub-1' }))
    }
    const p = new CompositeVideoProvider(
      'stub',
      'http://x',
      'k',
      'm',
      undefined,
      stub as never
    )
    expect(await p.probe()).toMatchObject({ id: 'stub', available: true })
    const r = await p.generate({
      prompt: 'p',
      durationSeconds: 6,
      outputPath: out
    })
    expect(r.jobId).toBe('stub-1')
    expect(p.lastUsedId).toBe('stub')
  })

  it('http mode delegates to http provider', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'idm-comp-h-'))
    const out = join(dir, 'h.mp4')
    writeFileSync(out, Buffer.alloc(64, 1))
    const fetchImpl = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/models')) {
        return new Response(JSON.stringify({ data: [] }), { status: 200 })
      }
      if (init?.method === 'POST') {
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

    // Construct with custom http via subclassing isn't easy; use auto with mocked probe
    // by injecting via videoPath that works with GrokHttpVideoProvider through Composite
    const p = new CompositeVideoProvider('http', 'http://ex/v1', 'k', 'm', {
      videoPollMs: 1,
      videoTimeoutSec: 5,
      videoMaxRetries: 0,
      videoPath: 'http://ex/v1/videos',
      aspectRatio: '16:9'
    })
    // monkey-patch http fetch
    ;(p.httpProvider as { fetchFn?: typeof fetch }).fetchFn = fetchImpl
    // Actually fetchFn is private - use generate path that will fail offline
    // Instead override generate on httpProvider
    p.httpProvider.generate = vi.fn(async () => ({
      outputPath: out,
      jobId: 'http-1'
    })) as never
    p.httpProvider.probe = vi.fn(async () => ({
      id: 'grok-http',
      available: true,
      message: 'up'
    })) as never

    expect(await p.probe()).toMatchObject({ available: true })
    const r = await p.generate({
      prompt: 'p',
      durationSeconds: 6,
      outputPath: out
    })
    expect(r.jobId).toBe('http-1')
    expect(p.lastUsedId).toBe('grok-http')
  })

  it('auto falls back to stub when http unavailable', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'idm-comp-a-'))
    const out = join(dir, 'a.mp4')
    const stub = {
      id: 'stub',
      name: 'stub',
      probe: vi.fn(async () => ({
        id: 'stub',
        available: true,
        message: 'stub ok'
      })),
      generate: vi.fn(async () => ({ outputPath: out, jobId: 'stub-fb' }))
    }
    const p = new CompositeVideoProvider(
      'auto',
      'http://127.0.0.1:1',
      '',
      'm',
      { videoPollMs: 1, videoTimeoutSec: 1, videoMaxRetries: 0 },
      stub as never
    )
    p.httpProvider.probe = vi.fn(async () => ({
      id: 'grok-http',
      available: false,
      message: 'down'
    })) as never

    const st = await p.probe()
    expect(st.message).toMatch(/auto/)
    const r = await p.generate({
      prompt: 'p',
      durationSeconds: 6,
      outputPath: out
    })
    expect(r.degraded).toBe(true)
    expect(p.lastUsedId).toBe('stub')
    // jobId keeps stub's id when present; fallback prefix only if stub omits it
    expect(r.jobId).toBeTruthy()
  })

  it('auto rethrows when http available but generate fails', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'idm-comp-fail-'))
    const out = join(dir, 'f.mp4')
    const p = new CompositeVideoProvider(
      'auto',
      'http://ex/v1',
      'k',
      'm',
      { videoMaxRetries: 0 },
      {
        id: 'stub',
        probe: async () => ({ id: 'stub', available: true, message: 's' }),
        generate: async () => ({ outputPath: out })
      } as never
    )
    p.httpProvider.probe = vi.fn(async () => ({
      id: 'grok-http',
      available: true,
      message: 'up'
    })) as never
    p.httpProvider.generate = vi.fn(async () => {
      throw new Error('gen fail')
    }) as never

    await expect(
      p.generate({ prompt: 'p', durationSeconds: 6, outputPath: out })
    ).rejects.toThrow(/gen fail/)
  })

  it('auto throws AI_UNAVAILABLE when both http and stub fail', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'idm-comp-both-'))
    const out = join(dir, 'b.mp4')
    const p = new CompositeVideoProvider(
      'auto',
      'http://ex/v1',
      'k',
      'm',
      undefined,
      {
        id: 'stub',
        probe: async () => ({ id: 'stub', available: false, message: 'no' }),
        generate: async () => {
          throw new Error('stub broken')
        }
      } as never
    )
    p.httpProvider.probe = vi.fn(async () => ({
      id: 'grok-http',
      available: false,
      message: 'down'
    })) as never

    await expect(
      p.generate({ prompt: 'p', durationSeconds: 6, outputPath: out })
    ).rejects.toMatchObject({ code: 'AI_UNAVAILABLE' })
  })

  it('exposes lastUsedId and httpProvider', () => {
    const p = new CompositeVideoProvider('stub', 'http://x', 'k', 'm')
    expect(p.httpProvider).toBeTruthy()
    expect(p.lastUsedId).toBe('stub')
  })
})
