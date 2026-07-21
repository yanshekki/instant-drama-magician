import { describe, expect, it, vi, afterEach } from 'vitest'
import { writeFileSync, mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { makeHandlerContext, invokeRegistered } from '../../test/handlerTestUtils'
import { registerProjectbackupHandlers } from './projectBackup'
import { ProjectBackupService } from '../../application/services'

describe('registerProjectbackupHandlers', () => {
  let dir: string | undefined
  afterEach(() => {
    if (dir) {
      rmSync(dir, { recursive: true, force: true })
      dir = undefined
    }
    vi.restoreAllMocks()
  })

  it('registers channels', () => {
    const ctx = makeHandlerContext()
    registerProjectbackupHandlers(ctx)
    const handlers = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(handlers.has('project:exportBackup')).toBe(true)
    expect(handlers.has('project:importBackup')).toBe(true)
  })

  it('exportBackup destPath and save dialogs', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-pb-'))
    const out = join(dir, 's.zip')
    const exportStoryToZip = vi
      .spyOn(ProjectBackupService.prototype, 'exportStoryToZip')
      .mockResolvedValue(out)

    const showSaveDialog = vi
      .fn()
      .mockResolvedValueOnce({ canceled: true, filePath: undefined })
      .mockResolvedValueOnce({ canceled: false, filePath: out })
      .mockResolvedValueOnce({ canceled: false, filePath: out })

    const ctx = makeHandlerContext({
      host: {
        ...(makeHandlerContext().host as object),
        getMainWindow: () => ({ id: 1 }),
        getPrisma: () => ({}) as never,
        dialog: { showSaveDialog, showOpenDialog: vi.fn() }
      } as never,
      mediaRoot: () => join(dir!, 'media')
    })
    registerProjectbackupHandlers(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers

    await expect(
      invokeRegistered(h as never, 'project:exportBackup', 's1')
    ).resolves.toBeNull()

    await expect(
      invokeRegistered(h as never, 'project:exportBackup', 's1')
    ).resolves.toEqual({ filePath: out })

    await expect(
      invokeRegistered(h as never, 'project:exportBackup', 's1', out)
    ).resolves.toEqual({ filePath: out })
    expect(exportStoryToZip).toHaveBeenCalled()

    // no window
    const ctx2 = makeHandlerContext({
      host: {
        ...(makeHandlerContext().host as object),
        getMainWindow: () => null,
        getPrisma: () => ({}) as never,
        dialog: {
          showSaveDialog: vi.fn(async () => ({ canceled: false, filePath: out })),
          showOpenDialog: vi.fn()
        }
      } as never,
      mediaRoot: () => join(dir!, 'media')
    })
    registerProjectbackupHandlers(ctx2)
    await invokeRegistered(
      (ctx2 as { handlers: Map<string, unknown> }).handlers as never,
      'project:exportBackup',
      's1'
    )
  })

  it('importBackup dialog, missing file, success', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-pb-imp-'))
    const zip = join(dir, 'in.zip')
    writeFileSync(zip, 'zip')
    const importZipAsNewStory = vi
      .spyOn(ProjectBackupService.prototype, 'importZipAsNewStory')
      .mockResolvedValue({ storyId: 's2' } as never)

    const showOpenDialog = vi
      .fn()
      .mockResolvedValueOnce({ canceled: true, filePaths: [] })
      .mockResolvedValueOnce({ canceled: false, filePaths: [zip] })
      .mockResolvedValueOnce({ canceled: false, filePaths: [zip] })

    const ctx = makeHandlerContext({
      host: {
        ...(makeHandlerContext().host as object),
        getMainWindow: () => ({ id: 1 }),
        getPrisma: () => ({}) as never,
        dialog: { showOpenDialog, showSaveDialog: vi.fn() }
      } as never,
      mediaRoot: () => join(dir!, 'media')
    })
    registerProjectbackupHandlers(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers

    await expect(
      invokeRegistered(h as never, 'project:importBackup')
    ).resolves.toBeNull()
    await expect(
      invokeRegistered(h as never, 'project:importBackup')
    ).resolves.toMatchObject({ storyId: 's2' })
    await expect(
      invokeRegistered(h as never, 'project:importBackup', '/no.zip')
    ).rejects.toMatchObject({ message: 'errors.backupZipNotFound' })
    await invokeRegistered(h as never, 'project:importBackup', zip)
    expect(importZipAsNewStory).toHaveBeenCalled()

    const ctx2 = makeHandlerContext({
      host: {
        ...(makeHandlerContext().host as object),
        getMainWindow: () => null,
        getPrisma: () => ({}) as never,
        dialog: {
          showOpenDialog: vi.fn(async () => ({
            canceled: false,
            filePaths: [zip]
          })),
          showSaveDialog: vi.fn()
        }
      } as never,
      mediaRoot: () => join(dir!, 'media')
    })
    registerProjectbackupHandlers(ctx2)
    await invokeRegistered(
      (ctx2 as { handlers: Map<string, unknown> }).handlers as never,
      'project:importBackup'
    )
  })
})
