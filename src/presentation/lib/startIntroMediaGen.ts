/**
 * Shared helper: open MediaGen shell for intro / clip video from a gallery still.
 * Replaces startVideoPrep for new intros (VideoPrep remains for draft resume only).
 */
import { getApi } from '../../lib/api'
import { parseIntroVideoTemplateId } from '../../domain/introVideoTemplates'
import type { MediaGenPrepOpenRequest } from '../components/MediaGenPrepModal'

export type IntroMediaGenKind =
  | 'character-intro'
  | 'scene-intro'
  | 'prop-intro'
  | 'costume-intro'
  | 'action-intro'
  | 'comic-intro'
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
  pageId?: string
  artStyle?: string | null
  durationSeconds?: number
  locale?: string
  /** default true for gallery-driven intros when source path present */
  skipStillIfExists?: boolean
  /** Timeline revision / director notes */
  userExtraPrompt?: string | null
  /** Camera performance template (merged into userExtra; not a MediaGen recipe). */
  introTemplateId?: string | null
  comicVideoScheme?: 'page' | 'drama'
  aspectRatio?: '16:9' | '9:16'
}): Promise<MediaGenPrepOpenRequest> {
  const source = opts.sourceImagePath.trim()
  const aspectRatio =
    opts.aspectRatio === '9:16' || opts.aspectRatio === '16:9'
      ? opts.aspectRatio
      : await resolveVideoAspectRatio()
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
    pageId: opts.pageId,
    artStyle: opts.artStyle ?? undefined,
    galleryIdentityPaths: source ? [source] : [],
    sourceImagePath: source || undefined,
    preferIdentityEdit: Boolean(source),
    skipStillIfExists: skip,
    durationSeconds: opts.durationSeconds ?? 10,
    aspectRatio,
    userExtraPrompt: opts.userExtraPrompt?.trim() || null,
    introTemplateId: parseIntroVideoTemplateId(opts.introTemplateId) ?? undefined,
    comicVideoScheme: opts.comicVideoScheme
  }
}

export function introLocaleFromI18n(lang: string): string {
  return lang || 'zh-HK'
}

export type PhotoBookClipQueueShot = {
  stillPath: string
  sceneId: string
  actionId?: string
  propIds: string[]
  notes?: string
}

/** Open MediaGen video shell for one photo-book shot (skip still → confirm video). */
export async function buildPhotoBookClipMediaGenRequest(opts: {
  characterId: string
  shotId: string
  shot: PhotoBookClipQueueShot
  identityPaths?: string[]
  artStyle?: string | null
  introTemplateId?: string | null
  locale?: string
  durationSeconds?: number
  advancedIdentity?: boolean
  identityCollage?: boolean
  queueIndex?: number
  queueTotal?: number
  queueRemaining?: string[]
  queueShotById?: Record<string, PhotoBookClipQueueShot>
}): Promise<MediaGenPrepOpenRequest> {
  const source = opts.shot.stillPath.trim()
  const identity = (opts.identityPaths ?? [])
    .map((p) => p.trim())
    .filter(Boolean)
  const aspectRatio = await resolveVideoAspectRatio()
  const notes = opts.shot.notes?.trim() || null
  return {
    kind: 'character-photoshoot-clip',
    characterId: opts.characterId,
    sceneId: opts.shot.sceneId,
    actionId: opts.shot.actionId,
    shotId: opts.shotId,
    propIds: opts.shot.propIds,
    artStyle: opts.artStyle ?? undefined,
    galleryIdentityPaths: identity.length > 0 ? identity : source ? [source] : [],
    sourceImagePath: source || undefined,
    preferIdentityEdit: identity.length > 0 || Boolean(source),
    skipStillIfExists: Boolean(source),
    durationSeconds: opts.durationSeconds ?? 10,
    aspectRatio,
    atmosphereDescription: notes ?? undefined,
    userExtraPrompt: notes,
    introTemplateId: parseIntroVideoTemplateId(opts.introTemplateId) ?? undefined,
    advancedIdentity: opts.advancedIdentity,
    identityCollage: opts.identityCollage,
    queueIndex: opts.queueIndex,
    queueTotal: opts.queueTotal,
    queueRemaining: opts.queueRemaining,
    queueShotById: opts.queueShotById,
    queueIntroTemplateId: opts.introTemplateId ?? null,
    queueIdentityPaths: identity,
    queueArtStyle: opts.artStyle ?? null,
    queueLocale: opts.locale,
    queueSkipStillIfExists: true
  }
}
