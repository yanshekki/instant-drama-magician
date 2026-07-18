/**
 * Post-process Grok Imagine outputs.
 *
 * Grok native canvas is often ~1280×720 / 720×1280 / 1024×1024 (aspect only;
 * OpenAI-style 1792×1024 is mapped to 16:9 and does NOT raise native pixels).
 * A mild 2× Lanczos + unsharp mask makes multi-panel character sheets less soft
 * when displayed large, without inventing new identity detail.
 */

import { spawnSync } from 'child_process'
import { copyFileSync, existsSync, renameSync, unlinkSync } from 'fs'
import { dirname, join } from 'path'

/** Upscale if the longest edge is below this (Grok class resolutions). */
export const ENHANCE_MAX_EDGE_BEFORE = 1600
export const ENHANCE_SCALE = 2

export interface EnhanceImageOptions {
  /** Skip when longest edge ≥ this (default 1600) */
  maxEdge?: number
  /** Integer scale factor (default 2) */
  scale?: number
  /** When false, no-op */
  enabled?: boolean
}

/**
 * In-place enhance of a PNG/JPEG on disk. Safe no-op if Pillow missing or file large.
 * Returns final path (same as input on success / skip).
 */
export function enhanceCharacterImage(
  filePath: string,
  options?: EnhanceImageOptions
): {
  path: string
  enhanced: boolean
  before?: string
  after?: string
  reason?: string
} {
  if (options?.enabled === false) {
    return { path: filePath, enhanced: false, reason: 'disabled' }
  }
  if (!filePath || !existsSync(filePath)) {
    return { path: filePath, enhanced: false, reason: 'missing' }
  }

  const maxEdge = options?.maxEdge ?? ENHANCE_MAX_EDGE_BEFORE
  const scale = Math.max(1, Math.min(4, Math.round(options?.scale ?? ENHANCE_SCALE)))

  const tmp = join(dirname(filePath), `.enhance_${Date.now()}.png`)
  const script = `
import sys
from pathlib import Path
try:
    from PIL import Image, ImageFilter
except Exception as e:
    print("NO_PIL", e)
    sys.exit(2)

src = Path(sys.argv[1])
dst = Path(sys.argv[2])
max_edge = int(sys.argv[3])
scale = int(sys.argv[4])

im = Image.open(src)
if im.mode not in ("RGB", "RGBA"):
    im = im.convert("RGBA" if "A" in im.getbands() else "RGB")
w, h = im.size
print(f"BEFORE {w}x{h}")
if max(w, h) >= max_edge:
    print("SKIP already large")
    sys.exit(3)

nw, nh = w * scale, h * scale
im = im.resize((nw, nh), Image.Resampling.LANCZOS)
# Mild unsharp — improves perceived clarity on character sheets
im = im.filter(ImageFilter.UnsharpMask(radius=1.15, percent=125, threshold=2))
im.save(dst, "PNG", optimize=True)
print(f"AFTER {nw}x{nh}")
`

  const r = spawnSync(
    'python3',
    ['-c', script, filePath, tmp, String(maxEdge), String(scale)],
    { encoding: 'utf8', timeout: 60_000 }
  )

  const out = `${r.stdout || ''}${r.stderr || ''}`
  if (r.status === 3) {
    // already large
    if (existsSync(tmp)) {
      try {
        unlinkSync(tmp)
      } catch {
        /* ignore */
      }
    }
    return { path: filePath, enhanced: false, reason: 'already_large', before: out.trim() }
  }
  if (r.status !== 0 || !existsSync(tmp)) {
    if (existsSync(tmp)) {
      try {
        unlinkSync(tmp)
      } catch {
        /* ignore */
      }
    }
    return {
      path: filePath,
      enhanced: false,
      reason: r.status === 2 ? 'no_pillow' : `exit_${r.status}`,
      before: out.trim()
    }
  }

  try {
    renameSync(tmp, filePath)
  } catch {
    // cross-device fallback
    copyFileSync(tmp, filePath)
    unlinkSync(tmp)
  }

  const m = out.match(/BEFORE\s+(\d+x\d+)/)
  const a = out.match(/AFTER\s+(\d+x\d+)/)
  return {
    path: filePath,
    enhanced: true,
    before: m?.[1],
    after: a?.[1]
  }
}
