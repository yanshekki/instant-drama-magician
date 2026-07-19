import type { PipelineContext, PipelineStep, PipelineStepResult } from '../../types/domain'
import { chatContentText } from '../../types/domain'

export class CharacterStep implements PipelineStep {
  readonly name = 'character' as const

  async run(context: PipelineContext): Promise<PipelineStepResult> {
    const { story, ai } = context
    if (story.characters.length === 0) {
      return {
        step: this.name,
        success: true,
        output: 'No characters defined — skipping character refinement.'
      }
    }

    const bible = story.characters
      .map((c) => {
        const soul = c.soulMdPath ? ` [soul.md: ${c.soulMdPath}]` : ''
        return `- ${c.name}: ${c.description}${soul}`
      })
      .join('\n')

    try {
      const status = await ai.getStatus()
      if (!status.available) {
        return {
          step: this.name,
          success: true,
          degraded: true,
          output: `Character bible (offline):\n${bible}`
        }
      }

      const completion = await ai.chat({
        messages: [
          {
            role: 'system',
            content:
              'You refine character bibles for short-form AI video drama. Keep each character to 3-5 lines: look, voice, motivation, signature gesture.'
          },
          {
            role: 'user',
            content: `Story "${story.title}" characters:\n${bible}\n\nProduce a tightened consistency bible.`
          }
        ]
      })

      const output =
        chatContentText(completion.choices[0]?.message.content) || bible
      return { step: this.name, success: true, output }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { step: this.name, success: false, error: message }
    }
  }
}
