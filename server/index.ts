/**
 * CLI entry for self-hosted web server.
 *
 *   IDM_DATA_DIR=/path IDM_AUTH_TOKEN=secret IDM_PORT=8787 npx tsx server/index.ts
 *
 * Default data dir matches desktop/CLI OS home paths (see domain/appPaths).
 */
import { createRequire } from 'module'
import { resolve } from 'path'
import { EmbeddedWebServer } from '../src/infrastructure/webserver/EmbeddedWebServer'
import { resolveAppPaths } from '../src/domain/appPaths'
import { migrateAppDataIfNeeded } from '../src/application/services/AppDataMigrationService'

const PORT = Number(process.env.IDM_PORT || 8787)
const HOST = process.env.IDM_HOST || '0.0.0.0'
const appPaths = resolveAppPaths({
  envDataDir: process.env.IDM_DATA_DIR,
  profile: process.env.IDM_PROFILE || 'default',
  isDevRuntime: false
})
const DATA_DIR = appPaths.dataRoot
const AUTH_TOKEN = (process.env.IDM_AUTH_TOKEN || '').trim()
const AUTH_DISABLED =
  process.env.IDM_AUTH_DISABLED === '1' ||
  process.env.IDM_AUTH_DISABLED === 'true'
const STATIC_DIR = resolve(
  process.env.IDM_STATIC_DIR || resolve(process.cwd(), 'out', 'renderer')
)

/** Prefer npm lifecycle env, then package.json — never fall back to 0.0.0. */
function resolveServerAppVersion(): string {
  const fromEnv = (process.env.npm_package_version || '').trim()
  if (fromEnv) return fromEnv
  try {
    const req = createRequire(resolve(process.cwd(), 'package.json'))
    const pkg = req('./package.json') as { version?: string }
    if (pkg?.version?.trim()) return pkg.version.trim()
  } catch {
    /* ignore */
  }
  try {
    // When started via `npx tsx server/index.ts`, require relative to this file
    const req = createRequire(__filename)
    const pkg = req('../package.json') as { version?: string }
    if (pkg?.version?.trim()) return pkg.version.trim()
  } catch {
    /* ignore */
  }
  return '1.0.0'
}

function log(...args: unknown[]): void {
  // eslint-disable-next-line no-console
  console.log('[idm-server]', ...args)
}

async function main(): Promise<void> {
  try {
    const mig = migrateAppDataIfNeeded({
      paths: appPaths,
      cwd: process.cwd()
    })
    if (mig.actions.length) log('migration', mig.actions.join('; '))
  } catch {
    /* non-fatal */
  }

  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = appPaths.databaseUrl
  }

  const server = new EmbeddedWebServer()
  const status = await server.start({
    dataDir: DATA_DIR,
    port: PORT,
    host: HOST,
    authToken: AUTH_TOKEN,
    authDisabled: AUTH_DISABLED,
    staticDir: STATIC_DIR,
    appVersion: resolveServerAppVersion(),
    // Web server is a published runtime (not Electron dev). UI uses channel=web
    // for updates; isPackaged only affects desktop electron-updater paths.
    isPackaged: true
  })

  log(`dataDir=${DATA_DIR}`)
  log(`database=${appPaths.databasePath}`)
  log(`staticDir=${STATIC_DIR} (ready=${status.staticReady})`)
  log(
    `auth=${status.authDisabled ? 'DISABLED' : status.authRequired ? 'token required' : 'loopback-only'}`
  )
  log(`channels=${status.channels}`)
  log(`listening ${status.url}`)

  const shutdown = (): void => {
    log('shutting down…')
    void server.stop().then(() => process.exit(0))
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
