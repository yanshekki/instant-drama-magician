/**
 * Domain IPC handlers (split for maintainability).
 */
import { copyFileSync, existsSync, mkdirSync, statSync } from 'fs'
import { basename, extname, join } from 'path'
import type { AppSettings } from '../../types/settings'
import { AppError } from '../../types/errors'
import type { OpenDialogOptionsLike } from '../HandlerHost'
import type { HandlerContext } from './context'

/** Cache-bust token for local media URLs (mtime, or now on race). Exported for tests. */
export function mediaCacheBust(filePath: string, now = Date.now()): number {
  try {
    return statSync(filePath).mtimeMs
  } catch {
    return now
  }
}

export function registerMediaHandlers(ctx: HandlerContext): void {
  const {
    reg,
    host,
    generation,
    rebindAi,
    mediaRoot,
    activity,
    settingsStore
  } = ctx

// ─── Media ─────────────────────────────────────────────────
reg(
  'media:pickRefImage',
  (async (filePath?: string) => {
    let src =
      typeof filePath === 'string' && filePath.trim() ? filePath.trim() : ''
    if (!src) {
      const win = host.getMainWindow()
      const options: OpenDialogOptionsLike = {
        title: 'Select reference image',
        filters: [
          { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }
        ],
        properties: ['openFile']
      }
      const result = win
        ? await host.dialog.showOpenDialog(win, options)
        : await host.dialog.showOpenDialog(options)
      if (result.canceled || result.filePaths.length === 0) return null
      src = result.filePaths[0]
    }
    if (!existsSync(src)) {
      throw new AppError('NOT_FOUND', 'errors.imageNotFound', String(src))
    }
    const destDir = join(mediaRoot(), 'refs')
    mkdirSync(destDir, { recursive: true })
    const dest = join(
      destDir,
      `${Date.now()}${extname(src) || '.png'}`
    )
    copyFileSync(src, dest)
    return { filePath: dest, originalName: basename(src) }
  })
)

reg(
  'media:exportStoryboard',
  (async ( storyId: string) => generation().exportStoryboard(storyId))
)

reg(
  'media:exportConcat',
  (async ( storyId: string) => generation().exportConcat(storyId))
)

reg(
  'media:exportFinal',
  (
    async (
      storyId: string,
      options?: Partial<{
        exportProfile: 'balanced' | 'fast'
        burnSubtitles: boolean
        includeSilentAudio: boolean
        bgmVolume: number
        dialogueVolume: number
        openExportFolder: boolean
      }>
    ) => {
      // Remember last one-shot export choices (not a permanent Settings tab)
      if (options && typeof options === 'object') {
        const patch: Record<string, unknown> = {}
        if (options.exportProfile === 'balanced' || options.exportProfile === 'fast') {
          patch.exportProfile = options.exportProfile
        }
        if (typeof options.burnSubtitles === 'boolean') {
          patch.burnSubtitles = options.burnSubtitles
        }
        if (typeof options.includeSilentAudio === 'boolean') {
          patch.includeSilentAudio = options.includeSilentAudio
        }
        if (typeof options.bgmVolume === 'number') {
          patch.bgmVolume = options.bgmVolume
        }
        if (typeof options.dialogueVolume === 'number') {
          patch.dialogueVolume = options.dialogueVolume
        }
        if (typeof options.openExportFolder === 'boolean') {
          patch.openExportFolder = options.openExportFolder
        }
        if (Object.keys(patch).length > 0) {
          const next = settingsStore.save(patch as Partial<AppSettings>)
          rebindAi(next)
        }
      }
      const result = await generation().exportFinal(storyId, options)
      activity.append({
        kind: 'export',
        message: 'final',
        storyId,
        meta: { path: result.outputPath, options: options ?? null }
      })
      return result
    }
  )
)

reg(
  'media:listExports',
  (async ( storyId: string) => generation().listExports(storyId))
)

reg(
  'media:deleteExport',
  (async ( storyId: string, exportId: string) => {
    const result = await generation().deleteExport(storyId, exportId)
    activity.append({
      kind: 'export',
      message: 'delete',
      storyId,
      meta: { exportId, ok: result.ok }
    })
    return result
  })
)

reg(
  'media:toPreviewUrl',
  (async ( filePath: string) => {
    if (!filePath || !existsSync(filePath)) {
      throw new AppError('NOT_FOUND', 'errors.mediaNotFound')
    }
    // Bust Chromium cache when the same path is rewritten (mtime changes).
    const bust = mediaCacheBust(filePath)
    const url = `idm-media://local/?p=${encodeURIComponent(filePath)}&t=${bust}`
    return { url, filePath }
  })
)

/**
 * Save / download local media.
 * - Electron: native Save dialog + copy
 * - Web/headless (no dest): return downloadUrl for /api/download (no server-side copy)
 * - CLI: pass destPath or IDM_SAVE_PATH
 */
reg(
  'media:saveAs',
  (async (filePath: string, destPath?: string) => {
    if (!filePath || !existsSync(filePath)) {
      throw new AppError('NOT_FOUND', 'errors.mediaNotFound')
    }
    const {
      buildMediaDownloadResult,
      mediaSaveAsKind,
      saveAsDialogFilters
    } = await import('../../domain/mediaSaveAs')

    let to =
      typeof destPath === 'string' && destPath.trim()
        ? destPath.trim()
        : process.env.IDM_SAVE_PATH || ''

    if (!to) {
      // Web / CLI headless: browser attachment via /api/download (never write cwd)
      if (host.mode === 'headless') {
        const dl = buildMediaDownloadResult(filePath)
        activity.append({
          kind: 'media',
          message: 'saveAs-download',
          meta: { from: filePath, fileName: dl.fileName, kind: dl.kind }
        })
        return dl
      }
      const win = host.getMainWindow()
      const options = {
        title: 'Save as',
        defaultPath: basename(filePath),
        filters: saveAsDialogFilters(filePath)
      }
      const result = win
        ? await host.dialog.showSaveDialog(win, options)
        : await host.dialog.showSaveDialog(options)
      if (result.canceled || !result.filePath) return null
      to = result.filePath
    }

    copyFileSync(filePath, to)
    activity.append({
      kind: 'media',
      message: 'saveAs',
      meta: { from: filePath, to }
    })
    return {
      filePath: to,
      fileName: basename(to),
      kind: mediaSaveAsKind(filePath)
    }
  })
)

reg(
  'media:checkFfmpeg',
  (async () => {
    const { FfmpegService } = await import(
      '../../infrastructure/ffmpeg/FfmpegService'
    )
    try {
      const svc = new FfmpegService()
      await svc.ensureAvailable()
      // Path kept for support/diagnostics; UI only surfaces failures
      // (FFmpeg is a hard dependency of the product).
      return {
        available: true,
        message: 'ready',
        path: svc.binaryPath
      }
    } catch (error) {
      return {
        available: false,
        message: error instanceof Error ? error.message : String(error)
      }
    }
  })
)

reg(
  'media:exportPreflight',
  (async ( storyId: string) => generation().exportPreflight(storyId))
)

reg(
  'app:getInfo',
  (async () => ({
    version: host.appVersion,
    name: 'InstantDrama Magician',
    electron: process.versions.electron ?? 'unknown',
    userData: host.userData,
    mediaRoot: mediaRoot(),
    isPackaged: host.isPackaged,
    platform: process.platform
  }))
)

}
