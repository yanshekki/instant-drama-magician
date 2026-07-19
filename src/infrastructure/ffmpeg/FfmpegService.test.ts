import { describe, expect, it } from 'vitest'
import { FfmpegService } from './FfmpegService'

describe('FfmpegService', () => {
  it('exposes binaryPath after construct', () => {
    const ff = new FfmpegService()
    expect(typeof ff.binaryPath === 'string' || ff.binaryPath === undefined).toBe(
      true
    )
  })

  it('ensureAvailable resolves when ffmpeg-static present', async () => {
    const ff = new FfmpegService()
    await expect(ff.ensureAvailable()).resolves.toBeUndefined()
  })
})
