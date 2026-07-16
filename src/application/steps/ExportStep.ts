import type { PipelineContext, PipelineStep, PipelineStepResult } from '../../types/domain'

export class ExportStep implements PipelineStep {
  readonly name = 'export' as const

  async run(context: PipelineContext): Promise<PipelineStepResult> {
    const summary = Object.entries(context.artifacts)
      .map(([k, v]) => `## ${k}\n${v}`)
      .join('\n\n')

    let exportPath: string | undefined
    try {
      if (context.media?.exportStoryboard) {
        exportPath = await context.media.exportStoryboard(context.story.id)
        await context.persistence?.setExportPath?.(context.story.id, exportPath)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      // Non-fatal for package text; surface as degraded
      const output = [
        `# Export package: ${context.story.title}`,
        `Story ID: ${context.story.id}`,
        '',
        summary || '(no prior artifacts)',
        '',
        `FFmpeg export failed: ${message}`
      ].join('\n')
      return { step: this.name, success: true, degraded: true, output }
    }

    const output = [
      `# Export package: ${context.story.title}`,
      `Story ID: ${context.story.id}`,
      exportPath ? `Video: ${exportPath}` : 'Video: (not generated — call media.export separately)',
      '',
      summary || '(no prior artifacts)'
    ].join('\n')

    return { step: this.name, success: true, output }
  }
}
