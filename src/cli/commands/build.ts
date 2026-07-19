/**
 * idm build — compile + package desktop app (mac / linux / win).
 */
import type { CliGlobalOptions } from '../types'
import { EXIT } from '../types'
import { emitFailure, emitSuccess, printErr, printHuman } from '../output'
import { findRepoRoot, releaseDir } from '../lib/repoRoot'
import {
  canBuildOnHost,
  electronBuilderPlatformArgs,
  hostArch,
  hostPlatform,
  parsePlatformFlag,
  type DesktopPlatform
} from '../lib/platform'
import { listBuildArtifacts } from '../lib/desktopPaths'
import { localBin, resolveNpx, runCommand } from '../lib/runProcess'
import { existsSync } from 'fs'
import { join } from 'path'

export async function cmdBuild(
  globals: CliGlobalOptions,
  positionals: string[],
  flags: Record<string, string | boolean>
): Promise<void> {
  const repo = findRepoRoot()
  if (!existsSync(join(repo, 'package.json'))) {
    emitFailure(
      globals,
      {
        message:
          'Not inside instant-drama-magician repo. Set IDM_REPO_ROOT or cd to project.',
        code: 'USAGE'
      },
      EXIT.USAGE
    )
  }

  let platform: DesktopPlatform
  try {
    platform = parsePlatformFlag(
      flags.platform === true
        ? 'current'
        : (flags.platform as string | undefined)
    )
  } catch (e) {
    emitFailure(
      globals,
      {
        message: e instanceof Error ? e.message : String(e),
        code: 'USAGE'
      },
      EXIT.USAGE
    )
  }

  const targetRaw =
    (typeof flags.target === 'string' && flags.target) ||
    positionals[0] ||
    'dir'
  const target = String(targetRaw).toLowerCase()
  if (!['dir', 'installer', 'all'].includes(target)) {
    emitFailure(
      globals,
      {
        message:
          'Usage: idm build [--target dir|installer|all] [--platform mac|linux|win]',
        code: 'USAGE'
      },
      EXIT.USAGE
    )
  }

  const force = Boolean(flags.force)
  const skipCompile = Boolean(flags.skipCompile || flags['skip-compile'])
  const arch =
    (typeof flags.arch === 'string' && flags.arch) || hostArch()

  const targets: Array<'dir' | 'installer'> =
    target === 'all' ? ['dir', 'installer'] : [target as 'dir' | 'installer']

  for (const t of targets) {
    const gate = canBuildOnHost(platform, t, force)
    if (!gate.ok) {
      emitFailure(
        globals,
        {
          message: gate.reason || 'Unsupported build target on this host',
          code: 'USAGE'
        },
        EXIT.USAGE
      )
    }
  }

  if (!globals.json) {
    printHuman(
      `idm build · platform=${platform} arch=${arch} target=${target} host=${hostPlatform()}`
    )
    printHuman(`repo: ${repo}`)
  }

  if (!skipCompile) {
    if (!globals.json) printHuman('→ electron-vite build…')
    const viteBin = localBin(repo, 'electron-vite')
    const r = viteBin
      ? await runCommand(viteBin, ['build'], {
          cwd: repo,
          inherit: !globals.json
        })
      : await runCommand(resolveNpx(), ['electron-vite', 'build'], {
          cwd: repo,
          inherit: !globals.json
        })
    if (r.code !== 0) {
      emitFailure(
        globals,
        {
          message: `electron-vite build failed (exit ${r.code})`,
          code: 'ERROR'
        },
        EXIT.ERROR
      )
    }
  }

  const builderBin = localBin(repo, 'electron-builder')
  const runBuilder = async (args: string[]): Promise<void> => {
    if (!globals.json) {
      printHuman(`→ electron-builder ${args.join(' ')}`)
    }
    const r = builderBin
      ? await runCommand(builderBin, args, {
          cwd: repo,
          inherit: !globals.json,
          env: {
            ...process.env,
            CSC_IDENTITY_AUTO_DISCOVERY: 'false'
          }
        })
      : await runCommand(resolveNpx(), ['electron-builder', ...args], {
          cwd: repo,
          inherit: !globals.json,
          env: {
            ...process.env,
            CSC_IDENTITY_AUTO_DISCOVERY: 'false'
          }
        })
    if (r.code !== 0) {
      emitFailure(
        globals,
        {
          message: `electron-builder failed (exit ${r.code})`,
          code: 'ERROR'
        },
        EXIT.ERROR
      )
    }
  }

  const platformArgs = electronBuilderPlatformArgs(platform)
  const archArgs =
    arch && arch !== 'all' ? ([`--${arch}`] as string[]) : []

  if (target === 'dir') {
    await runBuilder([...platformArgs, ...archArgs, '--dir'])
  } else if (target === 'installer') {
    // package.json build.linux/mac/win targets
    await runBuilder([...platformArgs, ...archArgs])
  } else {
    await runBuilder([...platformArgs, ...archArgs, '--dir'])
    await runBuilder([...platformArgs, ...archArgs])
  }

  const artifacts = listBuildArtifacts(releaseDir(repo), platform)
  const payload = {
    ok: true as const,
    platform,
    arch,
    target,
    repo,
    releaseDir: releaseDir(repo),
    artifacts: artifacts.map((a) => ({
      kind: a.kind,
      path: a.path,
      platform: a.platform
    }))
  }

  if (globals.json) {
    emitSuccess(globals, {
      ok: true,
      result: payload,
      meta: { ms: 0, mode: 'local' }
    })
  } else {
    printHuman('Build complete.')
    if (artifacts.length === 0) {
      printErr(
        'No artifacts detected under release/ — check electron-builder logs.'
      )
    } else {
      printHuman(`Artifacts (${artifacts.length}):`)
      for (const a of artifacts.slice(0, 20)) {
        printHuman(`  [${a.kind}] ${a.path}`)
      }
    }
    printHuman('Open with: idm open')
  }
}
