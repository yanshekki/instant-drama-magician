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
})
