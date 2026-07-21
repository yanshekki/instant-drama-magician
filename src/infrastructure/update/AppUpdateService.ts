import { app } from 'electron'
import type { BrowserWindow } from 'electron'
import { autoUpdater, type UpdateInfo } from 'electron-updater'
import {
  detectInstallChannel,
  githubReleaseUrl,
  type InstallChannel
} from '../../domain/installChannel'
import { classifyUpdateError, type UpdateState } from './updateTypes'
import { NPM_INSTALL_CMD } from './npmPackageUpdate'

export type { UpdateState, UpdateStatus } from './updateTypes'

/**
 * GitHub Releases auto-update (electron-updater).
 * Packaged builds only; dev/web get informational state.
 */
export class AppUpdateService {
  private state: UpdateState
  private win: (() => BrowserWindow | null) | null = null
  private wired = false
  private silentCheck = false

  constructor() {
    const channel = this.resolveChannel()
    this.state = this.initialState(channel)
  }

  private resolveChannel(): InstallChannel {
    try {
      return detectInstallChannel({
        isElectron: true,
        isPackaged: app.isPackaged
      })
    } catch {
      return 'desktop-dev'
    }
  }

  private initialState(channel: InstallChannel): UpdateState {
    const currentVersion = safeAppVersion()
    const isPackaged = channel === 'desktop-packaged'
    return {
      channel,
      status: isPackaged ? 'idle' : 'dev-skipped',
      currentVersion,
      releaseUrl: githubReleaseUrl(),
      installCommand: NPM_INSTALL_CMD,
      canAutoInstall: false,
      canDownload: false,
      canCheck: isPackaged,
      source: isPackaged ? 'github' : 'none',
      messageKey: isPackaged ? 'updateIdle' : 'updateDevSkipped',
      message: isPackaged
        ? 'No update check has been run yet.'
        : 'Updates only run in packaged builds.'
    }
  }

  bindWindow(getWin: () => BrowserWindow | null): void {
    this.win = getWin
    this.wireOnce()
  }

  getState(): UpdateState {
    return { ...this.state }
  }

  /**
   * @param opts.silent — startup background check: do not flip UI to "checking"
   *   if we already know status; still updates when result arrives.
   */
  async check(opts?: { silent?: boolean }): Promise<UpdateState> {
    const channel = this.resolveChannel()
    if (channel !== 'desktop-packaged') {
      this.setState({
        channel,
        status: 'dev-skipped',
        canCheck: false,
        canDownload: false,
        canAutoInstall: false,
        source: 'none',
        messageKey: 'updateDevSkipped',
        message: 'Updates only run in packaged builds.',
        releaseUrl: githubReleaseUrl(),
        installCommand: NPM_INSTALL_CMD
      })
      return this.getState()
    }

    this.silentCheck = Boolean(opts?.silent)
    if (!this.silentCheck) {
      this.setState({
        status: 'checking',
        messageKey: 'updateChecking',
        message: 'Checking for updates…',
        canCheck: true,
        canDownload: false,
        canAutoInstall: false,
        source: 'github'
      })
    } else if (this.state.status === 'idle') {
      // Soft: mark checking without aggressive toast pressure
      this.setState({
        status: 'checking',
        messageKey: 'updateChecking',
        message: 'Checking for updates…',
        source: 'github',
        canCheck: true
      })
    }

    try {
      const result = await autoUpdater.checkForUpdates()
      // Events usually set final state; if nothing fired, mark soft result
      if (
        !result?.updateInfo &&
        (this.state.status === 'checking' || this.state.status === 'idle')
      ) {
        this.setState({
          status: 'not-available',
          messageKey: 'updateUpToDate',
          message: 'No update info returned.',
          latestVersion: safeAppVersion(),
          canDownload: false,
          canAutoInstall: false
        })
      }
      return this.getState()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.setState({
        status: 'error',
        message,
        messageKey: 'updateCheckFail',
        errorKind: classifyUpdateError(message),
        canDownload: false,
        canAutoInstall: false,
        releaseUrl: githubReleaseUrl()
      })
      return this.getState()
    } finally {
      this.silentCheck = false
    }
  }

  async download(): Promise<UpdateState> {
    if (this.resolveChannel() !== 'desktop-packaged') {
      this.setState({
        status: 'dev-skipped',
        messageKey: 'updateDevSkipped',
        message: 'Updates only run in packaged builds.',
        canDownload: false,
        canAutoInstall: false
      })
      return this.getState()
    }
    if (this.state.status !== 'available' && this.state.status !== 'downloaded') {
      await this.check()
    }
    if (this.state.status === 'available') {
      this.setState({
        status: 'downloading',
        progress: 0,
        messageKey: 'updateDownloading',
        message: 'Downloading update…',
        canDownload: false,
        canAutoInstall: false
      })
      try {
        await autoUpdater.downloadUpdate()
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        this.setState({
          status: 'error',
          message,
          messageKey: 'updateDownloadFail',
          errorKind: classifyUpdateError(message),
          canDownload: true,
          canAutoInstall: false
        })
      }
    }
    return this.getState()
  }

