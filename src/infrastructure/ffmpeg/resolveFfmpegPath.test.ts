import { describe, expect, it, afterEach } from 'vitest'
import { resolveFfmpegPath } from './resolveFfmpegPath'

describe('resolveFfmpegPath', () => {
  const prev = process.env.FFMPEG_PATH

  afterEach(() => {
    if (prev === undefined) delete process.env.FFMPEG_PATH
    else process.env.FFMPEG_PATH = prev
  })

  it('prefers FFMPEG_PATH env when set', () => {
    process.env.FFMPEG_PATH = '/custom/ffmpeg'
    const p = resolveFfmpegPath()
    expect(p).toContain('ffmpeg')
  })

  it('returns a string path without env', () => {
    delete process.env.FFMPEG_PATH
    const p = resolveFfmpegPath()
    expect(typeof p).toBe('string')
    expect(p.length).toBeGreaterThan(0)
  })
})
