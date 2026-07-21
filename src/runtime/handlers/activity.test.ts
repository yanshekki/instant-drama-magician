import { describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { makeHandlerContext, invokeRegistered } from '../../test/handlerTestUtils'
import { registerActivityHandlers } from './activity'

describe('registerActivityHandlers', () => {
  it('registers domain channels', () => {
    const ctx = makeHandlerContext()
    registerActivityHandlers(ctx)
    const handlers = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(handlers.has('activity:recent')).toBe(true)
    expect(handlers.has('activity:query')).toBe(true)
    expect(handlers.has('activity:clear')).toBe(true)
    expect(handlers.has('diagnostics:full')).toBe(true)
  })

  it('activity recent/query/clear/getPath/openLogFolder', async () => {
    const readRecent = vi.fn(() => [{ kind: 'a', message: 'm', ts: 't' }])
    const query = vi.fn(() => [{ kind: 'ipc', message: 'q', ts: 't' }])
    const clear = vi.fn(() => ({ ok: true as const, path: '/tmp/l' }))
    const kinds = vi.fn(() => ['ipc'])
    const openPath = vi.fn(async () => '')
    const activity = {
      append: vi.fn(),
      readRecent,
      query,
      clear,
      kinds,
      path: '/tmp/idm-test/logs/activity.jsonl'
    }
    const ctx = makeHandlerContext({
      activity: activity as never,
      host: {
        mode: 'headless',
        userData: '/tmp/idm-test',
        mediaRoot: '/tmp/m',
        appVersion: '1',
        isPackaged: false,
        platform: 'linux',
        getPrisma: vi.fn(),
        settingsStore: { load: vi.fn(), save: vi.fn() },
        activity,
        dialog: {},
        shell: { openPath, openExternal: vi.fn(), showItemInFolder: vi.fn() },
        getMainWindow: () => null
      } as never
    })
    registerActivityHandlers(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers

    await expect(
      invokeRegistered(h as never, 'activity:recent', 10)
    ).resolves.toHaveLength(1)
    expect(readRecent).toHaveBeenCalledWith(10)

    const q = (await invokeRegistered(h as never, 'activity:query', {
      kind: 'ipc',
      q: 'x'
    })) as { entries: unknown[]; kinds: string[]; path: string }
    expect(q.entries).toHaveLength(1)
    expect(q.kinds).toEqual(['ipc'])
    expect(q.path).toContain('activity')

    await expect(invokeRegistered(h as never, 'activity:clear')).resolves.toEqual(
      { ok: true, path: '/tmp/l' }
    )
    await expect(
      invokeRegistered(h as never, 'activity:getPath')
    ).resolves.toEqual({ path: activity.path })

    const opened = (await invokeRegistered(
      h as never,
      'activity:openLogFolder'
    )) as { ok: boolean; path: string }
    expect(opened.ok).toBe(true)
    expect(openPath).toHaveBeenCalled()
  })

  it('support:exportReport writes with destPath', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'idm-sup-'))
    try {
      const dest = join(dir, 'report.json')
      const append = vi.fn()
      const ctx = makeHandlerContext({
        activity: {
          append,
          readRecent: vi.fn(() => []),
          query: vi.fn(() => []),
          clear: vi.fn(),
          kinds: vi.fn(() => []),
          path: join(dir, 'a.jsonl')
        } as never,
        settingsStore: {
          load: vi.fn(() => ({
            apiKey: 'secret',
            videoMode: 'auto',
            ttsHttpUrl: ''
          })),
          save: vi.fn(),
          lastLoadMigrated: false
        } as never
      })
      // aiClient getters are on the object - makeHandlerContext already mocks getStatus
      registerActivityHandlers(ctx)
      const h = (ctx as { handlers: Map<string, unknown> }).handlers
      const r = (await invokeRegistered(
        h as never,
        'support:exportReport',
        dest
      )) as { filePath: string }
      expect(r.filePath).toBe(dest)
      expect(append).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'support' })
      )
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('diagnostics:full returns probes and tips', async () => {
    const ctx = makeHandlerContext({
      aiClient: {
        probeChat: vi.fn(async () => ({ ok: false })),
        getStatus: vi.fn(async () => ({ available: false, message: 'down' })),
        videoProvider: {
          probe: vi.fn(async () => ({
            id: 'stub',
            available: false,
            message: 'no video'
          }))
        },
        chat: vi.fn(),
        generateImage: vi.fn()
      },
      host: {
        ...(makeHandlerContext().host as object),
        isPackaged: true,
        userData: '/tmp/idm-test'
      } as never
    })
    Object.defineProperty(ctx, 'settings', {
      get: () => ({ apiKey: '', videoMode: 'auto' })
    })
    registerActivityHandlers(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    const d = (await invokeRegistered(h as never, 'diagnostics:full')) as {
      chat: { available: boolean }
      video: { available: boolean }
      tips: string[]
      app: { version: string; isPackaged: boolean }
    }
    expect(d.chat).toBeDefined()
    expect(d.video).toBeDefined()
    expect(d.tips.length).toBeGreaterThan(0)
    expect(d.app.isPackaged).toBe(true)
  })

  it('support:exportReport dialog paths and media:pickBgm', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'idm-sup2-'))
    try {
      const audio = join(dir, 'a.mp3')
      const { writeFileSync } = await import('fs')
      writeFileSync(audio, 'mp3')
      const append = vi.fn()
      const rebindAi = vi.fn()
      const save = vi.fn((p: unknown) => ({ bgmPath: audio, ...(p as object) }))
      const showSaveDialog = vi
        .fn()
        .mockResolvedValueOnce({ canceled: true, filePath: undefined })
        .mockResolvedValueOnce({ canceled: false, filePath: join(dir, 'r.json') })
      const showOpenDialog = vi
        .fn()
        .mockResolvedValueOnce({ canceled: true, filePaths: [] })
        .mockResolvedValueOnce({ canceled: false, filePaths: [audio] })

      const ctx = makeHandlerContext({
        rebindAi,
        activity: {
          append,
          readRecent: vi.fn(() => []),
          query: vi.fn(() => []),
          clear: vi.fn(),
          kinds: vi.fn(() => []),
          path: join(dir, 'a.jsonl')
        } as never,
        settingsStore: {
          load: vi.fn(() => ({
            apiKey: '',
            videoMode: 'auto',
            ttsHttpUrl: ''
          })),
          save,
          lastLoadMigrated: false
        } as never,
        mediaRoot: () => join(dir, 'media'),
        host: {
          ...(makeHandlerContext().host as object),
          mode: 'headless',
          userData: dir,
          getMainWindow: () => ({ id: 1 }),
          dialog: { showSaveDialog, showOpenDialog }
        } as never,
        aiClient: {
          probeChat: vi.fn(async () => ({ ok: false })),
          getStatus: vi.fn(async () => ({ available: false, message: 'x' })),
          videoProvider: {
            probe: vi.fn(async () => ({
              id: 'v',
              available: false,
              message: 'v'
            }))
          },
          chat: vi.fn(),
          generateImage: vi.fn()
        }
      })
      registerActivityHandlers(ctx)
      const h = (ctx as { handlers: Map<string, unknown> }).handlers

      // canceled dialog → headless fallback to default path
      const r1 = (await invokeRegistered(h as never, 'support:exportReport')) as {
        filePath: string
      }
      expect(r1.filePath).toBeTruthy()

      // electron mode cancel returns null
      const ctxEl = makeHandlerContext({
        activity: {
          append,
          readRecent: vi.fn(() => []),
          query: vi.fn(),
          clear: vi.fn(),
          kinds: vi.fn(),
          path: join(dir, 'a.jsonl')
        } as never,
        settingsStore: {
          load: vi.fn(() => ({ apiKey: 'k', videoMode: 'auto' })),
          save: vi.fn(),
          lastLoadMigrated: false
        } as never,
        host: {
          ...(makeHandlerContext().host as object),
          mode: 'electron',
          userData: dir,
          getMainWindow: () => null,
          dialog: {
            showSaveDialog: vi.fn(async () => ({
              canceled: true,
              filePath: undefined
            })),
            showOpenDialog: vi.fn()
          }
        } as never
      })
      registerActivityHandlers(ctxEl)
      await expect(
        invokeRegistered(
          (ctxEl as { handlers: Map<string, unknown> }).handlers as never,
          'support:exportReport'
        )
      ).resolves.toBeNull()

      // pickBgm
      await expect(
        invokeRegistered(h as never, 'media:pickBgm')
      ).resolves.toBeNull()
      const bgm = (await invokeRegistered(h as never, 'media:pickBgm')) as {
        filePath: string
      }
      expect(bgm.filePath).toContain('bgm')
      expect(rebindAi).toHaveBeenCalled()

      await invokeRegistered(h as never, 'media:pickBgm', audio)
      await expect(
        invokeRegistered(h as never, 'media:pickBgm', '/no.mp3')
      ).rejects.toMatchObject({ message: 'errors.audioNotFound' })
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('diagnostics and support cover ffmpeg fail tips and bare dialogs', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'idm-sup3-'))
    try {
      const append = vi.fn()
      const showSaveDialog = vi.fn(async () => ({
        canceled: false,
        filePath: join(dir, 'ok.json')
      }))
      const showOpenDialog = vi.fn(async () => ({
        canceled: false,
        filePaths: [join(dir, 'b.mp3')]
      }))
      const { writeFileSync } = await import('fs')
      writeFileSync(join(dir, 'b.mp3'), 'x')

      vi.doMock('../../infrastructure/ffmpeg/FfmpegService', () => ({
        FfmpegService: class {
          async ensureAvailable() {
            throw 'ffmpeg-string-error'
          }
        }
      }))

      const ctx = makeHandlerContext({
        activity: {
          append,
          readRecent: vi.fn(() => []),
          query: vi.fn(() => []),
          clear: vi.fn(),
          kinds: vi.fn(() => []),
          path: join(dir, 'a.jsonl')
        } as never,
        settingsStore: {
          load: vi.fn(() => ({
            apiKey: '',
            videoMode: 'auto',
            ttsHttpUrl: ''
          })),
          save: vi.fn((p: unknown) => p),
          lastLoadMigrated: false
        } as never,
        mediaRoot: () => join(dir, 'media'),
        host: {
          ...(makeHandlerContext().host as object),
          mode: 'headless',
          isPackaged: true,
          userData: dir,
          getMainWindow: () => null,
          dialog: { showSaveDialog, showOpenDialog }
        } as never,
        aiClient: {
          probeChat: vi.fn(async () => ({ ok: false })),
          getStatus: vi.fn(async () => ({ available: false, message: 'down' })),
          videoProvider: {
            probe: vi.fn(async () => ({
              id: 'v',
              available: false,
              message: 'no'
            }))
          },
          chat: vi.fn(),
          generateImage: vi.fn()
        },
        rebindAi: vi.fn()
      })
      registerActivityHandlers(ctx)
      const h = (ctx as { handlers: Map<string, unknown> }).handlers

      const d = (await invokeRegistered(h as never, 'diagnostics:full')) as {
        ffmpeg: { available: boolean; message: string }
        tips: string[]
      }
      expect(d.ffmpeg.available).toBe(false)
      expect(d.tips.some((t) => /FFmpeg/i.test(t))).toBe(true)

      // support export: dialog with win=null (bare showSaveDialog) + success path
      const r = (await invokeRegistered(h as never, 'support:exportReport')) as {
        filePath: string
      }
      expect(r.filePath).toContain('ok.json')

      // pickBgm with win=null uses bare showOpenDialog
      const bgm = (await invokeRegistered(h as never, 'media:pickBgm')) as {
        filePath: string
      }
      expect(bgm.filePath).toContain('bgm')
    } finally {
      vi.doUnmock('../../infrastructure/ffmpeg/FfmpegService')
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
