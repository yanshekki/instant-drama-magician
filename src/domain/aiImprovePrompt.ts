/**
 * Shared “AI improve” user-prompt structure for all master-prompt fill buttons.
 * Always merge full form draft (+ optional extra context) so generate = refine.
 */

export function draftHasContent(
  draft: Record<string, unknown> | null | undefined
): boolean {
  if (!draft) return false
  return Object.values(draft).some((v) => {
    if (typeof v === 'string') return v.trim().length > 0
    if (Array.isArray(v)) return v.length > 0
    if (v != null && typeof v === 'object') {
      return Object.keys(v as object).length > 0
    }
    return v != null && String(v).trim().length > 0
  })
}

/** Compact object with only non-empty values (for JSON in prompts). */
export function compactDraft<T extends Record<string, unknown>>(
  draft: T
): Partial<T> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(draft)) {
    if (typeof v === 'string') {
      if (v.trim()) out[k] = v.trim()
    } else if (Array.isArray(v)) {
      if (v.length > 0) out[k] = v
    } else if (v != null && v !== '') {
      out[k] = v
    }
  }
  return out as Partial<T>
}

export function truncateForPrompt(text: string, max = 12_000): string {
  const t = text.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max)}\n\n…[truncated for length]`
}

export interface ImprovePromptParts {
  locale?: 'zh-HK' | 'en'
  /** Short user instruction / idea box */
  idea: string
  /** Label for the draft JSON block */
  draftLabel?: { en: string; zh: string }
  /** Full form fields already filled */
  draft?: Record<string, unknown> | null
  /** Extra markdown/text blocks (soul, story bible, prior scenes…) */
  extraBlocks?: Array<{
    labelEn: string
    labelZh: string
    body: string
  }>
  storyTitle?: string
  styleNote?: string | null
  /** Closing line */
  closing?: { en: string; zh: string }
  emptyIdeaPolish?: { en: string; zh: string }
  /** Pure create mode when no draft/extras */
  createLabel?: { en: string; zh: string }
}

/**
 * Build unified improve / create user prompt used by character, scene, prop, story AI.
 */
export function buildImproveUserPrompt(parts: ImprovePromptParts): string {
  const en = parts.locale === 'en'
  const lines: string[] = []
  const draft = parts.draft ? compactDraft(parts.draft) : {}
  const hasDraft = draftHasContent(draft)
  const extras = (parts.extraBlocks ?? []).filter((b) => b.body.trim())
  const hasExtras = extras.length > 0
  const idea = parts.idea.trim()

  if (hasDraft || hasExtras) {
    lines.push(
      en
        ? 'IMPROVE MODE: Merge ALL sources below into a complete result. Keep core identity unless the user explicitly asks to change it. Prefer rich extra context when form fields are sparse; prefer explicit user request when it asks for a change.'
        : '改進模式：合併下方所有來源輸出完整結果。除非用戶明確要求改身份，否則保持核心一致。表單稀疏時以額外上下文為準；用戶明確要求更改時以指示為準。'
    )
    lines.push('')
    if (hasDraft) {
      lines.push(
        en
          ? parts.draftLabel?.en ??
              'Current form fields (all filled inputs):'
          : parts.draftLabel?.zh ?? '目前表單欄位（已填內容）：'
      )
      lines.push(JSON.stringify(draft, null, 2))
      lines.push('')
    }
    for (const block of extras) {
      lines.push(en ? block.labelEn : block.labelZh)
      lines.push(truncateForPrompt(block.body))
      lines.push('')
    }
    lines.push(
      en
        ? 'User improvement request (may be empty = polish & merge everything):'
        : '用戶改進要求（可留空 = 全面潤飾並合併以上內容）：'
    )
    lines.push(
      idea ||
        (en
          ? parts.emptyIdeaPolish?.en ??
            '(polish all fields for short-drama continuity)'
          : parts.emptyIdeaPolish?.zh ??
            '（全面潤飾：適合短劇／出圖／出片 continuity）')
    )
  } else {
    lines.push(
      en
        ? parts.createLabel?.en ?? 'Idea / direction:'
        : parts.createLabel?.zh ?? '構想／方向：'
    )
    lines.push(idea)
  }

  lines.push('')
  // Only when caller explicitly passed story/style (e.g. suggestFromStory).
  // Never treat missing title/style as license to invent a default world.
  const hasStory = Boolean(parts.storyTitle?.trim())
  const hasStyle = Boolean(parts.styleNote?.trim())
  if (hasStory || hasStyle) {
    lines.push(
      en
        ? 'Explicit context in THIS request only (use for continuity; do not import any other sample world; user idea/draft wins on conflict):'
        : '僅限本次請求明確附上的上下文（作 continuity；勿引入其他樣本世界；與 idea／表單衝突時以用戶為準）：'
    )
    if (hasStory) {
      lines.push(
        en
          ? `Story title: ${parts.storyTitle!.trim()}`
          : `故事標題：${parts.storyTitle!.trim()}`
      )
    }
    if (hasStyle) {
      lines.push(
        en
          ? `Style note: ${parts.styleNote!.trim()}`
          : `風格備註：${parts.styleNote!.trim()}`
      )
    }
  }
  lines.push(
    en
      ? parts.closing?.en ?? 'Output the complete result now.'
      : parts.closing?.zh ?? '請立即輸出完整結果。'
  )
  return lines.join('\n')
}
