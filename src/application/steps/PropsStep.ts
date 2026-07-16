import type { PipelineContext, PipelineStep, PipelineStepResult } from '../../types/domain'

export class PropsStep implements PipelineStep {
  readonly name = 'props' as const

  async run(context: PipelineContext): Promise<PipelineStepResult> {
    const { story } = context
    const lines = story.props.map((p) => `- ${p.name}: ${p.description}`)

    const output =
      lines.length > 0
        ? `Props inventory ready:\n${lines.join('\n')}`
        : 'No props defined — skipping props pass.'

    return { step: this.name, success: true, output }
  }
}
