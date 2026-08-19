/**
 * Shared clip continuity contract used by MediaGen extract, generateClip,
 * VideoStep, and videoPrep:create. Callers supply disk paths; this module
 * does not touch the filesystem.
 */
import type { Action, Character, Prop, Scene, TimelineEntry } from '../types/domain'
import {
  chainEndForcesSequential,
  coerceContinuityMode,
  coerceMotionPriority,
  type ContinuityMode,
  type MotionPriority
} from './generationModes'
import {
  buildContinuityLockPrompt,
  getPreviousTimelineEntry,
  previousClipContext,
  resolveTimelineStillRefs,
  timelineBeatDisplayIndex,
  type ClipRefSource
} from './promptContinuity'
import { extractSpokenLines, parseBeatContent } from './beatContent'

export type ClipContinuityContext = {
  prevEntry: TimelineEntry | null
  previousBeatIndex: number
  previousContinuityPath: string | null
  sameCharacter: boolean
  sameScene: boolean
  continuityLock: string | null
  previousContext: string | null
  prevWithLock: string | null
  continuityMode: ContinuityMode
  motionPriority: MotionPriority
  missingEndFrame: boolean
  sequentialRequired: boolean
  editBase: string | null
  editSource: ClipRefSource | 'payload' | null
  polishPaths: string[]
  actionInPolish: boolean
  lastFramePath: string | null
}

export function buildClipContinuityContext(options: {
  entries: TimelineEntry[]
  currentId: string
  character?: Character | null
  scene?: Scene | null
  prop?: Prop | null
  action?: Pick<Action, 'refImagePath'> | null
  extraActionPaths?: Array<string | null | undefined>
  maps?: {
    characters: Map<string, Character>
    scenes: Map<string, Scene>
    props: Map<string, Prop>
  }
  previousContinuityPath?: string | null
  castRefPath?: string | null
  payloadSourcePath?: string | null
  ownStillPath?: string | null
  continuityMode?: ContinuityMode | string | null
  motionPriority?: MotionPriority | string | null
  locale?: string | null
  pathExists?: (path: string) => boolean
  maxPolishPaths?: number
}): ClipContinuityContext {
  const continuityMode = coerceContinuityMode(options.continuityMode)
  const motionPriority = coerceMotionPriority(options.motionPriority)
  const locale = options.locale || 'zh-HK'
  const prevEntry = getPreviousTimelineEntry(options.entries, options.currentId)
  const previousBeatIndex = prevEntry
    ? timelineBeatDisplayIndex(options.entries, prevEntry.id)
    : 0
  const previousContinuityPath = options.previousContinuityPath?.trim() || null
  const missingEndFrame = Boolean(prevEntry) && !previousContinuityPath

  const primaryCharId = options.character?.id ?? null
  const primarySceneId = options.scene?.id ?? null
  const prevCharIds = prevEntry
    ? [
        prevEntry.characterId,
        ...((prevEntry as { characterIds?: string[] }).characterIds ?? [])
      ].filter(Boolean)
    : []
  const prevSceneIds = prevEntry
    ? [
        prevEntry.sceneId,
        ...((prevEntry as { sceneIds?: string[] }).sceneIds ?? [])
      ].filter(Boolean)
    : []
  const sameCharacter = Boolean(
    primaryCharId && prevCharIds.includes(primaryCharId)
  )
  const sameScene = Boolean(
    primarySceneId && prevSceneIds.includes(primarySceneId)
  )

  const maps = options.maps ?? {
    characters: new Map<string, Character>(),
    scenes: new Map<string, Scene>(),
    props: new Map<string, Prop>()
  }
  const previousContext = previousClipContext(
    options.entries,
    options.currentId,
    maps
  )
  const prevSnippet = prevEntry
    ? extractSpokenLines(
        parseBeatContent(
          prevEntry.dialogue,
          (prevEntry as { beatContentJson?: string | null }).beatContentJson
        )
      ) || prevEntry.dialogue || previousContext
    : null
  const continuityLock = prevEntry
    ? buildContinuityLockPrompt({
        previousBeatIndex,
        previousDialogueSnippet: prevSnippet,
        sameCharacter,
        sameScene,
        hasContinuityImage: Boolean(previousContinuityPath),
        locale
      })
    : null
  const prevWithLock = [previousContext, continuityLock]
    .filter(Boolean)
    .join('\n') || null

  const refs = resolveTimelineStillRefs({
    character: options.character,
    scene: options.scene,
    prop: options.prop,
    action: options.action,
    extraActionPaths: options.extraActionPaths,
    previousContinuityPath,
    castRefPath: options.castRefPath,
    payloadSourcePath: options.payloadSourcePath,
    motionPriority,
    continuityMode,
    pathExists: options.pathExists,
    maxPolishPaths: options.maxPolishPaths
  })

  const own = options.ownStillPath?.trim() || null
  const lastFramePath =
    continuityMode === 'chain-end' &&
    own &&
    own !== previousContinuityPath &&
    (options.pathExists ?? (() => true))(own)
      ? own
      : null

  return {
    prevEntry,
    previousBeatIndex,
    previousContinuityPath,
    sameCharacter,
    sameScene,
    continuityLock,
    previousContext,
    prevWithLock,
    continuityMode,
    motionPriority,
    missingEndFrame,
    sequentialRequired: chainEndForcesSequential(continuityMode),
    editBase: refs.editBase,
    editSource: refs.editSource,
    polishPaths: refs.polishPaths,
    actionInPolish: refs.actionInPolish,
    lastFramePath
  }
}

export function actionMotionRole(
  hasPlate: boolean
): 'image' | 'text' {
  return hasPlate ? 'image' : 'text'
}
