/**
 * AI fill / refine for scene location bible + script.
 */
import type { SceneProfileFields } from '../types/domain'
import { buildImproveUserPrompt } from './aiImprovePrompt'
import { isArtStyleId, type ArtStyleId } from './characterArtStyles'
import { AppError } from '../types/errors'
import {
  coerceProfileString,
  coerceProfileStringFrom,
  extractJsonObject,
  profileCompletenessRules,
  synthesizeVisualTagsFromText,
  VISUAL_TAGS_KEYS
} from './jsonProfileFields'
import { inventFromProvidedSourcesRules } from './storyContextPolicy'
import {
  appendHardRules,
  defaultHardRulesFallback,
  hardRulesAiInstruction,
  normalizeHardRules
} from './promptHardRules'

export const SCENE_PROFILE_JSON_KEYS = [
  'title',
  'description',
  'script',
  'locationType',
  'timeOfDay',
  'weather',
  'mood',
  'lighting',
  'colorPalette',
  'setDressing',
  'soundscape',
  'cameraNotes',
  'visualTags',
  'artStyle',
  'hardRules'
] as const

export function buildSceneMasterSystemPrompt(
  locale: 'zh-HK' | 'en' = 'zh-HK'
): string {
  if (locale === 'en') {
    return [
      'You are a short-drama location & scene designer for AI video.',
      'Produce a filmable location bible + playable scene script fragment.',
      'Return ONLY one JSON object (no markdown) with keys:',
      SCENE_PROFILE_JSON_KEYS.join(', '),
      'Rules:',
      ...profileCompletenessRules(SCENE_PROFILE_JSON_KEYS, 'en').map(
        (r) => `- ${r}`
      ),
      ...inventFromProvidedSourcesRules('en').map((r) => `- ${r}`),
      hardRulesAiInstruction('en'),
      '- title: short location name',
      '- description: what the place looks like (architecture, materials, landmarks)',
      '- script: dialogue + action + camera cues for THIS scene (concise)',
      '- locationType: interior|exterior|mixed|vehicle|virtual',
      '- timeOfDay, weather, mood, lighting, colorPalette, setDressing: concrete; invent freely if the idea is thin',
      '- cameraNotes: blocking / lens language',
      '- artStyle: optional id like photo_cinematic or anime_modern, or ""',
      '- Focus on space + this beat; only cast people who appear in provided cast lists when those lists are given.'
    ].join('\n')
  }
  return [
    '你是短劇場景／場景空間設計師，服務 AI 影片 continuity。',
    '請輸出可拍的地點聖經 + 本場可演劇本片段。',
    '只回傳一個 JSON 物件（不要 markdown），鍵名：',
    SCENE_PROFILE_JSON_KEYS.join(', '),
    '規則：',
    ...profileCompletenessRules(SCENE_PROFILE_JSON_KEYS, 'zh-HK').map(
      (r) => `- ${r}`
    ),
    ...inventFromProvidedSourcesRules('zh-HK').map((r) => `- ${r}`),
    hardRulesAiInstruction('zh-HK'),
    '- title：短地名',
    '- description：空間外觀（建築、物料、地標）',
    '- script：本場對白／動作／鏡頭（精煉）',
    '- locationType：interior|exterior|mixed|vehicle|virtual',
    '- timeOfDay、weather、mood、lighting、colorPalette、setDressing：具體可畫；idea 不足時可自由補齊',
    '- cameraNotes：走位／鏡頭語言',
    '- artStyle：可選如 photo_cinematic、anime_modern，或 ""',
    '- 聚焦空間與本場戲；若有提供角色列表，只在需要時使用列表中的人。'
  ].join('\n')
}

