/**
 * Shared media generation prep: material sections → multi-vision LLM polish → one export.
 * Used by action plates first; video / other assets adopt the same shape.
 */
import type { ActionCastRef } from './actionCastRefs'
import { orderCastRefsForBinding } from './actionCastRefs'
import {
  buildActionPlatePrompt,
  type ActionProfileFields
} from './actionMasterPrompt'
import {
  getActionPanelLayout,
  type ActionPanelLayoutId
} from './actionPlateVariants'
import { getArtStyle } from './characterArtStyles'

export type MediaGenKind =
  // images
  | 'action-plate'
  | 'character-sheet'
  | 'scene-plate'
  | 'prop-plate'
  | 'story-cover'
  | 'costume-dress'
  | 'costume-swap'
  | 'atmosphere-swap'
  | 'timeline-still'
  // videos
  | 'character-intro'
  | 'scene-intro'
  | 'prop-intro'
  | 'costume-intro'
  | 'action-intro'
  | 'timeline-clip'

/** Image export vs video (still + generateVideo) pipeline. */
export function mediaGenMode(kind: MediaGenKind): 'image' | 'video' {
  if (
    kind.endsWith('-intro') ||
    kind === 'timeline-clip'
  ) {
    return 'video'
  }
  return 'image'
}

export const ALL_MEDIA_GEN_KINDS: MediaGenKind[] = [
  'action-plate',
  'character-sheet',
  'scene-plate',
  'prop-plate',
  'story-cover',
  'costume-dress',
  'costume-swap',
  'atmosphere-swap',
  'timeline-still',
  'character-intro',
  'scene-intro',
  'prop-intro',
  'costume-intro',
  'action-intro',
  'timeline-clip'
]

export type MaterialSectionKind =
  | 'ref-image'
  | 'text-profile'
  | 'prompt-block'
  | 'user-extra'

export type MaterialEntityType =
  | 'character'
  | 'costume'
  | 'scene'
  | 'prop'
  | 'gallery'
  | 'action'
  | 'story'
  | 'hardRules'
  | 'layout'
  | 'art'
  | 'other'

/** UI grouping — refs (images) vs task text vs hard rules. */
export type MaterialSectionGroup = 'refs' | 'task' | 'rules'

export interface MediaGenMaterialSection {
  id: string
  kind: MaterialSectionKind
  /**
   * Display name only (e.g. 「阿明」). UI prefixes localized entity type label.
   * Technical English for the model lives in `text`, not here.
   */
  title: string
  entityType?: MaterialEntityType
  imagePath?: string | null
  /** English / model-facing technical block for LLM polish (not primary UI copy). */
  text: string
  include: boolean
  canBeEditBase?: boolean
  /** Higher wins for default edit base (character > costume > … > gallery board). */
  editBasePriority?: number
  /** UI section group. Default inferred from kind/entityType. */
  group?: MaterialSectionGroup
}

export function materialSectionGroup(
  s: MediaGenMaterialSection
): MaterialSectionGroup {
  if (s.group) return s.group
  if (s.entityType === 'hardRules') return 'rules'
  if (s.kind === 'ref-image' || s.imagePath?.trim()) return 'refs'
  return 'task'
}

export function groupMaterialSections(sections: MediaGenMaterialSection[]): {
  refs: MediaGenMaterialSection[]
  task: MediaGenMaterialSection[]
  rules: MediaGenMaterialSection[]
} {
  const refs: MediaGenMaterialSection[] = []
  const task: MediaGenMaterialSection[] = []
  const rules: MediaGenMaterialSection[] = []
  for (const s of sections) {
    const g = materialSectionGroup(s)
    if (g === 'refs') refs.push(s)
    else if (g === 'rules') rules.push(s)
    else task.push(s)
  }
  return { refs, task, rules }
}

export interface MediaGenGenOptions {
  panelLayout?: string
  /** Character sheet package id (出圖方案) */
  sheetVariant?: string
  /** Scene / prop plate variant id */
  plateVariant?: string
  artStyle?: string
  aspectRatio?: string
  size?: string
  durationSeconds?: number
  useIdentityEdit: boolean
  /**
   * When true, never image_edit (nude/base body packages).
   * Cleared by extract when wardrobe layer forbids identity clone.
   */
  forcePureLayout?: boolean
  /** Gallery label for commit (English short tag) */
  galleryLabel?: string
  /** Wardrobe / plate layer tag for gallery commit */
  layer?: string
}

