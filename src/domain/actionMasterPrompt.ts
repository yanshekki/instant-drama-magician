/**
 * Action / motion-direction master prompts + multi-panel plate prompts.
 */
import {
  orderCastRefsForBinding,
  pickPrimaryCastStill,
  type ActionCastRef
} from './actionCastRefs'
import {
  buildPanelBeatInstructions,
  getActionPanelLayout,
  type ActionPanelLayoutId
} from './actionPlateVariants'
import { getArtStyle } from './characterArtStyles'
import {
  coerceProfileString,
  coerceProfileStringFrom,
  extractJsonObject,
  profileCompletenessRules,
  synthesizeVisualTagsFromText,
  VISUAL_TAGS_KEYS
} from './jsonProfileFields'
import {
  appendHardRules,
  defaultHardRulesFallback,
  hardRulesAiInstruction,
  normalizeHardRules
} from './promptHardRules'

export interface ActionProfileFields {
  name?: string
  description?: string
  motionNotes?: string
  intention?: string
  cameraNotes?: string
  visualTags?: string
  artStyle?: string
  panelLayout?: string
  hardRules?: string
}

export const ACTION_PROFILE_JSON_KEYS = [
  'name',
  'description',
  'motionNotes',
  'intention',
  'cameraNotes',
  'visualTags',
  'artStyle',
  'hardRules'
] as const

export function buildActionMasterSystemPrompt(
  locale: 'zh-HK' | 'en' = 'zh-HK'
): string {
  if (locale === 'en') {
    return [
      'You are a short-drama motion director. Output ONLY valid JSON for an action/motion guide asset.',
      `Fields: ${ACTION_PROFILE_JSON_KEYS.join(', ')}.`,
      ...profileCompletenessRules(ACTION_PROFILE_JSON_KEYS, 'en'),
      hardRulesAiInstruction('en'),
      'Be concrete: body parts, tempo, weight, prop paths, staging. No markdown.'
    ].join('\n')
  }
  return [
    '你是短劇動作指導。只輸出有效 JSON，描述一項可拍攝的動作指導。',
    `欄位：${ACTION_PROFILE_JSON_KEYS.join(', ')}。`,
    ...profileCompletenessRules(ACTION_PROFILE_JSON_KEYS, 'zh-HK'),
    hardRulesAiInstruction('zh-HK'),
    '要具體：身體部位、節奏、力度、道具路徑、走位。不要 markdown。'
  ].join('\n')
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
      ? `Return JSON only. Required keys: ${ACTION_PROFILE_JSON_KEYS.join(', ')}. visualTags = comma-separated string, not array.`
      : `只回傳 JSON。必填鍵：${ACTION_PROFILE_JSON_KEYS.join(', ')}。visualTags 為逗號分隔字串，禁止陣列。`
  )
  return parts.join('\n\n')
}

export function extractActionProfileJson(text: string): ActionProfileFields {
  try {
    const o = extractJsonObject(text)
    const name = coerceProfileString(o.name) || 'Untitled action'
    const description = coerceProfileString(o.description) || ''
    let visualTags = coerceProfileStringFrom(o, [...VISUAL_TAGS_KEYS])
    if (!visualTags) {
      visualTags = synthesizeVisualTagsFromText([
        name,
        description,
        coerceProfileString(o.motionNotes),
        coerceProfileString(o.intention)
      ])
    }
    return {
      name,
      description,
      motionNotes: coerceProfileString(o.motionNotes),
      intention: coerceProfileString(o.intention),
      cameraNotes: coerceProfileString(o.cameraNotes),
      visualTags,
      artStyle: coerceProfileString(o.artStyle),
      panelLayout: coerceProfileString(o.panelLayout),
      hardRules:
        normalizeHardRules(coerceProfileString(o.hardRules)) ||
        defaultHardRulesFallback('action', 'zh-HK')
    }
  } catch {
    return {
      name: 'Untitled action',
      description: text.slice(0, 400),
      hardRules: defaultHardRulesFallback('action', 'zh-HK')
    }
  }
}

/**
 * Structured cast / asset binding block — highest priority section of plate prompts.
 * Generate and edit modes share this so identity never becomes a weak afterthought.
 */