export function buildSceneMasterUserPrompt(options: {
  idea: string
  storyTitle?: string
  styleNote?: string | null
  locale?: 'zh-HK' | 'en'
  existingDraft?: Partial<SceneProfileFields> | null
  characterSnippets?: string[]
  propSnippets?: string[]
  priorSceneSnippets?: string[]
}): string {
  const extras: Array<{ labelEn: string; labelZh: string; body: string }> = []
  if (options.characterSnippets?.length) {
    extras.push({
      labelEn: 'Characters in story:',
      labelZh: '故事角色：',
      body: options.characterSnippets.slice(0, 12).join('\n')
    })
  }
  if (options.propSnippets?.length) {
    extras.push({
      labelEn: 'Props in story:',
      labelZh: '故事道具：',
      body: options.propSnippets.slice(0, 12).join('\n')
    })
  }
  if (options.priorSceneSnippets?.length) {
    extras.push({
      labelEn: 'Prior scenes (continuity):',
      labelZh: '既有場景（continuity）：',
      body: options.priorSceneSnippets.slice(0, 20).join('\n')
    })
  }
  return buildImproveUserPrompt({
    locale: options.locale,
    idea: options.idea,
    draft: (options.existingDraft ?? undefined) as
      | Record<string, unknown>
      | undefined,
    draftLabel: {
      en: 'Current scene form fields (all filled inputs):',
      zh: '目前場景表單欄位（已填內容）：'
    },
    extraBlocks: extras,
    storyTitle: options.storyTitle,
    styleNote: options.styleNote,
    createLabel: { en: 'Scene idea:', zh: '場景 idea：' },
    emptyIdeaPolish: {
      en: '(polish place + script for video continuity)',
      zh: '（全面潤飾地點與本場劇本，利於出片 continuity）'
    },
    closing: {
      en: `Output complete JSON now. Required keys: ${SCENE_PROFILE_JSON_KEYS.join(', ')}. Missing keys = invalid. visualTags must be a comma-separated string, not an array.`,
      zh: `請立即輸出完整 JSON。必填鍵：${SCENE_PROFILE_JSON_KEYS.join(', ')}。缺鍵無效。visualTags 必須是逗號分隔字串，禁止陣列。`
    }
  })
}

export function extractSceneProfileJson(text: string): SceneProfileFields & {
  artStyle?: ArtStyleId
} {
  const parsed = extractJsonObject(text)
  const description =
    coerceProfileString(parsed.description) ||
    coerceProfileString(parsed.title) ||
    ''
  if (!description) throw new AppError('VALIDATION', 'errors.sceneDescriptionRequired')
  const artRaw = coerceProfileString(parsed.artStyle)
  const title = coerceProfileString(parsed.title)
  let visualTags = coerceProfileStringFrom(parsed, [...VISUAL_TAGS_KEYS])
  if (!visualTags) {
    visualTags = synthesizeVisualTagsFromText([
      title,
      description,
      coerceProfileString(parsed.locationType),
      coerceProfileString(parsed.mood),
      coerceProfileString(parsed.lighting)
    ])
  }
  return {
    title,
    description,
    script: coerceProfileString(parsed.script),
    locationType: coerceProfileString(parsed.locationType),
    timeOfDay: coerceProfileString(parsed.timeOfDay),
    weather: coerceProfileString(parsed.weather),
    mood: coerceProfileString(parsed.mood),
    lighting: coerceProfileString(parsed.lighting),
    colorPalette: coerceProfileString(parsed.colorPalette),
    setDressing: coerceProfileString(parsed.setDressing),
    soundscape: coerceProfileString(parsed.soundscape),
    cameraNotes: coerceProfileString(parsed.cameraNotes),
    visualTags,
    hardRules:
      normalizeHardRules(coerceProfileString(parsed.hardRules)) ||
      defaultHardRulesFallback('scene', 'zh-HK'),
    artStyle: artRaw && isArtStyleId(artRaw) ? artRaw : undefined
  }
}

export function buildSceneSuggestFromStoryUserPrompt(options: {
  storyTitle: string
  styleNote?: string | null
  locale?: 'zh-HK' | 'en'
  sceneNumber: number
  existingSceneTitles?: string[]
  characterSnippets: string[]
  propSnippets: string[]
  priorSceneSnippets: string[]
  /** Focused plot slice (all / scene / beat) */
  segmentLabel?: string | null
  /** Detailed text for the chosen segment */
  focusSnippets?: string[]
}): string {
  const en = options.locale === 'en'
  return [
    en
      ? `Propose a production-ready LOCATION plate as scene #${options.sceneNumber} for story "${options.storyTitle}".`
      : `為故事「${options.storyTitle}」建議第 ${options.sceneNumber} 個可用場景（場地／環境設定）。`,
    options.segmentLabel
      ? en
        ? `Plot focus: ${options.segmentLabel}`
        : `劇情焦點：${options.segmentLabel}`
      : '',
    options.styleNote
      ? en
        ? `Style: ${options.styleNote}`
        : `風格：${options.styleNote}`
      : '',
    options.existingSceneTitles?.length
      ? en
        ? `Already have locations: ${options.existingSceneTitles.join('; ')}`
        : `庫內／故事已有場地：${options.existingSceneTitles.join('；')}`
      : '',
    en ? 'Characters (context):' : '角色（上下文）：',
    options.characterSnippets.join('\n') || '(none)',
    en ? 'Props (context):' : '道具（上下文）：',
    options.propSnippets.join('\n') || '(none)',
    options.focusSnippets?.length
      ? en
        ? 'Selected plot segment detail:'
        : '選定劇情段落詳情：'
      : en
        ? 'Story scenes / beats:'
        : '故事場次／段落：',
    (options.focusSnippets?.length
      ? options.focusSnippets
      : options.priorSceneSnippets
    ).join('\n---\n') || '(none)',
    en
      ? 'Return full scene JSON. Design a DISTINCT reusable location that fits this plot focus (global library asset — not only for one story).'
      : '回傳完整場景 JSON。請設計一個可重複使用的獨立場地（全域場景庫資產），須貼合選定劇情焦點，並與已有場地有所區別。'
  ]
    .filter(Boolean)
    .join('\n')
}