export interface MediaGenPrepDraft {
  kind: MediaGenKind
  entityIds: Record<string, string | undefined>
  sections: MediaGenMaterialSection[]
  editBaseSectionId: string | null
  polishedPrompt: string
  userExtraPrompt: string
  genOptions: MediaGenGenOptions
  resultPath?: string
  stillPromptUsed?: string
  polished?: boolean
}

/**
 * Shell phases — image and video share materials/polish, then diverge.
 * Video never leaves this shell for a second wizard.
 */
export type MediaGenShellPhase =
  | 'loading-extract'
  | 'materials'
  | 'loading-polish'
  | 'review-prompt'
  | 'loading-generate' // image final OR video keyframe gen
  | 'result' // image result
  | 'keyframe' // video: still preview
  | 'loading-video'
  | 'confirm-video'
  | 'video-done'
  | 'error'

/** @deprecated use MediaGenShellPhase */
export type MediaGenPrepPhase = MediaGenShellPhase

export type MediaGenShellStepId =
  | 'materials'
  | 'polish'
  | 'generate'
  | 'result'
  | 'keyframe'
  | 'confirm-video'
  | 'video-done'

export function shellStepsForMode(
  mode: 'image' | 'video'
): MediaGenShellStepId[] {
  if (mode === 'video') {
    return ['materials', 'polish', 'keyframe', 'confirm-video', 'video-done']
  }
  return ['materials', 'polish', 'generate', 'result']
}

/** Map live phase → stepper index (0-based). */
export function shellPhaseToStepIndex(
  phase: MediaGenShellPhase,
  mode: 'image' | 'video'
): number {
  if (mode === 'video') {
    switch (phase) {
      case 'loading-extract':
      case 'materials':
        return 0
      case 'loading-polish':
      case 'review-prompt':
        return 1
      case 'loading-generate':
      case 'keyframe':
        return 2
      case 'loading-video':
      case 'confirm-video':
        return 3
      case 'video-done':
        return 4
      case 'error':
        return 0
      default:
        return 0
    }
  }
  switch (phase) {
    case 'loading-extract':
    case 'materials':
      return 0
    case 'loading-polish':
    case 'review-prompt':
      return 1
    case 'loading-generate':
      return 2
    case 'result':
      return 3
    case 'error':
      return 0
    default:
      return 0
  }
}

export function isMediaGenPrepPhaseLocked(phase: MediaGenShellPhase): boolean {
  return (
    phase === 'loading-extract' ||
    phase === 'loading-polish' ||
    phase === 'loading-generate' ||
    phase === 'loading-video'
  )
}

/** i18n key under mediaGen.steps.* */
export function shellStepLabelKey(stepId: MediaGenShellStepId): string {
  const map: Record<MediaGenShellStepId, string> = {
    materials: 'materials',
    polish: 'polish',
    generate: 'generate',
    result: 'result',
    keyframe: 'keyframe',
    'confirm-video': 'confirmVideo',
    'video-done': 'videoDone'
  }
  return map[stepId]
}

/** Sections the user marked include=true (for polish / display). */
export function includedMaterialSections(
  sections: MediaGenMaterialSection[]
): MediaGenMaterialSection[] {
  return sections.filter((s) => s.include)
}

/** Absolute paths of included ref images (deduped, order preserved). */
export function includedMaterialImagePaths(
  sections: MediaGenMaterialSection[]
): string[] {
  const out: string[] = []
  for (const s of includedMaterialSections(sections)) {
    const p = s.imagePath?.trim()
    if (p && !out.includes(p)) out.push(p)
  }
  return out
}

export function pickDefaultEditBaseSectionId(
  sections: MediaGenMaterialSection[]
): string | null {
  let best: MediaGenMaterialSection | null = null
  for (const s of sections) {
    if (!s.include || !s.canBeEditBase) continue
    const p = s.imagePath?.trim()
    if (!p) continue
    if (
      !best ||
      (s.editBasePriority ?? 0) > (best.editBasePriority ?? 0)
    ) {
      best = s
    }
  }
  return best?.id ?? null
}

export function resolveEditBasePath(
  sections: MediaGenMaterialSection[],
  editBaseSectionId: string | null | undefined
): string | null {
  if (!editBaseSectionId) return null
  const s = sections.find((x) => x.id === editBaseSectionId)
  if (!s?.include || !s.canBeEditBase) return null
  const p = s.imagePath?.trim()
  return p || null
}

