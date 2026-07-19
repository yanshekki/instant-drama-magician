/**
 * instant-drama update — check npm registry / optionally install.
 */
import { spawnSync } from 'child_process'
import type { CliGlobalOptions } from '../types'
import { EXIT } from '../types'
import { emitFailure, emitSuccess, printErr, printHuman } from '../output'
import {
  checkNpmPackageUpdate,
  NPM_INSTALL_CMD,
  NPM_PACKAGE_NAME
} from '../../infrastructure/update/npmPackageUpdate'
import { readFileSync } from 'fs'
import { join } from 'path'

function currentCliVersion(): string {
  try {
    const root = join(__dirname, '..', '..', '..', 'package.json')
    const j = JSON.parse(readFileSync(root, 'utf8')) as {
      name?: string
      version?: string
    }
    if (j.version && (!j.name || j.name === NPM_PACKAGE_NAME)) {
      return j.version
    }
  } catch {
    /* fall through */
  }
  return process.env.npm_package_version || '0.0.0'
}

export async function cmdUpdate(
  globals: CliGlobalOptions,
  positionals: string[],
  flags: Record<string, string | boolean>
): Promise<void> {
  const sub = (positionals[0] || 'check').toLowerCase()
  if (sub === 'help' || sub === '-h' || sub === '--help') {
    printHuman(`Usage:
  instant-drama update [check]
  instant-drama update install [--yes]

Checks npm registry for a newer ${NPM_PACKAGE_NAME}.
Desktop app updates use GitHub Releases (in-app Settings), not this command.

Env: IDM_SKIP_UPDATE=1  skip automatic hints elsewhere`)
    return
  }

  if (sub !== 'check' && sub !== 'install') {
    emitFailure(
      globals,
      {
        code: 'USAGE',
        message: 'Usage: instant-drama update [check|install] [--yes]'
      },
      EXIT.USAGE
    )
  }

  const current = currentCliVersion()
  const result = await checkNpmPackageUpdate(NPM_PACKAGE_NAME, current)
  const payload = {
    ...result,
    channel: 'npm' as const,
    hint:
      result.updateAvailable
        ? `Run: ${result.installCommand}`
        : result.error
          ? `Could not check: ${result.error}`
          : 'You are on the latest npm version.'
  }

  if (sub === 'check') {
    if (globals.json) {
      emitSuccess(globals, { ok: true, result: payload, meta: { ms: 0, mode: 'local' } })
      return
    }
    printHuman(`package:  ${result.packageName}`)
    printHuman(`current:  ${result.currentVersion}`)
    printHuman(`latest:   ${result.latestVersion ?? '(unknown)'}`)
    if (result.error) {
      printErr(`check failed: ${result.error}`)
    } else if (result.updateAvailable) {
      printHuman(`update available → ${result.installCommand}`)
    } else {
      printHuman('up to date')
    }
    if (flags.strict && result.updateAvailable) {
      process.exit(EXIT.ERROR)
    }
    return
  }

  // install
  if (globals.json) {
    emitSuccess(globals, {
      ok: true,
      result: {
        ...payload,
        willInstall: Boolean(globals.yes || flags.yes)
      },
      meta: { ms: 0, mode: 'local' }
    })
  } else {
    printHuman(`current: ${current}`)
    printHuman(`latest:  ${result.latestVersion ?? '(unknown)'}`)
    printHuman(`command: ${NPM_INSTALL_CMD}`)
  }

  if (!result.updateAvailable && !result.error) {
    if (!globals.json) printHuman('Already on latest; nothing to install.')
    return
  }

  const doInstall = Boolean(globals.yes || flags.yes)
  if (!doInstall) {
    if (!globals.json) {
      printHuman('Re-run with --yes to execute global install:')
      printHuman(`  ${NPM_INSTALL_CMD}`)
    }
    return
  }

  if (!globals.json) {
    printHuman('Running global install…')
  }
  const r = spawnSync(
    'npm',
    ['install', '-g', `${NPM_PACKAGE_NAME}@latest`],
    { stdio: globals.json ? 'pipe' : 'inherit', shell: process.platform === 'win32' }
  )
  if (r.status !== 0) {
    emitFailure(
      globals,
      {
        code: 'IO',
        message:
          r.error?.message ||
          `npm install failed (exit ${r.status ?? 'unknown'}). Try manually: ${NPM_INSTALL_CMD}`
      },
      EXIT.ERROR
    )
  }
  if (globals.json) {
    emitSuccess(globals, {
      ok: true,
      result: { installed: true, command: NPM_INSTALL_CMD },
      meta: { ms: 0, mode: 'local' }
    })
  } else {
    printHuman('Install finished. Verify with: instant-drama version')
  }
}

/** Soft check for doctor / hints. */
export async function probeNpmUpdate(
  currentVersion?: string
): Promise<
  Awaited<ReturnType<typeof checkNpmPackageUpdate>>
> {
  return checkNpmPackageUpdate(
    NPM_PACKAGE_NAME,
    currentVersion || currentCliVersion()
  )
}
