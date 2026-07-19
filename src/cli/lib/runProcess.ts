/**
 * Spawn helpers for npm / electron-builder / app launch.
 */
import { spawn, type SpawnOptions } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'

export interface RunResult {
  code: number
  signal: NodeJS.Signals | null
}

export function runCommand(
  command: string,
  args: string[],
  opts: {
    cwd: string
    env?: NodeJS.ProcessEnv
    /** inherit streams (default true for human builds) */
    inherit?: boolean
  }
): Promise<RunResult> {
  const inherit = opts.inherit !== false
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: opts.cwd,
      env: { ...process.env, ...opts.env },
      stdio: inherit ? 'inherit' : 'pipe',
      shell: process.platform === 'win32'
    })
    child.on('error', reject)
    child.on('close', (code, signal) => {
      resolve({ code: code ?? 1, signal })
    })
  })
}

export function resolveNpm(): string {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm'
}

export function resolveNpx(): string {
  return process.platform === 'win32' ? 'npx.cmd' : 'npx'
}

/** Prefer local node_modules bin */
export function localBin(repoRoot: string, name: string): string | null {
  const bin =
    process.platform === 'win32'
      ? join(repoRoot, 'node_modules', '.bin', `${name}.cmd`)
      : join(repoRoot, 'node_modules', '.bin', name)
  return existsSync(bin) ? bin : null
}

export function spawnDetached(
  command: string,
  args: string[],
  opts: SpawnOptions & { cwd?: string }
): number {
  const child = spawn(command, args, {
    ...opts,
    detached: true,
    stdio: 'ignore',
    shell: process.platform === 'win32' ? true : opts.shell
  })
  child.unref()
  return child.pid ?? 0
}
