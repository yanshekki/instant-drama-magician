/**
 * Resolve the ffmpeg binary for InstantDrama Magician.
 * Prefer env override, then bundled ffmpeg-static, then PATH.
 */
import { existsSync } from 'fs'
import { join } from 'path'

let cached: string | null = null

function tryBundledStatic(): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('ffmpeg-static') as string | { default?: string } | null
    const p =
      typeof mod === 'string'
        ? mod
        : typeof mod?.default === 'string'
          ? mod.default
          : null
    if (p && existsSync(p)) return p
  } catch {
    /* not installed / wrong platform */
  }
  return null
}

function tryResourcesPath(): string | null {
  // electron packaged: optional extraResources/ffmpeg/ffmpeg
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { app } = require('electron') as typeof import('electron')
    if (!app?.isPackaged) return null
    const base = process.resourcesPath
    const name = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
    const candidates = [
      join(base, 'ffmpeg', name),
      join(base, name),
      // asarUnpack leaves binary under app.asar.unpacked
      join(
        base,
        'app.asar.unpacked',
        'node_modules',
        'ffmpeg-static',
        name
      )
    ]
    for (const c of candidates) {
      if (existsSync(c)) return c
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
  if (cached) return cached

  const env = process.env.FFMPEG_PATH?.trim()
  if (env && (env === 'ffmpeg' || existsSync(env))) {
    cached = env
    return cached
  }

  const bundled = tryBundledStatic()
  if (bundled) {
    cached = bundled
    return cached
  }

  const fromResources = tryResourcesPath()
  if (fromResources) {
    cached = fromResources
    return cached
  }

  cached = 'ffmpeg'
  return cached
}

/** Clear cache (tests). */
export function clearFfmpegPathCache(): void {
  cached = null
}
