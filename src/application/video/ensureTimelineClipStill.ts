/**
 * Headless MediaGen still: polish materials then write a keyframe
 * (skipIfExists avoids double image spend).
 */
import { existsSync } from 'fs'
import type { AIProvider } from '../../types/domain'
import {
  buildTimelineBeatMaterialSections,
  type MediaGenMaterialSection,
  type TimelineBoundEntityRef
} from '../../domain/mediaGenPrep'
import { polishMediaGenPrompt } from '../media/polishMediaGenPrompt'
import {
  generateVideoStillKeyframe,
  type ImageCapableAi
} from './generateVideoStill'

export async function ensureTimelineClipStill(options: {
  ai: AIProvider
  outputPath: string
  skipIfExists?: boolean
  locale?: string
  aspectRatio?: string
  hardRules?: string | null
  promptTemplateId?: string | null
  signal?: AbortSignal
  sourceImagePath?: string | null
  storyTitle: string
  displayIndex: number
  dialogue?: string | null
  beatBlock?: string | null
  previousContinuityPath?: string | null
  previousBeatIndex?: number
  continuityLockText?: string | null
  characters?: TimelineBoundEntityRef[]
  scenes?: TimelineBoundEntityRef[]
  props?: TimelineBoundEntityRef[]
  actions?: TimelineBoundEntityRef[]
  continuityMode?: string | null
  motionPriority?: string | null
  artStyleId?: string | null
  durationSeconds?: number
  styleNote?: string | null
  fallbackPrompt: string
}): Promise<{ stillPath: string; skipped: boolean; polished: boolean }> {
  if (options.skipIfExists !== false && existsSync(options.outputPath)) {
    return {
      stillPath: options.outputPath,
      skipped: true,
      polished: false
    }
  }

  const built = buildTimelineBeatMaterialSections({
    kind: 'timeline-still',
    storyTitle: options.storyTitle,
    displayIndex: options.displayIndex,
    dialogue: options.dialogue,
    beatBlock: options.beatBlock,
    previousContinuityPath: options.previousContinuityPath,
    previousBeatIndex: options.previousBeatIndex,
    ownStillPath: existsSync(options.outputPath) ? options.outputPath : null,
    continuityLockText: options.continuityLockText,
    characters: options.characters,
    scenes: options.scenes,
    props: options.props,
    actions: options.actions,
    continuityMode: options.continuityMode,
    motionPriority: options.motionPriority,
    hardRules: options.hardRules,
    artStyleId: options.artStyleId,
    durationSeconds: options.durationSeconds,
    styleNote: options.styleNote,
    fallbackPrompt: options.fallbackPrompt,
    locale: options.locale
  })

  const included: MediaGenMaterialSection[] = built.sections.filter(
    (s) => s.include !== false
  )
  const polished = await polishMediaGenPrompt({
    ai: options.ai,
    locale: options.locale,
    kind: 'timeline-still',
    includedSections: included,
    taskHint: built.taskHint,
    fallbackPrompt: built.fallbackPrompt || options.fallbackPrompt,
    hardRules: options.hardRules,
    mode: 'image',
    promptTemplateId: options.promptTemplateId,
    signal: options.signal
  })

  const imageAi = options.ai as AIProvider & Partial<ImageCapableAi>
  if (!imageAi.generateImage || !imageAi.editImage) {
    return {
      stillPath: options.sourceImagePath?.trim() || options.outputPath,
      skipped: true,
      polished: polished.polished
    }
  }

  const still = await generateVideoStillKeyframe({
    ai: imageAi as ImageCapableAi,
    store: {
      ensureLibraryDirs: () => undefined
    } as never,
    professionalPrompt: polished.prompt,
    sourceImagePath: options.sourceImagePath,
    locale: options.locale,
    aspectRatio: options.aspectRatio,
    hardRules: options.hardRules,
    outputPath: options.outputPath
  })
  return {
    stillPath: still.stillPath,
    skipped: false,
    polished: polished.polished
  }
}
