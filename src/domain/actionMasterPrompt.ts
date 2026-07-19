/**
 * Action / motion-direction master prompts + multi-panel plate prompts.
 */
import type { ActionCastRef } from './actionCastRefs'
import {
  buildPanelBeatInstructions,
  getActionPanelLayout,
  type ActionPanelLayoutId
} from './actionPlateVariants'
import { getArtStyle } from './characterArtStyles'

export interface ActionProfileFields {
  name?: string
  description?: string
  motionNotes?: string
  intention?: string
  cameraNotes?: string
  visualTags?: string
  artStyle?: string
  panelLayout?: string
}

export function buildActionMasterSystemPrompt(
  locale: 'zh-HK' | 'en' = 'zh-HK'
): string {
  if (locale === 'en') {
    return `You are a short-drama motion director. Output ONLY valid JSON for an action/motion guide asset.
Fields: name, description, motionNotes, intention, cameraNotes, visualTags, artStyle (optional medium id).
Be concrete: body parts, tempo, weight, prop paths, staging. No markdown.`
  }
  return `你是短劇動作指導。只輸出有效 JSON，描述一項可拍攝的動作指導。
欄位：name, description, motionNotes, intention, cameraNotes, visualTags, artStyle（可選）。
要具體：身體部位、節奏、力度、道具路徑、走位。不要 markdown。`
}

export function buildActionMasterUserPrompt(opts: {
  idea: string
  locale?: 'zh-HK' | 'en'
  existingDraft?: Partial<ActionProfileFields> | null
  storyTitle?: string
  styleNote?: string | null
}): string {
  const locale = opts.locale ?? 'zh-HK'
  const parts: string[] = []
  if (opts.storyTitle) {
    parts.push(
      locale === 'en'
        ? `Story context (optional): ${opts.storyTitle}`
        : `故事脈絡（可選）：${opts.storyTitle}`
    )
  }
  if (opts.styleNote?.trim()) {
    parts.push(
      locale === 'en'
        ? `Style note: ${opts.styleNote.trim()}`
        : `風格備註：${opts.styleNote.trim()}`
    )
  }
  if (opts.existingDraft) {
    parts.push(
      locale === 'en'
        ? `Existing draft JSON to polish:\n${JSON.stringify(opts.existingDraft)}`
        : `現有草稿（請潤飾補全）：\n${JSON.stringify(opts.existingDraft)}`
    )
  }
  parts.push(
    locale === 'en'
      ? `User idea: ${opts.idea}`
      : `用戶構想：${opts.idea}`
  )
  parts.push(
    locale === 'en'
      ? 'Return JSON only.'
      : '只回傳 JSON。'
  )
  return parts.join('\n\n')
}

export function extractActionProfileJson(text: string): ActionProfileFields {
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) {
    return {
      name: 'Untitled action',
      description: text.slice(0, 400)
    }
  }
  try {
    const o = JSON.parse(m[0]) as Record<string, unknown>
    const str = (k: string) =>
      typeof o[k] === 'string' ? (o[k] as string).trim() : undefined
    return {
      name: str('name') || 'Untitled action',
      description: str('description') || '',
      motionNotes: str('motionNotes'),
      intention: str('intention'),
      cameraNotes: str('cameraNotes'),
      visualTags: str('visualTags'),
      artStyle: str('artStyle'),
      panelLayout: str('panelLayout')
    }
  } catch {
    return { name: 'Untitled action', description: text.slice(0, 400) }
  }
}

