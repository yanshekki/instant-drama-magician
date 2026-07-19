/**
 * Resolve packaged desktop app artifacts for open/launch (mac / linux / win).
 */
import { existsSync, readdirSync, statSync } from 'fs'
import { join, basename } from 'path'
import type { DesktopPlatform } from './platform'
import { hostPlatform } from './platform'
import { releaseDir as defaultReleaseDir } from './repoRoot'

export interface Artifact {
  kind: 'dir-binary' | 'appimage' | 'dmg' | 'app' | 'exe' | 'nsis' | 'deb' | 'other'
  path: string
  mtimeMs: number
  platform: DesktopPlatform
}

export interface LaunchTarget {
  mode: 'packaged' | 'dev'
  platform: DesktopPlatform
  path: string
  /** Extra args for the process */
  args?: string[]
  /** How to spawn */
  method: 'spawn' | 'open-mac' | 'appimage'
}

const PRODUCT = 'InstantDrama Magician'
const EXEC = 'instant-drama-magician'

function safeStatMtime(p: string): number {
  try {
    return statSync(p).mtimeMs
  } catch {
    return 0
  }
}

function walkFiles(root: string, maxDepth = 4): string[] {
  const out: string[] = []
  if (!existsSync(root)) return out
  const walk = (dir: string, depth: number): void => {
    if (depth > maxDepth) return
    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch {
      return
    }
    for (const name of entries) {
      const full = join(dir, name)
      let st
      try {
        st = statSync(full)
      } catch {
        continue
      }
      if (st.isDirectory()) {
        // skip node_modules-like
        if (name === 'node_modules' || name === '.git') continue
        // .app is a bundle — treat as file leaf on mac
        if (name.endsWith('.app')) {
          out.push(full)
          continue
        }
        walk(full, depth + 1)
      } else if (st.isFile()) {
        out.push(full)
      }
    }
  }
  walk(root, 0)
  return out
}

export function listBuildArtifacts(
  releaseRoot: string,
  platform?: DesktopPlatform
): Artifact[] {
  const files = walkFiles(releaseRoot, 5)
  const arts: Artifact[] = []
  for (const p of files) {
    const base = basename(p)
    const lower = base.toLowerCase()
    const mtimeMs = safeStatMtime(p)
    let kind: Artifact['kind'] = 'other'
    let plat: DesktopPlatform = 'linux'
    if (lower.endsWith('.appimage')) {
      kind = 'appimage'
      plat = 'linux'
    } else if (lower.endsWith('.dmg')) {
      kind = 'dmg'
      plat = 'mac'
    } else if (lower.endsWith('.deb')) {
      kind = 'deb'
      plat = 'linux'
    } else if (lower.endsWith('.exe')) {
      kind =
        lower.includes('setup') || lower.includes('installer')
          ? 'nsis'
          : 'exe'
      plat = 'win'
    } else if (base.endsWith('.app') || p.endsWith('.app')) {
      kind = 'app'
      plat = 'mac'
    } else if (
      base === EXEC ||
      base === `${EXEC}.exe` ||
      base === `${PRODUCT}.exe` ||
      base === PRODUCT
    ) {
      kind = base.endsWith('.exe') ? 'exe' : 'dir-binary'
      if (p.includes('win')) plat = 'win'
      else if (p.includes('mac') || p.includes('darwin')) plat = 'mac'
      else plat = 'linux'
    } else {
      continue
    }
    if (platform && plat !== platform) continue
    arts.push({ kind, path: p, mtimeMs, platform: plat })
  }
  // Also detect unpacked binaries by directory convention
  for (const dirName of readdirSyncSafe(releaseRoot)) {
    const dir = join(releaseRoot, dirName)
    if (!statSyncSafeIsDir(dir)) continue
    if (/linux/i.test(dirName) && /unpacked/i.test(dirName)) {
      const bin = join(dir, EXEC)
      if (existsSync(bin)) {
        arts.push({
          kind: 'dir-binary',
          path: bin,
          mtimeMs: safeStatMtime(bin),
          platform: 'linux'
        })
      }
    }
    if (/win/i.test(dirName) && /unpacked/i.test(dirName)) {
      for (const name of [`${PRODUCT}.exe`, `${EXEC}.exe`]) {
        const bin = join(dir, name)
        if (existsSync(bin)) {
          arts.push({
            kind: 'exe',
            path: bin,
            mtimeMs: safeStatMtime(bin),
            platform: 'win'
          })
        }
      }
    }
    if (/^mac/i.test(dirName)) {
      const appPath = join(dir, `${PRODUCT}.app`)
      if (existsSync(appPath)) {
        arts.push({
          kind: 'app',
          path: appPath,
          mtimeMs: safeStatMtime(appPath),
          platform: 'mac'
        })
      }
    }
  }
  // unique by path
  const map = new Map<string, Artifact>()
  for (const a of arts) map.set(a.path, a)
  return [...map.values()].sort((a, b) => b.mtimeMs - a.mtimeMs)
}

