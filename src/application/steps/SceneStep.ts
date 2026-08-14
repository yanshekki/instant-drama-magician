import type { PipelineContext, PipelineStep, PipelineStepResult } from '../../types/domain'
import { chatContentText } from '../../types/domain'
import { PromptCatalog } from '../../prompts'
import { assembleSystemPrompt } from '../../domain/promptTemplates'

export class SceneStep implements PipelineStep {
  readonly name = 'scene' as const

  async run(context: PipelineContext): Promise<PipelineStepResult> {
    const { story, ai } = context
    if (story.scenes.length === 0) {
      return {
        step: this.name,
        success: true,
        output: 'No scenes defined — skipping scene expansion.'
      }
    }

    const plan = story.scenes
      .map(
        (s) =>
          `Scene ${s.sceneNumber} [${s.status}]: ${s.description}${
            s.script ? `\n  Script:\n${s.script}` : ''
          }`
      )
      .join('\n')

    try {
      const status = await ai.getStatus()
      if (!status.available) {
        return {
          step: this.name,
          success: true,
          degraded: true,
          output: `Scene plan (offline):\n${plan}`
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
                'pipeline.scene.system'
              )
            })
          },
          {
            role: 'user',
            content: `Story "${story.title}" scenes:\n${plan}\n\nList visual beats per scene.`
          }
        ]
      })

      return {
        step: this.name,
        success: true,
        output: chatContentText(completion.choices[0]?.message.content) || plan
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { step: this.name, success: false, error: message }
    }
  }
}
