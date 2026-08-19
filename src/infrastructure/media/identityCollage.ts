/**
 * Stitch 2–4 identity stills into one plate for the single-image edits API.
 */
import { spawnSync } from 'child_process'
import { existsSync } from 'fs'
import { collageFilterComplex } from '../../domain/identityCollageLayout'
import { collageSourcePaths } from '../../domain/advancedIdentity'
import { resolveFfmpegPath } from '../ffmpeg/resolveFfmpegPath'

export function stitchIdentityCollage(options: {
  imagePaths: string[]
  outputPath: string
  ffmpegBin?: string
}): { path: string; stitched: boolean; reason?: string } {
  const src = collageSourcePaths(options.imagePaths, 4).filter((p) =>
    existsSync(p)
  )
  if (src.length < 2) {
    return {
      path: src[0] || options.outputPath,
      stitched: false,
      reason: 'need-two'
    }
  }
  const filter = collageFilterComplex(src.length)
  if (!filter) {
    return { path: src[0]!, stitched: false, reason: 'filter' }
  }
  let bin: string
  try {
    bin = options.ffmpegBin?.trim() || resolveFfmpegPath()
  } catch {
    return { path: src[0]!, stitched: false, reason: 'no-ffmpeg' }
  }
  const args: string[] = ['-y']
  for (const p of src) {
    args.push('-i', p)
  }
  args.push('-filter_complex', filter, '-frames:v', '1', options.outputPath)
  const r = spawnSync(bin, args, { encoding: 'utf8', timeout: 60_000 })
  if (r.status !== 0 || !existsSync(options.outputPath)) {
    return { path: src[0]!, stitched: false, reason: 'ffmpeg-fail' }
  }
  return { path: options.outputPath, stitched: true }
}
