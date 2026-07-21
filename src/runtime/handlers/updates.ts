/**
 * Domain IPC handlers (split for maintainability).
 */
import { detectInstallChannel, githubReleaseUrl } from '../../domain/installChannel'
import {
  NPM_INSTALL_CMD,
  NPM_PACKAGE_NAME,
  checkNpmPackageUpdate
} from '../../infrastructure/update/npmPackageUpdate'
import type { HandlerContext } from './context'

/** Exported for residual tests (import failure → null). */
export async function loadUpdateService() {
  try {
    const mod = await import('../../infrastructure/update/AppUpdateService')
    return mod.appUpdateService
  } catch {
    return null
  }
}

/** Exported for residual tests (web/packaged channel mapping). */
export function nonDesktopUpdateState(
  status: 'dev-skipped' | 'web-skipped',
  host: { isPackaged: boolean; appVersion: string }
) {
  const channel = detectInstallChannel({
    isElectron: Boolean(process.versions.electron),
    isPackaged: host.isPackaged,
    isWeb: !process.versions.electron
  })
  const isWeb = channel === 'web' || status === 'web-skipped'
  return {
    channel: isWeb
      ? ('web' as const)
      : channel === 'desktop-packaged'
        ? ('desktop-dev' as const)
        : channel,
    status: isWeb ? ('web-skipped' as const) : ('dev-skipped' as const),
    currentVersion: host.appVersion,
    messageKey: isWeb ? 'updateWebOnly' : 'updateDevSkipped',
    message: isWeb
      ? 'Use the desktop app or CLI to update'
      : 'Updates only run in packaged builds.',
    releaseUrl: githubReleaseUrl(),
    installCommand: NPM_INSTALL_CMD,
    canAutoInstall: false,
    canDownload: false,
    canCheck: false,
    source: 'none' as const
  }
}

export function registerUpdatesHandlers(ctx: HandlerContext): void {
  const { reg, host, activity } = ctx

  reg('updates:status', async () => {
    const svc = await loadUpdateService()
    if (!svc) {
      return nonDesktopUpdateState(
        process.versions.electron ? 'dev-skipped' : 'web-skipped',
        host
      )
    }
    return svc.getState()
  })

  reg('updates:check', async (opts?: { silent?: boolean }) => {
    const svc = await loadUpdateService()
    if (!svc) {
      return nonDesktopUpdateState(
        process.versions.electron ? 'dev-skipped' : 'web-skipped',
        host
      )
    }
    const state = await svc.check({ silent: Boolean(opts?.silent) })
    activity.append({
      kind: 'update',
      message: `check → ${state.status}`,
      meta: {
        latest: state.latestVersion ?? null,
        silent: Boolean(opts?.silent)
      }
    })
    return state
  })

  reg('updates:download', async () => {
    const svc = await loadUpdateService()
    if (!svc) {
      return nonDesktopUpdateState(
        process.versions.electron ? 'dev-skipped' : 'web-skipped',
        host
      )
    }
    const state = await svc.download()
    activity.append({ kind: 'update', message: `download → ${state.status}` })
    return state
  })

  reg('updates:install', async () => {
    const svc = await loadUpdateService()
    if (!svc) {
      return {
        ok: false,
        message: 'Auto-update requires Electron packaged build',
        messageKey: 'updateDevSkipped'
      }
    }
    activity.append({ kind: 'update', message: 'quitAndInstall' })
    return svc.quitAndInstall()
  })

  reg('updates:checkNpm', async () => {
    const result = await checkNpmPackageUpdate(
      NPM_PACKAGE_NAME,
      host.appVersion
    )
    activity.append({
      kind: 'update',
      message: `npm check → ${result.updateAvailable ? 'available' : result.error ? 'error' : 'ok'}`,
      meta: { latest: result.latestVersion, error: result.error ?? null }
    })
    return {
      ...result,
      channel: 'cli-npm' as const,
      installCommand: result.installCommand || NPM_INSTALL_CMD
    }
  })

  reg('updates:openReleasePage', async (version?: string) => {
    const href = githubReleaseUrl(version || undefined)
    try {
      await host.shell.openExternal(href)
      return { ok: true as const, url: href }
    } catch (e) {
      return {
        ok: false as const,
        url: href,
        message: e instanceof Error ? e.message : String(e)
      }
    }
  })
}
