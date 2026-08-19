/**
 * Built-in look packs: thin snapshots over existing media recipes + flags.
 * Not a new template DSL. Default pack is follow-asset (no behaviour change).
 */
import {
  coerceContinuityMode,
  coerceMotionPriority,
  type ContinuityMode,
  type MotionPriority
} from './generationModes'
import {
  isMediaTemplateId,
  type MediaTemplateId
} from './promptTemplates'

export const LOOK_PACK_IDS = [
  'follow-asset',
  'identity-lock',
  'continuous-clip',
  'key-art',
  'comic'
] as const

export type LookPackId = (typeof LOOK_PACK_IDS)[number]

export type LookPackFlags = {
  id: LookPackId
  mediaTemplateId: MediaTemplateId
  continuityMode: ContinuityMode
  advancedIdentity: boolean
  identityCollage: boolean
  motionPriority: MotionPriority
  /** Mild FFmpeg enhance; key-art/comic bump the max-edge so more stills upscale. */
  imageEnhanceScale: number
  imageEnhanceMaxEdge: number
}

const PACKS: Record<LookPackId, LookPackFlags> = {
  'follow-asset': {
    id: 'follow-asset',
    mediaTemplateId: 'follow-asset',
    continuityMode: 'storyboard',
    advancedIdentity: false,
    identityCollage: false,
    motionPriority: 'default',
    imageEnhanceScale: 2,
    imageEnhanceMaxEdge: 1600
  },
  'identity-lock': {
    id: 'identity-lock',
    mediaTemplateId: 'identity-lock',
    continuityMode: 'storyboard',
    advancedIdentity: true,
    identityCollage: true,
    motionPriority: 'default',
    imageEnhanceScale: 2,
    imageEnhanceMaxEdge: 1600
  },
  'continuous-clip': {
    id: 'continuous-clip',
    mediaTemplateId: 'cinematic-lock',
    continuityMode: 'chain-end',
    advancedIdentity: true,
    identityCollage: false,
    motionPriority: 'default',
    imageEnhanceScale: 2,
    imageEnhanceMaxEdge: 1600
  },
  'key-art': {
    id: 'key-art',
    mediaTemplateId: 'cinematic-lock',
    continuityMode: 'storyboard',
    advancedIdentity: true,
    identityCollage: true,
    motionPriority: 'default',
    imageEnhanceScale: 2,
    imageEnhanceMaxEdge: 2400
  },
  comic: {
    id: 'comic',
    mediaTemplateId: 'follow-asset',
    continuityMode: 'storyboard',
    advancedIdentity: true,
    identityCollage: false,
    motionPriority: 'default',
    imageEnhanceScale: 2,
    imageEnhanceMaxEdge: 2400
  }
}

export function isLookPackId(v: string | null | undefined): v is LookPackId {
  return Boolean(v && (LOOK_PACK_IDS as readonly string[]).includes(v))
}

export function coerceLookPackId(v?: string | null): LookPackId {
  return isLookPackId(v) ? v : 'follow-asset'
}

export function getLookPack(v?: string | null): LookPackFlags {
  return PACKS[coerceLookPackId(v)]
}

/** Settings snapshot written when the user picks a pack in UI. */
export function lookPackSettingsPatch(id: LookPackId): {
  lookPackId: LookPackId
  continuityMode: ContinuityMode
  advancedIdentity: boolean
  identityCollage: boolean
  motionPriority: MotionPriority
  imageEnhanceScale: number
  imageEnhanceMaxEdge: number
} {
  const p = PACKS[id]
  return {
    lookPackId: p.id,
    continuityMode: p.continuityMode,
    advancedIdentity: p.advancedIdentity,
    identityCollage: p.identityCollage,
    motionPriority: p.motionPriority,
    imageEnhanceScale: p.imageEnhanceScale,
    imageEnhanceMaxEdge: p.imageEnhanceMaxEdge
  }
}

export function resolveMediaTemplateForPack(
  lookPackId?: string | null,
  explicitTemplateId?: string | null
): MediaTemplateId | string | null {
  if (explicitTemplateId && isMediaTemplateId(explicitTemplateId)) {
    return explicitTemplateId
  }
  return getLookPack(lookPackId).mediaTemplateId
}

export function resolveContinuityMode(
  lookPackId?: string | null,
  explicit?: string | null
): ContinuityMode {
  if (explicit) return coerceContinuityMode(explicit)
  return getLookPack(lookPackId).continuityMode
}

export function resolveMotionPriority(
  lookPackId?: string | null,
  explicit?: string | null
): MotionPriority {
  if (explicit) return coerceMotionPriority(explicit)
  return getLookPack(lookPackId).motionPriority
}
