/**
 * Write / refresh a timeline beat's continuity still from a finished clip video.
 * Prefers near-end frame so the next beat locks to the previous shot's end state.
 */
import { copyFileSync, existsSync } from 'fs'
import type { MediaStore } from '../../infrastructure/media/MediaStore'

export type ContinuityFrameExtractor = {
  extractStillFrame(options: {
    videoPath: string
    outputPath: string
    atSeconds?: number | 'end'
  }): Promise<string>
}

/**
 * Best-effort: extract end frame → clipContinuityStillPath.
 * Falls back to copying keyframe still if extract fails.
 * Returns continuity path when written, else null.
 */
export async function writeClipContinuityStillFromVideo(options: {
  ffmpeg: ContinuityFrameExtractor
  store: MediaStore
  storyId: string
  entryId: string
  videoPath: string
  /** Optional prep keyframe if end extract fails */
  fallbackStillPath?: string | null
  /** Skip when user explicitly removed the still */
  skipIfUserCleared?: boolean
}): Promise<string | null> {
  const video = options.videoPath?.trim()
  if (!video || !existsSync(video)) return null
  if (
    options.skipIfUserCleared !== false &&
    options.store.isEntryStillUserCleared?.(options.storyId, options.entryId)
  ) {
    return null
  }
  try {
    options.store.ensureStoryDirs?.(options.storyId)
  } catch {
    /* optional */
  }
  const contPath = options.store.clipContinuityStillPath(
    options.storyId,
    options.entryId,
    '.png'
  )
  try {
    await options.ffmpeg.extractStillFrame({
      videoPath: video,
      outputPath: contPath,
      atSeconds: 'end'
    })
    if (existsSync(contPath)) return contPath
  } catch {
    /* fall through */
  }
  const fb = options.fallbackStillPath?.trim()
  if (fb && existsSync(fb) && fb !== contPath) {
    try {
      copyFileSync(fb, contPath)
      if (existsSync(contPath)) return contPath
    } catch {
      /* ignore */
    }
  }
  return existsSync(contPath) ? contPath : null
}