const CAST_PRIORITY: Record<string, number> = {
  character: 100,
  costume: 80,
  scene: 60,
  prop: 40,
  gallery: 10
}

export interface BuildActionPlateMaterialsInput {
  actionId: string
  profile: ActionProfileFields
  castRefs: ActionCastRef[]
  /** Selected identity / gallery stills (指示圖庫). Default: not edit-base. */
  galleryIdentityPaths?: string[]
  panelLayout?: ActionPanelLayoutId | string | null
  artStyleId?: string | null
  /** When true, allow identity edit; default edit base = character if present. */
  preferIdentityEdit?: boolean
}

/**
 * Build material sections for action multi-panel plate.
 * Cast stills default include=true; gallery multi-panel boards default include=false
 * and cannot be edit base (avoids re-layout of unrelated salon boards).
 */
export function buildActionPlateMaterialSections(
  input: BuildActionPlateMaterialsInput
): {
  sections: MediaGenMaterialSection[]
  editBaseSectionId: string | null
  fallbackPrompt: string
  genOptions: MediaGenGenOptions
} {
  const sections: MediaGenMaterialSection[] = []
  const layout = getActionPanelLayout(input.panelLayout)
  const art = getArtStyle(input.artStyleId ?? undefined)
  const profile = input.profile

  let castIdx = 0
  for (const r of orderCastRefsForBinding(input.castRefs)) {
    castIdx += 1
    const name = (r.entityName || r.entityId || 'unnamed').trim()
    const type = r.entityType
    const lockLine =
      type === 'character'
        ? 'IDENTITY LOCK: same person (face, age, hair, body). NEVER replace with a different actor.'
        : type === 'costume'
          ? 'WARDROBE LOCK: match fabric, color, pattern, silhouette.'
          : type === 'scene'
            ? 'SPACE LOCK: same location architecture, lighting, set dressing — not a different shop/salon.'
            : 'PROP LOCK: match this prop when the action involves it.'
    sections.push({
      id: `cast_${type}_${r.entityId || castIdx}`,
      kind: 'ref-image',
      // UI localizes type label; title is name only
      title: name,
      entityType: type,
      imagePath: r.imagePath?.trim() || null,
      text: [
        `Entity: ${type} "${name}"${r.roleHint ? ` (${r.roleHint})` : ''}.`,
        lockLine,
        'Use this still as visual ground truth in every panel when included.'
      ].join(' '),
      include: Boolean(r.imagePath?.trim()),
      canBeEditBase: Boolean(r.imagePath?.trim()),
      editBasePriority: CAST_PRIORITY[type] ?? 20,
      group: 'refs'
    })
  }

  const galleryPaths = (input.galleryIdentityPaths ?? [])
    .map((p) => p?.trim())
    .filter((p): p is string => Boolean(p))
  galleryPaths.forEach((path, i) => {
    sections.push({
      id: `gallery_${i}`,
      kind: 'ref-image',
      title: String(i + 1),
      entityType: 'gallery',
      imagePath: path,
      text: 'Prior multi-panel board or identity still from action gallery. Prefer cast stills over re-layout of this board. Do NOT copy unrelated people or locations from this board when cast is present.',
      // Default OFF so old salon boards do not dominate polish / edit base
      include: false,
      canBeEditBase: false,
      editBasePriority: CAST_PRIORITY.gallery,
      group: 'refs'
    })
  })

  sections.push({
    id: 'action_profile',
    kind: 'text-profile',
    title: profile.name || 'Action',
    entityType: 'action',
    text: [
      `Action name: ${profile.name || 'Action'}.`,
      profile.description ? `Sequence: ${profile.description}` : '',
      profile.intention ? `Intention: ${profile.intention}` : '',
      profile.motionNotes ? `Body/tempo: ${profile.motionNotes}` : '',
      profile.cameraNotes ? `Camera: ${profile.cameraNotes}` : '',
      profile.visualTags ? `Tags: ${profile.visualTags}` : ''
    ]
      .filter(Boolean)
      .join('\n'),
    include: true,
    group: 'task'
  })

  sections.push({
    id: 'panel_layout',
    kind: 'prompt-block',
    title: `${layout.id} · ${layout.panelCount}`,
    entityType: 'layout',
    text: [
      `EXACTLY ${layout.panelCount} panels (${layout.id}).`,
      layout.promptLayout + '.',
      `Beat labels: ${layout.beatLabels.join(' → ')}.`
    ].join(' '),
    include: true,
    group: 'task'
  })

  sections.push({
    id: 'art_style',
    kind: 'prompt-block',
    title: art.id,
    entityType: 'art',
    text: `Art medium: ${art.promptBlock || art.labelKey || art.id}`,
    include: true,
    group: 'task'
  })

  if (profile.hardRules?.trim()) {
    sections.push({
      id: 'hard_rules',
      kind: 'prompt-block',
      title: 'HARD RULES',
      entityType: 'hardRules',
      text: profile.hardRules.trim(),
      include: true,
      group: 'rules'
    })
  }

  const hasCastImage = sections.some(
    (s) =>
      s.entityType &&
      ['character', 'costume', 'scene', 'prop'].includes(s.entityType) &&
      s.imagePath?.trim() &&
      s.include
  )

  // With cast: pure generate by default (multi-vision polish carries identity).
  // Without cast but identity requested: may use gallery (but gallery canBeEditBase false).
  const preferIdentity = input.preferIdentityEdit === true && !hasCastImage
  const editBaseSectionId = preferIdentity
    ? pickDefaultEditBaseSectionId(sections)
    : hasCastImage
      ? // Still allow character as optional base if user turns identity on later
        pickDefaultEditBaseSectionId(sections)
      : null

  const fallbackPrompt = buildActionPlatePrompt({
    profile,
    panelLayout: layout.id,
    artStyleId: art.id,
    castRefs: input.castRefs,
    mode: 'generate',
    identityLock: false
  })

  return {
    sections,
    // Default: null edit base when cast present → generateImage after polish
    editBaseSectionId: hasCastImage ? null : editBaseSectionId,
    fallbackPrompt,
    genOptions: {
      panelLayout: layout.id,
      artStyle: art.id,
      useIdentityEdit: false
    }
  }
}

