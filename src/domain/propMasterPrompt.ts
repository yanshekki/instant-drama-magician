import type { PropProfileFields } from '../types/domain'
import { buildImproveUserPrompt } from './aiImprovePrompt'
import { isArtStyleId, type ArtStyleId } from './characterArtStyles'
import { inventFromProvidedSourcesRules } from './storyContextPolicy'

export const PROP_PROFILE_JSON_KEYS = [
  'name',
  'description',
  'material',
  'sizeNotes',
  'condition',
  'visualTags',
  'artStyle'
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
      ...inventFromProvidedSourcesRules('en').map((r) => `- ${r}`),
      '- description: detailed look for image models; material/sizeNotes/condition concrete; visualTags English commas; artStyle optional id.'
    ].join('\n')
  }
  return [
    '你是短劇道具設計師，服務 AI 影片 continuity。',
    '只回傳一個 JSON，鍵名：',
    PROP_PROFILE_JSON_KEYS.join(', '),
    '規則：',
    ...inventFromProvidedSourcesRules('zh-HK').map((r) => `- ${r}`),
    '- description：可畫細節；material／sizeNotes／condition 具體；visualTags 英文；artStyle 可選。'
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
      en: 'Output the complete JSON prop profile now (every key filled when possible).',
      zh: '請立即輸出完整 JSON 道具設定（各鍵盡量填滿）。'
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
    return [
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
      .join(' ')
  }
  return [
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
    .join(' ')
}

export function extractPropProfileJson(
  text: string
): PropProfileFields & { artStyle?: ArtStyleId } {
  let jsonStr = text.trim()
  const fence = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) jsonStr = fence[1].trim()
  const brace = jsonStr.match(/\{[\s\S]*\}/)
  if (brace) jsonStr = brace[0]
  const parsed = JSON.parse(jsonStr) as Record<string, unknown>
  const str = (k: string): string | undefined => {
    const v = parsed[k]
    return typeof v === 'string' && v.trim() ? v.trim() : undefined
  }
  const name = str('name') || 'Prop'
  const description = str('description') || name
  const artRaw = str('artStyle')
  return {
    name,
    description,
    material: str('material'),
    sizeNotes: str('sizeNotes'),
    condition: str('condition'),
    visualTags: str('visualTags'),
    artStyle: artRaw && isArtStyleId(artRaw) ? artRaw : undefined
  }
}
