/**
 * Domain IPC handlers (split for maintainability).
 */
import { existsSync } from 'fs'
import { ProjectBackupService } from '../../application/services'
import { MediaStore } from '../../infrastructure/media/MediaStore'
import { AppError } from '../../types/errors'
import type { OpenDialogOptionsLike } from '../HandlerHost'
import type { HandlerContext } from './context'

export function registerProjectbackupHandlers(ctx: HandlerContext): void {
  const {
    reg,
    host,
    mediaRoot
  } = ctx

// ─── Project backup ────────────────────────────────────────
const backup = (): ProjectBackupService =>
  new ProjectBackupService(host.getPrisma(), new MediaStore(mediaRoot()))

reg(
  'project:exportBackup',
  (async (storyId: string, destPath?: string) => {
    let outPath =
      typeof destPath === 'string' && destPath.trim()
        ? destPath.trim()
        : ''
    if (!outPath) {
      const win = host.getMainWindow()
      const result = win
        ? await host.dialog.showSaveDialog(win, {
            title: 'Export story backup',
            defaultPath: `story-${storyId}.idm.zip`,
            filters: [{ name: 'IDM Backup', extensions: ['zip'] }]
          })
        : await host.dialog.showSaveDialog({
            title: 'Export story backup',
            defaultPath: `story-${storyId}.idm.zip`,
            filters: [{ name: 'IDM Backup', extensions: ['zip'] }]
          })
      if (result.canceled || !result.filePath) return null
      outPath = result.filePath
    }
    const path = await backup().exportStoryToZip(storyId, outPath)
    return { filePath: path }
  })
)

reg(
  'project:importBackup',
  (async (zipPath?: string) => {
    let src =
      typeof zipPath === 'string' && zipPath.trim() ? zipPath.trim() : ''
    if (!src) {
      const win = host.getMainWindow()
      const options: OpenDialogOptionsLike = {
        title: 'Import story backup',
        filters: [{ name: 'IDM Backup', extensions: ['zip'] }],
        properties: ['openFile']
      }
      const result = win
        ? await host.dialog.showOpenDialog(win, options)
        : await host.dialog.showOpenDialog(options)
      if (result.canceled || result.filePaths.length === 0) return null
      src = result.filePaths[0]
    }
    if (!existsSync(src)) {
      throw new AppError('NOT_FOUND', 'errors.backupZipNotFound', String(src))
    }
    return backup().importZipAsNewStory(src)
  })
)

}
