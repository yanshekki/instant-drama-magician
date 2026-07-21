/**
 * Platform adapters for HandlerHost (electron vs headless CLI/web).
 */
import { execFile } from 'child_process'
import { promisify } from 'util'
import { existsSync } from 'fs'
import { AppError } from '../types/errors'
import type {
  HandlerDialog,
  HandlerShell,
  OpenDialogOptionsLike,
  SaveDialogOptionsLike
} from './HandlerHost'

const execFileAsync = promisify(execFile)

export function createHeadlessDialog(): HandlerDialog {
  return {
    showOpenDialog: async (winOrOpts, maybeOpts) => {
      const opts = (maybeOpts || winOrOpts || {}) as OpenDialogOptionsLike
      const envPick =
        process.env.IDM_PICK_FILE ||
        process.env.IDM_OPEN_PATH ||
        ''
      if (envPick && existsSync(envPick)) {
        return { canceled: false, filePaths: [envPick] }
      }
      throw new AppError(
        'VALIDATION',
        'errors.headlessPickFile',
        opts.title || 'open dialog'
      )
    },
    showSaveDialog: async (winOrOpts, maybeOpts) => {
      const opts = (maybeOpts || winOrOpts || {}) as SaveDialogOptionsLike
      const envSave =
        process.env.IDM_SAVE_PATH ||
        process.env.IDM_SAVE_FILE ||
        opts.defaultPath ||
        ''
      if (envSave) {
        return { canceled: false, filePath: envSave }
      }
      throw new AppError(
        'VALIDATION',
        'errors.headlessSavePath',
        opts.title || 'save dialog'
      )
    }
  }
}

export function createHeadlessShell(): HandlerShell {
  return {
    openExternal: async (url: string) => {
      try {
        if (process.platform === 'darwin') {
          await execFileAsync('open', [url])
        } else if (process.platform === 'win32') {
          await execFileAsync('cmd', ['/c', 'start', '', url])
        } else {
          await execFileAsync('xdg-open', [url])
        }
      } catch {
        // Non-fatal in headless/server environments
        if (process.env.IDM_DEBUG) {
          // eslint-disable-next-line no-console
          console.warn('[idm] openExternal failed:', url)
        }
      }
    },
    openPath: async (filePath: string) => {
      try {
        if (process.platform === 'darwin') {
          await execFileAsync('open', [filePath])
        } else if (process.platform === 'win32') {
          await execFileAsync('cmd', ['/c', 'start', '', filePath])
        } else {
          await execFileAsync('xdg-open', [filePath])
        }
        return ''
      } catch (e) {
        return e instanceof Error ? e.message : String(e)
      }
    },
    showItemInFolder: (filePath: string) => {
      void createHeadlessShell().openPath(filePath)
    }
  }
}
