/**
 * Shared video-prep pipeline types and pure helpers.
 * Flow: extract materials → LLM professional prompt → still → user review → video.
 */

import { appendHardRules } from './promptHardRules'

export type VideoPrepKind =
  | 'character-intro'
  | 'scene-intro'
  | 'prop-intro'
  | 'costume-intro'
  | 'action-intro'
  | 'timeline-clip'

export interface VideoPrepEntityIds {
  characterId?: string
  sceneId?: string
  propId?: string
  costumeId?: string
  actionId?: string
  storyId?: string
  entryId?: string
}

/** Wizard step index 0..4 for stepper UI. */
export type VideoPrepStepId =
  | 'extract'
  | 'polish'
  | 'still'
  | 'review'
  | 'video'

export const VIDEO_PREP_STEPS: VideoPrepStepId[] = [
  'extract',
  'polish',
  'still',
  'review',
  'video'
]

/**
 * Session phase — loading phases lock the modal (no dismiss / no nav).
 */
export type VideoPrepPhase =
  | 'loading-materials' // legacy alias → treat as extract
  | 'loading-extract'
  | 'loading-polish'
  | 'loading-still'
  | 'review'
  | 'loading-regen'
  | 'loading-video'
  | 'success'
  | 'error'

export function isVideoPrepPhaseLocked(phase: VideoPrepPhase): boolean {
  return (
    phase === 'loading-materials' ||
    phase === 'loading-extract' ||
    phase === 'loading-polish' ||
    phase === 'loading-still' ||
    phase === 'loading-regen' ||
    phase === 'loading-video'
  )
}

/** Map phase → active step index (0-based) for stepper. */
export function videoPrepPhaseToStepIndex(phase: VideoPrepPhase): number {
  switch (phase) {
    case 'loading-materials':
    case 'loading-extract':
      return 0
    case 'loading-polish':
      return 1
    case 'loading-still':
      return 2
    case 'review':
    case 'loading-regen':
      return 3
    case 'loading-video':
    case 'success':
      return 4
    case 'error':
      return 3
    default:
      return 0
  }
}

/** Stable key for multi-draft store (entity + source still / clip). */
export function buildVideoPrepDraftKey(
  kind: VideoPrepKind,
  entityIds: VideoPrepEntityIds,
  sourceImagePath?: string | null
): string {
  if (kind === 'timeline-clip') {
    const story = entityIds.storyId?.trim() || '_'
    const entry = entityIds.entryId?.trim() || '_'
    return `timeline-clip:${story}:${entry}`
  }
  const primary =
    entityIds.characterId ||
    entityIds.sceneId ||
    entityIds.propId ||
    entityIds.costumeId ||
    '_'
  const src = (sourceImagePath ?? '').trim() || '_'
  return `${kind}:${primary}:${src}`
}

/** Input to open the wizard and run create (or resume a draft). */
export interface StartVideoPrepInput {
  kind: VideoPrepKind
  entityIds: VideoPrepEntityIds
  sourceImagePath?: string | null
  durationSeconds?: number
  locale?: 'zh-HK' | 'en'
  /** Seed for user extra (e.g. timeline revision notes). */
  userExtraPrompt?: string
  queueIndex?: number
  queueTotal?: number
  /** Remaining timeline entry ids after the current one. */
  queueRemaining?: string[]
  /** Skip create — open review with this draft (continue saved / resume). */
  resumeDraft?: VideoPrepDraftPayload
  /** Reuse continuity still if present (skip image gen). */
  skipStillIfExists?: boolean
  /** Polish + still only (batch storyboard); no video API required. */
  stillOnly?: boolean
}

/** Payload shown in VideoPrepModal and returned by videoPrep:create / regenStill. */
export interface VideoPrepDraftPayload {
  kind: VideoPrepKind
  entityIds: VideoPrepEntityIds
  professionalPrompt: string
  userExtraPrompt: string
  stillPath: string
  /** Identity / space lock still used for image_edit when present. */
  sourceImagePath?: string | null
  durationSeconds: number
  aspectRatio: string
  materialsSummary?: string
  /** Last still-gen prompt (may include improvement notes). */
  stillPromptUsed?: string
  /** When set, modal shows “clip i / n” for sequential timeline prep. */
  queueIndex?: number
  queueTotal?: number
}