/**
 * Text package for polish LLM (Ref#i maps to image order in multi-vision).
 */
export function buildMediaGenPolishUserText(opts: {
  kind: MediaGenKind
  locale?: 'zh-HK' | 'en'
  includedSections: MediaGenMaterialSection[]
  taskHint?: string
}): string {
  const locale = opts.locale ?? 'zh-HK'
  const lines: string[] = []
  if (locale === 'en') {
    lines.push(
      'Write ONE final image-generation prompt for a short-drama production still.',
      'Return ONLY the prompt text — no markdown fences, no title, no explanation.',
      'Attached images (if any) are ground-truth references in the same order as Ref# below.',
      'Lock identity/wardrobe/location/prop to those stills. Do NOT invent a different person, shop, or prop.',
      'Output must describe a SINGLE composite image (one export frame).'
    )
  } else {
    lines.push(
      '請撰寫「一條」最終短劇靜圖／多格指示圖生成 prompt。',
      '只回傳 prompt 正文——不要 markdown 代碼塊、標題或解釋。',
      '若有附圖，圖序與下方 Ref# 一致，須作視覺 ground truth。',
      '身份／戲服／場景／道具必須鎖定附圖，禁止換成另一人、另一店或另一物。',
      '輸出描述「單一合成圖」（只 export 一張）。'
    )
  }
  if (opts.taskHint?.trim()) {
    lines.push('', `Task: ${opts.taskHint.trim()}`)
  }
  lines.push('', `Kind: ${opts.kind}`, '', '--- MATERIALS ---')
  let refI = 0
  for (const s of opts.includedSections) {
    const hasImg = Boolean(s.imagePath?.trim())
    if (hasImg) {
      refI += 1
      lines.push(
        '',
        `### Ref#${refI} — ${s.title}${s.entityType ? ` [${s.entityType}]` : ''}`,
        s.text
      )
    } else {
      lines.push(
        '',
        `### ${s.title}${s.entityType ? ` [${s.entityType}]` : ''}`,
        s.text
      )
    }
  }
  lines.push(
    '',
    '--- END MATERIALS ---',
    locale === 'en'
      ? 'Produce a detailed English technical prompt that a single-image model can execute. Keep HARD RULES at the end if present.'
      : '產出可執行的英文技術向 prompt（單圖模型）。若有 HARD RULES 置於文末。'
  )
  return lines.join('\n')
}

