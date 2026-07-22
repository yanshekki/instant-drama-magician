/**
 * Multimodal (vision) helpers for AI fill — attach local stills as data URLs.
 *
 * Large stills are downscaled (via bundled ffmpeg) so Grok Gateway can pass
 * them through `grok --prompt-json` without hitting OS ARG_MAX (E2BIG).
 */
import { spawnSync } from 'child_process'
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync
} from 'fs'
import { createRequire } from 'module'
import { tmpdir } from 'os'
import { extname, join } from 'path'
import type { ChatContentPart } from '../types/domain'
import { AppError } from '../types/errors'

function tryResolveFfmpeg(): string | null {
  try {
    const req = createRequire(join(process.cwd(), 'package.json'))
    const mod = req('ffmpeg-static') as string | { default?: string } | null
    const p =
      typeof mod === 'string'
        ? mod
        : typeof mod?.default === 'string'
          ? mod.default
          : null
    if (p && existsSync(p)) return p
  } catch {
    /* ignore */
  }
  const candidate = join(
    process.cwd(),
    'node_modules',
    'ffmpeg-static',
    process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
  )
  return existsSync(candidate) ? candidate : null
}

/**
 * Longest edge for vision / image-edit stills (keeps Grok CLI argv / payload modest).
 * Shared by every AI-fill path (character / scene / prop / action / costume).
 */
export const VISION_MAX_EDGE = 768
/**
 * Prefer re-encode when original exceeds this many bytes.
 * ~100–150KB JPEG stills still failed gateway (“Grok CLI produced no stdout”);
 * keep the threshold low so typical 1–2k uploads are always compressed.
 */
export const VISION_MAX_BYTES = 100_000
/** Skip ffmpeg only for already-tiny files (icons / 1×1 tests). */
export const VISION_SKIP_RESIZE_BYTES = 80_000

export function resolveReadableImagePath(
  path: string | null | undefined
): string | null {
  if (typeof path !== 'string') return null
  const p = path.trim()
  if (!p || !existsSync(p)) return null
  return p
}

/** True when caller intended to attach an image (non-empty path string). */
export function isReferenceImagePathClaimed(
  path: string | null | undefined
): boolean {
  return typeof path === 'string' && path.trim().length > 0
}

function mimeFromExt(filePath: string): string {
  const ext = extname(filePath).toLowerCase()
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.webp') return 'image/webp'
  if (ext === '.gif') return 'image/gif'
  return 'image/png'
}

export function mimeFromImagePath(filePath: string): string {
  return mimeFromExt(filePath)
}

/**
 * Best-effort downscale + JPEG re-encode for vision / image-edit payloads.
 * Returns original buffer/mime when ffmpeg unavailable or already small.
 */
export function prepareVisionImageBytes(filePath: string): {
  bytes: Buffer
  mime: string
  resized: boolean
} {
  const original = readFileSync(filePath)
  const mime = mimeFromExt(filePath)
  // Any non-tiny still (JPEG/PNG/WebP) goes through the same ffmpeg path so
  // action / prop / scene / character / costume vision fill stay consistent.
  const needsResize = original.length > VISION_SKIP_RESIZE_BYTES

  if (!needsResize) {
    return { bytes: original, mime, resized: false }
  }

  const ffmpegBin = tryResolveFfmpeg()
  if (!ffmpegBin) return { bytes: original, mime, resized: false }

  let dir: string | null = null
  try {
    dir = mkdtempSync(join(tmpdir(), 'idm-vision-'))
    const outPath = join(dir, 'vision.jpg')
    const r = spawnSync(
      ffmpegBin,
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-y',
        '-i',
        filePath,
        '-vf',
        `scale='min(${VISION_MAX_EDGE},iw)':'min(${VISION_MAX_EDGE},ih)':force_original_aspect_ratio=decrease`,
        '-q:v',
        '5',
        outPath
      ],
      { encoding: 'utf8', timeout: 60_000 }
    )
    if (r.status === 0 && existsSync(outPath)) {
      const bytes = readFileSync(outPath)
      // Prefer re-encoded even if slightly larger than a tiny original PNG
      // (JPEG header), as long as payload is non-empty and under MAX_BYTES
      // or smaller than the original.
      if (
        bytes.length > 0 &&
        (bytes.length < original.length || bytes.length <= VISION_MAX_BYTES)
      ) {
        return { bytes, mime: 'image/jpeg', resized: true }
      }
    }
  } catch {
    /* fall through */
  } finally {
    if (dir) {
      try {
        rmSync(dir, { recursive: true, force: true })
      } catch {
        /* ignore */
      }
    }
  }
  return { bytes: original, mime, resized: false }
}

/**
 * Bytes for image edit / vision: always prefer prepareVisionImageBytes when large.
 */
export function loadImageBytesForAi(filePath: string): {
  bytes: Buffer
  mime: string
  resized: boolean
} {
  if (!existsSync(filePath)) {
    throw new AppError(
      'VALIDATION',
      'errors.visionImageUnreadable',
      'errors.visionImageUnreadableDetail'
    )
  }
  try {
    if (statSync(filePath).size <= VISION_SKIP_RESIZE_BYTES) {
      const bytes = readFileSync(filePath)
      return { bytes, mime: mimeFromExt(filePath), resized: false }
    }
  } catch {
    /* prepareVisionImageBytes */
  }
  return prepareVisionImageBytes(filePath)
}

