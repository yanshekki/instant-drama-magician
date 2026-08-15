/**
 * Beat = one short-clip screenplay unit (not a single spoken line).
 * Holds multi-line dialogue, action, expression, mood, atmosphere, camera, sfx.
 */
import { PromptCatalog } from '../prompts'

export type BeatUnitType = 'action' | 'expression' | 'dialogue' | 'note'

export type BeatUnit =
  | { type: 'action'; who?: string; text: string }
  | { type: 'expression'; who?: string; text: string }
  | {
      type: 'dialogue'
      who: string
      line: string
      tone?: string
      parenthetical?: string
    }
  | { type: 'note'; text: string }

export interface BeatContent {
  version: 1
  mood?: string
  atmosphere?: string
  camera?: string
  sfx?: string
  units: BeatUnit[]
}

export function emptyBeatContent(): BeatContent {
  return { version: 1, units: [] }
}

export function isBeatContent(v: unknown): v is BeatContent {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  if (o.version !== 1) return false
  if (!Array.isArray(o.units)) return false
  return true
}

function trimOrUndef(s: unknown): string | undefined {
  if (typeof s !== 'string') return undefined
  const t = s.trim()
  return t || undefined
}

export function normalizeBeatContent(raw: unknown): BeatContent | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const unitsIn = Array.isArray(o.units) ? o.units : []
  const units: BeatUnit[] = []
  for (const u of unitsIn) {
    if (!u || typeof u !== 'object') continue
    const r = u as Record<string, unknown>
    const type = r.type
    if (type === 'action' || type === 'expression') {
      const text = trimOrUndef(r.text)
      if (!text) continue
      const who = trimOrUndef(r.who)
      units.push(who ? { type, who, text } : { type, text })
    } else if (type === 'dialogue') {
      const line = trimOrUndef(r.line) ?? trimOrUndef(r.text)
      if (!line) continue
      const who = trimOrUndef(r.who) ?? ''
      const tone = trimOrUndef(r.tone)
      const parenthetical = trimOrUndef(r.parenthetical)
      units.push({
        type: 'dialogue',
        who,
        line,
        ...(tone ? { tone } : {}),
        ...(parenthetical ? { parenthetical } : {})
      })
    } else if (type === 'note') {
      const text = trimOrUndef(r.text)
      if (!text) continue
      units.push({ type: 'note', text })
    }
  }
  const mood = trimOrUndef(o.mood)
  const atmosphere = trimOrUndef(o.atmosphere)
  const camera = trimOrUndef(o.camera)
  const sfx = trimOrUndef(o.sfx)
  if (
    !units.length &&
    !mood &&
    !atmosphere &&
    !camera &&
    !sfx
  ) {
    return null
  }
  return {
    version: 1,
    ...(mood ? { mood } : {}),
    ...(atmosphere ? { atmosphere } : {}),
    ...(camera ? { camera } : {}),
    ...(sfx ? { sfx } : {}),
    units
  }
}

