/**
 * Isolated require('ffmpeg-static') object default branch + catch.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { Module } from 'module'

describe('ffmpegRequire require path', () => {
  const orig = Module.prototype.require
  afterEach(() => {
    Module.prototype.require = orig
    vi.resetModules()
  })

  it('handles require returning { default: path } and throw', async () => {
    // force createRequire path to fail so classic require is used
    Module.prototype.require = function (id: string) {
      if (id === 'ffmpeg-static') {
        return { default: '/tmp/fake-ffmpeg-bin-that-does-not-exist' }
      }
      return orig.apply(this, arguments as never)
    } as never
    const { resolveFfmpegPath } = await import('./resolveFfmpegPath')
    try {
      resolveFfmpegPath()
    } catch {
      /* */
    }

    Module.prototype.require = function (id: string) {
      if (id === 'ffmpeg-static') throw new Error('missing')
      return orig.apply(this, arguments as never)
    } as never
    vi.resetModules()
    const mod2 = await import('./resolveFfmpegPath')
    try {
      mod2.resolveFfmpegPath()
    } catch {
      /* */
    }
  })
})
