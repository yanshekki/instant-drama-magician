import { describe, expect, it, vi } from 'vitest'
import { StubVideoProvider } from './StubVideoProvider'

describe('StubVideoProvider', () => {
  it('probe reports available when ffmpeg ready', async () => {
    const ffmpeg = {
      ensureAvailable: vi.fn(async () => undefined),
      makeColorClip: vi.fn(async () => undefined)
    }
    const p = new StubVideoProvider(ffmpeg as never)
    const st = await p.probe()
    expect(st.available).toBe(true)
    expect(st.id).toBe('stub')
    expect(st.message).toMatch(/ready|ffmpeg/i)
  })

  it('probe unavailable when ffmpeg throws', async () => {
    const ffmpeg = {
      ensureAvailable: vi.fn(async () => {
        throw new Error('no ffmpeg')
      }),
      makeColorClip: vi.fn()
    }
    const p = new StubVideoProvider(ffmpeg as never)
    const st = await p.probe()
    expect(st.available).toBe(false)
    expect(st.message).toMatch(/no ffmpeg/)
  })

  it('generate writes color clip via ffmpeg', async () => {
    const ffmpeg = {
      ensureAvailable: vi.fn(),
      makeColorClip: vi.fn(async () => undefined)
    }
    const p = new StubVideoProvider(ffmpeg as never)
    const r = await p.generate({
      prompt: 'hello world clip',
      outputPath: '/tmp/stub.mp4',
      durationSeconds: 4,
      aspectRatio: '16:9'
    } as never)
    expect(r.degraded).toBe(true)
    expect(r.outputPath).toBe('/tmp/stub.mp4')
    expect(ffmpeg.makeColorClip).toHaveBeenCalledWith(
      expect.objectContaining({
        outputPath: '/tmp/stub.mp4',
        durationSeconds: 4,
        label: expect.stringContaining('hello')
      })
    )
  })
})
