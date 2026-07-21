import type { PipelineContext, PipelineStep, PipelineStepResult } from '../../types/domain'

export class ExportStep implements PipelineStep {
  readonly name = 'export' as const

  async run(context: PipelineContext): Promise<PipelineStepResult> {
    if (context.signal?.aborted) {
      return { step: this.name, success: false, error: 'errors.cancelled' }
    }

    const summary = Object.entries(context.artifacts)
      .map(([k, v]) => `## ${k}\n${v}`)
      .join('\n\n')

    let exportPath: string | undefined
    let degraded = false
    try {
      if (context.media?.exportConcat) {
        exportPath = await context.media.exportConcat(context.story.id)
      } else if (context.media?.exportStoryboard) {
        exportPath = await context.media.exportStoryboard(context.story.id)
        degraded = true
      }
      if (exportPath) {
        await context.persistence?.setExportPath?.(context.story.id, exportPath)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const output = [
        `# Export package: ${context.story.title}`,
        `Story ID: ${context.story.id}`,
        '',
        summary || '(no prior artifacts)',
        '',
        `Export failed: ${message}`
      ].join('\n')
      return { step: this.name, success: true, degraded: true, output }
    }

    const output = [
      `# Export package: ${context.story.title}`,
      `Story ID: ${context.story.id}`,
      exportPath
        ? `Video: ${exportPath}`
        : 'Video: (not generated — call media.export separately)',
      '',
      summary || '(no prior artifacts)'
    ].join('\n')

    return { step: this.name, success: true, degraded, output }
  }
}
