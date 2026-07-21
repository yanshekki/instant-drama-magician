/**
 * instant-drama update — check npm registry / optionally install.
 */
import type { CliGlobalOptions } from '../types'
import { EXIT } from '../types'
import { emitFailure, emitSuccess, printErr, printHuman } from '../output'
import {
  checkNpmPackageUpdate,
  installNpmPackageUpdate,
  npmInstallCommand,
  NPM_PACKAGE_NAME,
  probeNpmGlobalWrite
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

function resolveTargetVersion(
  positionals: string[],
  flags: Record<string, string | boolean>
): string {
  const fromFlag =
    typeof flags.version === 'string'
      ? flags.version
      : typeof flags.v === 'string'
        ? flags.v
        : ''
  const fromPos = positionals[1]?.trim() || ''
  return (fromFlag || fromPos || 'latest').replace(/^v/i, '') || 'latest'
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
  instant-drama update install <version> [--yes]

Checks npm registry for a newer ${NPM_PACKAGE_NAME}.
Desktop app updates use GitHub Releases (in-app Settings), not this command.

Examples:
  instant-drama update
  instant-drama update install --yes
  instant-drama update install 1.3.0 --yes

Env: IDM_SKIP_UPDATE=1  skip automatic hints elsewhere`)
    return
  }

  if (sub !== 'check' && sub !== 'install') {
    emitFailure(
      globals,
      {
        code: 'USAGE',
        message:
          'Usage: instant-drama update [check|install] [version] [--yes]'
      },
      EXIT.USAGE
    )
  }

  const current = currentCliVersion()
  const result = await checkNpmPackageUpdate(NPM_PACKAGE_NAME, current)
  const writeProbe = probeNpmGlobalWrite()
  const payload = {
    ...result,
    channel: 'cli-npm' as const,
    canWriteGlobal: writeProbe.ok,
    globalPrefix: writeProbe.prefix,
    writeHint: writeProbe.hint,
    hint: result.updateAvailable
      ? `Run: ${result.installCommand}`
      : result.error
        ? `Could not check: ${result.error}`
        : 'You are on the latest npm version.'
  }

  if (sub === 'check') {
    if (globals.json) {
      emitSuccess(globals, {
        ok: true,
        result: payload,
        meta: { ms: 0, mode: 'local' }
      })
      return
    }
    printHuman(`package:  ${result.packageName}`)
    printHuman(`channel:  cli-npm (registry.npmjs.org)`)
    printHuman(`current:  ${result.currentVersion}`)
    printHuman(`latest:   ${result.latestVersion ?? '(unknown)'}`)
    if (writeProbe.prefix) {
      printHuman(`prefix:   ${writeProbe.prefix}${writeProbe.ok ? '' : ' (not writable)'}`)
    }
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
  const targetVersion = resolveTargetVersion(positionals, flags)
  const pinOrLatest =
    targetVersion === 'latest'
      ? result.latestVersion || 'latest'
      : targetVersion
  const command = npmInstallCommand(NPM_PACKAGE_NAME, pinOrLatest)

  if (globals.json) {
    emitSuccess(globals, {
      ok: true,
      result: {
        ...payload,
        targetVersion: pinOrLatest,
        command,
        willInstall: Boolean(globals.yes || flags.yes)
      },
      meta: { ms: 0, mode: 'local' }
    })
  } else {
    printHuman(`current: ${current}`)
    printHuman(`target:  ${pinOrLatest}`)
    printHuman(`command: ${command}`)
  }

  // Skip only when requesting latest and already current (allow pin reinstall)
  if (
    targetVersion === 'latest' &&
    !result.updateAvailable &&
    !result.error &&
    result.latestVersion
  ) {
    if (!globals.json) printHuman('Already on latest; nothing to install.')
    return
  }

  const doInstall = Boolean(globals.yes || flags.yes)
  if (!doInstall) {
    if (!globals.json) {
      printHuman('Re-run with --yes to execute global install:')
      printHuman(`  ${command}`)
      if (!writeProbe.ok && writeProbe.hint) {
        printErr(`Note: ${writeProbe.hint}`)
      }
    }
    return
  }

  if (!globals.json) {
    printHuman('Running global install…')
  }

  const install = installNpmPackageUpdate({
    packageName: NPM_PACKAGE_NAME,
    version: pinOrLatest,
    inheritStdio: !globals.json
  })

  if (!install.ok) {
    emitFailure(
      globals,
      {
        code: 'IO',
        message:
          install.error ||
          install.stderr ||
          `npm install failed. Try manually: ${command}`
      },
      EXIT.ERROR
    )
  }

  if (globals.json) {
    emitSuccess(globals, {
      ok: true,
      result: {
        installed: true,
        command: install.command,
        targetVersion: pinOrLatest,
        verifiedVersion: install.verifiedVersion ?? null,
        writeProbe: install.writeProbe
      },
      meta: { ms: 0, mode: 'local' }
    })
  } else {
    if (install.verifiedVersion) {
      printHuman(
        `Install finished. Verified global version: ${install.verifiedVersion}`
      )
    } else {
      printHuman('Install finished. Verify with: instant-drama version')
    }
  }
}

/** Soft check for doctor / hints. */
export async function probeNpmUpdate(
  currentVersion?: string
): Promise<Awaited<ReturnType<typeof checkNpmPackageUpdate>>> {
  return checkNpmPackageUpdate(
    NPM_PACKAGE_NAME,
    currentVersion || currentCliVersion()
  )
}
