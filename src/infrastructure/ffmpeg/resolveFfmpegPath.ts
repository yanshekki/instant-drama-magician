/**
 * Resolve the ffmpeg binary for InstantDrama Magician.
 * Prefer env override, then bundled ffmpeg-static, then explicit
 * project/electron-relative paths, then PATH.
 */
import { existsSync } from 'fs'
import { dirname, join } from 'path'
import { createRequire } from 'module'

let cached: string | null = null

const BIN_NAME = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'

function isUsableFile(p: string | null | undefined): p is string {
  return Boolean(p && p !== 'ffmpeg' && existsSync(p))
}

function tryBundledStatic(): string | null {
  try {
    // Prefer createRequire so resolution works from CJS/ESM and electron-vite out/
    const req = createRequire(
      typeof __filename !== 'undefined'
        ? __filename
        : join(process.cwd(), 'package.json')
    )
    const mod = req('ffmpeg-static') as string | { default?: string } | null
    const p =
      typeof mod === 'string'
        ? mod
        : typeof mod?.default === 'string'
          ? mod.default
          : null
    if (isUsableFile(p)) return p
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
    if (isUsableFile(p)) return p
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
    if (isUsableFile(c)) return c
  }
  return null
}

function tryResourcesPath(): string | null {
  // electron packaged: optional extraResources/ffmpeg/ffmpeg
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { app } = require('electron') as typeof import('electron')
    if (!app?.isPackaged) {
      // Dev: also try next to app path
      try {
        const appPath = app.getAppPath()
        const p = join(appPath, 'node_modules', 'ffmpeg-static', BIN_NAME)
        if (isUsableFile(p)) return p
      } catch {
        /* ignore */
      }
      return null
    }
    const base = process.resourcesPath
    const candidates = [
      join(base, 'ffmpeg', BIN_NAME),
      join(base, BIN_NAME),
      join(
        base,
        'app.asar.unpacked',
        'node_modules',
        'ffmpeg-static',
        BIN_NAME
      )
    ]
    for (const c of candidates) {
      if (isUsableFile(c)) return c
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
  if (cached && (cached === 'ffmpeg' || existsSync(cached))) {
    return cached
  }

  const env = process.env.FFMPEG_PATH?.trim()
  if (env) {
    if (env === 'ffmpeg' || existsSync(env)) {
      cached = env
      return cached
    }
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

  const fromResources = tryResourcesPath()
  if (fromResources) {
    cached = fromResources
    return cached
  }

  // Last resort: hope PATH has ffmpeg (do not permanently cache failure path
  // as absolute so re-resolve can pick up newly installed binaries).
  cached = 'ffmpeg'
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
