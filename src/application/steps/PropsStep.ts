import type { PipelineContext, PipelineStep, PipelineStepResult } from '../../types/domain'
import { chatContentText } from '../../types/domain'
import { PromptCatalog } from '../../prompts'
import { assembleSystemPrompt } from '../../domain/promptTemplates'

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
            content: assembleSystemPrompt({
              locale: context.locale || 'zh-HK',
              templateId: context.promptTemplateId,
              family: 'copy',
              base: PromptCatalog.t(
                context.locale || 'zh-HK',
                'pipeline.props.system'
              )
            })
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
        output:
          chatContentText(completion.choices[0]?.message.content) || inventory
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { step: this.name, success: false, error: message }
    }
  }
}