export function buildActionCastBindingBlock(
  castRefs: ActionCastRef[],
  opts?: { identityLock?: boolean }
): string {
  const lines: string[] = [
    '## 1. SUBJECT BINDING (HIGHEST PRIORITY — do NOT invent replacements)'
  ]
  if (!castRefs.length) {
    lines.push(
      'No cast stills attached — invent clear generic figures consistent across all panels.'
    )
    return lines.join('\n')
  }
  lines.push(
    'Use these cast identities in EVERY panel. Match the named reference stills; do not substitute a different person, wardrobe, location, or prop.'
  )
  for (const r of orderCastRefsForBinding(castRefs)) {
    const name = (r.entityName || r.entityId || 'unnamed').trim()
    const hint = r.roleHint?.trim() ? ` (${r.roleHint.trim()})` : ''
    switch (r.entityType) {
      case 'character':
        lines.push(
          `- CHARACTER "${name}"${hint}: SAME person as the character reference still; lock face, age, hair, body type, ethnicity. NEVER replace with a different actor.`
        )
        break
      case 'costume':
        lines.push(
          `- COSTUME "${name}"${hint}: wardrobe MUST match the costume still (fabric, color, pattern, silhouette).`
        )
        break
      case 'scene':
        lines.push(
          `- SCENE "${name}"${hint}: location/background MUST match the scene plate (architecture, lighting, set dressing). Do NOT invent a different shop/salon/street.`
        )
        break
      case 'prop':
        lines.push(
          `- PROP "${name}"${hint}: handheld/worn prop MUST match the prop still when the action involves it.`
        )
        break
      default:
        lines.push(`- "${name}"${hint}: match attached reference still.`)
    }
  }
  if (opts?.identityLock) {
    lines.push(
      'Primary edit-base image is the identity anchor (prefer character/costume still, not an old multi-panel board). Do NOT swap to a different person from any other reference.'
    )
  }
  return lines.join('\n')
}

/**
 * Edit primary still: character → costume → any cast → first gallery identity path.
 * Pure domain helper — no filesystem checks.
 */
export function pickActionPlateEditBase(opts: {
  galleryIdentityPaths?: string[] | null
  castRefs: ActionCastRef[]
}): string | null {
  const fromCast = pickPrimaryCastStill(opts.castRefs ?? [])
  if (fromCast) return fromCast
  for (const raw of opts.galleryIdentityPaths ?? []) {
    const p = typeof raw === 'string' ? raw.trim() : ''
    if (p) return p
  }
  return null
}

/**
 * Ordered ref paths for confirm thumbs / API: edit-base first, then other cast, then gallery.
 */
export function orderActionPlateRefPaths(opts: {
  galleryIdentityPaths?: string[] | null
  castRefs: ActionCastRef[]
}): string[] {
  const out: string[] = []
  const push = (raw: string | null | undefined): void => {
    const p = typeof raw === 'string' ? raw.trim() : ''
    if (p && !out.includes(p)) out.push(p)
  }
  push(pickActionPlateEditBase(opts))
  for (const r of orderCastRefsForBinding(opts.castRefs ?? [])) {
    push(r.imagePath)
  }
  for (const g of opts.galleryIdentityPaths ?? []) {
    push(g)
  }
  return out
}

export interface BuildActionPlatePromptOpts {
  profile: ActionProfileFields
  panelLayout: ActionPanelLayoutId | string | null | undefined
  artStyleId: string | null | undefined
  castRefs: ActionCastRef[]
  mode: 'generate' | 'edit'
  identityLock?: boolean
}

/**
 * Unified action plate prompt: SUBJECT BINDING → ACTION → PANEL GEOMETRY → ART.
 * Use for both pure generate and identity edit so cast is never dropped on edit.
 */
