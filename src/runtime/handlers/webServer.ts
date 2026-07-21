/**
 * Domain IPC handlers (split for maintainability).
 */
import { existsSync } from 'fs'
import { join } from 'path'
import type { AppSettings } from '../../types/settings'
import { AppError } from '../../types/errors'
import type { HandlerContext } from './context'

export function registerWebserverHandlers(ctx: HandlerContext): void {
  const {
    reg,
    host,
    stories,
    characters,
    scenes,
    props,
    actions,
    costumes,
    timeline,
    generation,
    rebindAi,
    mediaRoot,
    activity,
    userDataPath,
    settingsStore
  } = ctx

// ─── Embedded web server (browser control) ─────────────────
async function resolveWebStaticDir(): Promise<string> {
  // Packaged: out/renderer next to main; dev: project out/renderer
  const candidates = [
    join(__dirname, '../renderer'),
    join(process.cwd(), 'out', 'renderer')
  ]
  for (const c of candidates) {
    if (existsSync(join(c, 'index.html'))) return c
  }
  return candidates[0]
}

async function syncEmbeddedWebServer(
  s: AppSettings
): Promise<import('../../infrastructure/webserver/EmbeddedWebServer').WebServerStatus> {
  const {
    getEmbeddedWebServer,
    generateWebServerToken
  } = await import(
    '../../infrastructure/webserver/EmbeddedWebServer'
  )
  const ws = getEmbeddedWebServer()
  if (!s.webServerEnabled) {
    return ws.stop()
  }
  let token = s.webServerAuthToken?.trim() || ''
  if (!token) {
    token = generateWebServerToken()
    settingsStore.save({ webServerAuthToken: token })
    s = settingsStore.load()
  }
  const staticDir = await resolveWebStaticDir()
  return ws.start({
    dataDir: host.userData,
    port: s.webServerPort || 8787,
    host: s.webServerHost || '0.0.0.0',
    authToken: token,
    authDisabled: false,
    staticDir,
    appVersion: host.appVersion,
    isPackaged: host.isPackaged
  })
}

reg(
  'webServer:status',
  (async () => {
    const { getEmbeddedWebServer } = await import(
      '../../infrastructure/webserver/EmbeddedWebServer'
    )
    return getEmbeddedWebServer().getStatus()
  })
)
reg(
  'webServer:start',
  (async () => {
    const next = settingsStore.save({ webServerEnabled: true })
    try {
      return await syncEmbeddedWebServer(next)
    } catch (e) {
      settingsStore.save({ webServerEnabled: false })
      throw e instanceof AppError
        ? e
        : new AppError(
            'IO',
            e instanceof Error ? e.message : String(e)
          )
    }
  })
)
reg(
  'webServer:stop',
  (async () => {
    settingsStore.save({ webServerEnabled: false })
    const { getEmbeddedWebServer } = await import(
      '../../infrastructure/webserver/EmbeddedWebServer'
    )
    return getEmbeddedWebServer().stop()
  })
)
reg(
  'webServer:generateToken',
  (async () => {
    const { generateWebServerToken } = await import(
      '../../infrastructure/webserver/EmbeddedWebServer'
    )
    const token = generateWebServerToken()
    const next = settingsStore.save({ webServerAuthToken: token })
    if (next.webServerEnabled) {
      await syncEmbeddedWebServer(next)
    }
    return { token, settings: next }
  })
)

}
