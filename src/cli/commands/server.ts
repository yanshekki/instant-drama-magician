/**
 * idm server start — foreground EmbeddedWebServer (replaces server/index.ts usage).
 */
import { join, resolve } from 'path'
import type { CliGlobalOptions } from '../types'
import { EXIT } from '../types'
import { emitFailure, printErr, printHuman } from '../output'
import { defaultDataDir } from '../config'
import { EmbeddedWebServer } from '../../infrastructure/webserver/EmbeddedWebServer'

export async function cmdServer(
  globals: CliGlobalOptions,
  positionals: string[],
  flags: Record<string, string | boolean>
): Promise<void> {
  const sub = positionals[0] || 'start'
  if (sub !== 'start') {
    emitFailure(
      globals,
      {
        message: 'Usage: idm server start [--port 8787] [--host 0.0.0.0]',
        code: 'USAGE'
      },
      EXIT.USAGE
    )
  }

  const port = Number(
    flags.port || process.env.IDM_PORT || 8787
  )
  const host = String(
    flags.host || process.env.IDM_HOST || '0.0.0.0'
  )
  const dataDir = resolve(
    globals.dataDir || process.env.IDM_DATA_DIR || defaultDataDir()
  )
  const authToken = String(
    globals.token ||
      process.env.IDM_AUTH_TOKEN ||
      process.env.IDM_TOKEN ||
      flags.authToken ||
      flags.token ||
      ''
  ).trim()
  const authDisabled =
    process.env.IDM_AUTH_DISABLED === '1' ||
    process.env.IDM_AUTH_DISABLED === 'true' ||
    Boolean(flags.authDisabled)
  const staticDir = resolve(
    String(
      flags.staticDir ||
        process.env.IDM_STATIC_DIR ||
        join(process.cwd(), 'out', 'renderer')
    )
  )

  const server = new EmbeddedWebServer()
  const status = await server.start({
    dataDir,
    port,
    host,
    authToken,
    authDisabled,
    staticDir,
    appVersion: process.env.npm_package_version || '1.0.0',
    isPackaged: true
  })

  if (globals.json) {
    process.stdout.write(
      JSON.stringify({ ok: true, result: status }, null, globals.pretty ? 2 : undefined) +
        '\n'
    )
  } else {
    printHuman(`[idm-server] dataDir=${dataDir}`)
    printHuman(
      `[idm-server] staticDir=${staticDir} (ready=${status.staticReady})`
    )
    printHuman(
      `[idm-server] auth=${
        status.authDisabled
          ? 'DISABLED'
          : status.authRequired
            ? 'token required'
            : 'loopback-only'
      }`
    )
    printHuman(`[idm-server] channels=${status.channels}`)
    printHuman(`[idm-server] listening ${status.url}`)
    printHuman('[idm-server] Ctrl+C to stop')
  }

  const shutdown = (): void => {
    printErr('[idm-server] shutting down…')
    void server.stop().then(() => process.exit(0))
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  // Keep process alive
  await new Promise(() => undefined)
}
