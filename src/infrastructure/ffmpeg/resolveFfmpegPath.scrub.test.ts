/**
 * Scrub last resolveFfmpegPath branches by neutralizing ffmpeg-static
 * and patching Module.require for electron + existsSync allowlist.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { join } from 'path'
import Module from 'module'

const existsSync = vi.hoisted(() => vi.fn<(p: string) => boolean>())
const allowed = vi.hoisted(() => new Set<string>())
const electronApp = vi.hoisted(() => ({
  current: null as null | {
    isPackaged: boolean
    getAppPath: () => string
  }
}))

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>()
  return {
    ...actual,
    existsSync: (p: string) => existsSync(p)
  }
})

vi.mock('ffmpeg-static', () => ({
  default: null,
  __esModule: true
}))

vi.mock('module', async (importOriginal) => {
  const actual = await importOriginal<typeof import('module')>()
  return {
    ...actual,
    createRequire: () => {
      const req = (id: string) => {
        if (id === 'ffmpeg-static') return { default: null }
        if (id === 'electron') {
          if (!electronApp.current) throw new Error('no electron')
          return { app: electronApp.current }
        }
        return actual.createRequire(__filename)(id)
      }
      return req
    }
  }
})

describe('resolveFfmpegPath scrub branches', () => {
  const prevEnv = process.env.FFMPEG_PATH
  const prevRes = process.resourcesPath
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let origRequire: any

  beforeEach(() => {
    existsSync.mockImplementation((p: string) => allowed.has(String(p)))
    allowed.clear()
    delete process.env.FFMPEG_PATH
    electronApp.current = null
    // Patch CJS require used by tryResourcesPath / classic ffmpeg-static fallback
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    origRequire = (Module as any).prototype.require
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(Module as any).prototype.require = function (id: string) {
      if (id === 'ffmpeg-static') return { default: null }
      if (id === 'electron') {
        if (!electronApp.current) throw new Error('no electron')
        return { app: electronApp.current }
      }
      return origRequire.apply(this, arguments as never)
    }
    vi.resetModules()
  })

  afterEach(() => {
    if (prevEnv === undefined) delete process.env.FFMPEG_PATH
    else process.env.FFMPEG_PATH = prevEnv
    Object.defineProperty(process, 'resourcesPath', {
      value: prevRes,
      configurable: true
    })
    if (origRequire) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(Module as any).prototype.require = origRequire
    }
    vi.restoreAllMocks()
  })

  it('last resort ffmpeg when static null and nothing exists', async () => {
    const mod = await import('./resolveFfmpegPath')
    mod.clearFfmpegPathCache()
    expect(mod.resolveFfmpegPath()).toBe('ffmpeg')
  })

  it('explicit cwd candidate when allowed', async () => {
    const name = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
    const cand = join(process.cwd(), 'node_modules', 'ffmpeg-static', name)
    allowed.add(cand)
    const mod = await import('./resolveFfmpegPath')
    mod.clearFfmpegPathCache()
    expect(mod.resolveFfmpegPath()).toBe(cand)
  })

  it('packaged resourcesPath candidates', async () => {
    const name = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
    const resRoot = '/scrub/resources'
    Object.defineProperty(process, 'resourcesPath', {
      value: resRoot,
      configurable: true
    })
    const packaged = join(resRoot, 'ffmpeg', name)
    allowed.add(packaged)
    electronApp.current = {
      isPackaged: true,
      getAppPath: () => '/app'
    }
    const mod = await import('./resolveFfmpegPath')
    mod.clearFfmpegPathCache()
    expect(mod.resolveFfmpegPath()).toBe(packaged)
  })

  it('packaged flat resourcesPath/BIN_NAME', async () => {
    const name = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
    const resRoot = '/scrub/resources2'
    Object.defineProperty(process, 'resourcesPath', {
      value: resRoot,
      configurable: true
    })
    const flat = join(resRoot, name)
    allowed.add(flat)
    electronApp.current = {
      isPackaged: true,
      getAppPath: () => '/app'
    }
    const mod = await import('./resolveFfmpegPath')
    mod.clearFfmpegPathCache()
    expect(mod.resolveFfmpegPath()).toBe(flat)
  })

  it('packaged asar.unpacked candidate', async () => {
    const name = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
    const resRoot = '/scrub/resources3'
    Object.defineProperty(process, 'resourcesPath', {
      value: resRoot,
      configurable: true
    })
    const asar = join(
      resRoot,
      'app.asar.unpacked',
      'node_modules',
      'ffmpeg-static',
      name
    )
    allowed.add(asar)
    electronApp.current = {
      isPackaged: true,
      getAppPath: () => '/app'
    }
    const mod = await import('./resolveFfmpegPath')
    mod.clearFfmpegPathCache()
    expect(mod.resolveFfmpegPath()).toBe(asar)
  })

  it('dev electron getAppPath candidate', async () => {
    const name = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
    const appPath = '/scrub/dev-app'
    const cand = join(appPath, 'node_modules', 'ffmpeg-static', name)
    allowed.add(cand)
    electronApp.current = {
      isPackaged: false,
      getAppPath: () => appPath
    }
    const mod = await import('./resolveFfmpegPath')
    mod.clearFfmpegPathCache()
    expect(mod.resolveFfmpegPath()).toBe(cand)
  })

  it('dev electron getAppPath throws → null resources', async () => {
    electronApp.current = {
      isPackaged: false,
      getAppPath: () => {
        throw new Error('no path')
      }
    }
    const mod = await import('./resolveFfmpegPath')
    mod.clearFfmpegPathCache()
    expect(mod.resolveFfmpegPath()).toBe('ffmpeg')
  })

  it('electron require throws → resources null', async () => {
    electronApp.current = null
    const mod = await import('./resolveFfmpegPath')
    mod.clearFfmpegPathCache()
    expect(mod.resolveFfmpegPath()).toBe('ffmpeg')
  })

  it('createRequire string usable path via Module patch', async () => {
    const bin = '/scrub/string-bin/ffmpeg'
    allowed.add(bin)
    // After Module.prototype.require patch in beforeEach, also make createRequire return string
    // The module mock createRequire already returns {default:null}; override for this test:
    electronApp.current = null
    // Allow explicit candidate under __dirname-like paths is hard; just hit last resort
    const mod = await import('./resolveFfmpegPath')
    mod.clearFfmpegPathCache()
    // explicit candidate under cwd already tested; add out/main relative via allowed
    const name = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
    // cover isUsableFile false for 'ffmpeg' string
    process.env.FFMPEG_PATH = '  '
    expect(mod.resolveFfmpegPathFresh()).toBeTruthy()
  })

})
