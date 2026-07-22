/**
 * Resolve the ffmpeg binary for InstantDrama Magician.
 * Prefer env override, then Electron packaged unpack path, then ffmpeg-static,
 * then project-relative paths, then PATH.
 *
 * Electron note: asarUnpack puts the binary under `app.asar.unpacked/…`.
 * `require('ffmpeg-static')` may still return a path under `app.asar/…`
 * where existsSync can succeed but spawn() cannot execute — rewrite required.
 */
import { existsSync } from 'fs'
import { dirname, join, sep } from 'path'
import { createRequire } from 'module'

let cached: string | null = null

const BIN_NAME = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'

/**
 * Map `…/app.asar/node_modules/…` → `…/app.asar.unpacked/node_modules/…`
 * so the real executable from asarUnpack is used.
 */
export function preferUnpackedAsar(p: string | null | undefined): string | null {
  if (!p || typeof p !== 'string') return null
  const marker = `${sep}app.asar${sep}`
  const unpacked = `${sep}app.asar.unpacked${sep}`
  if (p.includes(marker) && !p.includes(unpacked)) {
    return p.split(marker).join(unpacked)
  }
  // Also handle trailing "app.asar" without trailing sep (rare)
  if (p.endsWith(`${sep}app.asar`) || p.endsWith('/app.asar')) {
    return `${p}.unpacked`
  }
  return p
}

function usablePath(p: string | null | undefined): string | null {
  if (!p || p === 'ffmpeg') return null
  const fixed = preferUnpackedAsar(p) || p
  return existsSync(fixed) ? fixed : null
}

/** @internal exported for tests — `hasFilename` overrides for branch coverage */
export function ffmpegRequireBase(
  hasFilename: boolean = typeof __filename !== 'undefined'
): string {
  return hasFilename ? __filename : join(process.cwd(), 'package.json')
}

function tryBundledStatic(): string | null {
  try {
    // Prefer createRequire so resolution works from CJS/ESM and electron-vite out/
    const req = createRequire(ffmpegRequireBase())
    const mod = req('ffmpeg-static') as string | { default?: string } | null
    const p =
      typeof mod === 'string'
        ? mod
        : typeof mod?.default === 'string'
          ? mod.default
          : null
    const u = usablePath(p)
    if (u) return u
  } catch {
    /* not installed / wrong platform */
  }
  // Fallback classic require (main process CJS)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('ffmpeg-static') as string | { default?: string } | null
    const p =
      typeof mod === 'string'
        ? mod
        : typeof mod?.default === 'string'
          ? mod.default
          : null
    const u = usablePath(p)
    if (u) return u
  } catch {
    /* ignore */
  }
  return null
}

function tryExplicitCandidates(): string | null {
  const cwd = process.cwd()
  const here =
    typeof __dirname !== 'undefined' ? __dirname : join(cwd, 'out', 'main')
  const candidates = [
    // project root (npm run dev from repo)
    join(cwd, 'node_modules', 'ffmpeg-static', BIN_NAME),
    // electron-vite out/main → ../../node_modules
    join(here, '..', '..', 'node_modules', 'ffmpeg-static', BIN_NAME),
    // out/main/chunks → ../../../node_modules
    join(here, '..', '..', '..', 'node_modules', 'ffmpeg-static', BIN_NAME),
    // dirname of this file when not bundled
    join(dirname(here), 'node_modules', 'ffmpeg-static', BIN_NAME)
  ]
  for (const c of candidates) {
    const u = usablePath(c)
    if (u) return u
  }
  return null
}

function tryResourcesPath(): string | null {
  // electron packaged: asarUnpack → resources/app.asar.unpacked/node_modules/ffmpeg-static
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { app } = require('electron') as typeof import('electron')
    if (!app?.isPackaged) {
      // Dev: also try next to app path
      try {
        const appPath = app.getAppPath()
        const p = join(appPath, 'node_modules', 'ffmpeg-static', BIN_NAME)
        const u = usablePath(p)
        if (u) return u
      } catch {
        /* ignore */
      }
      return null
    }
    const base = process.resourcesPath
    const candidates = [
      join(
        base,
        'app.asar.unpacked',
        'node_modules',
        'ffmpeg-static',
        BIN_NAME
      ),
      join(base, 'ffmpeg', BIN_NAME),
      join(base, BIN_NAME)
    ]
    for (const c of candidates) {
      const u = usablePath(c)
      if (u) return u
    }
  } catch {
    /* not in electron main */
  }
  return null
}

/**
 * Absolute path or command name for ffmpeg.
 * Cached after first successful resolve of an existing file / env.
 */
export function resolveFfmpegPath(): string {
  if (cached) {
    // Never sticky-cache the bare PATH fallback — a later install / cwd fix
    // should be able to pick up the real binary without restart.
    if (cached === 'ffmpeg') {
      cached = null
    } else {
      const fixed = usablePath(cached)
      if (fixed) {
        cached = fixed
        return cached
      }
      cached = null
    }
  }

  // FFMPEG_PATH only wins when it points at a real file.
  // Bare names like `ffmpeg` (common mis-set env) must NOT skip bundled static —
  // otherwise web/server runs fail with errors.ffmpegNotFound while the binary sits in node_modules.
  const env = process.env.FFMPEG_PATH?.trim()
  if (env) {
    const u = usablePath(env)
    if (u) {
      cached = u
      return cached
    }
  }

  // Packaged Electron: prefer explicit unpacked path before require() (may hit asar).
  const fromResources = tryResourcesPath()
  if (fromResources) {
    cached = fromResources
    return cached
  }

  const bundled = tryBundledStatic()
  if (bundled) {
    cached = bundled
    return cached
  }

  const explicit = tryExplicitCandidates()
  if (explicit) {
    cached = explicit
    return cached
  }

  // Last resort: PATH command — prefer a custom bare name from env, else `ffmpeg`.
  // Do not sticky-cache this forever (see top of function).
  const bareCmd =
    env && !env.includes('/') && !env.includes('\\') ? env : 'ffmpeg'
  cached = bareCmd
  return cached
}

/**
 * Force a fresh resolve (e.g. after install / failed first probe).
 */
export function resolveFfmpegPathFresh(): string {
  clearFfmpegPathCache()
  return resolveFfmpegPath()
}

/** Clear cache (tests / retry). */
export function clearFfmpegPathCache(): void {
  cached = null
}
