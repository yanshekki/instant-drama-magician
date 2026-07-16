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
})
