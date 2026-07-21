/**
 * Universal short-drama character creation prompt + JSON extract.
 * Output fills InstantDrama Character profile fields.
 */

import type { CharacterProfileFields } from '../types/domain'
import { buildImproveUserPrompt } from './aiImprovePrompt'
import {
  getArtStyle,
  qualityBlockForFamily,
  type ArtStyleId
} from './characterArtStyles'
import {
  buildSheetIdentityLock,
  getSheetVariant
} from './characterSheetVariants'
import {
  coerceProfileString,
  coerceProfileStringFrom,
  extractJsonObject,
  profileCompletenessRules,
  synthesizeVisualTagsFromText,
  VISUAL_TAGS_KEYS
} from './jsonProfileFields'
import { inventFromProvidedSourcesRules } from './storyContextPolicy'
import { normalizeLanguageCodes } from './worldLanguages'
import {
  appendHardRules,
  defaultHardRulesFallback,
  hardRulesAiInstruction,
  normalizeHardRules
} from './promptHardRules'

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
  'spokenLanguages',
  'mannerisms',
  'relationships',
  'visualTags',
  'hardRules'
] as const

export function buildCharacterMasterSystemPrompt(locale: 'zh-HK' | 'en' = 'zh-HK'): string {
  if (locale === 'en') {
    return [
      'You are a professional short-drama character designer for AI video production.',
      'Given a short idea from the user, invent a complete, filmable character bible.',
      'A character may be human, animal, spirit, monster, robot, virtual avatar, or other designed entity — follow the idea; do not force a human if the idea is non-human.',
      'Return ONLY a single JSON object (no markdown fences, no commentary) with keys:',
      CHARACTER_PROFILE_JSON_KEYS.join(', '),
      'Rules:',
      ...profileCompletenessRules(
        CHARACTER_PROFILE_JSON_KEYS.filter((k) => k !== 'spokenLanguages'),
        'en'
      ).map((r) => `- ${r}`),
      ...inventFromProvidedSourcesRules('en').map((r) => `- ${r}`),
      '- description: 1–3 sentence public summary (role, vibe, personality)',
      '- appearance: head/face (or equivalent), body plan, colors, distinctive marks (detailed)',
      '- costume: clothing, exterior design, gear, accessories (or natural covering for creatures)',
      '- personality: traits and emotional core',
      '- backstory: concise origin relevant to drama',
      '- voiceDesc: pitch, pace, accent, speech or vocalization habits',
      '- spokenLanguages: JSON array of BCP-47/ISO codes this character SPEAKS (multi OK), e.g. ["yue","en"] or ["ja"]. Prefer: yue=Cantonese, cmn/zh-Hant=Mandarin/Trad. Chinese, en, ja, ko, etc. Empty array if non-verbal.',
      '- mannerisms: small habits, micro-gestures, posture ticks (very specific)',
      hardRulesAiInstruction('en'),
      '- Keep identity consistent for multi-angle reference sheets and video gen.',
      '- Prefer vivid, concrete sensory detail over vague adjectives.'
    ].join('\n')
  }
  return [
    '你是專業短劇角色設定師，專門為 AI 影片／短劇生成「可拍、可認、可一致」的角色聖經。',
    '用戶會給一段角色 idea（可很短）。請補齊完整角色設定。',
    '角色可以是人類、動物、鬼靈、魔物、機械、虛擬形象或其他設計體——依 idea 而定，勿強行寫成人類。',
    '只輸出一個 JSON 物件（不要 markdown 代碼塊、不要解說），鍵名必須是：',
    CHARACTER_PROFILE_JSON_KEYS.join(', '),
    '規則：',
    ...profileCompletenessRules(
      CHARACTER_PROFILE_JSON_KEYS.filter((k) => k !== 'spokenLanguages'),
      'zh-HK'
    ).map((r) => `- ${r}`),
    ...inventFromProvidedSourcesRules('zh-HK').map((r) => `- ${r}`),
    '- description：1–3 句對外摘要（繁體中文）',
    '- appearance：頭部／五官（或對應部位）、體型結構、顏色、辨識特徵（具體、可畫）',
    '- costume：服裝、外觀設計、裝備、配飾（生物可寫皮毛／外殼等）',
    '- personality：性格與情緒底色',
    '- backstory：與劇情相關的簡潔背景',
    '- voiceDesc：聲線高低、語速、口音、說話或發聲習慣（為配音／表演用）',
    '- spokenLanguages：角色使用的語言，JSON 字串陣列（可多選），BCP-47／ISO 代碼，例如 ["yue","en"]。常用：yue=粵語、cmn 或 zh-Hant=普通話／國語、en、ja、ko。非語言角色用 []。',
    '- mannerisms：小習慣、小動作、站姿／手勢癖好（越具體越好）',
    hardRulesAiInstruction('zh-HK'),
    '- 同一角色必須視覺一致，方便之後多角度參考圖與影片生成。',
    '- 避免空泛形容；用可拍攝的細節。'
  ].join('\n')
}

