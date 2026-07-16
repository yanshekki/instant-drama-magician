import type { PipelineContext, PipelineStep, PipelineStepResult } from '../../types/domain'

export class ExportStep implements PipelineStep {
  readonly name = 'export' as const

  async run(context: PipelineContext): Promise<PipelineStepResult> {
    const summary = Object.entries(context.artifacts)
      .map(([k, v]) => `## ${k}\n${v}`)
      .join('\n\n')

    const output = [
      `# Export package: ${context.story.title}`,
      `Story ID: ${context.story.id}`,
      '',
      summary || '(no prior artifacts)',
      '',
      'Status: package prepared (FFmpeg video export hook pending).'
    ].join('\n')

    return { step: this.name, success: true, output }
  }
}
