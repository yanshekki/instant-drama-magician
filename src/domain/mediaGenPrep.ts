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
  artStyle?: string
  aspectRatio?: string
  size?: string
  durationSeconds?: number
  useIdentityEdit: boolean
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
  locale: 'zh-HK' | 'en' = 'zh-HK'
): string {
  if (locale === 'en') {
    return [
      'You are a short-drama image prompt director.',
      'Merge the selected materials and attached reference stills into ONE image prompt.',
      'Return ONLY the prompt — no markdown fences.',
      'Highest priority: match faces/wardrobe/locations/props from attached images.',
      'Never substitute a different celebrity, salon clerk, or unrelated set when cast stills are provided.',
      'If multi-panel geometry is required, keep exact panel count and gutters.',
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

  paths.forEach((path, i) => {
    sections.push({
      id: `gallery_${i}`,
      kind: 'ref-image',
      title: opts.name || String(i + 1),
      entityType:
        opts.kind === 'character-sheet'
          ? 'character'
          : opts.kind === 'scene-plate'
            ? 'scene'
            : opts.kind === 'prop-plate'
              ? 'prop'
              : opts.kind === 'story-cover'
                ? 'story'
                : 'gallery',
      imagePath: path,
      text: `Identity / style reference still for ${opts.kind}. Match subject look when included.`,
      include: true,
      canBeEditBase: true,
      editBasePriority: 100 - i,
      group: 'refs'
    })
  })

  sections.push({
    id: 'profile',
    kind: 'text-profile',
    title: opts.name || 'Profile',
    entityType:
      opts.kind === 'character-sheet'
        ? 'character'
        : opts.kind === 'scene-plate'
          ? 'scene'
          : opts.kind === 'prop-plate'
            ? 'prop'
            : 'story',
    text: opts.profileText,
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

  const editBaseSectionId =
    opts.preferIdentityEdit === true
      ? pickDefaultEditBaseSectionId(sections)
      : null

  const fallbackPrompt = [
    `Generate one high-quality short-drama ${opts.kind} image for "${opts.name}".`,
    opts.profileText,
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
      useIdentityEdit: Boolean(editBaseSectionId)
    }
  }
}

/**
 * Materials for one timeline beat still / clip refine (MediaGen shell).
 * Prefers previous continuity as edit base (same rule as resolveTimelineStillRefs).
 */
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
  characterName?: string | null
  characterImagePath?: string | null
  sceneLabel?: string | null
  sceneImagePath?: string | null
  propName?: string | null
  propImagePath?: string | null
  hardRules?: string | null
  artStyleId?: string | null
  durationSeconds?: number
  styleNote?: string | null
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

  const prev = opts.previousContinuityPath?.trim() || null
  if (prev) {
    sections.push({
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
    sections.push({
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

  const charImg = opts.characterImagePath?.trim() || null
  if (charImg && charImg !== cast && charImg !== prev) {
    sections.push({
      id: 'character_ref',
      kind: 'ref-image',
      title: opts.characterName || 'Character',
      entityType: 'character',
      imagePath: charImg,
      text: `Character library still for "${opts.characterName || 'lead'}". Match face/hair/body.`,
      include: !cast,
      canBeEditBase: true,
      editBasePriority: 120,
      group: 'refs'
    })
  }

  const sceneImg = opts.sceneImagePath?.trim() || null
  if (sceneImg && sceneImg !== prev) {
    sections.push({
      id: 'scene_ref',
      kind: 'ref-image',
      title: opts.sceneLabel || 'Scene',
      entityType: 'scene',
      imagePath: sceneImg,
      text: 'Location plate — SPACE LOCK architecture, materials, light direction.',
      include: true,
      canBeEditBase: false,
      editBasePriority: 60,
      group: 'refs'
    })
  }

  const propImg = opts.propImagePath?.trim() || null
  if (propImg) {
    sections.push({
      id: 'prop_ref',
      kind: 'ref-image',
      title: opts.propName || 'Prop',
      entityType: 'prop',
      imagePath: propImg,
      text: `Prop still for "${opts.propName || 'item'}". Match when the beat uses this prop.`,
      include: true,
      canBeEditBase: false,
      editBasePriority: 40,
      group: 'refs'
    })
  }

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
      opts.characterName ? `Primary character: ${opts.characterName}` : null,
      opts.sceneLabel ? `Location: ${opts.sceneLabel}` : null,
      opts.propName ? `Prop: ${opts.propName}` : null
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
    ? `Keyframe still then short-drama video for story "${opts.storyTitle}" beat #${beatN}. Continuity-lock previous frame when attached.`
    : `One cinematic short-drama KEYFRAME still for story "${opts.storyTitle}" beat #${beatN}. Continuity-lock previous frame when attached. No watermark.`

  const fallbackPrompt = [
    taskHint,
    opts.continuityLockText?.trim() || null,
    beatText || null,
    opts.characterName
      ? `Character focus: ${opts.characterName}.`
      : null,
    `Art: ${art.promptBlock || art.id}`,
    'Cinematic short drama; anatomically correct; no text overlay.'
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