export function buildCharacterMasterUserPrompt(options: {
  idea: string
  storyTitle?: string
  styleNote?: string | null
  locale?: 'zh-HK' | 'en'
  /** When set, model should refine/improve this draft rather than invent from scratch */
  existingDraft?: Partial<CharacterProfileFields> | null
  /**
   * Full soul.md / Soul Hub markdown linked on the character.
   * Used as high-priority identity bible when improving the profile.
   */
  soulContent?: string | null
}): string {
  const soul = options.soulContent?.trim() ?? ''
  return buildImproveUserPrompt({
    locale: options.locale,
    idea: options.idea,
    draft: (options.existingDraft ?? undefined) as
      | Record<string, unknown>
      | undefined,
    draftLabel: {
      en: 'Current Profile form fields (all filled inputs):',
      zh: '目前 Profile 表單欄位（已填內容）：'
    },
    extraBlocks: soul
      ? [
          {
            labelEn:
              'Linked soul.md / character bible (primary identity & personality source):',
            labelZh: '已連結 soul.md／角色聖經（主要身份與性格依據）：',
            body: soul
          }
        ]
      : [],
    storyTitle: options.storyTitle,
    styleNote: options.styleNote,
    createLabel: { en: 'Character idea:', zh: '角色 idea：' },
    emptyIdeaPolish: {
      en: '(polish all fields; integrate soul into profile)',
      zh: '（全面潤飾：將 soul 與表單合併進完整 Profile）'
    },
    closing: {
      en: `Output complete JSON now. Required keys: ${CHARACTER_PROFILE_JSON_KEYS.join(', ')}. visualTags = comma-separated string (not array). spokenLanguages may be a code array.`,
      zh: `請立即輸出完整 JSON。必填鍵：${CHARACTER_PROFILE_JSON_KEYS.join(', ')}。visualTags 為逗號分隔字串（禁止標籤陣列）；spokenLanguages 可以是代碼陣列。`
    }
  })
}

/** Extract first JSON object from model text (tolerates ```json fences). */
export function extractCharacterProfileJson(text: string): CharacterProfileFields {
  const parsed = extractJsonObject(text)
  const name = coerceProfileString(parsed.name)
  if (!name) throw new Error('Character JSON missing name')
  const spokenLanguages = normalizeLanguageCodes(
    parsed.spokenLanguages ?? parsed.languages ?? parsed.spoken_languages
  )
  const description = coerceProfileString(parsed.description) || name
  const appearance = coerceProfileString(parsed.appearance)
  const costume = coerceProfileString(parsed.costume)
  let visualTags = coerceProfileStringFrom(parsed, [...VISUAL_TAGS_KEYS])
  if (!visualTags) {
    visualTags = synthesizeVisualTagsFromText([
      name,
      description,
      appearance,
      costume
    ])
  }
  return {
    name,
    description,
    appearance,
    personality: coerceProfileString(parsed.personality),
    backstory: coerceProfileString(parsed.backstory),
    costume,
    ageRange: coerceProfileString(parsed.ageRange),
    gender: coerceProfileString(parsed.gender),
    voiceDesc: coerceProfileString(parsed.voiceDesc),
    spokenLanguages:
      spokenLanguages.length > 0 ? spokenLanguages : undefined,
    mannerisms: coerceProfileString(parsed.mannerisms),
    relationships: coerceProfileString(parsed.relationships),
    visualTags,
    hardRules:
      normalizeHardRules(coerceProfileString(parsed.hardRules)) ||
      defaultHardRulesFallback('character', 'zh-HK')
  }
}

/**
 * Prompt for multi-angle reference sheet (image gen).
 * Style is front-loaded — models weight the start of the prompt heavily.
 */
