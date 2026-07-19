import type { CliGlobalOptions } from '../types'
import { EXIT } from '../types'
import { resolveClient } from '../client'
import { emitFailure, emitSuccess, printHuman, printErr } from '../output'
import { defaultConfigPath, defaultDataDir } from '../config'
import { toAppError } from '../../types/errors'
import { isAuthError, isNetworkError } from '../client/remote'
import { createRemoteClient } from '../client/remote'
import { probeNpmUpdate } from './update'

export async function cmdDoctor(globals: CliGlobalOptions): Promise<void> {
  const t0 = Date.now()
  const report: Record<string, unknown> = {
    ok: true,
    version: process.env.npm_package_version || '1.1.0',
    configPath: defaultConfigPath(),
    defaultDataDir: defaultDataDir(),
    globals: {
      url: globals.url,
      hasToken: Boolean(globals.token),
      local: globals.local,
      dataDir: globals.dataDir,
      profile: globals.profile
    },
    checks: {} as Record<string, unknown>
  }
  const checks = report.checks as Record<string, unknown>

  // Prefer explicit remote probe when URL set and not forced local
  if (globals.url && !globals.local) {
    try {
      const res = await fetch(`${globals.url.replace(/\/+$/, '')}/api/health`)
      const body = (await res.json()) as Record<string, unknown>
      checks.health = { ok: res.ok, status: res.status, body }
    } catch (e) {
      checks.health = {
        ok: false,
        error: e instanceof Error ? e.message : String(e)
      }
      report.ok = false
    }
    try {
      const client = createRemoteClient({
        url: globals.url,
        token: globals.token
      })
      const ch = await client.channels()
      checks.channels = { ok: true, count: ch.length, sample: ch.slice(0, 8) }
      checks.client = client.describe()
    } catch (e) {
      const err = toAppError(e)
      checks.channels = { ok: false, code: err.code, message: err.message }
      report.ok = false
      if (isAuthError(e)) {
        emitFailure(
          globals,
          {
            ok: false,
            error: { code: err.code, message: err.message },
            meta: { ms: Date.now() - t0, mode: 'remote' }
          },
          EXIT.UNAUTH
        )
      }
      if (isNetworkError(e)) {
        emitFailure(
          globals,
          {
            ok: false,
            error: { code: err.code, message: err.message },
            meta: { ms: Date.now() - t0, mode: 'remote' }
          },
          EXIT.CONNECT
        )
      }
    }
  } else {
    try {
      const client = await resolveClient({ ...globals, local: true })
      checks.client = client.describe()
      const ch = await client.channels()
      checks.channels = { ok: true, count: ch.length, sample: ch.slice(0, 8) }
      try {
        const info = await client.invoke('app:getInfo')
        checks.appInfo = info
      } catch (e) {
        checks.appInfo = {
          ok: false,
          message: toAppError(e).message
        }
      }
      try {
        const ff = await client.invoke('media:checkFfmpeg')
        checks.ffmpeg = ff
      } catch (e) {
        checks.ffmpeg = { ok: false, message: toAppError(e).message }
      }
      await client.dispose?.()
    } catch (e) {
      const err = toAppError(e)
      checks.local = { ok: false, code: err.code, message: err.message }
      report.ok = false
    }
  }

  // npm CLI package update probe (non-fatal)
  if (process.env.IDM_SKIP_UPDATE !== '1') {
    try {
      const npmUpdate = await probeNpmUpdate(String(report.version))
      checks.npmUpdate = npmUpdate
      if (npmUpdate.updateAvailable) {
        report.updateAvailable = true
      }
    } catch (e) {
      checks.npmUpdate = {
        ok: false,
        error: e instanceof Error ? e.message : String(e)
      }
    }
  } else {
    checks.npmUpdate = { skipped: true }
  }

  report.ms = Date.now() - t0

  if (globals.json) {
    emitSuccess(globals, report)
    if (!report.ok) process.exit(EXIT.ERROR)
    return
  }

  printHuman(`instant-drama doctor — ${report.ok ? 'OK' : 'ISSUES'}`)
  printHuman(`  config: ${report.configPath}`)
  printHuman(`  mode probe: ${globals.url && !globals.local ? 'remote' : 'local'}`)
  if (checks.channels && typeof checks.channels === 'object') {
    const c = checks.channels as { count?: number; message?: string }
    if (c.count != null) printHuman(`  channels: ${c.count}`)
    else if (c.message) printErr(`  channels: ${c.message}`)
  }
  if (checks.ffmpeg) {
    printHuman(`  ffmpeg: ${JSON.stringify(checks.ffmpeg)}`)
  }
  if (checks.npmUpdate && typeof checks.npmUpdate === 'object') {
    const u = checks.npmUpdate as {
      updateAvailable?: boolean
      latestVersion?: string | null
      currentVersion?: string
      installCommand?: string
      error?: string
      skipped?: boolean
    }
    if (u.skipped) {
      printHuman('  npm update: skipped (IDM_SKIP_UPDATE=1)')
    } else if (u.error) {
      printHuman(`  npm update: check failed (${u.error})`)
    } else if (u.updateAvailable) {
      printErr(
        `  npm update: ${u.currentVersion} → ${u.latestVersion} available`
      )
      if (u.installCommand) printHuman(`    ${u.installCommand}`)
    } else {
      printHuman(
        `  npm update: up to date (${u.currentVersion ?? report.version})`
      )
    }
  }
  if (!report.ok) process.exit(EXIT.ERROR)
}
