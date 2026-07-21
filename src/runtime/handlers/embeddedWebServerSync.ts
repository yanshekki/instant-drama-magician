/**
 * Shared embedded web-server start/stop used by settings + webServer handlers.
 */
import { existsSync } from 'fs'
import { join } from 'path'
import type { AppSettings } from '../../types/settings'
import type { SettingsStore } from '../../infrastructure/settings/SettingsStore'

export async function resolveWebStaticDir(): Promise<string> {
  const candidates = [
    join(__dirname, '../renderer'),
    join(process.cwd(), 'out', 'renderer')
  ]
  for (const c of candidates) {
    if (existsSync(join(c, 'index.html'))) return c
  }
  return candidates[0]
}

export async function syncEmbeddedWebServer(
  s: AppSettings,
  opts: {
    settingsStore: SettingsStore
    userData: string
    appVersion: string
    isPackaged: boolean
  }
): Promise<
  import('../../infrastructure/webserver/EmbeddedWebServer').WebServerStatus
> {
  const { getEmbeddedWebServer, generateWebServerToken } = await import(
    '../../infrastructure/webserver/EmbeddedWebServer'
  )
  const ws = getEmbeddedWebServer()
  if (!s.webServerEnabled) {
    return ws.stop()
  }
  let token = s.webServerAuthToken?.trim() || ''
  let settings = s
  if (!token) {
    token = generateWebServerToken()
    opts.settingsStore.save({ webServerAuthToken: token })
    settings = opts.settingsStore.load()
  }
  const staticDir = await resolveWebStaticDir()
  return ws.start({
    dataDir: opts.userData,
    port: settings.webServerPort || 8787,
    host: settings.webServerHost || '0.0.0.0',
    authToken: token,
    authDisabled: false,
    staticDir,
    appVersion: opts.appVersion,
    isPackaged: opts.isPackaged
  })
}