export function buildCharacterSheetImagePrompt(
  profile: Partial<CharacterProfileFields> & { name: string },
  variant: string = 'bible',
  artStyle: string = 'photo_cinematic'
): string {
  const def = getSheetVariant(variant)
  const style = getArtStyle(artStyle)
  const skipOuterCostume =
    def.wardrobeLayer === 'nude' || def.wardrobeLayer === 'base'
  // "nude" as a word trips Grok Imagine filters — prompt uses "body" for that layer
  const layerTag =
    def.wardrobeLayer === 'nude' ? 'body' : def.wardrobeLayer
  const identity = buildSheetIdentityLock(
    {
      name: profile.name,
      ageRange: profile.ageRange,
      gender: profile.gender,
      appearance: profile.appearance,
      costume: profile.costume,
      visualTags: profile.visualTags,
      mannerisms: profile.mannerisms
    },
    qualityBlockForFamily(style.family),
    { skipOuterCostume }
  )
  // Order: STYLE (×2) → identity → layout → style reminder → HARD RULES last
  const body = [
    style.promptBlock,
    `Repeat: the final image medium MUST be exactly style id "${style.id}" (${style.family}).`,
    identity,
    `Wardrobe layer tag: ${layerTag}.`,
    `LAYOUT: ${def.layout}`,
    `Final check: if the image looks like the wrong medium, regenerate in the correct medium: ${style.promptBlock}`
  ].join(' ')
  return appendHardRules(body, profile.hardRules)
}

/**
 * Decide generate vs edit for sheet packages.
 * Default: pure generate so layout/variant can change freely.
 * Edit only when the UI explicitly requests identity lock + a valid ref path exists.
 */
export function resolveSheetGenMode(opts: {
  useIdentityEdit?: boolean | null
  hasValidRef?: boolean
}): 'generate' | 'edit' {
  if (opts.useIdentityEdit === true && opts.hasValidRef) return 'edit'
  return 'generate'
}

/**
 * When re-generating with a prior gallery image as edit reference.
 * Critical: force NEW layout + medium — image_edit otherwise clones the source sheet.
 */
export function buildCharacterSheetEditPrompt(
  profile: Partial<CharacterProfileFields> & { name: string },
  variant: string = 'bible',
  artStyle: string = 'photo_cinematic'
): string {
  const def = getSheetVariant(variant)
  const style = getArtStyle(artStyle)
  const skipOuterCostume =
    def.wardrobeLayer === 'nude' || def.wardrobeLayer === 'base'
  const layerTag =
    def.wardrobeLayer === 'nude' ? 'body' : def.wardrobeLayer
  const body = buildCharacterSheetImagePrompt(profile, variant, artStyle)
  return [
    'IMAGE EDIT / LAYOUT CHANGE TASK (highest priority — read fully):',
    style.promptBlock,
    `Target sheet package id: "${def.id}". Wardrobe layer: ${layerTag}.`,
    'IGNORE the source image LAYOUT completely: panel count, gutters, camera angles, crop, and framing from the source must NOT be copied.',
    'IGNORE the source wardrobe/clothing if it conflicts with the target wardrobe layer below.',
    'KEEP only CHARACTER IDENTITY from the source: face/head design, hair, body proportions, species/body plan, skin or surface markings, age presentation.',
    skipOuterCostume
      ? 'STRIP all outer clothing/armor from the source. For body plates: skin-tone unitard only. For base layer: simple undergarments only. Do not preserve the source outfit.'
      : 'You may apply the PROFILE costume description in the body prompt; do not merely recolor or crop the source costume panels.',
    'Completely CHANGE the rendering medium if needed to match the mandatory art style.',
    'DO NOT invent a different character. DO NOT only crop, zoom, or recolor the source.',
    'Produce an entirely NEW reference-sheet composition that matches the LAYOUT block exactly (panel count and poses).',
    `Final checklist: (1) identity matches source face/body (2) layout matches package "${def.id}" not the source sheet (3) wardrobe layer ${layerTag} (4) medium = ${style.id}.`,
    body
  ].join(' ')
}

export type { ArtStyleId }