/**
 * Template fallback for location intro / establishing video (LLM polish improves this).
 * Space identity must match the reference plate; atmosphere from location bible.
 */
export function buildSceneIntroVideoPrompt(
  profile: Partial<SceneProfileFields> & {
    title?: string
    description: string
    artStyle?: string
  },
  locale: 'zh-HK' | 'en' = 'zh-HK'
): string {
  const name =
    profile.title?.trim() ||
    profile.description.trim().slice(0, 48) ||
    (locale === 'en' ? 'Location' : '場景')
  const place = profile.description.trim() || name
  const mood =
    profile.mood?.trim() ||
    (locale === 'en' ? 'cinematic atmosphere' : '電影氣氛')
  const lighting =
    profile.lighting?.trim() ||
    (locale === 'en' ? 'match the still' : '與靜幀一致')
  const camera =
    profile.cameraNotes?.trim().slice(0, 200) ||
    (locale === 'en'
      ? 'gentle establishing push-in or slow pan'
      : '輕微建立鏡頭推近或慢搖')
  const time = profile.timeOfDay?.trim()
  const weather = profile.weather?.trim()
  const locationType = profile.locationType?.trim()
  const setDressing = profile.setDressing?.trim().slice(0, 200)
  const palette = profile.colorPalette?.trim()
  const soundscape = profile.soundscape?.trim().slice(0, 120)
  const tags = profile.visualTags?.trim()
  const art = profile.artStyle?.trim()
  const scriptCue = profile.script?.trim().slice(0, 200)

  if (locale === 'en') {
    return appendHardRules(
      [
        'IMAGE-TO-VIDEO: animate the exact location in the reference still as a short location-intro / establishing clip for short-drama production.',
        'SPACE LOCK: same architecture, materials, signage, layout, and color language as the reference plate — do not invent a different place.',
        `Location name: ${name}.`,
        `Place description: ${place}.`,
        locationType ? `Space type: ${locationType}.` : null,
        time ? `Time of day: ${time}.` : null,
        weather ? `Weather: ${weather}.` : null,
        `Mood: ${mood}. Lighting: ${lighting}.`,
        palette ? `Color palette: ${palette}.` : null,
        setDressing ? `Set dressing: ${setDressing}.` : null,
        tags ? `Visual tags: ${tags}.` : null,
        art ? `Art style: ${art}.` : null,
        soundscape ? `Ambient feel (no UI text): ${soundscape}.` : null,
        scriptCue
          ? `Beat cue (atmosphere only, no hero faces unless already in still): ${scriptCue}.`
          : null,
        `Camera: ${camera}; continuous gentle motion; empty-set preferred — no new cast faces, no logos, no text overlays.`,
        'Action beat: hold establishing → subtle environmental life (light shift, weather particles, fabric/tree if already present) → settle.',
        'Duration fits a 6–10s establishing intro clip.'
      ]
        .filter(Boolean)
        .join(' '),
      profile.hardRules
    )
  }
  return appendHardRules(
    [
      '圖生影片：以參考靜幀中的同一場地，拍一段短劇用「場景介紹／建立鏡頭」短片。',
      '空間鎖定：建築、材質、招牌、格局與色彩語言必須與參考靜幀一致，不可換成另一個地方。',
      `地點名稱：${name}。`,
      `場地描述：${place}。`,
      locationType ? `空間類型：${locationType}。` : null,
      time ? `時段：${time}。` : null,
      weather ? `天氣：${weather}。` : null,
      `氣氛：${mood}。燈光：${lighting}。`,
      palette ? `色盤：${palette}。` : null,
      setDressing ? `陳設：${setDressing}。` : null,
      tags ? `視覺標籤：${tags}。` : null,
      art ? `藝術風格：${art}。` : null,
      soundscape ? `環境氛圍（無 UI 字幕）：${soundscape}。` : null,
      scriptCue
        ? `本場提示（只作氣氛，勿新增角色臉，除非靜幀已有）：${scriptCue}。`
        : null,
      `運鏡：${camera}；連續輕微動態；空鏡為主——勿新增路人臉、logo、字幕。`,
      '動作節奏：建立鏡頭定場 → 環境微動（光影、天氣粒子、已有的布料／樹影）→ 定格。',
      '適合 6–10 秒場景介紹短片。'
    ]
      .filter(Boolean)
      .join(' '),
    profile.hardRules
  )
}
