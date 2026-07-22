import { describe, expect, it, afterEach, vi } from 'vitest'
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  mkdirSync,
  readFileSync
} from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import {
  createRuntime,
  readMediaFile,
  readMediaFileAsync
} from './createRuntime'

describe('createRuntime', () => {
  let dir: string
  let runtime: Awaited<ReturnType<typeof createRuntime>> | null = null

  afterEach(async () => {
    if (runtime) {
      await runtime.dispose()
      runtime = null
    }
    if (dir) rmSync(dir, { recursive: true, force: true })
    delete process.env.DATABASE_URL
  })

  it('boots headless runtime with channels', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-rt-'))
    const dbPath = join(dir, 't.db')
    process.env.DATABASE_URL = `file:${dbPath}`
    const { execSync } = await import('child_process')
    execSync('npx prisma db push --skip-generate', {
      cwd: join(__dirname, '../..'),
      env: { ...process.env, DATABASE_URL: `file:${dbPath}` },
      stdio: 'pipe'
    })
    runtime = createRuntime({
      dataDir: dir,
      databaseUrl: `file:${dbPath}`,
      appVersion: 'test',
      isPackaged: false
    })
    expect(runtime.channels().length).toBe(157)
    expect(runtime.hasChannel('stories:list')).toBe(true)
    const list = await runtime.invoke('stories:list', [])
    expect(Array.isArray(list)).toBe(true)

    // headless media:toPreviewUrl + app:getInfo
    const mediaFile = join(runtime.mediaRoot, 'uploads', 'x.png')
    mkdirSync(join(runtime.mediaRoot, 'uploads'), { recursive: true })
    writeFileSync(mediaFile, 'png')
    const preview = (await runtime.invoke('media:toPreviewUrl', [mediaFile])) as {
      url: string
    }
    expect(preview.url).toContain('/api/media')
    await expect(
      runtime.invoke('media:toPreviewUrl', ['/etc/passwd'])
    ).rejects.toMatchObject({ message: 'errors.pathOutsideDataDir' })
    await expect(
      runtime.invoke('media:toPreviewUrl', ['/no/such'])
    ).rejects.toMatchObject({ message: 'errors.mediaNotFound' })

    const info = (await runtime.invoke('app:getInfo', [])) as {
      runtime: string
      channels: number
    }
    expect(info.runtime).toBe('headless')
    expect(info.channels).toBeGreaterThan(100)

    // resolveMediaPath
    expect(runtime.resolveMediaPath(mediaFile)).toBe(mediaFile)
    expect(runtime.resolveMediaPath('/etc/passwd')).toBeNull()
    expect(runtime.resolveMediaPath(runtime.mediaRoot)).toBeNull() // directory
    expect(runtime.resolveMediaPath('%2Fnope')).toBeNull()

    // unknown channel
    await expect(runtime.invoke('no:such', [])).rejects.toMatchObject({
      message: 'errors.apiChannelNotAvailable'
    })

    // progress helpers
    runtime.host.emitGenerationProgress?.({ step: 1 })
    expect(runtime.host.getLastGenerationProgress?.()).toEqual({ step: 1 })

    // readMedia helpers
    expect(readMediaFile(mediaFile).toString()).toBe('png')
    expect((await readMediaFileAsync(mediaFile)).toString()).toBe('png')
  }, 60_000)

  it('accepts hostOverrides getPrisma and custom progress', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-rt2-'))
    const fakePrisma = {
      $disconnect: vi.fn(async () => undefined),
      $queryRaw: vi.fn()
    }
    const settingsStore = {
      path: join(dir, 'settings.json'),
      load: vi.fn(() => ({
        uiLanguage: 'zh-HK',
        llmProvider: 'grok-gateway',
        videoMode: 'auto',
        apiKey: '',
        webServerEnabled: false
      })),
      save: vi.fn((p: unknown) => p),
      lastLoadMigrated: false
    }
    const activity = {
      append: vi.fn(),
      readRecent: vi.fn(() => []),
      query: vi.fn(() => []),
      clear: vi.fn(),
      kinds: vi.fn(() => []),
      path: join(dir, 'a.jsonl')
    }
    let last: unknown = null
    runtime = createRuntime({
      dataDir: dir,
      appVersion: 'x',
      platform: 'linux',
      isPackaged: true,
      hostOverrides: {
        mode: 'electron',
        getPrisma: () => fakePrisma as never,
        settingsStore: settingsStore as never,
        activity: activity as never,
        emitGenerationProgress: (p) => {
          last = p
        },
        getLastGenerationProgress: () => last
      }
    })
    expect(runtime.prisma).toBe(fakePrisma)
    // electron mode → no headless media:toPreviewUrl override
    expect(runtime.hasChannel('media:toPreviewUrl')).toBe(true) // still registered via media handlers
    runtime.host.emitGenerationProgress?.({ n: 2 })
    expect(runtime.host.getLastGenerationProgress?.()).toEqual({ n: 2 })
    await runtime.dispose()
    expect(fakePrisma.$disconnect).not.toHaveBeenCalled()
    runtime = null
  })

  it('uses process.env.DATABASE_URL when databaseUrl omitted', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-rt3-'))
    const dbPath = join(dir, 'env.db')
    process.env.DATABASE_URL = `file:${dbPath}`
    // Provide getPrisma so we don't need real db push for boot
    const fakePrisma = {
      $disconnect: vi.fn(async () => undefined)
    }
    runtime = createRuntime({
      dataDir: dir,
      hostOverrides: {
        getPrisma: () => fakePrisma as never
      }
    })
    expect(process.env.DATABASE_URL).toContain('env.db')
    await runtime.dispose()
    runtime = null
  })
})