/** Compact text block for video prompts (fallback + LLM polish input). */
export function characterVideoPromptBlock(
  c: Partial<CharacterProfileFields> & {
    name: string
    gender?: string
    artStyle?: string
  }
): string {
  const langs =
    Array.isArray(c.spokenLanguages) && c.spokenLanguages.length > 0
      ? c.spokenLanguages.join(', ')
      : null
  return [
    `Character: ${c.name}`,
    c.ageRange ? `Age: ${c.ageRange}` : null,
    c.gender ? `Gender: ${c.gender}` : null,
    c.appearance ? `Look: ${c.appearance}` : null,
    c.costume ? `Costume: ${c.costume}` : null,
    c.personality ? `Personality: ${c.personality}` : null,
    c.backstory ? `Backstory: ${c.backstory.slice(0, 280)}` : null,
    c.relationships ? `Relationships: ${c.relationships.slice(0, 200)}` : null,
    c.mannerisms ? `Mannerisms: ${c.mannerisms}` : null,
    c.voiceDesc ? `Voice: ${c.voiceDesc}` : null,
    c.visualTags ? `Visual tags: ${c.visualTags}` : null,
    c.artStyle ? `Art style: ${c.artStyle}` : null,
    langs ? `Spoken languages: ${langs}` : null
  ]
    .filter(Boolean)
    .join('. ')
}

/**
 * Template fallback for self-intro video (LLM polish improves this).
 * Identity must match the reference image; dialogue/persona from full profile.
 */
export function buildCharacterIntroVideoPrompt(
  profile: Partial<CharacterProfileFields> & {
    name: string
    gender?: string
    artStyle?: string
  },
  locale: 'zh-HK' | 'en' = 'zh-HK',
  options?: { soulExcerpt?: string | null }
): string {
  const identity = characterVideoPromptBlock(profile)
  const langs =
    Array.isArray(profile.spokenLanguages) && profile.spokenLanguages.length > 0
      ? profile.spokenLanguages.join(', ')
      : locale === 'en'
        ? 'match the character bible'
        : '跟從角色人設語言'
  const personality =
    profile.personality?.trim() ||
    profile.description?.trim() ||
    (locale === 'en' ? 'warm, clear presence' : '溫暖清晰、有個性')
  const manner =
    profile.mannerisms?.trim() ||
    (locale === 'en' ? 'natural micro-gestures' : '自然微動作')
  const voice =
    profile.voiceDesc?.trim() ||
    (locale === 'en' ? 'clear speaking voice' : '清晰聲線')
  const soul = (options?.soulExcerpt ?? '').trim().slice(0, 1200)
  const backstory = profile.backstory?.trim().slice(0, 240)
  const relationships = profile.relationships?.trim().slice(0, 160)

  if (locale === 'en') {
    return appendHardRules(
      [
        'IMAGE-TO-VIDEO: animate the exact person in the reference image as a short self-introduction clip for short-drama casting.',
        'IDENTITY LOCK: same face, hair, body, age, wardrobe, and colors as the reference still — do not invent a different person.',
        identity,
        `Personality / vibe: ${personality}.`,
        backstory ? `Backstory cue: ${backstory}.` : null,
        relationships ? `Relationships cue: ${relationships}.` : null,
        soul ? `Soul bible excerpt (performance source): ${soul}` : null,
        `Performance: gentle camera push-in or subtle handheld; character looks toward camera or slightly off-camera; ${manner}.`,
        `Speech: mouth moves as if introducing themselves briefly; voice tone: ${voice}; languages: ${langs}.`,
        'Action beat: natural idle → small smile or nod → short spoken intro gesture (hand optional) → hold.',
        'Cinematic lighting consistent with the still; no text overlays, no logos, no extra people.',
        'Duration fits a 6–10s vertical-or-horizontal casting self-intro clip.'
      ]
        .filter(Boolean)
        .join(' '),
      profile.hardRules
    )
  }
  return appendHardRules(
    [
      '圖生影片：以參考圖中的同一人物，拍一段短劇選角用「自我介紹」短片。',
      '身份鎖定：臉、髮型、體型、年齡感、服裝與顏色必須與參考靜幀一致，不可換成另一個人。',
      identity,
      `性格／氣場：${personality}。`,
      backstory ? `背景要點：${backstory}。` : null,
      relationships ? `關係要點：${relationships}。` : null,
      soul ? `Soul 摘要（表演來源）：${soul}` : null,
      `表演：輕微推近或手持晃動；角色望向鏡頭或略偏鏡頭；${manner}。`,
      `口白：嘴唇自然開合像在簡短自我介紹；聲線：${voice}；語言：${langs}。`,
      '動作節奏：自然站定 → 微笑或輕點頭 → 簡短介紹手勢（可空手）→ 定格。',
      '光線與靜幀一致；無字幕、無 logo、無其他人入鏡。',
      '適合 6–10 秒自我介紹短片。'
    ]
      .filter(Boolean)
      .join(' '),
    profile.hardRules
  )
}
