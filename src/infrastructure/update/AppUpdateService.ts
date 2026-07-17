import { app } from 'electron'
import type { BrowserWindow } from 'electron'
import { autoUpdater, type UpdateInfo } from 'electron-updater'

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'
  | 'dev-skipped'

export interface UpdateState {
  status: UpdateStatus
  currentVersion: string
  latestVersion?: string
  progress?: number
  message?: string
  releaseNotes?: string | null
}

/**
 * GitHub Releases auto-update (electron-updater).
 * Dev / non-packaged builds skip network checks.
 */
export class AppUpdateService {
  private state: UpdateState
  private win: (() => BrowserWindow | null) | null = null
  private wired = false

  constructor() {
    this.state = {
      status: 'idle',
      currentVersion: app.getVersion()
    }
  }

  bindWindow(getWin: () => BrowserWindow | null): void {
    this.win = getWin
    this.wireOnce()
  }

  getState(): UpdateState {
    return { ...this.state }
  }

  async check(): Promise<UpdateState> {
    if (!app.isPackaged) {
      this.setState({
        status: 'dev-skipped',
        message: 'Updates only run in packaged builds.'
      })
      return this.getState()
    }
    this.setState({ status: 'checking', message: 'Checking for updates…' })
    try {
      const result = await autoUpdater.checkForUpdates()
      if (!result?.updateInfo) {
        this.setState({
          status: 'not-available',
          message: 'No update info returned.'
        })
      }
      return this.getState()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.setState({ status: 'error', message })
      return this.getState()
    }
  }

  async download(): Promise<UpdateState> {
    if (!app.isPackaged) {
      this.setState({
        status: 'dev-skipped',
        message: 'Updates only run in packaged builds.'
      })
      return this.getState()
    }
    if (this.state.status !== 'available' && this.state.status !== 'downloaded') {
      await this.check()
    }
    if (this.state.status === 'available') {
      this.setState({ status: 'downloading', progress: 0 })
      try {
        await autoUpdater.downloadUpdate()
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        this.setState({ status: 'error', message })
      }
    }
    return this.getState()
  }

  quitAndInstall(): { ok: boolean; message?: string } {
    if (!app.isPackaged) {
      return { ok: false, message: 'Not packaged' }
    }
    if (this.state.status !== 'downloaded') {
      return { ok: false, message: 'No update downloaded' }
    }
    autoUpdater.quitAndInstall(false, true)
    return { ok: true }
  }

  private wireOnce(): void {
    if (this.wired) return
    this.wired = true

    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = true
    // Allow unsigned RC feeds when channel is open
    autoUpdater.allowPrerelease = false

    autoUpdater.on('checking-for-update', () => {
      this.setState({ status: 'checking' })
    })
    autoUpdater.on('update-available', (info: UpdateInfo) => {
      this.setState({
        status: 'available',
        latestVersion: info.version,
        releaseNotes:
          typeof info.releaseNotes === 'string'
            ? info.releaseNotes
            : Array.isArray(info.releaseNotes)
              ? info.releaseNotes.map((n) => n.note).join('\n')
              : null,
        message: `Update ${info.version} available`
      })
    })
    autoUpdater.on('update-not-available', () => {
      this.setState({
        status: 'not-available',
        latestVersion: app.getVersion(),
        message: 'You are on the latest version.'
      })
    })
    autoUpdater.on('download-progress', (p) => {
      this.setState({
        status: 'downloading',
        progress: Math.round(p.percent)
      })
    })
    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
      this.setState({
        status: 'downloaded',
        latestVersion: info.version,
        progress: 100,
        message: `Downloaded ${info.version}. Restart to install.`
      })
    })
    autoUpdater.on('error', (err) => {
      this.setState({
        status: 'error',
        message: err?.message ?? String(err)
      })
    })
  }

  private setState(partial: Partial<UpdateState>): void {
    this.state = {
      ...this.state,
      currentVersion: app.getVersion(),
      ...partial
    }
    const w = this.win?.()
    w?.webContents.send('updates:state', this.getState())
  }
}

export const appUpdateService = new AppUpdateService()
