/**
 * Suggest costume + art style from story plot context (scenes / style note).
 * Domain-only prompt builders; IPC runs the LLM.
 */
import { ART_STYLES, isArtStyleId, type ArtStyleId } from './characterArtStyles'

export type PlotSegmentRef =
  | { type: 'all' }
  | { type: 'scene'; sceneId: string }
  | { type: 'beat'; entryId: string }

export interface WardrobeSuggestInput {
  characterName: string
  appearance?: string | null
  currentCostume?: string | null
  ageRange?: string | null
  gender?: string | null
  /** Full profile extras for better wardrobe continuity */
  description?: string | null
  personality?: string | null
  visualTags?: string | null
  mannerisms?: string | null
  /** Optional soul.md excerpt */
  soulExcerpt?: string | null
  storyTitle?: string | null
  styleNote?: string | null
  /** Scene blurbs (description + script snippets) */
  sceneSnippets: string[]
  /** Human-readable segment label for the model */
  segmentLabel?: string | null
  locale?: 'zh-HK' | 'en'
  existingCostumeNames?: string[]
  /** Optional user direction for the look */
  userRequest?: string | null
}

export interface WardrobeSuggestion {
  name: string
  costume: string
  artStyle: ArtStyleId
  rationale: string
}

export function buildWardrobeSuggestSystemPrompt(
  locale: 'zh-HK' | 'en' = 'zh-HK'
): string {
  const styleIds = ART_STYLES.map((s) => s.id).join(', ')
  if (locale === 'en') {
    return [
      'You are a short-drama costume & visual-style consultant.',
      'Given a character and plot context, propose ONE cohesive wardrobe look.',
      'Reply with ONLY a single JSON object (no markdown fences):',
      '{"name":"short look name","costume":"detailed outer wardrobe for image/video prompts","artStyle":"one id from list","rationale":"1-2 sentences"}',
      `artStyle MUST be exactly one of: ${styleIds}`,
      'costume must be specific materials, colors, silhouette, shoes, accessories.',
      'Respect age-appropriate presentation. Never eroticize minors.',
      'Prefer continuity with existing appearance; invent only wardrobe/style.',
      'Use character fields + any plot segment / story context provided; if thin, invent a cohesive look freely.'
    ].join(' ')
  }
  return [
    '你是短劇服裝與視覺風格顧問。',
    '根據角色與劇情，提出一套完整外裝方案。',
    '只回傳一個 JSON 物件（不要 markdown 圍欄）：',
    '{"name":"短名稱","costume":"詳細外裝描述（供出圖／影片）","artStyle":"下列其一","rationale":"一兩句理由"}',
    `artStyle 必須是：${styleIds}`,
    'costume 要具體：材質、顏色、輪廓、鞋履、配件。',
    '年齡表述須得體；禁止對未成年做性化描述。',
    '保留既有外貌身份，只設計服裝與風格。',
    '用角色欄位與已提供的劇情／故事上下文；不足就自由補一套連貫造型。'
  ].join(' ')
}

export function buildWardrobeSuggestUserPrompt(
  input: WardrobeSuggestInput
): string {
  const locale = input.locale ?? 'zh-HK'
  const scenes =
    input.sceneSnippets.filter(Boolean).slice(0, 12).join('\n---\n') ||
    (locale === 'en' ? '(no scenes yet)' : '（尚無場景）')
  const lines = [
    locale === 'en'
      ? 'IMPROVE / SUGGEST MODE: Use ALL character fields + plot context below.'
      : '改進／建議模式：使用下方全部角色欄位與劇情上下文。',
    locale === 'en' ? 'Character (full form):' : '角色（完整表單）：',
    `name: ${input.characterName}`,
    input.description ? `description: ${input.description}` : '',
    input.appearance ? `appearance: ${input.appearance}` : '',
    input.personality ? `personality: ${input.personality}` : '',
    input.ageRange ? `age: ${input.ageRange}` : '',
    input.gender ? `gender: ${input.gender}` : '',
    input.mannerisms ? `mannerisms: ${input.mannerisms}` : '',
    input.visualTags ? `visualTags: ${input.visualTags}` : '',
    input.currentCostume ? `current costume: ${input.currentCostume}` : '',
    input.existingCostumeNames?.length
      ? `already has looks: ${input.existingCostumeNames.join('; ')}`
      : '',
    input.soulExcerpt?.trim()
      ? `${locale === 'en' ? 'soul.md excerpt' : 'soul.md 摘要'}:\n${input.soulExcerpt.trim().slice(0, 4000)}`
      : '',
    input.userRequest?.trim()
      ? `${locale === 'en' ? 'User request' : '用戶指示'}: ${input.userRequest.trim()}`
      : '',
    locale === 'en'
      ? 'Story / production context (use when provided; do not invent a different world):'
      : '故事／製作上下文（有就用；勿另起一個世界）：',
    input.storyTitle ? `title: ${input.storyTitle}` : '',
    input.styleNote
      ? locale === 'en'
        ? `style: ${input.styleNote}`
        : `風格：${input.styleNote}`
      : '',
    input.segmentLabel
      ? locale === 'en'
        ? `Selected plot segment: ${input.segmentLabel}`
        : `選定劇情段落：${input.segmentLabel}`
      : '',
    locale === 'en' ? 'Scene / beat context:' : '場景／段落／對白摘錄：',
    scenes,
    locale === 'en'
      ? 'Propose a NEW wardrobe look that fits the plot (not a duplicate of existing looks).'
      : '請提出一套符合劇情的新戲服（避免與已有造型重複）。'
  ]
  return lines.filter(Boolean).join('\n')
}

export function extractWardrobeSuggestionJson(
  text: string
): WardrobeSuggestion {
  const raw = text.trim()
  let jsonStr = raw
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) jsonStr = fence[1].trim()
  const brace = jsonStr.match(/\{[\s\S]*\}/)
  if (brace) jsonStr = brace[0]
  const parsed = JSON.parse(jsonStr) as Record<string, unknown>
  const name =
    typeof parsed.name === 'string' && parsed.name.trim()
      ? parsed.name.trim()
      : 'Look'
  const costume =
    typeof parsed.costume === 'string' ? parsed.costume.trim() : ''
  if (!costume) throw new Error('Missing costume in wardrobe suggestion')
  const styleRaw =
    typeof parsed.artStyle === 'string' ? parsed.artStyle.trim() : ''
  const artStyle: ArtStyleId = isArtStyleId(styleRaw)
    ? styleRaw
    : 'photo_cinematic'
  const rationale =
    typeof parsed.rationale === 'string' ? parsed.rationale.trim() : ''
  return { name, costume, artStyle, rationale }
}
