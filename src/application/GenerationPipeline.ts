import type {
  AIProvider,
  GenerationResult,
  PipelineContext,
  PipelineStep,
  PipelineStepResult,
  StoryDetail
} from '../types/domain'
import { ScriptStep } from './steps/ScriptStep'
import { CharacterStep } from './steps/CharacterStep'
import { SceneStep } from './steps/SceneStep'
import { PropsStep } from './steps/PropsStep'
import { TimelineStep } from './steps/TimelineStep'
import { ExportStep } from './steps/ExportStep'

/**
 * Composable generation pipeline:
 * Script → Character → Scene → Props → Timeline → Export
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
        new ExportStep()
      ]
  }

  async run(story: StoryDetail): Promise<GenerationResult> {
    const context: PipelineContext = {
      story,
      ai: this.ai,
      artifacts: {}
    }

    const results: PipelineStepResult[] = []

    for (const step of this.steps) {
      try {
        const result = await step.run(context)
        results.push(result)
        if (!result.success) {
          return { storyId: story.id, steps: results, success: false }
        }
        if (result.output) {
          context.artifacts[step.name] = result.output
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        results.push({ step: step.name, success: false, error: message })
        return { storyId: story.id, steps: results, success: false }
      }
    }

    return { storyId: story.id, steps: results, success: true }
  }
}
