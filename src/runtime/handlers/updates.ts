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

/**
 * True when running under a real Electron process (desktop).
 * Headless web server / CLI must NOT load electron-updater — importing it
 * still succeeds via the electron package stub and reports version 0.0.0 / desktop-dev.
 */
export function isElectronDesktopRuntime(
  hostMode?: 'electron' | 'headless'
): boolean {
  if (hostMode === 'headless') return false
  if (hostMode === 'electron') return true
  return Boolean(process.versions.electron)
}

/** Exported for residual tests (import failure → null). */
export async function loadUpdateService(
  hostMode?: 'electron' | 'headless'
) {
  // Never load electron-updater outside Electron — avoids fake 0.0.0 / desktop-dev on web.
  if (!isElectronDesktopRuntime(hostMode)) return null
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
  host: { isPackaged: boolean; appVersion: string; mode?: 'electron' | 'headless' }
) {
  const isElectron = isElectronDesktopRuntime(host.mode)
  // Headless web → isWeb true → channel "web". Electron uses packaged/dev mapping.
  // (Do not force isWeb via !isElectron after channel detect — tests may mock channel.)
  const channel = detectInstallChannel({
    isElectron,
    isPackaged: host.isPackaged,
    isWeb: !isElectron
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

  const webOrDevFallback = (): ReturnType<typeof nonDesktopUpdateState> =>
    nonDesktopUpdateState(
      isElectronDesktopRuntime(host.mode) ? 'dev-skipped' : 'web-skipped',
      host
    )

  reg('updates:status', async () => {
    if (!isElectronDesktopRuntime(host.mode)) {
      return webOrDevFallback()
    }
    const svc = await loadUpdateService(host.mode)
    if (!svc) return webOrDevFallback()
    return svc.getState()
  })

  reg('updates:check', async (opts?: { silent?: boolean }) => {
    if (!isElectronDesktopRuntime(host.mode)) {
      return webOrDevFallback()
    }
    const svc = await loadUpdateService(host.mode)
    if (!svc) return webOrDevFallback()
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
    if (!isElectronDesktopRuntime(host.mode)) {
      return webOrDevFallback()
    }
    const svc = await loadUpdateService(host.mode)
    if (!svc) return webOrDevFallback()
    const state = await svc.download()
    activity.append({ kind: 'update', message: `download → ${state.status}` })
    return state
  })

  reg('updates:install', async () => {
    if (!isElectronDesktopRuntime(host.mode)) {
      return {
        ok: false,
        message: 'Auto-update is not available in the web app',
        messageKey: 'updateWebOnly'
      }
    }
    const svc = await loadUpdateService(host.mode)
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
    // Headless/web server: never xdg-open on the machine hosting the API —
    // return openUrl so the browser client can window.open.
    if (host.mode === 'headless' || !process.versions.electron) {
      return { ok: true as const, url: href, openUrl: href }
    }
    try {
      await host.shell.openExternal(href)
      return { ok: true as const, url: href, openUrl: href }
    } catch (e) {
      return {
        ok: false as const,
        url: href,
        openUrl: href,
        message: e instanceof Error ? e.message : String(e)
      }
    }
  })
}
