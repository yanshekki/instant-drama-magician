export interface SubtitleCue {
  startSeconds: number
  endSeconds: number
  text: string
}

/** Format seconds as SRT timestamp HH:MM:SS,mmm */
export function formatSrtTime(seconds: number): string {
  const s = Math.max(0, seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  const ms = Math.round((s - Math.floor(s)) * 1000)
  const pad = (n: number, w = 2): string => String(n).padStart(w, '0')
  return `${pad(h)}:${pad(m)}:${pad(sec)},${pad(ms, 3)}`
}

export function buildSrt(cues: readonly SubtitleCue[]): string {
  const usable = cues.filter((c) => c.text.trim().length > 0 && c.endSeconds > c.startSeconds)
  return usable
    .map((c, i) => {
      const text = c.text.trim().replace(/\r\n/g, '\n')
      return `${i + 1}\n${formatSrtTime(c.startSeconds)} --> ${formatSrtTime(c.endSeconds)}\n${text}\n`
    })
    .join('\n')
}
