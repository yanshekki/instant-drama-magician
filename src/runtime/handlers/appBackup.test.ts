import { describe, expect, it, vi, afterEach } from 'vitest'
import { writeFileSync, mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { makeHandlerContext, invokeRegistered } from '../../test/handlerTestUtils'
import { registerAppBackupHandlers } from './appBackup'
import { AppDataBackupService } from '../../application/services'

describe('registerAppBackupHandlers', () => {
  let dir: string | undefined
  afterEach(() => {
    if (dir) {
      rmSync(dir, { recursive: true, force: true })
      dir = undefined
    }
    delete process.env.DATABASE_URL
    delete process.env.IDM_SAVE_PATH
    delete process.env.IDM_PICK_FILE
    vi.restoreAllMocks()
  })

  it('registers domain channels', () => {
    const ctx = makeHandlerContext()
    registerAppBackupHandlers(ctx)
    const handlers = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(handlers.has('app:exportFullBackup')).toBe(true)
    expect(handlers.has('app:importFullBackup')).toBe(true)
    expect(handlers.has('app:rebuildMenu')).toBe(true)
    expect(handlers.has('media:importClip')).toBe(true)
    expect(handlers.has('media:openClip')).toBe(true)
  })

  it('exportFullBackup uses host hook when no destPath', async () => {
    const exportFullBackup = vi.fn(async () => undefined)
    const ctx = makeHandlerContext({
      host: {
        ...(makeHandlerContext().host as object),
        exportFullBackup
      } as never
    })
    registerAppBackupHandlers(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    await expect(
      invokeRegistered(h as never, 'app:exportFullBackup')
    ).resolves.toEqual({ ok: true })
    expect(exportFullBackup).toHaveBeenCalled()
  })

  it('exportFullBackup headless path with destPath and DATABASE_URL variants', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-ab-'))
    const dest = join(dir, 'b.zip')
    const exportToZip = vi
      .spyOn(AppDataBackupService.prototype, 'exportToZip')
      .mockResolvedValue(undefined as never)
    const disconnect = vi.fn(async () => undefined)
    const connect = vi.fn(async () => undefined)
    const baseHost = makeHandlerContext().host as object

    // file: absolute
    process.env.DATABASE_URL = `file:${join(dir, 'db.sqlite')}`
    const ctx = makeHandlerContext({
      host: {
        ...baseHost,
        userData: dir,
        getPrisma: () => ({ $disconnect: disconnect, $connect: connect }) as never,
        resolveDatabasePath: () => join(dir, 'resolved.db')
      } as never,
      mediaRoot: () => join(dir, 'media')
    })
    registerAppBackupHandlers(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    const r = (await invokeRegistered(h as never, 'app:exportFullBackup', {
      destPath: dest,
      includeSecrets: true
    })) as { ok: boolean; filePath: string }
    expect(r.ok).toBe(true)
    expect(r.filePath).toBe(dest)
    expect(exportToZip).toHaveBeenCalled()
    expect(disconnect).toHaveBeenCalled()
    expect(connect).toHaveBeenCalled()

    // resolveDatabasePath throws → keep prior
    const ctx2 = makeHandlerContext({
      host: {
        ...baseHost,
        userData: dir,
        getPrisma: () =>
          ({
            $disconnect: vi.fn(async () => {
              throw new Error('x')
            }),
            $connect: vi.fn(async () => {
              throw new Error('y')
            })
          }) as never,
        resolveDatabasePath: () => {
          throw new Error('nope')
        }
      } as never,
      mediaRoot: () => join(dir, 'media')
    })
    registerAppBackupHandlers(ctx2)
    const h2 = (ctx2 as { handlers: Map<string, unknown> }).handlers
    process.env.DATABASE_URL = 'file:////tmp/idm-abs.db'
    await invokeRegistered(h2 as never, 'app:exportFullBackup', {
      destPath: join(dir, 'b2.zip')
    })
    process.env.DATABASE_URL = 'file://host/rel.db'
    await invokeRegistered(h2 as never, 'app:exportFullBackup', {
      destPath: join(dir, 'b3.zip')
    })
    delete process.env.DATABASE_URL
    process.env.IDM_SAVE_PATH = join(dir, 'env.zip')
    await invokeRegistered(h2 as never, 'app:exportFullBackup', {})
  })

  it('importFullBackup host hook, dialog, path and errors', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-ab-imp-'))
    const zip = join(dir, 'in.zip')
    writeFileSync(zip, 'zip')
    const importFromZip = vi
      .spyOn(AppDataBackupService.prototype, 'importFromZip')
      .mockResolvedValue({ stories: 1 } as never)
    const importFullBackup = vi.fn(async () => undefined)
    const baseHost = makeHandlerContext().host as object

    const ctxHook = makeHandlerContext({
      host: { ...baseHost, importFullBackup } as never
    })
    registerAppBackupHandlers(ctxHook)
    const hh = (ctxHook as { handlers: Map<string, unknown> }).handlers
    await expect(
      invokeRegistered(hh as never, 'app:importFullBackup')
    ).resolves.toEqual({ ok: true })

    const showOpenDialog = vi
      .fn()
      .mockResolvedValueOnce({ canceled: true, filePaths: [] })
      .mockResolvedValueOnce({ canceled: false, filePaths: [zip] })
    const disconnect = vi.fn(async () => undefined)
    const connect = vi.fn(async () => undefined)
    const ctx = makeHandlerContext({
      host: {
        ...baseHost,
        userData: dir,
        getMainWindow: () => ({ id: 1 }),
        getPrisma: () => ({ $disconnect: disconnect, $connect: connect }) as never,
        dialog: { showOpenDialog, showSaveDialog: vi.fn() }
      } as never,
      mediaRoot: () => join(dir, 'media')
    })
    registerAppBackupHandlers(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers

    await expect(
      invokeRegistered(h as never, 'app:importFullBackup')
    ).rejects.toMatchObject({ message: 'errors.importZipPathRequired' })

    const r = (await invokeRegistered(h as never, 'app:importFullBackup')) as {
      ok: boolean
      requiresReload: boolean
    }
    expect(r.ok).toBe(true)
    expect(importFromZip).toHaveBeenCalled()

    await expect(
      invokeRegistered(h as never, 'app:importFullBackup', '/no.zip')
    ).rejects.toMatchObject({ message: 'errors.backupZipNotFound' })

    // no window path
    const showOpenDialog2 = vi.fn(async () => ({
      canceled: false,
      filePaths: [zip]
    }))
    const ctx2 = makeHandlerContext({
      host: {
        ...baseHost,
        userData: dir,
        getMainWindow: () => null,
        getPrisma: () =>
          ({
            $disconnect: vi.fn(async () => {
              throw new Error('d')
            }),
            $connect: vi.fn(async () => {
              throw new Error('c')
            })
          }) as never,
        dialog: { showOpenDialog: showOpenDialog2, showSaveDialog: vi.fn() }
      } as never,
      mediaRoot: () => join(dir, 'media')
    })
    registerAppBackupHandlers(ctx2)
    const h2 = (ctx2 as { handlers: Map<string, unknown> }).handlers
    await invokeRegistered(h2 as never, 'app:importFullBackup')
  })

  it('rebuildMenu and media import/open clip', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-ab-media-'))
    const clip = join(dir, 'c.mp4')
    writeFileSync(clip, 'mp4')
    const rebuildApplicationMenu = vi.fn()
    const importClip = vi.fn(() => join(dir, 'imported.mp4'))
    const setMedia = vi.fn(async () => ({ ok: true }))
    const openPath = vi
      .fn()
      .mockResolvedValueOnce('')
      .mockResolvedValueOnce('fail open')
    const showOpenDialog = vi
      .fn()
      .mockResolvedValueOnce({ canceled: true, filePaths: [] })
      .mockResolvedValueOnce({ canceled: false, filePaths: [clip] })
      .mockResolvedValueOnce({ canceled: false, filePaths: [clip] })

    const ctx = makeHandlerContext({
      host: {
        ...(makeHandlerContext().host as object),
        rebuildApplicationMenu,
        getMainWindow: () => ({ id: 1 }),
        shell: {
          openExternal: vi.fn(),
          openPath,
          showItemInFolder: vi.fn()
        },
        dialog: { showOpenDialog, showSaveDialog: vi.fn() }
      } as never,
      generation: () =>
        ({
          getMediaStore: () => ({ importClip })
        }) as never,
      timeline: () => ({ setMedia }) as never
    })
    registerAppBackupHandlers(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers

    await expect(
      invokeRegistered(h as never, 'app:rebuildMenu')
    ).resolves.toEqual({ ok: true })
    expect(rebuildApplicationMenu).toHaveBeenCalled()

    await expect(
      invokeRegistered(h as never, 'media:importClip', 's1', 'e1')
    ).resolves.toBeNull()

    const imported = (await invokeRegistered(
      h as never,
      'media:importClip',
      's1',
      'e1'
    )) as { filePath: string }
    expect(imported.filePath).toContain('imported')
    expect(setMedia).toHaveBeenCalled()

    await invokeRegistered(h as never, 'media:importClip', 's1', 'e1', clip)
    await expect(
      invokeRegistered(h as never, 'media:importClip', 's1', 'e1', '/no.mp4')
    ).rejects.toMatchObject({ message: 'errors.videoNotFound' })

    // no window dialog
    const ctx2 = makeHandlerContext({
      host: {
        ...(makeHandlerContext().host as object),
        getMainWindow: () => null,
        dialog: {
          showOpenDialog: vi.fn(async () => ({
            canceled: false,
            filePaths: [clip]
          })),
          showSaveDialog: vi.fn()
        },
        shell: {
          openExternal: vi.fn(),
          openPath,
          showItemInFolder: vi.fn()
        }
      } as never,
      generation: () =>
        ({ getMediaStore: () => ({ importClip }) }) as never,
      timeline: () => ({ setMedia }) as never
    })
    registerAppBackupHandlers(ctx2)
    const h2 = (ctx2 as { handlers: Map<string, unknown> }).handlers
    await invokeRegistered(h2 as never, 'media:importClip', 's1', 'e1')

    await expect(
      invokeRegistered(h as never, 'media:openClip', '/missing.mp4')
    ).rejects.toMatchObject({ message: 'errors.clipNotFound' })
    await expect(
      invokeRegistered(h as never, 'media:openClip', clip)
    ).resolves.toEqual({ ok: true })
    await expect(
      invokeRegistered(h as never, 'media:openClip', clip)
    ).rejects.toMatchObject({ code: 'IO' })
  })
})
