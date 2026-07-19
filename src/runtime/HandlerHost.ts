/**
 * Platform adapters for the shared channel registry.
 * Electron provides real dialog/shell; CLI/web use headless path-based adapters.
 */
import type { PrismaClient } from '../types/prisma'
import type { SettingsStore } from '../infrastructure/settings/SettingsStore'
import type { ActivityLog } from '../infrastructure/activity/ActivityLog'

export interface OpenDialogOptionsLike {
  title?: string
  defaultPath?: string
  filters?: Array<{ name: string; extensions: string[] }>
  properties?: Array<
    | 'openFile'
    | 'openDirectory'
    | 'multiSelections'
    | 'showHiddenFiles'
    | 'createDirectory'
  >
}

export interface SaveDialogOptionsLike {
  title?: string
  defaultPath?: string
  filters?: Array<{ name: string; extensions: string[] }>
}

export interface DialogResult {
  canceled: boolean
  filePaths: string[]
}

export interface SaveDialogResult {
  canceled: boolean
  filePath?: string
}

export interface HandlerDialog {
  showOpenDialog: (
    winOrOpts: unknown,
    maybeOpts?: OpenDialogOptionsLike
  ) => Promise<DialogResult>
  showSaveDialog: (
    winOrOpts: unknown,
    maybeOpts?: SaveDialogOptionsLike
  ) => Promise<SaveDialogResult>
}

export interface HandlerShell {
  openExternal: (url: string) => Promise<void>
  openPath: (filePath: string) => Promise<string>
  showItemInFolder: (filePath: string) => void
}

export interface HandlerHost {
  mode: 'electron' | 'headless'
  userData: string
  mediaRoot: string
  appVersion: string
  isPackaged: boolean
  platform: string
  getPrisma: () => PrismaClient
  settingsStore: SettingsStore
  activity: ActivityLog
  dialog: HandlerDialog
  shell: HandlerShell
  /** Main window for modal dialogs (electron only). */
  getMainWindow: () => unknown
  rebuildApplicationMenu?: () => void
  resolveDatabasePath?: () => string
  exportFullBackup?: () => void | Promise<void>
  importFullBackup?: () => void | Promise<void>
  /** Push generation progress (electron → renderer; CLI stores last). */
  emitGenerationProgress?: (payload: unknown) => void
  getLastGenerationProgress?: () => unknown
  /** Optional: open admin in BrowserWindow (electron). */
  openAdminWindow?: (url: string) => Promise<{
    ok: true
    url: string
    reused?: boolean
    state?: string
    healthOk?: boolean
  }>
}
