/**
 * Shared helpers for media:saveAs (Electron save dialog vs web download URL).
 */
import { basename, extname } from 'path'

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'avif'])
const VIDEO_EXTS = new Set(['mp4', 'webm', 'mov', 'm4v', 'mkv', 'avi'])

export function mediaExt(filePath: string): string {
  return extname(filePath).replace(/^\./, '').toLowerCase() || 'bin'
}

export function isVideoPath(filePath: string): boolean {
  return VIDEO_EXTS.has(mediaExt(filePath))
}

export function isImagePath(filePath: string): boolean {
  return IMAGE_EXTS.has(mediaExt(filePath))
}

export type MediaSaveAsKind = 'image' | 'video' | 'file'

export function mediaSaveAsKind(filePath: string): MediaSaveAsKind {
  if (isVideoPath(filePath)) return 'video'
  if (isImagePath(filePath)) return 'image'
  return 'file'
}

/** Build browser attachment URL for headless / web runtimes. */
export function buildMediaDownloadResult(filePath: string): {
  downloadUrl: string
  fileName: string
  kind: MediaSaveAsKind
} {
  const fileName = basename(filePath)
  return {
    downloadUrl: `/api/download?p=${encodeURIComponent(filePath)}`,
    fileName,
    kind: mediaSaveAsKind(filePath)
  }
}

/** Default Save-as name for one timeline clip (safe for Windows/macOS). */
export function suggestedClipExportName(opts: {
  storyTitle?: string | null
  clipIndex: number
  ext?: string
}): string {
  const raw = (opts.storyTitle || '').trim() || 'clip'
  const title = raw.replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, ' ').trim()
  const n = Number.isFinite(opts.clipIndex) ? Math.max(1, Math.floor(opts.clipIndex)) : 1
  const ext = (opts.ext || 'mp4').replace(/^\./, '') || 'mp4'
  return `${title}-第${n}段.${ext}`
}

/** Electron Save dialog filters based on source extension. */
export function saveAsDialogFilters(
  filePath: string
): Array<{ name: string; extensions: string[] }> {
  const ext = mediaExt(filePath)
  if (IMAGE_EXTS.has(ext)) {
    return [
      {
        name: 'Images',
        extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif']
      },
      { name: 'All files', extensions: ['*'] }
    ]
  }
  if (VIDEO_EXTS.has(ext)) {
    return [
      {
        name: 'Videos',
        extensions: ['mp4', 'webm', 'mov', 'm4v', 'mkv']
      },
      { name: 'All files', extensions: ['*'] }
    ]
  }
  return [
    { name: 'Media', extensions: [ext] },
    { name: 'All files', extensions: ['*'] }
  ]
}