function readdirSyncSafe(dir: string): string[] {
  try {
    return readdirSync(dir)
  } catch {
    return []
  }
}

function statSyncSafeIsDir(p: string): boolean {
  try {
    return statSync(p).isDirectory()
  } catch {
    return false
  }
}

/** Prefer launchable packaged apps over installers */
function launchScore(a: Artifact): number {
  switch (a.kind) {
    case 'app':
      return 100
    case 'dir-binary':
      return 90
    case 'exe':
      return 90
    case 'appimage':
      return 80
    case 'dmg':
    case 'nsis':
    case 'deb':
      return 10 // installers — not direct launch
    default:
      return 0
  }
}

export function resolveLaunchTarget(opts: {
  repoRoot: string
  appPath?: string | null
  preferDev?: boolean
  platform?: DesktopPlatform
}): LaunchTarget | null {
  const platform = opts.platform ?? hostPlatform()
  if (opts.preferDev) {
    return {
      mode: 'dev',
      platform,
      path: opts.repoRoot,
      method: 'spawn',
      args: []
    }
  }
  if (opts.appPath && existsSync(opts.appPath)) {
    const p = opts.appPath
    if (p.endsWith('.app')) {
      return { mode: 'packaged', platform: 'mac', path: p, method: 'open-mac' }
    }
    if (p.toLowerCase().endsWith('.appimage')) {
      return {
        mode: 'packaged',
        platform: 'linux',
        path: p,
        method: 'appimage'
      }
    }
    return {
      mode: 'packaged',
      platform,
      path: p,
      method: 'spawn'
    }
  }

  const release = defaultReleaseDir(opts.repoRoot)
  const arts = listBuildArtifacts(release, platform).filter(
    (a) => launchScore(a) >= 80
  )
  arts.sort((a, b) => launchScore(b) - launchScore(a) || b.mtimeMs - a.mtimeMs)
  const best = arts[0]
  if (!best) {
    // mac Applications fallback
    if (platform === 'mac') {
      const sys = `/Applications/${PRODUCT}.app`
      if (existsSync(sys)) {
        return {
          mode: 'packaged',
          platform: 'mac',
          path: sys,
          method: 'open-mac'
        }
      }
    }
    return null
  }
  if (best.kind === 'app') {
    return {
      mode: 'packaged',
      platform: 'mac',
      path: best.path,
      method: 'open-mac'
    }
  }
  if (best.kind === 'appimage') {
    return {
      mode: 'packaged',
      platform: 'linux',
      path: best.path,
      method: 'appimage'
    }
  }
  return {
    mode: 'packaged',
    platform: best.platform,
    path: best.path,
    method: 'spawn'
  }
}

export { PRODUCT as PRODUCT_NAME, EXEC as EXECUTABLE_NAME }