/** Live wizard session (not necessarily persisted). */
export interface VideoPrepSession {
  /** Unique id so effects can re-run create safely. */
  requestId: string
  phase: VideoPrepPhase
  draft: VideoPrepDraftPayload | null
  /** Original start request (for retry). */
  request: StartVideoPrepInput
  errorMessage?: string
  /** Result video path after success. */
  resultPath?: string
  queueRemaining: string[]
}

/** @deprecated single-draft v1 */
export const VIDEO_PREP_DRAFT_STORAGE_KEY = 'idm.videoPrepDraft.v1'
/** Multi-draft map v2 */
export const VIDEO_PREP_DRAFTS_STORAGE_KEY = 'idm.videoPrepDrafts.v2'

export interface PersistedVideoPrepDraft {
  version: 1
  savedAt: string
  draft: VideoPrepDraftPayload
  queueRemaining: string[]
  /** Storage key (set when saving into map). */
  key?: string
}

export type VideoPrepDraftStore = Record<string, PersistedVideoPrepDraft>

export function makePersistedVideoPrepDraft(
  draft: VideoPrepDraftPayload,
  queueRemaining: string[] = [],
  key?: string
): PersistedVideoPrepDraft {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    draft,
    queueRemaining: queueRemaining.filter(Boolean),
    ...(key ? { key } : {})
  }
}

export function serializeVideoPrepDraft(
  draft: VideoPrepDraftPayload,
  queueRemaining: string[] = []
): string {
  return JSON.stringify(makePersistedVideoPrepDraft(draft, queueRemaining))
}

export function parsePersistedVideoPrepDraft(
  raw: string | null | undefined
): PersistedVideoPrepDraft | null {
  if (!raw?.trim()) return null
  try {
    const o = JSON.parse(raw) as Partial<PersistedVideoPrepDraft>
    if (o.version !== 1 || !o.draft || typeof o.draft !== 'object') return null
    const d = o.draft as VideoPrepDraftPayload
    if (!d.kind || !d.stillPath || !d.professionalPrompt) return null
    return {
      version: 1,
      savedAt: typeof o.savedAt === 'string' ? o.savedAt : new Date().toISOString(),
      draft: d,
      queueRemaining: Array.isArray(o.queueRemaining)
        ? o.queueRemaining.filter((x): x is string => typeof x === 'string')
        : [],
      ...(typeof o.key === 'string' ? { key: o.key } : {})
    }
  } catch {
    return null
  }
}

export function parseVideoPrepDraftStore(
  raw: string | null | undefined
): VideoPrepDraftStore {
  if (!raw?.trim()) return {}
  try {
    const o = JSON.parse(raw) as unknown
    if (!o || typeof o !== 'object' || Array.isArray(o)) return {}
    const out: VideoPrepDraftStore = {}
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      if (!k || !v || typeof v !== 'object') continue
      const entry = v as Partial<PersistedVideoPrepDraft>
      if (entry.version !== 1 || !entry.draft) continue
      const d = entry.draft as VideoPrepDraftPayload
      if (!d.kind || !d.stillPath || !d.professionalPrompt) continue
      out[k] = {
        version: 1,
        savedAt:
          typeof entry.savedAt === 'string'
            ? entry.savedAt
            : new Date().toISOString(),
        draft: d,
        queueRemaining: Array.isArray(entry.queueRemaining)
          ? entry.queueRemaining.filter((x): x is string => typeof x === 'string')
          : [],
        key: k
      }
    }
    return out
  } catch {
    return {}
  }
}

/** Load v2 map; migrate single v1 draft if present. */
export function loadVideoPrepDraftStore(options: {
  v2Raw?: string | null
  v1Raw?: string | null
}): VideoPrepDraftStore {
  const store = parseVideoPrepDraftStore(options.v2Raw)
  if (Object.keys(store).length > 0) return store
  const single = parsePersistedVideoPrepDraft(options.v1Raw)
  if (!single) return {}
  const key = buildVideoPrepDraftKey(
    single.draft.kind,
    single.draft.entityIds,
    single.draft.sourceImagePath
  )
  return { [key]: { ...single, key } }
}

export function serializeVideoPrepDraftStore(store: VideoPrepDraftStore): string {
  return JSON.stringify(store)
}

