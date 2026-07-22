/**
 * Resolve package version for headless web server / CLI.
 * Prefer npm lifecycle env, then package.json — never fall back to 0.0.0.
 */
import { createRequire } from 'module'
import { resolve } from 'path'

export function resolveServerAppVersion(opts?: {
  envVersion?: string | null
  cwd?: string
  /** Absolute path of a module used as createRequire base (e.g. server entry). */
  requireFrom?: string
}): string {
  const fromEnv = (
    opts?.envVersion ??
    process.env.npm_package_version ??
    ''
  ).trim()
  if (fromEnv) return fromEnv
  const cwd = opts?.cwd || process.cwd()
  try {
    const req = createRequire(resolve(cwd, 'package.json'))
    const pkg = req('./package.json') as { version?: string }
    if (pkg?.version?.trim()) return pkg.version.trim()
  } catch {
    /* ignore */
  }
  if (opts?.requireFrom) {
    try {
      const req = createRequire(opts.requireFrom)
      const pkg = req('../package.json') as { version?: string }
      if (pkg?.version?.trim()) return pkg.version.trim()
    } catch {
      /* ignore */
    }
  }
  return '1.0.0'
}
