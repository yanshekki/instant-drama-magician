/**
 * Universal short-drama character creation prompt + JSON extract.
 * Output fills InstantDrama Character profile fields.
 */

import type { CharacterProfileFields } from '../types/domain'

export const CHARACTER_PROFILE_JSON_KEYS = [
  'name',
  'description',
  'appearance',
  'personality',
  'backstory',
  'costume',
  'ageRange',
  'gender',
  'voiceDesc',
  'mannerisms',
  'relationships',
  'visualTags'
] as const

export function buildCharacterMasterSystemPrompt(locale: 'zh-HK' | 'en' = 'zh-HK'): string {
  if (locale === 'en') {
    return [
      'You are a professional short-drama character designer for AI video production.',
      'Given a short idea from the user, invent a complete, filmable character bible.',
      'Return ONLY a single JSON object (no markdown fences, no commentary) with keys:',
      CHARACTER_PROFILE_JSON_KEYS.join(', '),
      'Rules:',
      '- description: 1–3 sentence public summary',
      '- appearance: face, hair, body, skin, distinctive features (detailed)',
      '- costume: clothing, colors, accessories for the main look',
      '- personality: traits and emotional core',
      '- backstory: concise origin relevant to drama',
      '- voiceDesc: pitch, pace, accent, speech habits',
      '- mannerisms: small habits, micro-gestures, posture ticks (very specific)',
      '- visualTags: comma-separated English tags for image models',
      '- Keep identity consistent for multi-angle reference sheets and video gen.',
      '- Prefer vivid, concrete sensory detail over vague adjectives.'
    ].join('\n')
  }
  return [
    '你是專業短劇角色設定師，專門為 AI 影片／短劇生成「可拍、可認、可一致」的角色聖經。',
    '用戶會給一段角色 idea（可很短）。請補齊完整角色設定。',
    '只輸出一個 JSON 物件（不要 markdown 代碼塊、不要解說），鍵名必須是：',
    CHARACTER_PROFILE_JSON_KEYS.join(', '),
    '規則：',
    '- description：1–3 句對外摘要（繁體中文）',
    '- appearance：五官、髮型、身形、膚色、辨識特徵（具體、可畫）',
    '- costume：主要造型服裝、色調、配飾',
    '- personality：性格與情緒底色',
    '- backstory：與劇情相關的簡潔背景',
    '- voiceDesc：聲線高低、語速、口音、說話習慣（為配音／表演用）',
    '- mannerisms：小習慣、小動作、站姿／手勢癖好（越具體越好）',
    '- visualTags：逗號分隔英文標籤，方便 image model',
    '- 同一角色必須視覺一致，方便之後多角度參考圖與影片生成。',
    '- 避免空泛形容；用可拍攝的細節。'
  ].join('\n')
}

export function buildCharacterMasterUserPrompt(options: {
  idea: string
  storyTitle?: string
  styleNote?: string | null
  locale?: 'zh-HK' | 'en'
}): string {
  const lines = [
    options.locale === 'en' ? 'Character idea:' : '角色 idea：',
    options.idea.trim(),
    ''
  ]
  if (options.storyTitle) {
    lines.push(
      options.locale === 'en'
        ? `Story title: ${options.storyTitle}`
        : `故事標題：${options.storyTitle}`
    )
  }
  if (options.styleNote?.trim()) {
    lines.push(
      options.locale === 'en'
        ? `Style bible: ${options.styleNote.trim()}`
        : `風格備註：${options.styleNote.trim()}`
    )
  }
  lines.push(
    options.locale === 'en'
      ? 'Output the JSON character profile now.'
      : '請立即輸出 JSON 角色設定。'
  )
  return lines.join('\n')
}

/** Extract first JSON object from model text (tolerates ```json fences). */
export function extractCharacterProfileJson(text: string): CharacterProfileFields {
  let raw = text.trim()
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced) raw = fenced[1].trim()
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end <= start) {
    throw new Error('No JSON object in model response')
  }
  const parsed = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>
  const str = (k: string): string => {
    const v = parsed[k]
    return typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim()
  }
  const name = str('name')
  if (!name) throw new Error('Character JSON missing name')
  return {
    name,
    description: str('description') || name,
    appearance: str('appearance') || undefined,
    personality: str('personality') || undefined,
    backstory: str('backstory') || undefined,
    costume: str('costume') || undefined,
    ageRange: str('ageRange') || undefined,
    gender: str('gender') || undefined,
    voiceDesc: str('voiceDesc') || undefined,
    mannerisms: str('mannerisms') || undefined,
    relationships: str('relationships') || undefined,
    visualTags: str('visualTags') || undefined
  }
}

/** Prompt for multi-angle reference sheet (image gen). */
export function buildCharacterSheetImagePrompt(
  profile: Partial<CharacterProfileFields> & { name: string },
  variant: 'bible' | 'turnaround' | 'expression' | 'costume' = 'bible'
): string {
  const base = [
    `Character reference sheet for AI video consistency, single person only, same face identity across panels, clean white/light gray background, high detail, cinematic lighting, no watermark, no text labels.`,
    `Name/concept: ${profile.name}`,
    profile.ageRange ? `Age: ${profile.ageRange}` : '',
    profile.gender ? `Gender presentation: ${profile.gender}` : '',
    profile.appearance ? `Appearance: ${profile.appearance}` : '',
    profile.costume ? `Costume: ${profile.costume}` : '',
    profile.visualTags ? `Tags: ${profile.visualTags}` : '',
    profile.mannerisms
      ? `Pose hints (subtle): ${profile.mannerisms.slice(0, 200)}`
      : ''
  ]
    .filter(Boolean)
    .join('. ')

  const layouts: Record<typeof variant, string> = {
    bible:
      'Layout: one sheet with multiple panels — full body front, full body side, full body back, 3/4 view, head close-up front, head close-up 3/4, two expression variations (neutral + smile). Consistent wardrobe and face.',
    turnaround:
      'Layout: horizontal turnaround strip — front, three-quarter, left side, back, right side, full body standing, same scale.',
    expression:
      'Layout: 2x2 grid of face close-ups — neutral, smile, angry, surprised; same lighting and identity.',
    costume:
      'Layout: full body hero pose + two clothing/detail close-ups (fabric, shoes, accessories); same character.'
  }

  return `${base}. ${layouts[variant]}`
}

/** Compact text block for video prompts. */
export function characterVideoPromptBlock(
  c: Partial<CharacterProfileFields> & { name: string }
): string {
  return [
    `Character: ${c.name}`,
    c.ageRange ? `Age: ${c.ageRange}` : null,
    c.appearance ? `Look: ${c.appearance}` : null,
    c.costume ? `Costume: ${c.costume}` : null,
    c.mannerisms ? `Mannerisms: ${c.mannerisms}` : null,
    c.voiceDesc ? `Voice: ${c.voiceDesc}` : null
  ]
    .filter(Boolean)
    .join('. ')
}