  quitAndInstall(): { ok: boolean; message?: string; messageKey?: string } {
    if (this.resolveChannel() !== 'desktop-packaged') {
      return {
        ok: false,
        message: 'Not packaged',
        messageKey: 'updateDevSkipped'
      }
    }
    if (this.state.status !== 'downloaded') {
      return {
        ok: false,
        message: 'No update downloaded',
        messageKey: 'updateInstallFail'
      }
    }
    autoUpdater.quitAndInstall(false, true)
    return { ok: true }
  }

  private wireOnce(): void {
    if (this.wired) return
    this.wired = true

    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.allowPrerelease = false

    autoUpdater.on('checking-for-update', () => {
      if (this.silentCheck && this.state.status !== 'idle') return
      this.setState({
        status: 'checking',
        messageKey: 'updateChecking',
        source: 'github',
        canCheck: true
      })
    })
    autoUpdater.on('update-available', (info: UpdateInfo) => {
      const notes = normalizeReleaseNotes(info.releaseNotes)
      this.setState({
        status: 'available',
        latestVersion: info.version,
        releaseNotes: notes,
        releaseUrl: githubReleaseUrl(info.version),
        messageKey: 'updateAvailableToast',
        message: `Update ${info.version} available`,
        canDownload: true,
        canAutoInstall: false,
        canCheck: true,
        source: 'github',
        progress: undefined,
        errorKind: undefined
      })
    })
    autoUpdater.on('update-not-available', (info?: UpdateInfo) => {
      this.setState({
        status: 'not-available',
        latestVersion: info?.version ?? safeAppVersion(),
        messageKey: 'updateUpToDate',
        message: 'You are on the latest version.',
        canDownload: false,
        canAutoInstall: false,
        canCheck: true,
        source: 'github',
        releaseUrl: githubReleaseUrl(info?.version ?? safeAppVersion()),
        errorKind: undefined
      })
    })
    autoUpdater.on('download-progress', (p) => {
      this.setState({
        status: 'downloading',
        progress: Math.round(p.percent),
        messageKey: 'updateDownloading',
        canDownload: false,
        canAutoInstall: false
      })
    })
    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
      this.setState({
        status: 'downloaded',
        latestVersion: info.version,
        progress: 100,
        releaseNotes: normalizeReleaseNotes(info.releaseNotes) ?? this.state.releaseNotes,
        releaseUrl: githubReleaseUrl(info.version),
        messageKey: 'updateDownloadedToast',
        message: `Downloaded ${info.version}. Restart to install.`,
        canDownload: false,
        canAutoInstall: true,
        canCheck: true,
        source: 'github',
        errorKind: undefined
      })
    })
    autoUpdater.on('error', (err) => {
      const message = err?.message ?? String(err)
      this.setState({
        status: 'error',
        message,
        messageKey: 'updateCheckFail',
        errorKind: classifyUpdateError(message),
        canDownload: this.state.status === 'available',
        canAutoInstall: false,
        releaseUrl: githubReleaseUrl(this.state.latestVersion)
      })
    })
  }

  private setState(partial: Partial<UpdateState>): void {
    const channel = partial.channel ?? this.resolveChannel()
    const isPackaged = channel === 'desktop-packaged'
    const nextSource =
      partial.source ??
      (isPackaged
        ? this.state.source === 'none'
          ? 'github'
          : this.state.source
        : 'none')
    this.state = {
      ...this.state,
      ...partial,
      channel,
      currentVersion: safeAppVersion(),
      source: nextSource,
      canCheck:
        partial.canCheck !== undefined
          ? partial.canCheck
          : isPackaged
            ? this.state.canCheck || true
            : false
    }
    if (!isPackaged) {
      this.state.canCheck = false
      this.state.canDownload = false
      this.state.canAutoInstall = false
    }
    const w = this.win?.()
    w?.webContents.send('updates:state', this.getState())
  }
}

function safeAppVersion(): string {
  try {
    return app.getVersion()
  } catch {
    return '0.0.0'
  }
}

function normalizeReleaseNotes(
  notes: UpdateInfo['releaseNotes']
): string | null {
  if (notes == null) return null
  if (typeof notes === 'string') return notes.trim() || null
  if (Array.isArray(notes)) {
    return notes
      .map((n) => (typeof n === 'string' ? n : n?.note ?? ''))
      .filter(Boolean)
      .join('\n')
      .trim() || null
  }
  return null
}

export const appUpdateService = new AppUpdateService()