export function buildMediaGenPolishSystemPrompt(
  locale: 'zh-HK' | 'en' = 'zh-HK',
  opts?: { mode?: 'image' | 'video' }
): string {
  if (opts?.mode === 'video') {
    if (locale === 'en') {
      return [
        'You are a short-drama video director prompt writer (image-to-video).',
        'Merge materials into ONE professional video prompt for a short clip.',
        'Return ONLY the prompt — no markdown fences.',
        'Include: subject identity locks from stills, camera move, performance/dialogue, pacing, lighting continuity.',
        'Do not invent a different actor, location, or prop when refs are attached.',
        'Hard rules at end if supplied.'
      ].join('\n')
    }
    return [
      '你是短劇 image-to-video 導演 prompt 撰寫者。',
      '將材料合併為「一條」專業短片 video prompt。',
      '只回傳 prompt 正文——不要 markdown 代碼塊。',
      '須含：身份鎖定、鏡頭運動、表演／對白、節奏、光影連續。',
      '有附圖時禁止換成另一演員、場景或道具。',
      '有 HARD RULES 則置於文末。'
    ].join('\n')
  }
  if (locale === 'en') {
    return [
      'You are a short-drama image prompt director.',
      'Merge the selected materials and attached reference stills into ONE image prompt.',
      'Return ONLY the prompt — no markdown fences.',
      'Highest priority: match faces/wardrobe/locations/props from attached images.',
      'Never substitute a different celebrity, salon clerk, or unrelated set when cast stills are provided.',
      'If multi-panel geometry is required, keep exact panel count and gutters.',
      'If a LAYOUT / package section is present, the final prompt MUST implement that exact layout (panel count, poses, crop).',
      'Hard rules at end if supplied.'
    ].join('\n')
  }
  return [
    '你是短劇靜圖／指示圖 prompt 導演。',
    '將用戶勾選材料與附圖合併為「一條」出圖 prompt。',
    '只回傳 prompt 正文——不要 markdown 代碼塊。',
    '最高優先：附圖中的臉／服裝／場景／道具必須一致。',
    '有角色／場景靜圖時，禁止換成無關沙龍店員或另一間店。',
    '若要求多格板，保留精確格數與分隔。',
    '若有 LAYOUT／出圖方案區塊，最終 prompt 必須嚴格執行該 layout（格數、姿勢、構圖）。',
    '有 HARD RULES 則置於文末。'
  ].join('\n')
}

