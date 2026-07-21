/**
 * Embedded web server (browser control) IPC handlers.
 */
import type { HandlerContext } from './context'
import { AppError } from '../../types/errors'
import { syncEmbeddedWebServer } from './embeddedWebServerSync'

export function registerWebserverHandlers(ctx: HandlerContext): void {
  const { reg, host, settingsStore } = ctx

  const sync = (s: Parameters<typeof syncEmbeddedWebServer>[0]) =>
    syncEmbeddedWebServer(s, {
      settingsStore,
      userData: host.userData,
      appVersion: host.appVersion,
      isPackaged: host.isPackaged
    })

  reg('webServer:status', async () => {
    const { getEmbeddedWebServer } = await import(
      '../../infrastructure/webserver/EmbeddedWebServer'
    )
    return getEmbeddedWebServer().getStatus()
  })

  reg('webServer:start', async () => {
    const next = settingsStore.save({ webServerEnabled: true })
    try {
      return await sync(next)
    } catch (e) {
      settingsStore.save({ webServerEnabled: false })
      throw e instanceof AppError
        ? e
        : new AppError('IO', e instanceof Error ? e.message : String(e))
    }
  })

  reg('webServer:stop', async () => {
    settingsStore.save({ webServerEnabled: false })
    const { getEmbeddedWebServer } = await import(
      '../../infrastructure/webserver/EmbeddedWebServer'
    )
    return getEmbeddedWebServer().stop()
  })

  reg('webServer:generateToken', async () => {
    const { generateWebServerToken } = await import(
      '../../infrastructure/webserver/EmbeddedWebServer'
    )
    const token = generateWebServerToken()
    const next = settingsStore.save({ webServerAuthToken: token })
    if (next.webServerEnabled) {
      await sync(next)
    }
    return { token, settings: next }
  })
}
