/** Grok Imagine reference_to_video preset voices (gctoac 1.7+). */

export const GROK_VIDEO_VOICES = [
  'ara',
  'eve',
  'leo',
  'rex',
  'sal',
  'mio'
] as const

export type GrokVideoVoice = (typeof GROK_VIDEO_VOICES)[number]

export function isGrokVideoVoice(v: string): v is GrokVideoVoice {
  return (GROK_VIDEO_VOICES as readonly string[]).includes(v)
}

export function coerceGrokVideoVoice(raw: unknown): GrokVideoVoice {
  const v = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  return isGrokVideoVoice(v) ? v : 'ara'
}

export function sanitizeGrokVoices(
  raw?: Array<string | null | undefined> | null
): GrokVideoVoice[] {
  const out: GrokVideoVoice[] = []
  for (const x of raw ?? []) {
    if (typeof x !== 'string' || !x.trim()) continue
    const v = x.trim().toLowerCase()
    if (!isGrokVideoVoice(v) || out.includes(v)) continue
    out.push(v)
    if (out.length >= 3) break
  }
  return out
}

export function inferGrokVoiceFromCharacter(opts: {
  gender?: string | null
  voiceDesc?: string | null
  defaultVoice?: string | null
}): GrokVideoVoice {
  const def = coerceGrokVideoVoice(opts.defaultVoice)
  const blob = `${opts.gender ?? ''} ${opts.voiceDesc ?? ''}`.toLowerCase()
  if (/女|female|woman|girl|femme|soprano|eve/.test(blob)) return 'eve'
  if (/男|male|man|boy|homme|baritone|bass|tenor|leo/.test(blob)) return 'leo'
  return def
}

export function mapGrokClipVoices(
  chars: Array<{ gender?: string | null; voiceDesc?: string | null }>,
  defaultVoice?: string | null
): GrokVideoVoice[] {
  const def = coerceGrokVideoVoice(defaultVoice)
  if (!chars.length) return [def]
  const out: GrokVideoVoice[] = []
  for (const c of chars.slice(0, 3)) {
    let v = inferGrokVoiceFromCharacter({ ...c, defaultVoice: def })
    if (out.includes(v)) {
      v = GROK_VIDEO_VOICES.find((x) => !out.includes(x)) ?? v
    }
    out.push(v)
  }
  return out
}

/** xAI reference-to-video prompt tags for preset voices. */
export function appendGrokVoicePromptHints(
  prompt: string,
  voices: string[]
): string {
  const ids = sanitizeGrokVoices(voices)
  if (ids.length === 0) return prompt
  const tags = ids.map((_, i) => `<AUDIO_${i}>`).join(', ')
  return `${prompt.trim()}\n\nSpoken dialogue uses preset voices ${tags} in character order (${ids.join(', ')}).`
}
