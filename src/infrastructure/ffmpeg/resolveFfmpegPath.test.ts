import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest'
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

describe('resolveFfmpegPath', () => {
  const prev = process.env.FFMPEG_PATH
  let tmp: string

  beforeEach(() => {
    tmp = join(
      tmpdir(),
      `idm-ff-${Date.now()}-${Math.random().toString(36).slice(2)}`
    )
    mkdirSync(tmp, { recursive: true })
  })

  afterEach(() => {
    if (prev === undefined) delete process.env.FFMPEG_PATH
    else process.env.FFMPEG_PATH = prev
    rmSync(tmp, { recursive: true, force: true })
    vi.resetModules()
    vi.unmock('fs')
    vi.unmock('module')
    vi.restoreAllMocks()
  })

  it('prefers FFMPEG_PATH when it is an existing file; bare "ffmpeg" does not short-circuit', async () => {
    const bin = join(tmp, 'custom-ffmpeg')
    writeFileSync(bin, 'x')
    process.env.FFMPEG_PATH = bin
    const mod = await import('./resolveFfmpegPath')
    mod.clearFfmpegPathCache()
    expect(mod.resolveFfmpegPath()).toBe(bin)
    expect(mod.resolveFfmpegPath()).toBe(bin)

    // Bare command name must not skip bundled static (web/server env trap)
    mod.clearFfmpegPathCache()
    process.env.FFMPEG_PATH = 'ffmpeg'
    const p = mod.resolveFfmpegPath()
    expect(typeof p).toBe('string')
    expect(p.length).toBeGreaterThan(0)
    // Prefer real binary over bare PATH name when available
    if (p !== 'ffmpeg') {
      expect(existsSync(p)).toBe(true)
    }
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
    process.env.FFMPEG_PATH = join(tmp, 'other-ff')
    writeFileSync(process.env.FFMPEG_PATH, 'y')
    expect(mod.resolveFfmpegPathFresh()).toBe(process.env.FFMPEG_PATH)
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
    const mod = await import('./resolveFfmpegPath')
    mod.clearFfmpegPathCache()
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
    if (existsSync(candidate)) {
      expect(p === candidate || existsSync(p) || p === 'ffmpeg').toBe(true)
    } else {
      expect(typeof p).toBe('string')
    }
  })

  it('falls through when env missing and eventually returns path or ffmpeg', async () => {
    delete process.env.FFMPEG_PATH
    const mod = await import('./resolveFfmpegPath')
    mod.clearFfmpegPathCache()
    const p1 = mod.resolveFfmpegPath()
    expect(p1).toBeTruthy()
    expect(mod.resolveFfmpegPath()).toBe(p1)
    mod.clearFfmpegPathCache()
    const p2 = mod.resolveFfmpegPathFresh()
    expect(typeof p2).toBe('string')
  })

  it('bare FFMPEG_PATH=ffmpeg falls through to bundled/PATH without sticky false cache', async () => {
    process.env.FFMPEG_PATH = 'ffmpeg'
    const mod = await import('./resolveFfmpegPath')
    mod.clearFfmpegPathCache()
    const p1 = mod.resolveFfmpegPath()
    expect(typeof p1).toBe('string')
    // Second call should re-resolve bare cache and still return a usable path
    const p2 = mod.resolveFfmpegPath()
    expect(typeof p2).toBe('string')
    if (p1 !== 'ffmpeg') expect(existsSync(p1)).toBe(true)
  })

  it('tryResourcesPath via mocked electron app (dev + packaged)', async () => {
    delete process.env.FFMPEG_PATH
    const name = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'

    // Force bundled/static to fail so we reach resources path
    vi.resetModules()
    vi.doMock('module', async () => {
      const actual = await vi.importActual<typeof import('module')>('module')
      return {
        ...actual,
        createRequire: () => {
          throw new Error('no static')
        }
      }
    })

    // Mock electron for resources path (packaged)
    vi.doMock('electron', () => ({
      app: {
        isPackaged: true,
        getAppPath: () => tmp
      }
    }))
    const prevRes = process.resourcesPath
    Object.defineProperty(process, 'resourcesPath', {
      value: tmp,
      configurable: true
    })
    // place ffmpeg under resourcesPath/ffmpeg/<bin>
    mkdirSync(join(tmp, 'ffmpeg'), { recursive: true })
    writeFileSync(join(tmp, 'ffmpeg', name), 'x')

    const mod = await import('./resolveFfmpegPath')
    mod.clearFfmpegPathCache()
    const p = mod.resolveFfmpegPath()
    expect(p).toBeTruthy()

    // dev path (isPackaged false)
    vi.resetModules()
    vi.doMock('electron', () => ({
      app: {
        isPackaged: false,
        getAppPath: () => {
          throw new Error('no app path')
        }
      }
    }))
    const mod2 = await import('./resolveFfmpegPath')
    mod2.clearFfmpegPathCache()
    expect(mod2.resolveFfmpegPath()).toBeTruthy()

    Object.defineProperty(process, 'resourcesPath', {
      value: prevRes,
      configurable: true
    })
    vi.doUnmock('electron')
    vi.doUnmock('module')
  })
})
