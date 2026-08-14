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
