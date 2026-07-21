/**
 * Domain IPC handlers (split for maintainability).
 */
import type { AppSettings } from '../../types/settings'
import type { HandlerContext } from './context'
import { syncEmbeddedWebServer } from './embeddedWebServerSync'

export function registerSettingsHandlers(ctx: HandlerContext): void {
  const {
    reg,
    host,
    rebindAi,
    activity,
    settingsStore
  } = ctx

// ─── Settings ──────────────────────────────────────────────
reg(
  'settings:get',
  (async () => {
    const s = settingsStore.load()
    if (settingsStore.lastLoadMigrated) {
      activity.append({
        kind: 'settings',
        message: 'migrated gateway defaults 39281 → 3847'
      })
      settingsStore.lastLoadMigrated = false
    }
    return s
  })
)
reg(
  'settings:set',
  (async ( partial: Partial<AppSettings>) => {
    const prev = settingsStore.load()
    const prevLang = prev.uiLanguage
    const next = settingsStore.save(partial)
    rebindAi(next)
    // Auto-start local gateway when user switches to / saves Grok preset
    if (
      next.llmProvider === 'grok-gateway' ||
      next.imageProvider === 'grok-gateway' ||
      next.videoProvider === 'grok-gateway'
    ) {
      void import('../../infrastructure/gateway/GrokGatewayService')
        .then(({ getGrokGatewayService }) =>
          getGrokGatewayService().ensureRunning()
        )
        .catch(() => undefined)
    }
    if (
      partial.uiLanguage !== undefined &&
      partial.uiLanguage !== prevLang &&
      host.rebuildApplicationMenu
    ) {
      try {
        host.rebuildApplicationMenu()
      } catch {
        /* non-fatal */
      }
    }
    // Sync embedded web server when related ctx.settings change
    const webTouched =
      partial.webServerEnabled !== undefined ||
      partial.webServerPort !== undefined ||
      partial.webServerHost !== undefined ||
      partial.webServerAuthToken !== undefined
    if (webTouched) {
      void syncEmbeddedWebServer(next, {
        settingsStore,
        userData: host.userData,
        appVersion: host.appVersion,
        isPackaged: host.isPackaged
      }).catch(() => undefined)
    }
    return next
  })
)

}
