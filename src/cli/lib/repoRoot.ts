/**
 * Locate monorepo / app root (package.json with our appId or name).
 */
import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'

export function findRepoRoot(start = process.cwd()): string {
  if (process.env.IDM_REPO_ROOT && existsSync(process.env.IDM_REPO_ROOT)) {
    return process.env.IDM_REPO_ROOT
  }
  let dir = start
  for (let i = 0; i < 12; i++) {
    const pkgPath = join(dir, 'package.json')
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
          name?: string
          build?: { appId?: string }
        }
        if (
          pkg.name === 'instant-drama-magician' ||
          pkg.build?.appId === 'hk.ysk.instant-drama-magician'
        ) {
          return dir
        }
        // any package.json with electron-builder + our product is fine if cwd is root
        if (pkg.build?.appId?.includes('instant-drama')) return dir
      } catch {
        /* continue */
      }
    }
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  // fallback: cwd if package.json exists
  if (existsSync(join(start, 'package.json'))) return start
  return start
}

export function releaseDir(repoRoot: string): string {
  return join(repoRoot, 'release')
}
