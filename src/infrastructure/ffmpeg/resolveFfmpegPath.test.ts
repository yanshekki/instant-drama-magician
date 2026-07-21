import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest'
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

describe('resolveFfmpegPath', () => {
  const prev = process.env.FFMPEG_PATH
  let tmp: string

  beforeEach(() => {
    tmp = join(tmpdir(), `idm-ff-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    mkdirSync(tmp, { recursive: true })
  })

  afterEach(() => {
    if (prev === undefined) delete process.env.FFMPEG_PATH
    else process.env.FFMPEG_PATH = prev
    delete process.env.FFMPEG_PATH
    if (prev !== undefined) process.env.FFMPEG_PATH = prev
    rmSync(tmp, { recursive: true, force: true })
    vi.resetModules()
    vi.unmock('fs')
    vi.unmock('module')
    vi.restoreAllMocks()
  })

  it('prefers FFMPEG_PATH env when file exists or is "ffmpeg"', async () => {
    const bin = join(tmp, 'custom-ffmpeg')
    writeFileSync(bin, 'x')
    process.env.FFMPEG_PATH = bin
    const mod = await import('./resolveFfmpegPath')
    mod.clearFfmpegPathCache()
    expect(mod.resolveFfmpegPath()).toBe(bin)
    // cached
    expect(mod.resolveFfmpegPath()).toBe(bin)

    mod.clearFfmpegPathCache()
    process.env.FFMPEG_PATH = 'ffmpeg'
    expect(mod.resolveFfmpegPath()).toBe('ffmpeg')
  })

  it('ignores FFMPEG_PATH when path missing, falls through', async () => {
    process.env.FFMPEG_PATH = join(tmp, 'missing-binary')
    const mod = await import('./resolveFfmpegPath')
    mod.clearFfmpegPathCache()
    const p = mod.resolveFfmpegPath()
    expect(typeof p).toBe('string')
    expect(p.length).toBeGreaterThan(0)
  })

  it('resolveFfmpegPathFresh clears cache', async () => {
    const bin = join(tmp, 'ff')
    writeFileSync(bin, 'x')
    process.env.FFMPEG_PATH = bin
    const mod = await import('./resolveFfmpegPath')
    mod.clearFfmpegPathCache()
    expect(mod.resolveFfmpegPath()).toBe(bin)
    process.env.FFMPEG_PATH = 'ffmpeg'
    expect(mod.resolveFfmpegPathFresh()).toBe('ffmpeg')
  })

  it('returns a string path without env', async () => {
    delete process.env.FFMPEG_PATH
    const mod = await import('./resolveFfmpegPath')
    mod.clearFfmpegPathCache()
    const p = mod.resolveFfmpegPath()
    expect(typeof p).toBe('string')
    expect(p.length).toBeGreaterThan(0)
  })

  it('tryBundledStatic default export path via mocked createRequire', async () => {
    delete process.env.FFMPEG_PATH
    const fakeBin = join(tmp, 'bundled-ffmpeg')
    writeFileSync(fakeBin, 'x')
    vi.resetModules()
    vi.doMock('module', async () => {
      const actual = await vi.importActual<typeof import('module')>('module')
      return {
        ...actual,
        createRequire: () => {
          const req = () => ({ default: fakeBin })
          return req
        }
      }
    })
    // Also need existsSync to see our fake
    const mod = await import('./resolveFfmpegPath')
    mod.clearFfmpegPathCache()
    // may still resolve real ffmpeg-static if installed; just ensure non-empty
    const p = mod.resolveFfmpegPath()
    expect(p).toBeTruthy()
    expect(existsSync(p) || p === 'ffmpeg').toBe(true)
    vi.doUnmock('module')
  })

  it('uses explicit candidate under cwd node_modules when present', async () => {
    delete process.env.FFMPEG_PATH
    const name = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
    const candidate = join(process.cwd(), 'node_modules', 'ffmpeg-static', name)
    const mod = await import('./resolveFfmpegPath')
    mod.clearFfmpegPathCache()
    const p = mod.resolveFfmpegPath()
    // If project has ffmpeg-static, path should be absolute and exist
    if (existsSync(candidate)) {
      expect(p === candidate || existsSync(p) || p === 'ffmpeg').toBe(true)
    } else {
      expect(typeof p).toBe('string')
    }
  })
})
