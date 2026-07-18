/**
 * Generate a soul.md (single_md style) from InstantDrama character profile fields.
 * Compatible with SoulMD Hub catalog structure for local use.
 */

import type { CharacterProfileFields } from '../types/domain'

export type SoulProfileInput = Partial<CharacterProfileFields> & {
  name?: string
}

export function buildSoulGenerateSystemPrompt(
  locale: 'zh-HK' | 'en' = 'zh-HK'
): string {
  if (locale === 'en') {
    return [
      'You write production soul.md files for AI agents and short-drama characters.',
      'Output ONLY a complete Markdown document (no code fences, no commentary).',
      'Structure (use these ## headings):',
      '# {Character name}',
      '## Identity',
      '## Appearance',
      '## Costume & silhouette',
      '## Personality & voice',
      '## Spoken languages',
      '## Mannerisms',
      '## Backstory',
      '## Relationships',
      '## Performance & dialogue style',
      '## Hard rules for consistency',
      '## Visual tags',
      'Rules:',
      '- Adult short-drama / film production context; concrete, filmable detail.',
      '- Sources of truth: profile form + existing soul + user request. If sparse, invent freely to complete the soul; do not invent from sources not provided in this request.',
      '- Identity and appearance must stay consistent across multi-angle sheets and video.',
      '- Spoken languages: honor profile spokenLanguages codes for dialogue/TTS.',
      '- Hard rules: 5–10 bullet constraints (do/don\'t) for image & dialogue AI.',
      '- Prefer Traditional Chinese if the profile is Chinese; else match the profile language.',
      '- Optional YAML frontmatter at top with name, role, tags is allowed but not required.'
    ].join('\n')
  }
  return [
    '你為短劇／影視角色撰寫 production 用 soul.md（單檔 Markdown）。',
    '只輸出完整 Markdown 文件（不要代碼塊圍欄、不要解說）。',
    '結構（請用以下 ## 標題）：',
    '# {角色名}',
    '## 身份 Identity',
    '## 外貌 Appearance',
    '## 服裝與輪廓 Costume',
    '## 性格與聲線 Personality & voice',
    '## 使用語言 Spoken languages',
    '## 小習慣 Mannerisms',
    '## 背景 Backstory',
    '## 關係 Relationships',
    '## 表演與對白風格',
    '## 一致性硬規則 Hard rules',
    '## 視覺標籤 Visual tags',
    '規則：',
    '- 短劇可拍、可辨認、可一致；細節須具體。',
    '- 依據：Profile 表單 + 現有 soul + 用戶指示。不足則自由補齊；勿用本次未提供的來源臆造。',
    '- 對白／配音必須尊重 profile 的 spokenLanguages。',
    '- 硬規則用 5–10 條 bullet，方便之後圖像／對白 AI 遵守。',
    '- 繁體中文（香港書面語）。',
    '- 可選開頭 YAML frontmatter（name / tags），非必須。'
  ].join('\n')
}

export function buildSoulGenerateUserPrompt(options: {
  profile: SoulProfileInput
  locale?: 'zh-HK' | 'en'
  storyTitle?: string
  styleNote?: string | null
  /** Existing soul.md to improve / merge */
  existingSoul?: string | null
  userRequest?: string | null
}): string {
  const en = options.locale === 'en'
  const p = options.profile
  const lines: string[] = []
  const hasExisting = Boolean(options.existingSoul?.trim())
  lines.push(
    hasExisting
      ? en
        ? 'IMPROVE MODE: Merge profile form + existing soul into an updated full soul.md. Keep core identity unless asked to change it.'
        : '改進模式：合併 Profile 表單 + 現有 soul，輸出更新後完整 soul.md。除非要求改身份，否則保持核心一致。'
      : en
        ? 'Build a full soul.md from this character profile (fill gaps reasonably; do not invent a different person):'
        : '根據以下角色設定撰寫完整 soul.md（合理補齊空白；不要換成另一個人）：'
  )
  lines.push('')
  lines.push(
    en ? 'Profile form fields (all filled inputs):' : 'Profile 表單欄位（已填內容）：'
  )
  lines.push('```json')
  lines.push(
    JSON.stringify(
      {
        name: p.name ?? '',
        description: p.description ?? '',
        appearance: p.appearance ?? '',
        costume: p.costume ?? '',
        personality: p.personality ?? '',
        backstory: p.backstory ?? '',
        ageRange: p.ageRange ?? '',
        gender: p.gender ?? '',
        voiceDesc: p.voiceDesc ?? '',
        spokenLanguages: p.spokenLanguages ?? [],
        mannerisms: p.mannerisms ?? '',
        relationships: p.relationships ?? '',
        visualTags: p.visualTags ?? ''
      },
      null,
      2
    )
  )
  lines.push('```')
  if (hasExisting) {
    const soul = options.existingSoul!.trim()
    const body =
      soul.length > 12_000
        ? `${soul.slice(0, 12_000)}\n\n…[truncated]`
        : soul
    lines.push('')
    lines.push(
      en
        ? 'Existing soul.md (merge / improve; do not discard useful detail):'
        : '現有 soul.md（合併／改進；勿丟有用細節）：'
    )
    lines.push(body)
  }
  if (options.userRequest?.trim()) {
    lines.push('')
    lines.push(
      en
        ? `User request: ${options.userRequest.trim()}`
        : `用戶指示：${options.userRequest.trim()}`
    )
  }
  if (options.storyTitle?.trim() || options.styleNote?.trim()) {
    lines.push('')
    lines.push(
      en
        ? 'Additional context provided with this request (use if helpful; profile still wins):'
        : '本次一併提供的上下文（有用就用；仍以 profile 為準）：'
    )
    if (options.storyTitle?.trim()) {
      lines.push(
        en
          ? `Story title: ${options.storyTitle.trim()}`
          : `故事標題：${options.storyTitle.trim()}`
      )
    }
    if (options.styleNote?.trim()) {
      lines.push(
        en
          ? `Style note: ${options.styleNote.trim()}`
          : `風格備註：${options.styleNote.trim()}`
      )
    }
  }
  lines.push(
    en
      ? 'Return the full soul.md markdown only.'
      : '只輸出完整 soul.md Markdown 正文。'
  )
  return lines.join('\n')
}

/** Strip accidental ``` fences around the model output. */
export function normalizeSoulMarkdown(raw: string): string {
  let s = raw.trim()
  if (s.startsWith('```')) {
    s = s.replace(/^```(?:markdown|md)?\s*/i, '')
    s = s.replace(/\s*```\s*$/i, '')
  }
  return s.trim()
}

export function profileHasSoulSource(profile: SoulProfileInput): boolean {
  return Boolean(
    profile.name?.trim() ||
      profile.description?.trim() ||
      profile.appearance?.trim() ||
      profile.personality?.trim() ||
      profile.costume?.trim() ||
      profile.backstory?.trim()
  )
}
