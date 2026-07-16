import type { PipelineContext, PipelineStep, PipelineStepResult } from '../../types/domain'

export class SceneStep implements PipelineStep {
  readonly name = 'scene' as const

  async run(context: PipelineContext): Promise<PipelineStepResult> {
    const { story } = context
    const lines = story.scenes.map(
      (s) =>
        `Scene ${s.sceneNumber}: ${s.description}${s.script ? `\n  Script: ${s.script}` : ''}`
    )

    const output =
      lines.length > 0
        ? `Scene plan ready:\n${lines.join('\n')}`
        : 'No scenes defined — skipping scene expansion.'

    return { step: this.name, success: true, output }
  }
}
