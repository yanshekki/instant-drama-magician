/**
 * FFmpeg filter planner for an identity collage (2–4 stills → one plate).
 * Pixel edits only accept one image; collage is the workaround.
 */

export function collageFilterComplex(inputCount: number): string | null {
  const n = Math.max(0, Math.floor(inputCount))
  if (n < 2) return null
  if (n === 2) {
    return '[0:v]scale=768:768:force_original_aspect_ratio=decrease,pad=768:768:(ow-iw)/2:(oh-ih)/2[a];[1:v]scale=768:768:force_original_aspect_ratio=decrease,pad=768:768:(ow-iw)/2:(oh-ih)/2[b];[a][b]hstack=inputs=2'
  }
  if (n === 3) {
    return [
      '[0:v]scale=768:768:force_original_aspect_ratio=decrease,pad=768:768:(ow-iw)/2:(oh-ih)/2[a]',
      '[1:v]scale=768:768:force_original_aspect_ratio=decrease,pad=768:768:(ow-iw)/2:(oh-ih)/2[b]',
      '[2:v]scale=768:768:force_original_aspect_ratio=decrease,pad=768:768:(ow-iw)/2:(oh-ih)/2[c]',
      '[a][b]hstack=inputs=2[top]',
      '[c]pad=1536:768:(ow-iw)/2:(oh-ih)/2[bottom]',
      '[top][bottom]vstack=inputs=2'
    ].join(';')
  }
  return [
    '[0:v]scale=768:768:force_original_aspect_ratio=decrease,pad=768:768:(ow-iw)/2:(oh-ih)/2[a]',
    '[1:v]scale=768:768:force_original_aspect_ratio=decrease,pad=768:768:(ow-iw)/2:(oh-ih)/2[b]',
    '[2:v]scale=768:768:force_original_aspect_ratio=decrease,pad=768:768:(ow-iw)/2:(oh-ih)/2[c]',
    '[3:v]scale=768:768:force_original_aspect_ratio=decrease,pad=768:768:(ow-iw)/2:(oh-ih)/2[d]',
    '[a][b]hstack=inputs=2[top]',
    '[c][d]hstack=inputs=2[bottom]',
    '[top][bottom]vstack=inputs=2'
  ].join(';')
}