/** Legacy free text → treat as visual action / note (not pure speech). */
export function legacyDialogueToBeatContent(
  text: string | null | undefined
): BeatContent | null {
  const t = text?.trim()
  if (!t) return null
  // Already structured human format?
  if (/【(心情|氣氛|鏡頭|聲效|動作|表情|對白)/.test(t) ||
      /\[(MOOD|ATMO|CAMERA|SFX|ACTION|EXPR|DIALOGUE)/i.test(t)) {
    return parseBeatContentText(t)
  }
  // Looks like pure spoken line(s)? short quotes or 角色：句
  const spokenLike =
    /^[「『"'].+[」』"']\s*$/.test(t) ||
    /^[\w\u4e00-\u9fff]{1,12}[：:]\s*.+/.test(t)
  if (spokenLike && t.length < 120 && !t.includes('\n')) {
    const m = t.match(/^([\w\u4e00-\u9fff]{1,12})[：:]\s*(.+)$/)
    if (m) {
      return {
        version: 1,
        units: [{ type: 'dialogue', who: m[1], line: m[2].trim() }]
      }
    }
    return {
      version: 1,
      units: [{ type: 'dialogue', who: '', line: t.replace(/^[「『"']|[」』"']$/g, '') }]
    }
  }
  // Narrative / action dump (common AI output) → action unit
  return {
    version: 1,
    units: [{ type: 'action', text: t }]
  }
}

/**
 * Parse human-readable canonical script or JSON string into BeatContent.
 * Prefer structured editor text when present (so live typing is not overridden by stale JSON).
 */
export function parseBeatContent(
  input: string | null | undefined,
  jsonFallback?: string | null
): BeatContent | null {
  const t = input?.trim()
  if (t) {
    if (t.startsWith('{')) {
      try {
        const n = normalizeBeatContent(JSON.parse(t) as unknown)
        if (n) return n
      } catch {
        // fall through
      }
    }
    if (/【|\[(MOOD|ATMO|CAMERA|SFX|ACTION|EXPR|DIALOGUE)/i.test(t)) {
      const fromText = parseBeatContentText(t)
      if (fromText) return fromText
    }
  }
  if (jsonFallback?.trim()) {
    try {
      const parsed = JSON.parse(jsonFallback) as unknown
      const n = normalizeBeatContent(parsed)
      if (n) return n
    } catch {
      // fall through
    }
  }
  if (!t) return null
  const fromText = parseBeatContentText(t)
  if (fromText) return fromText
  return legacyDialogueToBeatContent(t)
}

function parseBeatContentText(text: string): BeatContent | null {
  const lines = text.split(/\r?\n/)
  const units: BeatUnit[] = []
  let mood: string | undefined
  let atmosphere: string | undefined
  let camera: string | undefined
  let sfx: string | undefined

  const tagRe =
    /^【(心情|氣氛|氣氛\/背景|鏡頭|聲效|動作|表情|對白)(?:[｜|]([^】]*))?】\s*(.*)$/
  const enRe =
    /^\[(MOOD|ATMO|ATMOSPHERE|CAMERA|SFX|ACTION|EXPR|EXPRESSION|DIALOGUE|LINE)(?:[|:]([^\]]*))?\]\s*(.*)$/i

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue
    let m = line.match(tagRe)
    if (m) {
      const kind = m[1]
      const meta = (m[2] ?? '').trim()
      const body = (m[3] ?? '').trim()
      if (kind === '心情') mood = body || meta || mood
      else if (kind === '氣氛' || kind === '氣氛/背景')
        atmosphere = body || meta || atmosphere
      else if (kind === '鏡頭') camera = body || meta || camera
      else if (kind === '聲效') sfx = body || meta || sfx
      else if (kind === '動作') {
        if (body)
          units.push(
            meta
              ? { type: 'action', who: meta.split(/[｜|]/)[0]?.trim(), text: body }
              : { type: 'action', text: body }
          )
      } else if (kind === '表情') {
        if (body)
          units.push(
            meta
              ? {
                  type: 'expression',
                  who: meta.split(/[｜|]/)[0]?.trim(),
                  text: body
                }
              : { type: 'expression', text: body }
          )
      } else if (kind === '對白') {
        const parts = meta.split(/[｜|]/).map((s) => s.trim()).filter(Boolean)
        const who = parts[0] ?? ''
        const tone = parts[1]
        const paren = body.match(/^[（(]([^）)]+)[）)]\s*(.*)$/)
        if (paren) {
          units.push({
            type: 'dialogue',
            who,
            line: paren[2].trim() || paren[1],
            ...(tone ? { tone } : {}),
            parenthetical: paren[1]
          })
        } else if (body) {
          units.push({
            type: 'dialogue',
            who,
            line: body,
            ...(tone ? { tone } : {})
          })
        }
      }
      continue
    }
    m = line.match(enRe)
    if (m) {
      const kind = m[1].toUpperCase()
      const meta = (m[2] ?? '').trim()
      const body = (m[3] ?? '').trim()
      if (kind === 'MOOD') mood = body || meta || mood
      else if (kind === 'ATMO' || kind === 'ATMOSPHERE')
        atmosphere = body || meta || atmosphere
      else if (kind === 'CAMERA') camera = body || meta || camera
      else if (kind === 'SFX') sfx = body || meta || sfx
      else if (kind === 'ACTION') {
        if (body)
          units.push(
            meta
              ? { type: 'action', who: meta, text: body }
              : { type: 'action', text: body }
          )
      } else if (kind === 'EXPR' || kind === 'EXPRESSION') {
        if (body)
          units.push(
            meta
              ? { type: 'expression', who: meta, text: body }
              : { type: 'expression', text: body }
          )
      } else if (kind === 'DIALOGUE' || kind === 'LINE') {
        const parts = meta.split(/[|:]/).map((s) => s.trim()).filter(Boolean)
        const who = parts[0] ?? ''
        const tone = parts[1]
        if (body)
          units.push({
            type: 'dialogue',
            who,
            line: body,
            ...(tone ? { tone } : {})
          })
      }
      continue
    }
    // Untagged line inside structured doc → note
    units.push({ type: 'note', text: line })
  }

  if (!units.length && !mood && !atmosphere && !camera && !sfx) return null
  // If only untagged notes and no headers, not really structured
  const onlyNotes =
    units.length > 0 &&
    units.every((u) => u.type === 'note') &&
    !mood &&
    !atmosphere &&
    !camera &&
    !sfx
  if (onlyNotes && !/【|\[(MOOD|ACTION|DIALOGUE)/i.test(text)) {
    return null
  }

  return {
    version: 1,
    ...(mood ? { mood } : {}),
    ...(atmosphere ? { atmosphere } : {}),
    ...(camera ? { camera } : {}),
    ...(sfx ? { sfx } : {}),
    units
  }
}

/** Parser only understands zh-HK / English markup tags. */
function beatTagLocale(locale?: string): 'en' | 'zh-HK' {
  const id = PromptCatalog.locale(locale)
  return id === 'zh-HK' || id === 'zh-CN' ? 'zh-HK' : 'en'
}

/** Human-readable script for editor. */
export function serializeBeatContent(
  content: BeatContent,
  locale: string = 'zh-HK'
): string {
  const tagLoc = beatTagLocale(locale)
  const lines: string[] = []
  if (content.mood?.trim())
    lines.push(
      PromptCatalog.t(tagLoc, 'beat.mood', { text: content.mood.trim() })
    )
  if (content.atmosphere?.trim())
    lines.push(
      PromptCatalog.t(tagLoc, 'beat.atmo', { text: content.atmosphere.trim() })
    )
  if (content.camera?.trim())
    lines.push(
      PromptCatalog.t(tagLoc, 'beat.camera', { text: content.camera.trim() })
    )
  if (content.sfx?.trim())
    lines.push(PromptCatalog.t(tagLoc, 'beat.sfx', { text: content.sfx.trim() }))
  for (const u of content.units) {
    if (u.type === 'action') {
      const who = u.who?.trim()
      lines.push(
        who
          ? PromptCatalog.t(tagLoc, 'beat.actionWho', { who, text: u.text })
          : PromptCatalog.t(tagLoc, 'beat.action', { text: u.text })
      )
    } else if (u.type === 'expression') {
      const who = u.who?.trim()
      lines.push(
        who
          ? PromptCatalog.t(tagLoc, 'beat.exprWho', { who, text: u.text })
          : PromptCatalog.t(tagLoc, 'beat.expr', { text: u.text })
      )
    } else if (u.type === 'dialogue') {
      const who = u.who?.trim() || PromptCatalog.t(tagLoc, 'beat.whoUnknown')
      const tone = u.tone?.trim()
      const body = u.parenthetical
        ? `（${u.parenthetical}）${u.line}`
        : u.line
      lines.push(
        tone
          ? PromptCatalog.t(tagLoc, 'beat.dialogueTone', { who, tone, body })
          : PromptCatalog.t(tagLoc, 'beat.dialogue', { who, body })
      )
    } else if (u.type === 'note' && u.text.trim()) {
      lines.push(u.text.trim())
    }
  }
  return lines.join('\n')
}

export function beatContentToJson(content: BeatContent): string {
  return JSON.stringify(content)
}

/** Spoken lines only — for TTS / SRT. */
export function extractSpokenLines(content: BeatContent | null | undefined): string {
  if (!content?.units?.length) return ''
  const lines: string[] = []
  for (const u of content.units) {
    if (u.type !== 'dialogue') continue
    const line = u.line.trim()
    if (!line) continue
    const who = u.who?.trim()
    lines.push(who ? `${who}：${line}` : line)
  }
  return lines.join('\n')
}

/** Compact spoken-only cache for dialogue column. */
export function spokenSummaryFromBeatContent(
  content: BeatContent | null | undefined
): string | null {
  const s = extractSpokenLines(content)
  return s || null
}

/** Resolve display text for editor: prefer structured serialize. */
export function beatContentForEditor(
  dialogue: string | null | undefined,
  beatContentJson?: string | null,
  locale: string = 'zh-HK'
): string {
  const parsed = parseBeatContent(dialogue, beatContentJson)
  if (!parsed) return dialogue?.trim() ?? ''
  // If we only have legacy action blob, show as-is if no structure tags
  if (
    parsed.units.length === 1 &&
    parsed.units[0].type === 'action' &&
    !parsed.mood &&
    !beatContentJson?.trim() &&
    dialogue &&
    !/【|\[ACTION|\[DIALOGUE/i.test(dialogue)
  ) {
    return dialogue
  }
  return serializeBeatContent(parsed, locale)
}

/**
 * Build clip prompt block: separate VISUAL vs SPEECH.
 */
export function beatContentToClipPromptBlock(
  content: BeatContent | null | undefined,
  fallbackDialogue?: string | null,
  locale?: string | null
): string | null {
  const loc = locale || 'zh-HK'
  const c =
    content ??
    (fallbackDialogue ? legacyDialogueToBeatContent(fallbackDialogue) : null)
  if (!c) return null
  const bits: string[] = []
  if (c.mood) bits.push(PromptCatalog.t(loc, 'beat.mood', { text: c.mood }))
  if (c.atmosphere) {
    bits.push(PromptCatalog.t(loc, 'beat.atmo', { text: c.atmosphere }))
  }
  if (c.camera) {
    bits.push(PromptCatalog.t(loc, 'beat.camera', { text: c.camera }))
  }
  if (c.sfx) bits.push(PromptCatalog.t(loc, 'beat.sfx', { text: c.sfx }))
  for (const u of c.units) {
    if (u.type === 'action') {
      bits.push(
        u.who
          ? PromptCatalog.t(loc, 'beat.actionWho', { who: u.who, text: u.text })
          : PromptCatalog.t(loc, 'beat.action', { text: u.text })
      )
    } else if (u.type === 'expression') {
      bits.push(
        u.who
          ? PromptCatalog.t(loc, 'beat.exprWho', { who: u.who, text: u.text })
          : PromptCatalog.t(loc, 'beat.expr', { text: u.text })
      )
    } else if (u.type === 'dialogue') {
      bits.push(
        u.tone
          ? PromptCatalog.t(loc, 'beat.dialogueTone', {
              who: u.who || PromptCatalog.t(loc, 'beat.whoUnknown'),
              tone: u.tone,
              body: u.line
            })
          : PromptCatalog.t(loc, 'beat.dialogue', {
              who: u.who || PromptCatalog.t(loc, 'beat.whoUnknown'),
              body: u.line
            })
      )
    } else if (u.type === 'note') {
      bits.push(u.text)
    }
  }
  return bits.length ? bits.join('\n') : null
}

/** Estimate clip duration seconds from content richness. */
export function estimateBeatDurationSeconds(
  content: BeatContent | null | undefined,
  opts?: { min?: number; max?: number; base?: number }
): number {
  const min = opts?.min ?? 4
  const max = opts?.max ?? 15
  const base = opts?.base ?? 6
  if (!content) return base
  let sec = base
  const dialogues = content.units.filter((u) => u.type === 'dialogue')
  const actions = content.units.filter((u) => u.type === 'action')
  sec += dialogues.length * 2
  sec += Math.min(actions.length, 3) * 0.8
  const spokenChars = dialogues.reduce((n, u) => n + (u.type === 'dialogue' ? u.line.length : 0), 0)
  sec += Math.min(4, spokenChars / 24)
  if (content.camera) sec += 0.5
  return Math.round(Math.min(max, Math.max(min, sec)) * 10) / 10
}

/** Template inserted into empty editor. */
export function beatScriptTemplate(locale: string = 'zh-HK'): string {
  return PromptCatalog.t(locale, 'beat.template')
}

/**
 * When user edits script text, produce json + spoken dialogue cache.
 */
export function commitBeatScriptEdit(
  scriptText: string,
  locale: string = 'zh-HK'
): {
  beatContentJson: string | null
  dialogue: string | null
  content: BeatContent | null
} {
  const content = parseBeatContent(scriptText)
  if (!content) {
    const t = scriptText.trim()
    return {
      beatContentJson: null,
      dialogue: t || null,
      content: null
    }
  }
  const spoken = spokenSummaryFromBeatContent(content)
  // Prefer keeping human serialize in dialogue when structured (for backup without json)
  // but cache spoken-only for TTS-friendly column when we have json
  return {
    beatContentJson: beatContentToJson(content),
    dialogue: spoken ?? serializeBeatContent(content, locale),
    content
  }
}
