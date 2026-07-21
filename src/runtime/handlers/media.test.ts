import { describe, expect, it, vi, afterEach } from 'vitest'
import { writeFileSync, mkdtempSync, rmSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { makeHandlerContext, invokeRegistered } from '../../test/handlerTestUtils'
import { registerMediaHandlers } from './media'

describe('registerMediaHandlers', () => {
  let dir: string | undefined
  const prevEnv = { ...process.env }

  afterEach(() => {
    process.env = { ...prevEnv }
    if (dir) {
      rmSync(dir, { recursive: true, force: true })
      dir = undefined
    }
  })

  it('registers domain channels', () => {
    const ctx = makeHandlerContext()
    registerMediaHandlers(ctx)
    const handlers = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(handlers.has('media:pickRefImage')).toBe(true)
    expect(handlers.has('media:exportStoryboard')).toBe(true)
    expect(handlers.has('media:exportConcat')).toBe(true)
    expect(handlers.has('media:toPreviewUrl')).toBe(true)
    expect(handlers.has('app:getInfo')).toBe(true)
  })

  it('pickRefImage copies provided path into media refs', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-media-'))
    const src = join(dir, 'a.png')
    writeFileSync(src, 'img')
    const mediaRoot = join(dir, 'media')
    const ctx = makeHandlerContext({
      mediaRoot: () => mediaRoot
    })
    registerMediaHandlers(ctx)
    const handlers = (ctx as { handlers: Map<string, unknown> }).handlers
    const r = (await invokeRegistered(
      handlers as never,
      'media:pickRefImage',
      src
    )) as { filePath: string; originalName: string }
    expect(r.originalName).toBe('a.png')
    expect(existsSync(r.filePath)).toBe(true)
    expect(readFileSync(r.filePath, 'utf8')).toBe('img')
  })

  it('pickRefImage returns null when dialog canceled', async () => {
    const showOpenDialog = vi.fn(async () => ({
      canceled: true,
      filePaths: [] as string[]
    }))
    const ctx = makeHandlerContext({
      host: {
        mode: 'headless',
        userData: '/tmp/u',
        mediaRoot: '/tmp/m',
        appVersion: '1',
        isPackaged: false,
        platform: 'linux',
        getPrisma: vi.fn(),
        settingsStore: { load: vi.fn(), save: vi.fn() },
        activity: { append: vi.fn() },
        dialog: { showOpenDialog },
        shell: {},
        getMainWindow: () => null
      } as never
    })
    registerMediaHandlers(ctx)
    const handlers = (ctx as { handlers: Map<string, unknown> }).handlers
    await expect(
      invokeRegistered(handlers as never, 'media:pickRefImage')
    ).resolves.toBeNull()
  })

  it('toPreviewUrl and saveAs headless download', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-media2-'))
    const f = join(dir, 'clip.mp4')
    writeFileSync(f, 'vid')
    const append = vi.fn()
    const ctx = makeHandlerContext({
      activity: {
        append,
        readRecent: vi.fn(),
        query: vi.fn(),
        clear: vi.fn(),
        kinds: vi.fn(),
        path: '/l'
      } as never,
      host: {
        mode: 'headless',
        userData: dir,
        mediaRoot: join(dir, 'media'),
        appVersion: '1.2.0',
        isPackaged: true,
        platform: 'linux',
        getPrisma: vi.fn(),
        settingsStore: { load: vi.fn(), save: vi.fn() },
        activity: { append },
        dialog: {},
        shell: {},
        getMainWindow: () => null
      } as never
    })
    registerMediaHandlers(ctx)
    const handlers = (ctx as { handlers: Map<string, unknown> }).handlers

    const preview = (await invokeRegistered(
      handlers as never,
      'media:toPreviewUrl',
      f
    )) as { url: string }
    expect(preview.url).toMatch(/^idm-media:\/\/local\//)

    const dl = (await invokeRegistered(
      handlers as never,
      'media:saveAs',
      f
    )) as { downloadUrl: string; fileName: string }
    expect(dl.fileName).toBe('clip.mp4')
    expect(dl.downloadUrl).toContain('/api/download')
    expect(append).toHaveBeenCalled()

    await expect(
      invokeRegistered(handlers as never, 'media:toPreviewUrl', '/nope')
    ).rejects.toMatchObject({ message: 'errors.mediaNotFound' })
  })

  it('saveAs with destPath copies file', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-media3-'))
    const f = join(dir, 'a.png')
    const dest = join(dir, 'out.png')
    writeFileSync(f, 'x')
    const ctx = makeHandlerContext()
    registerMediaHandlers(ctx)
    const handlers = (ctx as { handlers: Map<string, unknown> }).handlers
    const r = (await invokeRegistered(
      handlers as never,
      'media:saveAs',
      f,
      dest
    )) as { filePath: string }
    expect(r.filePath).toBe(dest)
    expect(existsSync(dest)).toBe(true)
  })

  it('exportFinal saves options and appends activity', async () => {
    const exportFinal = vi.fn(async () => ({ outputPath: '/tmp/final.mp4' }))
    const save = vi.fn((p: object) => p)
    const append = vi.fn()
    const rebindAi = vi.fn()
    const ctx = makeHandlerContext({
      generation: () =>
        ({
          exportFinal,
          getMediaStore: () => ({}),
          cancel: vi.fn(),
          rebindAi: vi.fn()
        }) as never,
      settingsStore: {
        load: vi.fn(() => ({})),
        save,
        lastLoadMigrated: false
      } as never,
      activity: {
        append,
        readRecent: vi.fn(),
        query: vi.fn(),
        clear: vi.fn(),
        kinds: vi.fn(),
        path: '/l'
      } as never,
      rebindAi
    })
    registerMediaHandlers(ctx)
    const handlers = (ctx as { handlers: Map<string, unknown> }).handlers
    const r = await invokeRegistered(handlers as never, 'media:exportFinal', 's1', {
      exportProfile: 'fast',
      burnSubtitles: true,
      bgmVolume: 0.2
    })
    expect(exportFinal).toHaveBeenCalledWith(
      's1',
      expect.objectContaining({ exportProfile: 'fast' })
    )
    expect(save).toHaveBeenCalled()
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'export', message: 'final', storyId: 's1' })
    )
    expect(r).toMatchObject({ outputPath: '/tmp/final.mp4' })
  })

  it('listExports / deleteExport / exportStoryboard / app:getInfo', async () => {
    const listExports = vi.fn(async () => [{ id: 'e1' }])
    const deleteExport = vi.fn(async () => ({ ok: true }))
    const exportStoryboard = vi.fn(async () => ({ outputPath: '/sb' }))
    const exportConcat = vi.fn(async () => ({ outputPath: '/cat' }))
    const exportPreflight = vi.fn(async () => ({ ok: true }))
    const append = vi.fn()
    const ctx = makeHandlerContext({
      generation: () =>
        ({
          listExports,
          deleteExport,
          exportStoryboard,
          exportConcat,
          exportPreflight,
          getMediaStore: () => ({}),
          cancel: vi.fn(),
          rebindAi: vi.fn()
        }) as never,
      activity: {
        append,
        readRecent: vi.fn(),
        query: vi.fn(),
        clear: vi.fn(),
        kinds: vi.fn(),
        path: '/l'
      } as never
    })
    registerMediaHandlers(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    await expect(
      invokeRegistered(h as never, 'media:listExports', 's1')
    ).resolves.toEqual([{ id: 'e1' }])
    await invokeRegistered(h as never, 'media:deleteExport', 's1', 'e1')
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'delete' })
    )
    await invokeRegistered(h as never, 'media:exportStoryboard', 's1')
    await invokeRegistered(h as never, 'media:exportConcat', 's1')
    await invokeRegistered(h as never, 'media:exportPreflight', 's1')
    const info = (await invokeRegistered(h as never, 'app:getInfo')) as {
      version: string
      name: string
    }
    expect(info.name).toMatch(/InstantDrama/)
    expect(info.version).toBeTruthy()
  })
})