export function imagePathToDataUrl(filePath: string): string | null {
  try {
    if (!existsSync(filePath)) return null
    const { bytes, mime } = loadImageBytesForAi(filePath)
    return `data:${mime};base64,${bytes.toString('base64')}`
  } catch {
    return null
  }
}

/**
 * OpenAI-compatible user content: plain text, or text + image when path is readable.
 *
 * If a non-empty reference path was claimed but the file cannot be read into a
 * data URL, throws (never silently drops the image — that made image-only fill
 * look broken).
 */
/** Max stills attached to one chat vision request (polish / multi-ref). */
export const MULTI_VISION_MAX_IMAGES = 8

/**
 * OpenAI-compatible user content with **multiple** reference stills.
 * Chat/vision supports N image_url parts; final image export is still one frame.
 *
 * Empty path list → plain text. Claimed but unreadable paths are skipped when
 * at least one image succeeds; if every claimed path fails, throws.
 */
export function buildMultiVisionUserContent(
  textPrompt: string,
  referenceImagePaths?: Array<string | null | undefined> | null,
  opts?: { maxImages?: number; requireAll?: boolean }
): string | ChatContentPart[] {
  const max = opts?.maxImages ?? MULTI_VISION_MAX_IMAGES
  const raw = (referenceImagePaths ?? [])
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter(Boolean)
  if (raw.length === 0) return textPrompt

  const unique: string[] = []
  for (const p of raw) {
    if (!unique.includes(p)) unique.push(p)
    if (unique.length >= max) break
  }

  const parts: ChatContentPart[] = [{ type: 'text', text: textPrompt }]
  let attached = 0
  const failed: string[] = []
  for (const claimed of unique) {
    const path = resolveReadableImagePath(claimed)
    if (!path) {
      failed.push(claimed)
      if (opts?.requireAll) {
        throw new AppError(
          'VALIDATION',
          'errors.visionImageUnreadable',
          'errors.visionImageUnreadableDetail'
        )
      }
      continue
    }
    const dataUrl = imagePathToDataUrl(path)
    if (!dataUrl) {
      failed.push(claimed)
      if (opts?.requireAll) {
        throw new AppError(
          'VALIDATION',
          'errors.visionImageUnreadable',
          'errors.visionImageUnreadableDetail'
        )
      }
      continue
    }
    parts.push({ type: 'image_url', image_url: { url: dataUrl } })
    attached += 1
  }

  if (attached === 0) {
    throw new AppError(
      'VALIDATION',
      'errors.visionImageUnreadable',
      'errors.visionImageUnreadableDetail'
    )
  }
  return parts
}

/**
 * OpenAI-compatible user content: plain text, or text + image when path is readable.
 *
 * If a non-empty reference path was claimed but the file cannot be read into a
 * data URL, throws (never silently drops the image — that made image-only fill
 * look broken).
 */
export function buildVisionUserContent(
  textPrompt: string,
  referenceImagePath?: string | null
): string | ChatContentPart[] {
  const claimed = isReferenceImagePathClaimed(referenceImagePath)
  if (!claimed) return textPrompt
  return buildMultiVisionUserContent(textPrompt, [referenceImagePath], {
    requireAll: true,
    maxImages: 1
  })
}

/**
 * Grok CLI ACP image block (via Gateway pass-through when type === 'image').
 * OpenAI `image_url` is converted for grok-gateway in buildChatCompletionBody.
 */
export function dataUrlToGrokImagePart(
  dataUrl: string
): { type: 'image'; mimeType: string; data: string } | null {
  const m = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl.trim())
  if (!m) return null
  return { type: 'image', mimeType: m[1], data: m[2] }
}

export function visionFillUserPreamble(
  locale: 'zh-HK' | 'en',
  kind: 'character' | 'scene' | 'prop' | 'action' | 'costume'
): string {
  if (locale === 'en') {
    const what =
      kind === 'character'
        ? 'character identity (name, appearance, costume, age, gender, tags)'
        : kind === 'scene'
          ? 'location profile (title, description, lighting, mood, set dressing, tags)'
          : kind === 'prop'
            ? 'prop profile (name, description, material, size, condition, tags)'
            : kind === 'action'
              ? 'action profile (name, description, motion, intention, camera notes, tags)'
              : 'wardrobe (name, full costume description)'
    return `A reference still is attached. Fill ALL profile fields for this ${what} primarily FROM THE IMAGE. Optionally refine with any idea/draft text.`
  }
  const what =
    kind === 'character'
      ? '角色（名稱、外貌、戲服、年齡、性別、標籤等）'
      : kind === 'scene'
        ? '場景（標題、描述、光影、氣氛、佈景、標籤等）'
        : kind === 'prop'
          ? '道具（名稱、描述、材質、尺寸、狀態、標籤等）'
          : kind === 'action'
            ? '動作（名稱、說明、節奏、意圖、鏡頭備註、標籤等）'
            : '戲服（名稱、完整造型描述）'
  return `已附上參考靜圖。請主要根據圖片填寫此${what}全部欄位；可結合構思／草稿潤飾。`
}
