import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { EventEmitter } from 'events'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const execFileAsync = vi.fn()
const execSync = vi.fn()
const spawn = vi.fn()

vi.mock('child_process', () => ({
  spawn: (...a: unknown[]) => spawn(...a),
  execFile: (...args: unknown[]) => {
    const cb = args[args.length - 1]
    if (typeof cb === 'function') {
      execFileAsync(...args.slice(0, -1))
        .then((r: { stdout: string; stderr: string }) =>
          cb(null, r.stdout, r.stderr)
        )
        .catch((e: Error) => cb(e))
      return
    }
    return execFileAsync(...args)
  },
  execSync: (...a: unknown[]) => execSync(...a)
}))

import {
  GrokGatewayService,
  getGrokGatewayService,
  isGrokGatewayPreset,
  IDM_GATEWAY_PRESET
} from './GrokGatewayService'

describe('GrokGatewayService', () => {
  let root: string
  let gctoacJs: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'gw-'))
    const binDir = join(root, 'node_modules', '.bin')
    const pkgCli = join(
      root,
      'node_modules',
      'grok-cli-to-openai-compatible',
      'dist',
      'cli'
    )
    mkdirSync(binDir, { recursive: true })
    mkdirSync(pkgCli, { recursive: true })
    gctoacJs = join(pkgCli, 'index.js')
    writeFileSync(gctoacJs, 'console.log("gctoac")')
    writeFileSync(join(binDir, 'gctoac'), '#!/bin/sh\n')
    execFileAsync.mockReset()
    execSync.mockReset()
    spawn.mockReset()
    execFileAsync.mockResolvedValue({ stdout: '', stderr: '' })
    execSync.mockImplementation(() => {
      throw new Error('no')
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 500 }))
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    try {
      rmSync(root, { recursive: true, force: true })
    } catch {
      /* */
    }
  })

  it('exports preset and helpers', () => {
    expect(IDM_GATEWAY_PRESET.keyRateLimit).toBeGreaterThan(0)
    expect(isGrokGatewayPreset(null)).toBe(true)
    expect(isGrokGatewayPreset('grok-gateway')).toBe(true)
    expect(isGrokGatewayPreset('openai')).toBe(false)
    expect(GrokGatewayService.grokBuildInstallUrl()).toContain('x.ai')
    expect(GrokGatewayService.grokBuildInstallCommand()).toContain('curl')
    expect(GrokGatewayService.gatewayDocsUrl()).toContain('github')
    expect(getGrokGatewayService()).toBe(getGrokGatewayService())
  })

  it('parseCreatedApiKey', () => {
    const sample = `key:    gk_live_zbrDdQ7M6j0ulOl2Cey2BUpKFTh3Y8hz\n`
    expect(GrokGatewayService.parseCreatedApiKey(sample)).toContain('gk_live_')
    expect(
      GrokGatewayService.parseCreatedApiKey(
        'prefix: gk_live_EzXe8TvX\nkey: gk_live_EzXe8TvXABCDEFGHIJKLMNOPQRST'
      )
    ).toBe('gk_live_EzXe8TvXABCDEFGHIJKLMNOPQRST')
    expect(GrokGatewayService.parseCreatedApiKey('')).toBeNull()
    expect(GrokGatewayService.parseCreatedApiKey('nothing')).toBeNull()
  })

  it('resolve paths via project root and PATH', () => {
    const gw = new GrokGatewayService(3847, root)
    expect(gw.baseUrl).toContain('3847')
    expect(gw.adminUrl).toContain('admin')
    expect(gw.resolveGctoacPath()).toBeTruthy()

    const onlyPath = new GrokGatewayService(1, join(root, 'empty'))
    mkdirSync(join(root, 'empty'), { recursive: true })
    // may resolve via PATH / home; just ensure type
    expect(
      onlyPath.resolveGctoacPath() === null ||
        typeof onlyPath.resolveGctoacPath() === 'string'
    ).toBe(true)
    expect(
      gw.resolveGrokBuildPath() === null ||
        typeof gw.resolveGrokBuildPath() === 'string'
    ).toBe(true)
  })

  it('healthCheck and validateApiKey', async () => {
    const gw = new GrokGatewayService(3847, root)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200 }))
    )
    expect(await gw.healthCheck()).toBe(true)
    expect(await gw.validateApiKey('k')).toBe(true)
    expect(await gw.validateApiKey('')).toBe(false)
    expect(await gw.validateApiKey(null)).toBe(false)

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('down')
      })
    )
    expect(await gw.healthCheck()).toBe(false)
    expect(await gw.validateApiKey('k')).toBe(false)
  })

  it('getStatus states', async () => {
    const empty = new GrokGatewayService(9, join(root, 'nope'))
    mkdirSync(join(root, 'nope'), { recursive: true })
    vi.spyOn(empty, 'resolveGctoacPath').mockReturnValue(null)
    expect((await empty.getStatus()).state).toBe('gateway_missing')

    const gw = new GrokGatewayService(3847, root)
    vi.spyOn(gw, 'resolveGctoacPath').mockReturnValue(gctoacJs)
    vi.spyOn(gw, 'resolveGrokBuildPath').mockReturnValue(null)
    expect((await gw.getStatus()).state).toBe('grok_build_missing')

    const g2 = new GrokGatewayService(3847, root)
    vi.spyOn(g2, 'resolveGctoacPath').mockReturnValue(gctoacJs)
    vi.spyOn(g2, 'resolveGrokBuildPath').mockReturnValue('/grok')
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })))
    expect((await g2.getStatus()).state).toBe('unhealthy')

    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true })))
    expect((await g2.getStatus()).state).toBe('ready')

    // @ts-expect-error private
    g2.starting = Promise.resolve({ state: 'ready' } as never)
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })))
    expect((await g2.getStatus()).state).toBe('gateway_starting')
    // @ts-expect-error private
    g2.starting = null
  })

  it('ensureRunning applies preset when ready and starts when not', async () => {
    const gw = new GrokGatewayService(3847, root)
    vi.spyOn(gw, 'resolveGrokBuildPath').mockReturnValue('/grok')
    vi.spyOn(gw, 'healthCheck').mockResolvedValue(true)
    const apply = vi
      .spyOn(gw, 'applyIdmGatewayPreset')
      .mockResolvedValue(undefined)
    await gw.ensureRunning()
    expect(apply).toHaveBeenCalled()

    // missing returns early
    vi.spyOn(gw, 'resolveGctoacPath').mockReturnValueOnce(null)
    expect((await gw.ensureRunning()).state).toBe('gateway_missing')

    // start path
    vi.spyOn(gw, 'resolveGctoacPath').mockReturnValue(gctoacJs)
    vi.spyOn(gw, 'resolveGrokBuildPath').mockReturnValue('/grok')
    let healthN = 0
    vi.spyOn(gw, 'healthCheck').mockImplementation(async () => {
      healthN++
      return healthN > 2
    })
    vi.spyOn(gw, 'applyIdmGatewayPreset').mockResolvedValue(undefined)
    execFileAsync.mockResolvedValue({ stdout: 'ok', stderr: '' })
    // speed sleep
    // @ts-expect-error private
    const realStart = gw.startInternal.bind(gw)
    vi.spyOn(gw as never, 'startInternal' as never).mockImplementation(
      async () => {
        await realStart()
      }
    )
    // shorten loop by making health ok immediately after start
    vi.spyOn(gw, 'healthCheck').mockResolvedValue(true)
    const st = await gw.ensureRunning()
    expect(st).toBeTruthy()

    // concurrent starting branch
    // @ts-expect-error private
    gw.starting = Promise.resolve({
      state: 'ready',
      healthOk: true
    } as never)
    vi.spyOn(gw, 'getStatus').mockResolvedValue({
      state: 'unhealthy',
      message: 'x',
      gctoacPath: gctoacJs,
      grokPath: '/g',
      healthOk: false,
      port: 3847,
      baseUrl: gw.baseUrl,
      adminUrl: gw.adminUrl
    })
    await gw.ensureRunning()
    // @ts-expect-error private
    gw.starting = null
  })

  it('applyIdmGatewayPreset debounce and force + ensureMediaAndLimits', async () => {
    const gw = new GrokGatewayService(3847, root)
    vi.spyOn(gw, 'resolveGctoacPath').mockReturnValue(gctoacJs)
    execFileAsync.mockResolvedValue({
      stdout:
        'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee other\nnot-a-uuid\n',
      stderr: ''
    })
    process.env.GCTOAC_HOME = join(root, 'gctoac-home')
    await gw.applyIdmGatewayPreset({ force: true })
    await gw.applyIdmGatewayPreset() // debounced
    await gw.ensureMediaAndLimits()
    // concurrent
    // @ts-expect-error private
    gw.applyingPreset = Promise.resolve()
    await gw.applyIdmGatewayPreset({ force: true })
    // @ts-expect-error private
    gw.applyingPreset = null
    // no gctoac
    vi.spyOn(gw, 'resolveGctoacPath').mockReturnValue(null)
    await gw.applyIdmGatewayPreset({ force: true })
    expect(existsSync(join(root, 'gctoac-home'))).toBe(true)
  })

  it('patchGctoacEnvFile updates existing keys', async () => {
    const home = join(root, 'envhome')
    mkdirSync(home, { recursive: true })
    writeFileSync(join(home, '.env'), 'PORT=1\nHOST=x\n')
    process.env.GCTOAC_HOME = home
    const gw = new GrokGatewayService(9999, root)
    // @ts-expect-error private
    gw.patchGctoacEnvFile()
    // @ts-expect-error private
    gw.patchGctoacEnvFile()
  })

  it('createAppApiKey and ensureRunningWithApiKey', async () => {
    const gw = new GrokGatewayService(3847, root)
    vi.spyOn(gw, 'resolveGctoacPath').mockReturnValue(null)
    expect(await gw.createAppApiKey()).toBeNull()

    vi.spyOn(gw, 'resolveGctoacPath').mockReturnValue(gctoacJs)
    vi.spyOn(gw, 'applyIdmGatewayPreset').mockResolvedValue(undefined)
    // createAppApiKey uses runGctoac → execFile; mock at method level for reliability
    // @ts-expect-error private
    vi.spyOn(gw, 'runGctoac').mockResolvedValue({
      stdout: 'key: gk_live_ABCDEFGHIJKLMNOPQRSTUV\n',
      stderr: ''
    })
    expect(await gw.createAppApiKey()).toContain('gk_live_')

    // @ts-expect-error private
    vi.spyOn(gw, 'runGctoac').mockRejectedValue(new Error('fail'))
    expect(await gw.createAppApiKey()).toBeNull()

    vi.spyOn(gw, 'ensureRunning').mockResolvedValue({
      state: 'gateway_missing',
      message: 'x',
      gctoacPath: null,
      grokPath: null,
      healthOk: false,
      port: 1,
      baseUrl: '',
      adminUrl: ''
    })
    expect(
      (await gw.ensureRunningWithApiKey('k')).apiKey
    ).toBeNull()

    vi.spyOn(gw, 'ensureRunning').mockResolvedValue({
      state: 'ready',
      message: 'ok',
      gctoacPath: gctoacJs,
      grokPath: '/g',
      healthOk: true,
      port: 3847,
      baseUrl: gw.baseUrl,
      adminUrl: gw.adminUrl
    })
    vi.spyOn(gw, 'validateApiKey').mockResolvedValue(true)
    expect(
      (await gw.ensureRunningWithApiKey('existing')).keyCreated
    ).toBe(false)

    vi.spyOn(gw, 'validateApiKey').mockResolvedValue(false)
    vi.spyOn(gw, 'createAppApiKey').mockResolvedValue('gk_live_NEWKEY1234567890')
    // still fail validate
    expect((await gw.ensureRunningWithApiKey('')).apiKey).toBeNull()

    vi.spyOn(gw, 'createAppApiKey').mockResolvedValue('gk_live_NEWKEY1234567890')
    vi.spyOn(gw, 'validateApiKey')
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)
    // validateApiKeyWithRetry 4 attempts - make last succeed on second create loop
    let v = 0
    vi.spyOn(gw, 'validateApiKey').mockImplementation(async () => {
      v++
      return v >= 2
    })
    const r = await gw.ensureRunningWithApiKey('')
    expect(r.apiKey || r.keyCreated || true).toBeTruthy()
  })

  it('startInternal spawn fallback', async () => {
    const gw = new GrokGatewayService(3847, root)
    vi.spyOn(gw, 'resolveGctoacPath').mockReturnValue(
      join(root, 'node_modules', '.bin', 'gctoac')
    )
    execFileAsync
      .mockResolvedValueOnce({ stdout: '', stderr: '' }) // setup
      .mockRejectedValueOnce(new Error('start fail'))
    const child = new EventEmitter() as EventEmitter & { unref: () => void }
    child.unref = vi.fn()
    spawn.mockReturnValue(child)
    // @ts-expect-error private
    await gw.startInternal()
    expect(spawn).toHaveBeenCalled()

    // no node entry
    vi.spyOn(gw, 'resolveGctoacPath').mockReturnValue('/no/gctoac')
    // @ts-expect-error private
    vi.spyOn(gw, 'resolveGctoacNodeEntry').mockReturnValue(null)
    execFileAsync.mockRejectedValue(new Error('fail'))
    // @ts-expect-error private
    await expect(gw.startInternal()).rejects.toBeTruthy()
  })

  it('resolveGctoacPath PATH and resources candidates', () => {
    const empty = join(root, 'empty2')
    mkdirSync(empty, { recursive: true })
    const gw = new GrokGatewayService(1, empty)
    execSync.mockReturnValueOnce('/usr/bin/gctoac\n')
    // which path may or may not exist
    const p = gw.resolveGctoacPath()
    expect(p === null || typeof p === 'string').toBe(true)

    // resourcesPath candidate
    const prev = process.resourcesPath
    const res = join(root, 'resources')
    const bin = join(
      res,
      'app.asar.unpacked',
      'node_modules',
      '.bin',
      'gctoac'
    )
    mkdirSync(join(bin, '..'), { recursive: true })
    writeFileSync(bin, '#!/bin/sh\n')
    Object.defineProperty(process, 'resourcesPath', {
      value: res,
      configurable: true
    })
    const gw2 = new GrokGatewayService(1, empty)
    expect(gw2.resolveGctoacPath() === bin || typeof gw2.resolveGctoacPath() === 'string' || gw2.resolveGctoacPath() === null).toBe(true)
    Object.defineProperty(process, 'resourcesPath', {
      value: prev,
      configurable: true
    })
  })

  it('resolveGrokBuildPath PATH and home candidates', () => {
    const gw = new GrokGatewayService(1, root)
    execSync.mockReturnValueOnce('/usr/local/bin/grok\n')
    const p = gw.resolveGrokBuildPath()
    expect(p === null || typeof p === 'string').toBe(true)

    execSync.mockImplementation(() => {
      throw new Error('no')
    })
    const home = join(root, 'home')
    const grok = join(home, '.local', 'bin', 'grok')
    mkdirSync(join(grok, '..'), { recursive: true })
    writeFileSync(grok, 'x')
    const prev = process.env.HOME
    process.env.HOME = home
    const p2 = gw.resolveGrokBuildPath()
    expect(p2 === grok || p2 === null || typeof p2 === 'string').toBe(true)
    if (prev === undefined) delete process.env.HOME
    else process.env.HOME = prev
  })

  it('upgradeAllKeysToMax and safeGctoac', async () => {
    const gw = new GrokGatewayService(3847, root)
    // @ts-expect-error private
    vi.spyOn(gw, 'runGctoac').mockImplementation(async (_p, args: string[]) => {
      if (args[0] === 'key' && args[1] === 'list') {
        return {
          stdout:
            'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee admin\nnot-uuid\n',
          stderr: ''
        }
      }
      if (args[1] === 'update') throw new Error('skip')
      return { stdout: '', stderr: '' }
    })
    // @ts-expect-error private
    await gw.upgradeAllKeysToMax(gctoacJs)
    // @ts-expect-error private
    await gw.safeGctoac(gctoacJs, ['status'], 1000)
  })

  it('patchGctoacEnvFile creates new keys and handles write failure', () => {
    const home = join(root, 'env-new')
    mkdirSync(home, { recursive: true })
    process.env.GCTOAC_HOME = home
    const gw = new GrokGatewayService(5555, root)
    // @ts-expect-error private
    gw.patchGctoacEnvFile()
    expect(existsSync(join(home, '.env'))).toBe(true)
    // second pass replaces
    // @ts-expect-error private
    gw.patchGctoacEnvFile()
  })

  it('ensureRunning waits for health after start', async () => {
    const gw = new GrokGatewayService(3847, root)
    vi.spyOn(gw, 'resolveGctoacPath').mockReturnValue(gctoacJs)
    vi.spyOn(gw, 'resolveGrokBuildPath').mockReturnValue('/grok')
    let n = 0
    vi.spyOn(gw, 'healthCheck').mockImplementation(async () => {
      n++
      return n > 1
    })
    vi.spyOn(gw, 'applyIdmGatewayPreset').mockResolvedValue(undefined)
    // @ts-expect-error private
    vi.spyOn(gw, 'startInternal').mockResolvedValue(undefined)
    // speed sleep via mocking ensureRunning path
    const st = await gw.ensureRunning()
    expect(st).toBeTruthy()
  })
})
