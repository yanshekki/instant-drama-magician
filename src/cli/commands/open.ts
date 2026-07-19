/**
 * idm open | launch — start desktop GUI (packaged or --dev).
 * Platforms: macOS, Linux (Ubuntu), Windows.
 */
import { chmodSync } from 'fs'
import type { CliGlobalOptions } from '../types'
import { EXIT } from '../types'
import { emitFailure, emitSuccess, printHuman } from '../output'
import { findRepoRoot } from '../lib/repoRoot'
import { hostPlatform } from '../lib/platform'
import { resolveLaunchTarget } from '../lib/desktopPaths'
import { resolveNpm, runCommand, spawnDetached } from '../lib/runProcess'
import { cmdBuild } from './build'

export async function cmdOpen(
  globals: CliGlobalOptions,
  positionals: string[],
  flags: Record<string, string | boolean>
): Promise<void> {
  const repo = findRepoRoot()
  const preferDev = Boolean(flags.dev)
  const buildIfMissing = Boolean(
    flags.buildIfMissing || flags['build-if-missing']
  )
  const detached = flags.detached !== false && flags.detached !== 'false'
  const appPath =
    (typeof flags.appPath === 'string' && flags.appPath) ||
    (typeof flags['app-path'] === 'string' && flags['app-path']) ||
    null
  const extraArgs = positionals.slice() // trailing passthrough

  // Linux default: no-sandbox for some containers (override with --sandbox)
  const useSandbox = Boolean(flags.sandbox)
  if (
    hostPlatform() === 'linux' &&
    !useSandbox &&
    !extraArgs.includes('--no-sandbox')
  ) {
    extraArgs.push('--no-sandbox')
  }

  let target = resolveLaunchTarget({
    repoRoot: repo,
    appPath,
    preferDev
  })

  if (!target && buildIfMissing && !preferDev) {
    if (!globals.json) printHuman('No packaged app found — building (dir)…')
    await cmdBuild(globals, [], {
      target: 'dir',
      platform: 'current'
    })
    target = resolveLaunchTarget({ repoRoot: repo, appPath })
  }

  if (!target && !preferDev) {
    emitFailure(
      globals,
      {
        message:
          'No packaged app found. Run: idm build   or   idm open --dev   or   idm open --build-if-missing',
        code: 'NOT_FOUND'
      },
      EXIT.ERROR
    )
  }

  if (preferDev || target?.mode === 'dev') {
    await launchDev(repo, globals, detached, extraArgs)
    return
  }

  const t = target!
  let pid = 0
  try {
    if (t.method === 'open-mac') {
      // open -na "App.app" --args ...
      const args = ['-na', t.path]
      if (extraArgs.length) {
        args.push('--args', ...extraArgs)
      }
      if (detached) {
        pid = spawnDetached('open', args, { cwd: repo })
      } else {
        const r = await runCommand('open', args, { cwd: repo, inherit: true })
        if (r.code !== 0) {
          emitFailure(
            globals,
            { message: `open failed (exit ${r.code})`, code: 'ERROR' },
            EXIT.ERROR
          )
        }
      }
    } else if (t.method === 'appimage' || t.method === 'spawn') {
      if (t.method === 'appimage' || hostPlatform() === 'linux') {
        try {
          chmodSync(t.path, 0o755)
        } catch {
          /* ignore */
        }
      }
      const cmd = t.path
      const args = [...(t.args || []), ...extraArgs]
      if (detached) {
        pid = spawnDetached(cmd, args, {
          cwd: repo,
          env: {
            ...process.env,
            ...(process.env.IDM_DATA_DIR
              ? { IDM_DATA_DIR: process.env.IDM_DATA_DIR }
              : {})
          }
        })
      } else {
        const r = await runCommand(cmd, args, { cwd: repo, inherit: true })
        if (r.code !== 0) {
          emitFailure(
            globals,
            { message: `App exited with ${r.code}`, code: 'ERROR' },
            EXIT.ERROR
          )
        }
      }
    }
  } catch (e) {
    emitFailure(
      globals,
      {
        message: e instanceof Error ? e.message : String(e),
        code: 'ERROR'
      },
      EXIT.ERROR
    )
  }

  const result = {
    ok: true as const,
    mode: t.mode,
    platform: t.platform,
    path: t.path,
    method: t.method,
    pid: pid || null,
    detached
  }

  if (globals.json) {
    emitSuccess(globals, {
      ok: true,
      result,
      meta: { ms: 0, mode: 'local' }
    })
  } else {
    printHuman(`Launched (${t.mode}) ${t.path}`)
    if (pid) printHuman(`pid=${pid}`)
  }
}

async function launchDev(
  repo: string,
  globals: CliGlobalOptions,
  detached: boolean,
  extraArgs: string[]
): Promise<void> {
  const npm = resolveNpm()
  // Prefer npm run dev so class/icon flags from package.json apply
  if (!globals.json) {
    printHuman('Starting dev app (electron-vite)…')
  }
  if (detached) {
    const pid = spawnDetached(npm, ['run', 'dev', '--', ...extraArgs], {
      cwd: repo,
      env: process.env
    })
    const result = {
      ok: true as const,
      mode: 'dev' as const,
      platform: hostPlatform(),
      path: repo,
      method: 'spawn' as const,
      pid,
      detached: true
    }
    if (globals.json) {
      emitSuccess(globals, {
        ok: true,
        result,
        meta: { ms: 0, mode: 'local' }
      })
    } else {
      printHuman(`Dev process started pid=${pid}`)
    }
    return
  }
  const r = await runCommand(npm, ['run', 'dev', '--', ...extraArgs], {
    cwd: repo,
    inherit: true
  })
  if (r.code !== 0) {
    emitFailure(
      globals,
      { message: `dev exited ${r.code}`, code: 'ERROR' },
      EXIT.ERROR
    )
  }
}
