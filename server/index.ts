/**
 * CLI entry for self-hosted web server.
 *
 *   IDM_DATA_DIR=./data IDM_AUTH_TOKEN=secret IDM_PORT=8787 npx tsx server/index.ts
 */
import { join, resolve } from 'path'
import { EmbeddedWebServer } from '../src/infrastructure/webserver/EmbeddedWebServer'

const PORT = Number(process.env.IDM_PORT || 8787)
const HOST = process.env.IDM_HOST || '0.0.0.0'
const DATA_DIR = resolve(
  process.env.IDM_DATA_DIR || join(process.cwd(), 'data')
)
const AUTH_TOKEN = (process.env.IDM_AUTH_TOKEN || '').trim()
const AUTH_DISABLED =
  process.env.IDM_AUTH_DISABLED === '1' ||
  process.env.IDM_AUTH_DISABLED === 'true'
const STATIC_DIR = resolve(
  process.env.IDM_STATIC_DIR || join(process.cwd(), 'out', 'renderer')
)

function log(...args: unknown[]): void {
  // eslint-disable-next-line no-console
  console.log('[idm-server]', ...args)
}

async function main(): Promise<void> {
  const server = new EmbeddedWebServer()
  const status = await server.start({
    dataDir: DATA_DIR,
    port: PORT,
    host: HOST,
    authToken: AUTH_TOKEN,
    authDisabled: AUTH_DISABLED,
    staticDir: STATIC_DIR,
    appVersion: process.env.npm_package_version || '1.0.0',
    isPackaged: true
  })

  log(`dataDir=${DATA_DIR}`)
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
