import type { PipelineContext, PipelineStep, PipelineStepResult } from '../../types/domain'

export class PropsStep implements PipelineStep {
  readonly name = 'props' as const

  async run(context: PipelineContext): Promise<PipelineStepResult> {
    const { story, ai } = context
    if (story.props.length === 0) {
      return {
        step: this.name,
        success: true,
        output: 'No props defined — skipping props pass.'
      }
    }

    const inventory = story.props
      .map((p) => `- ${p.name}: ${p.description}`)
      .join('\n')

    try {
      const status = await ai.getStatus()
      if (!status.available) {
        return {
          step: this.name,
          success: true,
          degraded: true,
          output: `Props inventory (offline):\n${inventory}`
        }
      }

      const completion = await ai.chat({
        messages: [
          {
            role: 'system',
            content:
              'You refine prop continuity notes for short drama production. Note color, size, and when the prop appears.'
          },
          {
            role: 'user',
            content: `Story "${story.title}" props:\n${inventory}`
          }
        ]
      })

      return {
        step: this.name,
        success: true,
        output: completion.choices[0]?.message.content ?? inventory
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { step: this.name, success: false, error: message }
    }
  }
}
