import { describe, expect, it, vi } from 'vitest'
import { GrokHttpVideoProvider } from './GrokHttpVideoProvider'
import { writeFileSync, mkdtempSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

describe('GrokHttpVideoProvider', () => {
  it('resolves direct output_path JSON', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'idm-vid-'))
    const out = join(dir, 'clip.mp4')
    writeFileSync(out, Buffer.alloc(64, 1))

    const fetchImpl = vi.fn(async () => {
      return new Response(JSON.stringify({ output_path: out }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    }) as unknown as typeof fetch

    const p = new GrokHttpVideoProvider({
      videoPath: 'http://example.test/v1/video',
      apiKey: 'k',
      model: 'm',
      maxRetries: 0,
      fetchImpl
    })

    const result = await p.generate({
      prompt: 'test',
      durationSeconds: 2,
      outputPath: join(dir, 'other.mp4')
    })
    expect(result.outputPath).toBe(out)
  })

  it('polls job until succeeded', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'idm-job-'))
    const out = join(dir, 'done.mp4')
    writeFileSync(out, Buffer.alloc(64, 2))

    let polls = 0
    const fetchImpl = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input)
      if (init?.method === 'POST') {
        return new Response(
          JSON.stringify({ job_id: 'j1', status_url: 'http://example.test/jobs/j1' }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      }
      if (url.includes('/jobs/j1')) {
        polls++
        if (polls < 2) {
          return new Response(JSON.stringify({ status: 'running' }), {
            status: 200,
            headers: { 'content-type': 'application/json' }
          })
        }
        return new Response(
          JSON.stringify({ status: 'succeeded', output_path: out }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      }
      return new Response('nope', { status: 404 })
    }) as unknown as typeof fetch

    const p = new GrokHttpVideoProvider({
      videoPath: 'http://example.test/v1/video',
      apiKey: 'k',
      model: 'm',
      pollMs: 10,
      timeoutSec: 5,
      maxRetries: 0,
      fetchImpl
    })

    const result = await p.generate({
      prompt: 'job',
      durationSeconds: 1,
      outputPath: join(dir, 'x.mp4')
    })
    expect(result.outputPath).toBe(out)
    expect(polls).toBeGreaterThanOrEqual(2)
  })

  it('retries on 503', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'idm-retry-'))
    const out = join(dir, 'ok.mp4')
    writeFileSync(out, Buffer.alloc(64, 3))
    let calls = 0
    const fetchImpl = vi.fn(async () => {
      calls++
      if (calls < 2) {
        return new Response('busy', { status: 503 })
      }
      return new Response(JSON.stringify({ output_path: out }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    }) as unknown as typeof fetch

    const p = new GrokHttpVideoProvider({
      videoPath: 'http://example.test/v',
      apiKey: 'k',
      model: 'm',
      maxRetries: 2,
      fetchImpl
    })
    const result = await p.generate({
      prompt: 'r',
      durationSeconds: 1,
      outputPath: join(dir, 'y.mp4')
    })
    expect(result.outputPath).toBe(out)
    expect(calls).toBe(2)
  })
})