export function buildActionPlateImagePrompt(
  profile: ActionProfileFields,
  panelLayout: ActionPanelLayoutId | string | null | undefined,
  artStyleId: string | null | undefined,
  castRefs: ActionCastRef[]
): string {
  const layout = getActionPanelLayout(panelLayout)
  const art = getArtStyle(artStyleId ?? undefined)
  const n = layout.panelCount
  const refs =
    castRefs.length === 0
      ? 'No cast stills attached — invent clear generic figures consistent across all panels.'
      : castRefs
          .map(
            (r, i) =>
              `Ref ${i + 1}: ${r.entityType} "${r.entityName || r.entityId}"${r.roleHint ? ` (${r.roleHint})` : ''} — match identity/look from provided reference stills if editing; SAME person/prop across every panel.`
          )
          .join('\n')

  return [
    `TASK: Generate ONE composite short-drama MOTION DIRECTION / action-instruction board image.`,
    `PRIMARY CONSTRAINT: the board must contain EXACTLY ${n} storyboard panels (${layout.id}).`,
    layout.promptLayout + '.',
    buildPanelBeatInstructions(layout),
    `Art medium: ${art.promptBlock || art.labelKey || art.id}`,
    `Action name: ${profile.name || 'Action'}.`,
    `Full sequence to split across panels 1→${n} (each panel = one beat of this sequence): ${profile.description || 'motion sequence'}.`,
    profile.intention ? `Intention: ${profile.intention}.` : '',
    profile.motionNotes ? `Body / tempo: ${profile.motionNotes}.` : '',
    profile.cameraNotes ? `Camera / staging: ${profile.cameraNotes}.` : '',
    profile.visualTags ? `Tags: ${profile.visualTags}.` : '',
    `Cast / asset notes:\n${refs}`,
    'Clean thick gutters, readable silhouettes, cinematic short-drama look.',
    'No watermark, no app UI chrome, no extra logos, no title banner that replaces a panel.',
    `Single composite file only — still EXACTLY ${n} panels inside that one image.`
  ]
    .filter(Boolean)
    .join('\n')
}

export function buildActionPlateEditPrompt(
  profile: ActionProfileFields,
  panelLayout: ActionPanelLayoutId | string | null | undefined,
  artStyleId: string | null | undefined
): string {
  const layout = getActionPanelLayout(panelLayout)
  const art = getArtStyle(artStyleId ?? undefined)
  const n = layout.panelCount
  return [
    `TASK: Re-layout the reference into a NEW motion instruction board with EXACTLY ${n} panels.`,
    `CRITICAL: Do NOT copy the source panel count or grid. If the reference has 2 or 4 panels, you must EXPAND/REBUILD to exactly ${n} panels.`,
    layout.promptLayout + '.',
    buildPanelBeatInstructions(layout),
    'Preserve character face / costume / prop identity from the reference when present — same identity in every NEW panel.',
    'You may invent intermediate beats so the timeline has enough distinct moments for all panels.',
    `Art: ${art.promptBlock || art.labelKey || art.id}`,
    `Action: ${profile.name}. ${profile.description || ''}`,
    profile.motionNotes ? `Motion: ${profile.motionNotes}` : '',
    profile.intention ? `Intention: ${profile.intention}` : '',
    `Output: one composite image with numbered panels 1…${n} only — never fewer.`
  ]
    .filter(Boolean)
    .join('\n')
}

/** Fallback prompt for action demo video (before LLM polish). */
export function buildActionIntroVideoPrompt(
  profile: ActionProfileFields,
  locale: 'zh-HK' | 'en' = 'zh-HK'
): string {
  if (locale === 'en') {
    return [
      `Short-drama motion demo video of action "${profile.name || 'Action'}".`,
      profile.description || '',
      profile.intention ? `Intention: ${profile.intention}` : '',
      profile.motionNotes ? `Body/tempo: ${profile.motionNotes}` : '',
      profile.cameraNotes ? `Camera: ${profile.cameraNotes}` : '',
      'Smooth continuous motion, cinematic, no text overlays, follow the keyframe still.'
    ]
      .filter(Boolean)
      .join(' ')
  }
  return [
    `短劇動作示範片：「${profile.name || '動作'}」。`,
    profile.description || '',
    profile.intention ? `意圖：${profile.intention}` : '',
    profile.motionNotes ? `肢體節奏：${profile.motionNotes}` : '',
    profile.cameraNotes ? `鏡頭：${profile.cameraNotes}` : '',
    '動作連貫流暢，電影感，無字幕水印，緊跟關鍵幀靜圖。'
  ]
    .filter(Boolean)
    .join(' ')
}
