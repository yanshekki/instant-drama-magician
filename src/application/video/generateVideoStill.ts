/**
 * Generate a keyframe still for video-prep review.
 */
import { writeFileSync } from 'fs'
import type { MediaStore } from '../../infrastructure/media/MediaStore'
import { buildStillKeyframePrompt } from '../../domain/videoPrep'

export interface ImageCapableAi {
  generateImage(options: {
    prompt: string
    size?: string
    aspectRatio?: string
  }): Promise<{ b64: string }>
  editImage(options: {
    prompt: string
    imagePath: string
    size?: string
    aspectRatio?: string
  }): Promise<{ b64: string }>
}

export async function generateVideoStillKeyframe(options: {
  ai: ImageCapableAi
  store: MediaStore
  professionalPrompt: string
  sourceImagePath?: string | null
  improvementNotes?: string | null
  locale?: 'zh-HK' | 'en'
  aspectRatio?: string
  size?: string
  /** Output path under media library */
  outputPath: string
}): Promise<{ stillPath: string; stillPromptUsed: string }> {
  const stillPrompt = buildStillKeyframePrompt(options.professionalPrompt, {
    improvementNotes: options.improvementNotes,
    locale: options.locale
  })
  const size = options.size || '1024x1024'
  const aspectRatio = options.aspectRatio || '16:9'
  const ref =
    options.sourceImagePath?.trim() && options.sourceImagePath.trim()
      ? options.sourceImagePath.trim()
      : null

  const img =
    ref &&
    (await import('fs')).existsSync(ref)
      ? await options.ai.editImage({
          prompt: stillPrompt,
          imagePath: ref,
          size,
          aspectRatio
        })
      : await options.ai.generateImage({
          prompt: stillPrompt,
          size,
          aspectRatio
        })

  options.store.ensureLibraryDirs()
  writeFileSync(options.outputPath, Buffer.from(img.b64, 'base64'))
  return { stillPath: options.outputPath, stillPromptUsed: stillPrompt }
}