/** Loose extract: strip fences; accept body ≥ 40 chars. */
export function extractPolishedMediaPrompt(raw: string): string {
  let t = (raw ?? '').trim()
  if (!t) return ''
  const fence = /^```(?:\w+)?\s*([\s\S]*?)```$/m.exec(t)
  if (fence) t = fence[1].trim()
  t = t.replace(/^#+\s*.+$/m, '').trim()
  return t
}

export function actionPlateTaskHint(
  panelLayout?: string | null,
  actionName?: string | null
): string {
  const layout = getActionPanelLayout(panelLayout)
  return `Generate ONE composite MOTION DIRECTION board with EXACTLY ${layout.panelCount} panels (${layout.id}) for action "${actionName || 'Action'}". Each panel = one beat of the motion sequence. Cinematic short-drama still; no watermark.`
}

/** Generic still/plate materials for character sheet / scene / prop / story cover. */
export function buildGenericEntityMaterialSections(opts: {
  kind: MediaGenKind
  name: string
  profileText: string
  hardRules?: string | null
  artStyleId?: string | null
  galleryPaths?: string[]
  preferIdentityEdit?: boolean
  /**
   * Layout / package section (出圖方案, plate variant, costume task).
   * Included as task material so polish sees exact geometry.
   */
  layoutSection?: {
    id?: string
    title: string
    text: string
  } | null
  /** Professional template prompt (variant builders). Overrides generic fallback. */
  fallbackPrompt?: string | null
  /** Nude/base packages: never use identity edit base. */
  forcePureLayout?: boolean
  /** Extra genOptions merged into return (variant ids, labels, …). */
  genOptionsExtra?: Partial<MediaGenGenOptions>
}): {
  sections: MediaGenMaterialSection[]
  editBaseSectionId: string | null
  fallbackPrompt: string
  genOptions: MediaGenGenOptions
} {
  const sections: MediaGenMaterialSection[] = []
  const art = getArtStyle(opts.artStyleId ?? undefined)
  const paths = (opts.galleryPaths ?? [])
    .map((p) => p?.trim())
    .filter((p): p is string => Boolean(p))
  const forcePure = opts.forcePureLayout === true

  paths.forEach((path, i) => {
    sections.push({
      id: `gallery_${i}`,
      kind: 'ref-image',
      title: opts.name || String(i + 1),
      entityType:
        opts.kind === 'character-sheet' ||
        opts.kind === 'costume-dress' ||
        opts.kind === 'costume-swap' ||
        opts.kind === 'character-intro' ||
        opts.kind === 'costume-intro'
          ? 'character'
          : opts.kind === 'scene-plate' ||
              opts.kind === 'atmosphere-swap' ||
              opts.kind === 'scene-intro'
            ? 'scene'
            : opts.kind === 'prop-plate' || opts.kind === 'prop-intro'
              ? 'prop'
              : opts.kind === 'story-cover'
                ? 'story'
                : 'gallery',
      imagePath: path,
      text: forcePure
        ? `Reference still for ${opts.kind}. Do NOT clone wardrobe or layout from this image when producing a pure layout package — use only for identity cues if at all.`
        : `Identity / style reference still for ${opts.kind}. Match subject look when included.`,
      include: true,
      // Nude/base packages must not image_edit from clothed refs
      canBeEditBase: !forcePure,
      editBasePriority: 100 - i,
      group: 'refs'
    })
  })

  sections.push({
    id: 'profile',
    kind: 'text-profile',
    title: opts.name || 'Profile',
    entityType:
      opts.kind === 'character-sheet' ||
      opts.kind === 'costume-dress' ||
      opts.kind === 'costume-swap' ||
      opts.kind === 'character-intro' ||
      opts.kind === 'costume-intro'
        ? 'character'
        : opts.kind === 'scene-plate' ||
            opts.kind === 'atmosphere-swap' ||
            opts.kind === 'scene-intro'
          ? 'scene'
          : opts.kind === 'prop-plate' || opts.kind === 'prop-intro'
            ? 'prop'
            : 'story',
    text: opts.profileText,
    include: true,
    group: 'task'
  })

  if (opts.layoutSection?.text?.trim()) {
    sections.push({
      id: opts.layoutSection.id || 'layout_package',
      kind: 'prompt-block',
      title: opts.layoutSection.title,
      entityType: 'layout',
      text: opts.layoutSection.text.trim(),
      include: true,
      group: 'task'
    })
  }

  sections.push({
    id: 'art_style',
    kind: 'prompt-block',
    title: art.id,
    entityType: 'art',
    text: `Art medium: ${art.promptBlock || art.labelKey || art.id}`,
    include: true,
    group: 'task'
  })

  if (opts.hardRules?.trim()) {
    sections.push({
      id: 'hard_rules',
      kind: 'prompt-block',
      title: 'HARD RULES',
      entityType: 'hardRules',
      text: opts.hardRules.trim(),
      include: true,
      group: 'rules'
    })
  }

  const preferIdentity =
    !forcePure && opts.preferIdentityEdit === true
  const editBaseSectionId = preferIdentity
    ? pickDefaultEditBaseSectionId(sections)
    : null

  const fallbackPrompt =
    (opts.fallbackPrompt && opts.fallbackPrompt.trim()) ||
    [
      `Generate one high-quality short-drama ${opts.kind} image for "${opts.name}".`,
      opts.profileText,
      opts.layoutSection?.text?.trim() || null,
      `Art: ${art.promptBlock || art.id}`,
      'No watermark, no app UI chrome.'
    ]
      .filter(Boolean)
      .join('\n')

  return {
    sections,
    editBaseSectionId,
    fallbackPrompt,
    genOptions: {
      artStyle: art.id,
      useIdentityEdit: Boolean(editBaseSectionId),
      forcePureLayout: forcePure,
      ...(opts.genOptionsExtra || {})
    }
  }
}

/**
 * Materials for one timeline beat still / clip refine (MediaGen shell).
 * Prefers previous continuity as edit base (same rule as resolveTimelineStillRefs).
 */
export type TimelineBoundEntityRef = {
  id?: string
  name: string
  imagePath?: string | null
}

export function buildTimelineBeatMaterialSections(opts: {
  kind: 'timeline-still' | 'timeline-clip'
  storyTitle: string
  displayIndex: number
  dialogue?: string | null
  beatBlock?: string | null
  previousContinuityPath?: string | null
  previousBeatIndex?: number
  continuityLockText?: string | null
  castRefPath?: string | null
  castRefName?: string | null
  /** @deprecated prefer characters[] — kept for single-primary callers */
  characterName?: string | null
  characterImagePath?: string | null
  sceneLabel?: string | null
  sceneImagePath?: string | null
  propName?: string | null
  propImagePath?: string | null
  /** Multi-cast library stills (all bound characters). */
  characters?: TimelineBoundEntityRef[]
  scenes?: TimelineBoundEntityRef[]
  props?: TimelineBoundEntityRef[]
  hardRules?: string | null
  artStyleId?: string | null
  durationSeconds?: number
  styleNote?: string | null
  /** Optional video-oriented fallback when kind is timeline-clip. */
  fallbackPrompt?: string | null
}): {
  sections: MediaGenMaterialSection[]
  editBaseSectionId: string | null
  fallbackPrompt: string
  genOptions: MediaGenGenOptions
  taskHint: string
} {
  const sections: MediaGenMaterialSection[] = []
  const art = getArtStyle(opts.artStyleId ?? undefined)
  const beatN = opts.displayIndex || 1
  const isVideo = opts.kind === 'timeline-clip'
  const seenPaths = new Set<string>()

  const pushRef = (s: MediaGenMaterialSection): void => {
    const p = s.imagePath?.trim()
    if (p) {
      if (seenPaths.has(p)) return
      seenPaths.add(p)
    }
    sections.push(s)
  }

  const prev = opts.previousContinuityPath?.trim() || null
  if (prev) {
    pushRef({
      id: 'prev_clip',
      kind: 'ref-image',
      title: opts.previousBeatIndex
        ? `#${opts.previousBeatIndex}`
        : 'Previous',
      entityType: 'gallery',
      imagePath: prev,
      text: [
        `CONTINUITY KEYFRAME from previous beat${
          opts.previousBeatIndex ? ` #${opts.previousBeatIndex}` : ''
        }.`,
        'This is the END/LOCK frame of the prior shot. Match identity, wardrobe, set, lighting.',
        'New beat continues from this visual state — do not hard-cut to a different actor or location.'
      ].join(' '),
      include: true,
      canBeEditBase: true,
      editBasePriority: 200,
      group: 'refs'
    })
  }

  const cast = opts.castRefPath?.trim() || null
  if (cast) {
    pushRef({
      id: 'cast_ref',
      kind: 'ref-image',
      title: opts.castRefName || opts.characterName || 'Cast',
      entityType: 'character',
      imagePath: cast,
      text: 'Advanced cast look / costume still. IDENTITY LOCK face and body proportions.',
      include: true,
      canBeEditBase: true,
      editBasePriority: 150,
      group: 'refs'
    })
  }

  const charList: TimelineBoundEntityRef[] =
    opts.characters && opts.characters.length > 0
      ? opts.characters
      : opts.characterName || opts.characterImagePath
        ? [
            {
              name: opts.characterName || 'Character',
              imagePath: opts.characterImagePath
            }
          ]
        : []

  charList.forEach((c, i) => {
    const img = c.imagePath?.trim() || null
    if (!img) return
    pushRef({
      id: `character_ref_${c.id || i}`,
      kind: 'ref-image',
      title: c.name || `Character ${i + 1}`,
      entityType: 'character',
      imagePath: img,
      text: `Character library still for "${c.name || 'cast'}". Match face/hair/body.`,
      include: !cast || i === 0,
      canBeEditBase: true,
      editBasePriority: 120 - i,
      group: 'refs'
    })
  })

  const sceneList: TimelineBoundEntityRef[] =
    opts.scenes && opts.scenes.length > 0
      ? opts.scenes
      : opts.sceneLabel || opts.sceneImagePath
        ? [
            {
              name: opts.sceneLabel || 'Scene',
              imagePath: opts.sceneImagePath
            }
          ]
        : []

  sceneList.forEach((sc, i) => {
    const img = sc.imagePath?.trim() || null
    if (!img) return
    pushRef({
      id: `scene_ref_${sc.id || i}`,
      kind: 'ref-image',
      title: sc.name || `Scene ${i + 1}`,
      entityType: 'scene',
      imagePath: img,
      text: 'Location plate — SPACE LOCK architecture, materials, light direction.',
      include: true,
      canBeEditBase: false,
      editBasePriority: 60 - i,
      group: 'refs'
    })
  })

  const propList: TimelineBoundEntityRef[] =
    opts.props && opts.props.length > 0
      ? opts.props
      : opts.propName || opts.propImagePath
        ? [
            {
              name: opts.propName || 'Prop',
              imagePath: opts.propImagePath
            }
          ]
        : []

  propList.forEach((pr, i) => {
    const img = pr.imagePath?.trim() || null
    if (!img) return
    pushRef({
      id: `prop_ref_${pr.id || i}`,
      kind: 'ref-image',
      title: pr.name || `Prop ${i + 1}`,
      entityType: 'prop',
      imagePath: img,
      text: `Prop still for "${pr.name || 'item'}". Match when the beat uses this prop.`,
      include: true,
      canBeEditBase: false,
      editBasePriority: 40 - i,
      group: 'refs'
    })
  })

  const primaryChar = charList[0]?.name || opts.characterName || null
  const primaryScene = sceneList[0]?.name || opts.sceneLabel || null
  const primaryProp = propList[0]?.name || opts.propName || null
  const castNames = charList.map((c) => c.name).filter(Boolean)

  const beatText = [
    opts.beatBlock?.trim() || null,
    opts.dialogue?.trim() ? `Dialogue: ${opts.dialogue.trim()}` : null
  ]
    .filter(Boolean)
    .join('\n')

  sections.push({
    id: 'beat_profile',
    kind: 'text-profile',
    title: `Beat #${beatN}`,
    entityType: 'story',
    text: [
      `Story: ${opts.storyTitle}`,
      `Beat #${beatN}${isVideo ? ` · ${opts.durationSeconds || 10}s clip` : ' · keyframe still'}`,
      opts.styleNote?.trim()
        ? `Style: ${opts.styleNote.trim().slice(0, 300)}`
        : null,
      beatText || 'No dialogue — play the visual action of this beat.',
      castNames.length > 0
        ? `Cast: ${castNames.join(', ')}.`
        : primaryChar
          ? `Primary character: ${primaryChar}`
          : null,
      primaryScene ? `Location: ${primaryScene}` : null,
      primaryProp ? `Prop: ${primaryProp}` : null
    ]
      .filter(Boolean)
      .join('\n'),
    include: true,
    group: 'task'
  })

  if (opts.continuityLockText?.trim()) {
    sections.push({
      id: 'continuity_lock',
      kind: 'prompt-block',
      title: 'Continuity',
      entityType: 'other',
      text: opts.continuityLockText.trim(),
      include: true,
      group: 'task'
    })
  }

  sections.push({
    id: 'art_style',
    kind: 'prompt-block',
    title: art.id,
    entityType: 'art',
    text: `Art medium: ${art.promptBlock || art.labelKey || art.id}`,
    include: true,
    group: 'task'
  })

  if (opts.hardRules?.trim()) {
    sections.push({
      id: 'hard_rules',
      kind: 'prompt-block',
      title: 'HARD RULES',
      entityType: 'hardRules',
      text: opts.hardRules.trim(),
      include: true,
      group: 'rules'
    })
  }

  const editBaseSectionId = pickDefaultEditBaseSectionId(sections)
  const taskHint = isVideo
    ? `Keyframe still then short-drama video for story "${opts.storyTitle}" beat #${beatN}. Continuity-lock previous frame when attached. Include camera motion and dialogue performance.`
    : `One cinematic short-drama KEYFRAME still for story "${opts.storyTitle}" beat #${beatN}. Continuity-lock previous frame when attached. No watermark.`

  const fallbackPrompt =
    (opts.fallbackPrompt && opts.fallbackPrompt.trim()) ||
    [
      taskHint,
      opts.continuityLockText?.trim() || null,
      beatText || null,
      castNames.length > 0
        ? `Character focus: ${castNames.join(', ')}.`
        : primaryChar
          ? `Character focus: ${primaryChar}.`
          : null,
      `Art: ${art.promptBlock || art.id}`,
      isVideo
        ? 'Motion: natural performance, clear camera intent, short-drama pacing; no text overlay.'
        : 'Cinematic short drama; anatomically correct; no text overlay.'
    ]
      .filter(Boolean)
      .join('\n')

  return {
    sections,
    editBaseSectionId,
    fallbackPrompt,
    taskHint,
    genOptions: {
      artStyle: art.id,
      durationSeconds: opts.durationSeconds,
      useIdentityEdit: Boolean(editBaseSectionId)
    }
  }
}
