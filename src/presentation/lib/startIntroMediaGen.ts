/**
 * Shared helper: open MediaGen shell for intro / clip video from a gallery still.
 * Replaces startVideoPrep for new intros (VideoPrep remains for draft resume only).
 */
import { getApi } from '../../lib/api'
import type { MediaGenPrepOpenRequest } from '../components/MediaGenPrepModal'
import { getAiLocale } from '../../lib/aiLocale'

export type IntroMediaGenKind =
  | 'character-intro'
  | 'scene-intro'
  | 'prop-intro'
  | 'costume-intro'
  | 'action-intro'
  | 'timeline-clip'

export async function resolveVideoAspectRatio(): Promise<'16:9' | '9:16'> {
  try {
    const s = await getApi().settings.get()
    const ar = s.aspectRatio?.trim()
    if (ar === '9:16' || ar === '16:9') return ar
  } catch {
    /* default */
  }
  return '16:9'
}

/** Build open request for intro from a source still (skip re-gen keyframe). */
export async function buildIntroMediaGenRequest(opts: {
  kind: IntroMediaGenKind
  sourceImagePath: string
  characterId?: string
  sceneId?: string
  propId?: string
  costumeId?: string
  actionId?: string
  storyId?: string
  entryId?: string
  artStyle?: string | null
  durationSeconds?: number
  locale?: 'zh-HK' | 'en'
  /** default true for gallery-driven intros when source path present */
  skipStillIfExists?: boolean
  /** Timeline revision / director notes */
  userExtraPrompt?: string | null
}): Promise<MediaGenPrepOpenRequest> {
  const source = opts.sourceImagePath.trim()
  const aspectRatio = await resolveVideoAspectRatio()
  // Timeline clip may skip still via extract.existingStillPath without a client path
  const allowSkipWithoutSource =
    opts.kind === 'timeline-clip' && opts.skipStillIfExists === true
  const skip =
    opts.skipStillIfExists === true
      ? Boolean(source) || allowSkipWithoutSource
      : opts.skipStillIfExists !== false && Boolean(source)
  return {
    kind: opts.kind,
    characterId: opts.characterId,
    sceneId: opts.sceneId,
    propId: opts.propId,
    costumeId: opts.costumeId,
    actionId: opts.actionId,
    storyId: opts.storyId,
    entryId: opts.entryId,
    artStyle: opts.artStyle ?? undefined,
    galleryIdentityPaths: source ? [source] : [],
    sourceImagePath: source || undefined,
    preferIdentityEdit: Boolean(source),
    skipStillIfExists: skip,
    durationSeconds: opts.durationSeconds ?? 10,
    aspectRatio,
    userExtraPrompt: opts.userExtraPrompt?.trim() || null
  }
}

export function introLocaleFromI18n(lang: string): 'zh-HK' | 'en' {
  return getAiLocale(lang)
}