export function upsertVideoPrepDraft(
  store: VideoPrepDraftStore,
  key: string,
  draft: VideoPrepDraftPayload,
  queueRemaining: string[] = []
): VideoPrepDraftStore {
  return {
    ...store,
    [key]: makePersistedVideoPrepDraft(draft, queueRemaining, key)
  }
}

export function removeVideoPrepDraft(
  store: VideoPrepDraftStore,
  key: string
): VideoPrepDraftStore {
  if (!store[key]) return store
  const next = { ...store }
  delete next[key]
  return next
}

/** Merge director prompt + optional user extras for the final generateVideo call. */
export function mergeFinalVideoPrompt(
  professionalPrompt: string,
  userExtraPrompt?: string | null,
  hardRules?: string | null
): string {
  const pro = (professionalPrompt ?? '').trim()
  const extra = (userExtraPrompt ?? '').trim()
  let base = ''
  if (!pro && !extra) base = ''
  else if (!extra) base = pro
  else if (!pro) base = extra
  else {
    base = [
      pro,
      'DIRECTOR / USER REVISION (supplement only — must not violate HARD RULES):',
      extra
    ].join('\n')
  }
  return appendHardRules(base, hardRules)
}

/**
 * Turn a professional video director prompt into a single keyframe image prompt.
 * Keeps lock language; strips pure motion-only beats that confuse image models.
 */
export function buildStillKeyframePrompt(
  professionalVideoPrompt: string,
  options?: { improvementNotes?: string | null; locale?: 'zh-HK' | 'en' }
): string {
  const en = options?.locale === 'en'
  const base = (professionalVideoPrompt ?? '').trim()
  const notes = (options?.improvementNotes ?? '').trim()
  const header = en
    ? [
        'SINGLE KEYFRAME STILL for short-drama video continuity (not a multi-panel sheet).',
        'Produce one cinematic hero frame that matches the planned shot below.',
        'No text, logos, watermarks, UI chrome. Sharp, production-ready.'
      ].join(' ')
    : [
        'SINGLE KEYFRAME STILL for short-drama video continuity (not a multi-panel sheet).',
        'Produce one cinematic hero frame that matches the planned shot below.',
        'No text, logos, watermarks, UI chrome. Sharp, production-ready.'
      ].join(' ')
  const revision = notes
    ? en
      ? `USER IMPROVEMENT FOR THIS STILL (must apply): ${notes}`
      : `用戶改進要求（必須套用）：${notes}`
    : ''
  return [header, revision, base].filter(Boolean).join('\n')
}

/** LLM user message: revise professional video prompt with user still feedback. */
export function buildStillRegenPolishUserPrompt(options: {
  locale?: 'zh-HK' | 'en'
  professionalPrompt: string
  improvementNotes: string
  seconds: number
  aspectRatio?: string
  hardRules?: string | null
}): string {
  const en = options.locale === 'en'
  const rules = (options.hardRules ?? '').trim()
  return [
    en
      ? 'TASK: Revise the image-to-video director prompt AND keep it usable as a still keyframe brief.'
      : '任務：修訂 image-to-video 導演提示詞，並保持可作靜幀 keyframe 簡報。',
    `Duration target: ${options.seconds}s. Aspect: ${options.aspectRatio || '16:9'}.`,
    en
      ? `USER IMPROVEMENT REQUEST:\n${options.improvementNotes.trim()}`
      : `用戶改進要求：\n${options.improvementNotes.trim()}`,
    en ? 'Current professional prompt:' : '目前專業提示詞：',
    options.professionalPrompt.trim(),
    rules
      ? en
        ? [
            'HARD RULES (must keep at end of output; do not drop or weaken):',
            rules
          ].join('\n')
        : [
            'HARD RULES／生成鐵則（必須保留於輸出最尾；不得刪除或削弱）：',
            rules
          ].join('\n')
      : null,
    en
      ? 'Return ONE improved director prompt only (English-first). Apply the improvement; keep IDENTITY/SPACE/OBJECT locks and HARD RULES.'
      : '只回傳一條改進後的導演提示詞（英文為主）。套用改進；保留 IDENTITY／SPACE／OBJECT 鎖定與 HARD RULES。'
  ]
    .filter(Boolean)
    .join('\n')
}

export function materialsSummaryLines(
  lines: Array<string | null | undefined>
): string {
  return lines
    .map((l) => (l ?? '').trim())
    .filter(Boolean)
    .join('\n')
}
