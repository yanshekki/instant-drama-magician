import type { PropProfileFields } from '../types/domain'
import { buildImproveUserPrompt } from './aiImprovePrompt'
import { isArtStyleId, type ArtStyleId } from './characterArtStyles'
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

export const PROP_PROFILE_JSON_KEYS = [
  'name',
  'description',
  'material',
  'sizeNotes',
  'condition',
  'visualTags',
  'artStyle',
  'hardRules'
] as const

export function buildPropMasterSystemPrompt(
  locale: 'zh-HK' | 'en' = 'zh-HK'
): string {
  if (locale === 'en') {
    return [
      'You are a short-drama prop designer for AI video continuity.',
      'Return ONLY one JSON object with keys:',
      PROP_PROFILE_JSON_KEYS.join(', '),
      'Rules:',
      ...profileCompletenessRules(PROP_PROFILE_JSON_KEYS, 'en').map(
        (r) => `- ${r}`
      ),
      ...inventFromProvidedSourcesRules('en').map((r) => `- ${r}`),
      '- description: detailed look for image models; material/sizeNotes/condition concrete.',
      '- artStyle: optional known style id string, or "".',
      hardRulesAiInstruction('en')
    ].join('\n')
  }
  return [
    '你是短劇道具設計師，服務 AI 影片 continuity。',
    '只回傳一個 JSON，鍵名：',
    PROP_PROFILE_JSON_KEYS.join(', '),
    '規則：',
    ...profileCompletenessRules(PROP_PROFILE_JSON_KEYS, 'zh-HK').map(
      (r) => `- ${r}`
    ),
    ...inventFromProvidedSourcesRules('zh-HK').map((r) => `- ${r}`),
    '- description：可畫細節；material／sizeNotes／condition 具體。',
    '- artStyle：可選已知風格 id 字串，或 ""。',
    hardRulesAiInstruction('zh-HK')
  ].join('\n')
}

export function buildPropMasterUserPrompt(options: {
  idea: string
  storyTitle?: string
  styleNote?: string | null
  locale?: 'zh-HK' | 'en'
  existingDraft?: Partial<PropProfileFields> | null
}): string {
  return buildImproveUserPrompt({
    locale: options.locale,
    idea: options.idea,
    draft: (options.existingDraft ?? undefined) as
      | Record<string, unknown>
      | undefined,
    draftLabel: {
      en: 'Current prop form fields (all filled inputs):',
      zh: '目前道具表單欄位（已填內容）：'
    },
    storyTitle: options.storyTitle,
    styleNote: options.styleNote,
    createLabel: { en: 'Prop idea:', zh: '道具 idea：' },
    emptyIdeaPolish: {
      en: '(polish prop look for video continuity)',
      zh: '（全面潤飾道具外觀，利於出片 continuity）'
    },
    closing: {
      en: `Output complete JSON now. Required keys: ${PROP_PROFILE_JSON_KEYS.join(', ')}. Missing keys = invalid. visualTags must be a comma-separated string, not an array.`,
      zh: `請立即輸出完整 JSON。必填鍵：${PROP_PROFILE_JSON_KEYS.join(', ')}。缺鍵無效。visualTags 必須是逗號分隔字串，禁止陣列。`
    }
  })
}

/**
 * Template fallback for prop intro video (LLM polish improves this).
 * Object identity must match the reference still.
 */
export function buildPropIntroVideoPrompt(
  profile: Partial<PropProfileFields> & {
    name: string
    description: string
    artStyle?: string
  },
  locale: 'zh-HK' | 'en' = 'zh-HK'
): string {
  const name = profile.name.trim() || (locale === 'en' ? 'Prop' : '道具')
  const look = profile.description.trim() || name
  const material = profile.material?.trim()
  const size = profile.sizeNotes?.trim()
  const condition = profile.condition?.trim()
  const tags = profile.visualTags?.trim()
  const art = profile.artStyle?.trim()

  if (locale === 'en') {
    return appendHardRules(
      [
      'IMAGE-TO-VIDEO: animate the exact prop in the reference still as a short product/hero intro clip for short-drama continuity.',
      'OBJECT LOCK: same silhouette, materials, colors, logos/engravings, wear, and proportions as the reference — do not invent a different object.',
      `Prop name: ${name}.`,
      `Look description: ${look}.`,
      material ? `Material: ${material}.` : null,
      size ? `Size notes: ${size}.` : null,
      condition ? `Condition / wear: ${condition}.` : null,
      tags ? `Visual tags: ${tags}.` : null,
      art ? `Art style: ${art}.` : null,
      'Camera: gentle orbit or slow push-in on a clean tabletop/hero stage; soft cinematic light consistent with the still.',
      'Action beat: hold hero still → subtle light glint / micro-rotation or fabric/metal shimmer if present → settle.',
      'No hands unless already in the still; no new cast faces; no text overlays, logos watermarks, or extra props.',
      'Duration fits a 6–10s prop intro clip.'
    ]
      .filter(Boolean)
      .join(' '),
      profile.hardRules
    )
  }
  return appendHardRules(
    [
    '圖生影片：以參考靜幀中的同一道具，拍一段短劇 continuity 用「道具介紹／主視覺」短片。',
    '物件鎖定：輪廓、材質、顏色、刻字／紋樣、舊損與比例必須與參考圖一致，不可換成另一件。',
    `道具名稱：${name}。`,
    `外觀描述：${look}。`,
    material ? `材質：${material}。` : null,
    size ? `尺寸筆記：${size}。` : null,
    condition ? `狀態／舊損：${condition}。` : null,
    tags ? `視覺標籤：${tags}。` : null,
    art ? `藝術風格：${art}。` : null,
    '運鏡：乾淨桌面／主視覺台，輕微環繞或慢推近；光線與靜幀一致。',
    '動作節奏：主視覺定格 → 微光澤／微旋轉或材質閃爍（若圖中已有）→ 定格。',
    '除非靜幀已有，否則勿加手、角色臉、字幕、浮水印或額外道具。',
    '適合 6–10 秒道具介紹短片。'
  ]
    .filter(Boolean)
    .join(' '),
    profile.hardRules
  )
}

export function extractPropProfileJson(
  text: string
): PropProfileFields & { artStyle?: ArtStyleId } {
  const parsed = extractJsonObject(text)
  const name = coerceProfileString(parsed.name) || 'Prop'
  const description = coerceProfileString(parsed.description) || name
  const material = coerceProfileString(parsed.material)
  const sizeNotes = coerceProfileString(parsed.sizeNotes)
  const condition = coerceProfileString(parsed.condition)
  let visualTags = coerceProfileStringFrom(parsed, [...VISUAL_TAGS_KEYS])
  if (!visualTags) {
    visualTags = synthesizeVisualTagsFromText([
      name,
      description,
      material,
      condition
    ])
  }
  const artRaw = coerceProfileString(parsed.artStyle)
  return {
    name,
    description,
    material,
    sizeNotes,
    condition,
    visualTags,
    artStyle: artRaw && isArtStyleId(artRaw) ? artRaw : undefined,
    hardRules:
      normalizeHardRules(coerceProfileString(parsed.hardRules)) ||
      defaultHardRulesFallback('prop', 'zh-HK')
  }
}
