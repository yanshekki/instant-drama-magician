/**
 * Bridge VideoPrep start/resume payloads → MediaGen shell open request.
 * All new video UX goes through MediaGen; VideoPrep modal is legacy fallback only.
 */
import type { StartVideoPrepInput, VideoPrepDraftPayload } from './videoPrep'
import { buildVideoPrepDraftKey } from './videoPrep'

/** Minimal open-request shape (avoid circular import with presentation). */
export type MediaGenOpenFromVideoPrep = {
  kind:
    | 'character-intro'
    | 'scene-intro'
    | 'prop-intro'
    | 'costume-intro'
    | 'action-intro'
    | 'timeline-clip'
  characterId?: string
  sceneId?: string
  propId?: string
  costumeId?: string
  actionId?: string
  storyId?: string
  entryId?: string
  galleryIdentityPaths?: string[]
  sourceImagePath?: string
  preferIdentityEdit?: boolean
  skipStillIfExists?: boolean
  durationSeconds?: number
  aspectRatio?: string
  userExtraPrompt?: string | null
  queueIndex?: number
  queueTotal?: number
  queueRemaining?: string[]
  /** Resume mid-flow (still + prompts already ready). */
  resumeDraft?: {
    polishedPrompt: string
    videoPrompt?: string
    stillPath: string
    userExtraPrompt?: string
    durationSeconds?: number
    aspectRatio?: string
    phase?: 'keyframe' | 'confirm-video' | 'review-prompt'
  }
}

export function videoPrepInputToMediaGenOpen(
  input: StartVideoPrepInput
): MediaGenOpenFromVideoPrep {
  const src = input.sourceImagePath?.trim() || ''
  const kind = input.kind as MediaGenOpenFromVideoPrep['kind']
  const allowSkipTimeline =
    kind === 'timeline-clip' && input.skipStillIfExists === true
  return {
    kind,
    characterId: input.entityIds.characterId,
    sceneId: input.entityIds.sceneId,
    propId: input.entityIds.propId,
    costumeId: input.entityIds.costumeId,
    actionId: input.entityIds.actionId,
    storyId: input.entityIds.storyId,
    entryId: input.entityIds.entryId,
    galleryIdentityPaths: src ? [src] : [],
    sourceImagePath: src || undefined,
    preferIdentityEdit: Boolean(src),
    skipStillIfExists:
      input.skipStillIfExists === true
        ? Boolean(src) || allowSkipTimeline
        : Boolean(src) && input.skipStillIfExists !== false,
    durationSeconds: input.durationSeconds ?? 10,
    userExtraPrompt: input.userExtraPrompt?.trim() || null,
    queueIndex: input.queueIndex,
    queueTotal: input.queueTotal,
    queueRemaining: input.queueRemaining
  }
}

/** Resume a saved VideoPrep-compatible draft inside MediaGen (confirm-video). */
export function videoPrepDraftToMediaGenResume(
  draft: VideoPrepDraftPayload,
  queueRemaining: string[] = []
): MediaGenOpenFromVideoPrep {
  const src =
    draft.sourceImagePath?.trim() ||
    draft.stillPath?.trim() ||
    ''
  const kind = draft.kind as MediaGenOpenFromVideoPrep['kind']
  const ar =
    draft.aspectRatio === '9:16' || draft.aspectRatio === '16:9'
      ? draft.aspectRatio
      : '16:9'
  return {
    kind,
    characterId: draft.entityIds.characterId,
    sceneId: draft.entityIds.sceneId,
    propId: draft.entityIds.propId,
    costumeId: draft.entityIds.costumeId,
    actionId: draft.entityIds.actionId,
    storyId: draft.entityIds.storyId,
    entryId: draft.entityIds.entryId,
    galleryIdentityPaths: src ? [src] : [],
    sourceImagePath: src || undefined,
    preferIdentityEdit: Boolean(src),
    skipStillIfExists: Boolean(draft.stillPath?.trim()),
    durationSeconds: draft.durationSeconds ?? 10,
    aspectRatio: ar,
    userExtraPrompt: draft.userExtraPrompt?.trim() || null,
    queueIndex: draft.queueIndex,
    queueTotal: draft.queueTotal,
    queueRemaining,
    resumeDraft: {
      polishedPrompt: draft.professionalPrompt || draft.stillPromptUsed || '',
      videoPrompt: draft.professionalPrompt || '',
      stillPath: draft.stillPath,
      userExtraPrompt: draft.userExtraPrompt,
      durationSeconds: draft.durationSeconds,
      aspectRatio: ar,
      phase: 'confirm-video'
    }
  }
}

export function mediaGenDraftStorageKey(opts: {
  kind: string
  characterId?: string
  sceneId?: string
  propId?: string
  costumeId?: string
  actionId?: string
  storyId?: string
  entryId?: string
  sourceImagePath?: string | null
}): string {
  return buildVideoPrepDraftKey(
    opts.kind as never,
    {
      characterId: opts.characterId,
      sceneId: opts.sceneId,
      propId: opts.propId,
      costumeId: opts.costumeId,
      actionId: opts.actionId,
      storyId: opts.storyId,
      entryId: opts.entryId
    },
    opts.sourceImagePath
  )
}

/** Queue handoff policy: skip-still + revision + duration for next entry (B1 / B4 / R1). */
export function resolveMediaGenQueueHandoff(opts: {
  nextEntryId: string
  skipStillIfExists: boolean
  userExtraByEntryId?: Record<string, string>
  /** entryId → snap'd duration seconds */
  durationSecondsByEntryId?: Record<string, number>
  defaultDurationSeconds?: number
}): {
  skipStillIfExists: boolean
  userExtraPrompt: string | null
  durationSeconds: number
} {
  const extra = opts.userExtraByEntryId?.[opts.nextEntryId]?.trim() || null
  const d = opts.durationSecondsByEntryId?.[opts.nextEntryId]
  const durationSeconds =
    typeof d === 'number' && d > 0
      ? d
      : typeof opts.defaultDurationSeconds === 'number' &&
          opts.defaultDurationSeconds > 0
        ? opts.defaultDurationSeconds
        : 10
  return {
    skipStillIfExists: opts.skipStillIfExists === true,
    userExtraPrompt: extra,
    durationSeconds
  }
}
