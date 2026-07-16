import type {
  AIProvider,
  GenerationResult,
  PipelineContext,
  PipelinePersistence,
  PipelineStep,
  PipelineStepResult,
  StoryDetail
} from '../types/domain'
import { ScriptStep } from './steps/ScriptStep'
import { CharacterStep } from './steps/CharacterStep'
import { SceneStep } from './steps/SceneStep'
import { PropsStep } from './steps/PropsStep'
import { TimelineStep } from './steps/TimelineStep'
import { VideoStep } from './steps/VideoStep'
import { ExportStep } from './steps/ExportStep'

export interface PipelineRunOptions {
  onStepComplete?: (
    result: PipelineStepResult,
    index: number,
    total: number
  ) => void
  persistence?: PipelinePersistence
  media?: PipelineContext['media']
  signal?: AbortSignal
  onlyFailedVideos?: boolean
  videoConcurrency?: number
  onClipProgress?: PipelineContext['onClipProgress']
}

/**
 * Script → Character → Scene → Props → Timeline → Video → Export
 */
export class GenerationPipeline {
  private readonly steps: PipelineStep[]

  constructor(
    private readonly ai: AIProvider,
    steps?: PipelineStep[]
  ) {
    this.steps =
      steps ??
      [
        new ScriptStep(),
        new CharacterStep(),
        new SceneStep(),
        new PropsStep(),
        new TimelineStep(),
        new VideoStep(),
        new ExportStep()
      ]
  }

  async run(
    story: StoryDetail,
    options?: PipelineRunOptions
  ): Promise<GenerationResult> {
    const context: PipelineContext = {
      story,
      ai: this.ai,
      artifacts: {},
      persistence: options?.persistence,
      media: options?.media,
      signal: options?.signal,
      onlyFailedVideos: options?.onlyFailedVideos,
      videoConcurrency: options?.videoConcurrency,
      onClipProgress: options?.onClipProgress
    }

    const results: PipelineStepResult[] = []
    const total = this.steps.length

    for (let i = 0; i < this.steps.length; i++) {
      if (options?.signal?.aborted) {
        results.push({ step: this.steps[i].name, success: false, error: 'Cancelled' })
        return { storyId: story.id, steps: results, success: false }
      }

      const step = this.steps[i]
      try {
        const result = await step.run(context)
        results.push(result)
        options?.onStepComplete?.(result, i, total)
        if (!result.success) {
          return { storyId: story.id, steps: results, success: false }
        }
        if (result.output) {
          context.artifacts[step.name] = result.output
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        const result: PipelineStepResult = {
          step: step.name,
          success: false,
          error: message
        }
        results.push(result)
        options?.onStepComplete?.(result, i, total)
        return { storyId: story.id, steps: results, success: false }
      }
    }

    return { storyId: story.id, steps: results, success: true }
  }
}
