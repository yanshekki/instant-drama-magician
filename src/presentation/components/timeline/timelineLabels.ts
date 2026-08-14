import { getArtStyle, isArtStyleId } from '../../../domain/characterArtStyles'
import { getLlmPresetDef, isLlmProviderPreset } from '../../../domain/openaiCompatible'
import type { Scene } from '../../../types/domain'

const CHANNEL_PRESET_KEYS: Record<string, string> = {
  'same-as-llm': 'sameAsLlm',
  stub: 'stub',
  seedance: 'seedance',
  seedream: 'seedream'
}

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

/** Known art-style ids → UI language; unknown / custom text stays as-is. */
export function timelineArtStyleLabel(
  raw: string,
  t: (key: string) => string
): string {
  const id = raw.trim()
  if (!isArtStyleId(id)) return raw
  return t(`characters.${getArtStyle(id).labelKey}`)
}

/** Provider id (same-as-llm, stub, grok-gateway…) → settings picker label. */
export function timelineProviderLabel(
  id: string,
  t: (key: string) => string
): string {
  const raw = id.trim()
  if (!raw) return raw
  const channelKey = CHANNEL_PRESET_KEYS[raw]
  if (channelKey) return t(`settings.channelPreset.${channelKey}`)
  if (isLlmProviderPreset(raw)) {
    const def = getLlmPresetDef(raw)
    if (def) return t(`settings.llmPreset.${def.labelKey}`)
  }
  return raw
}

/** "same-as-llm · grok" → localized provider + raw model id. */
export function timelineChannelLabel(
  raw: string,
  t: (key: string) => string
): string {
  const s = raw.trim()
  if (!s) return s
  const sep = ' · '
  const i = s.indexOf(sep)
  const provider = (i >= 0 ? s.slice(0, i) : s).trim()
  const model = i >= 0 ? s.slice(i + sep.length).trim() : ''
  const name = timelineProviderLabel(provider, t)
  if (name && model) return `${name} · ${model}`
  return name || model
}
