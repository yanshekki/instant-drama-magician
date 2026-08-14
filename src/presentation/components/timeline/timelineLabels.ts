import type { Scene } from '../../../types/domain'

export type StoryCastScene = Scene & { sceneNumber?: number }

/** Safe scene label — never emits `#undefined`. */
export function sceneCastLabel(s: StoryCastScene): string {
  const title = (s.title || s.description || '').trim()
  const short = title.slice(0, 36)
  if (s.sceneNumber != null && Number.isFinite(s.sceneNumber)) {
    return `#${s.sceneNumber} ${short}`.trim()
  }
  return short || s.id.slice(0, 8)
}

/**
 * Compact clip-track copy: keep the first speaker tag, drop repeats on later
 * lines, and join so Konva can wrap two readable lines instead of "Name：" twice.
 */
export function timelineTrackLabel(raw: string, max = 220): string {
  const lines = raw
    .replace(/\r/g, '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
  if (lines.length === 0) return ''
  const head = lines[0].match(/^([^\s：:]{1,16})[：:]\s*/)
  const speaker = head?.[1]
  const compact = lines
    .map((line, i) => {
      if (i === 0 || !speaker) return line
      const prefixes = [`${speaker}：`, `${speaker}:`]
      for (const p of prefixes) {
        if (line.startsWith(p)) return line.slice(p.length).trim()
      }
      return line
    })
    .filter(Boolean)
  const joined = compact.join('  ')
  if (joined.length <= max) return joined
  return `${joined.slice(0, Math.max(1, max - 1)).trimEnd()}…`
}