export function buildActionPlatePrompt(opts: BuildActionPlatePromptOpts): string {
  const layout = getActionPanelLayout(opts.panelLayout)
  const art = getArtStyle(opts.artStyleId ?? undefined)
  const n = layout.panelCount
  const profile = opts.profile
  const castRefs = opts.castRefs ?? []
  const hasCast = castRefs.length > 0
  const identityLock = opts.identityLock ?? opts.mode === 'edit'

  const char = castRefs.find((r) => r.entityType === 'character')
  const scene = castRefs.find((r) => r.entityType === 'scene')
  const who = char
    ? `"${(char.entityName || char.entityId).trim()}"`
    : hasCast
      ? 'the bound cast'
      : null
  const where = scene
    ? ` in location "${(scene.entityName || scene.entityId).trim()}"`
    : ''

  let task: string
  if (opts.mode === 'edit' && hasCast) {
    task = [
      `TASK: Generate a NEW motion-direction board with EXACTLY ${n} panels of action "${profile.name || 'Action'}" starring ${who}${where}.`,
      'The edit-base image is ONLY for identity/look lock — rebuild the full multi-panel sequence; do NOT copy an old panel grid or unrelated background from a previous board.'
    ].join(' ')
  } else if (opts.mode === 'edit') {
    task = [
      `TASK: Re-layout the reference into a NEW motion instruction board with EXACTLY ${n} panels.`,
      `CRITICAL: Do NOT copy the source panel count or grid. If the reference has 2 or 4 panels, you must EXPAND/REBUILD to exactly ${n} panels.`,
      'Preserve identity from the edit-base still when present — same identity in every NEW panel.'
    ].join(' ')
  } else {
    task = `TASK: Generate ONE composite short-drama MOTION DIRECTION / action-instruction board image with EXACTLY ${n} storyboard panels (${layout.id}).`
  }

  const binding = buildActionCastBindingBlock(castRefs, { identityLock })

  const actionBlock = [
    '## 2. ACTION SEQUENCE (what the body does — not a static product hero shot)',
    `Action name: ${profile.name || 'Action'}.`,
    `Full sequence to split across panels 1→${n} (each panel = one beat of THIS sequence): ${profile.description || 'motion sequence'}.`,
    profile.intention ? `Intention: ${profile.intention}.` : '',
    profile.motionNotes ? `Body / tempo: ${profile.motionNotes}.` : '',
    profile.cameraNotes ? `Camera / staging: ${profile.cameraNotes}.` : '',
    profile.visualTags ? `Tags: ${profile.visualTags}.` : '',
    opts.mode === 'edit'
      ? 'You may invent intermediate beats so the timeline has enough distinct moments for all panels; every beat still uses the SAME bound identities when cast is present.'
      : ''
  ]
    .filter(Boolean)
    .join('\n')

  const panelBlock = [
    '## 3. PANEL GEOMETRY (hard constraint — structure only, not story identity)',
    `LAYOUT CONSTRAINT: the board must contain EXACTLY ${n} storyboard panels (${layout.id}).`,
    layout.promptLayout + '.',
    buildPanelBeatInstructions(layout),
    `Single composite file only — still EXACTLY ${n} panels inside that one image. Numbered panels 1…${n} only — never fewer.`
  ].join('\n')

  const artBlock = [
    '## 4. ART + OUTPUT',
    `Art medium: ${art.promptBlock || art.labelKey || art.id}`,
    'Clean thick gutters, readable silhouettes, cinematic short-drama look.',
    'No watermark, no app UI chrome, no extra logos, no title banner that replaces a panel.'
  ].join('\n')

  const body = [task, binding, actionBlock, panelBlock, artBlock].join('\n\n')
  return appendHardRules(body, profile.hardRules)
}

/** @deprecated Prefer buildActionPlatePrompt — thin wrap for callers/tests. */
export function buildActionPlateImagePrompt(
  profile: ActionProfileFields,
  panelLayout: ActionPanelLayoutId | string | null | undefined,
  artStyleId: string | null | undefined,
  castRefs: ActionCastRef[]
): string {
  return buildActionPlatePrompt({
    profile,
    panelLayout,
    artStyleId,
    castRefs,
    mode: 'generate',
    identityLock: false
  })
}

/**
 * Identity-edit plate prompt. Pass castRefs so SUBJECT BINDING is not dropped.
 * @deprecated Prefer buildActionPlatePrompt — thin wrap for callers/tests.
 */
export function buildActionPlateEditPrompt(
  profile: ActionProfileFields,
  panelLayout: ActionPanelLayoutId | string | null | undefined,
  artStyleId: string | null | undefined,
  castRefs: ActionCastRef[] = []
): string {
  return buildActionPlatePrompt({
    profile,
    panelLayout,
    artStyleId,
    castRefs,
    mode: 'edit',
    identityLock: true
  })
}

/** Fallback prompt for action demo video (before LLM polish). */
export function buildActionIntroVideoPrompt(
  profile: ActionProfileFields,
  locale: 'zh-HK' | 'en' = 'zh-HK'
): string {
  if (locale === 'en') {
    return appendHardRules(
      [
        `Short-drama motion demo video of action "${profile.name || 'Action'}".`,
        profile.description || '',
        profile.intention ? `Intention: ${profile.intention}` : '',
        profile.motionNotes ? `Body/tempo: ${profile.motionNotes}` : '',
        profile.cameraNotes ? `Camera: ${profile.cameraNotes}` : '',
        'Smooth continuous motion, cinematic, no text overlays, follow the keyframe still.'
      ]
        .filter(Boolean)
        .join(' '),
      profile.hardRules
    )
  }
  return appendHardRules(
    [
      `短劇動作示範片：「${profile.name || '動作'}」。`,
      profile.description || '',
      profile.intention ? `意圖：${profile.intention}` : '',
      profile.motionNotes ? `肢體節奏：${profile.motionNotes}` : '',
      profile.cameraNotes ? `鏡頭：${profile.cameraNotes}` : '',
      '動作連貫流暢，電影感，無字幕水印，緊跟關鍵幀靜圖。'
    ]
      .filter(Boolean)
      .join(' '),
    profile.hardRules
  )
}
