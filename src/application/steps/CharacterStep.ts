import type { PipelineContext, PipelineStep, PipelineStepResult } from '../../types/domain'

export class CharacterStep implements PipelineStep {
  readonly name = 'character' as const

  async run(context: PipelineContext): Promise<PipelineStepResult> {
    const { story } = context
    const lines = story.characters.map((c) => {
      const soul = c.soulMdPath ? ` [soul.md: ${c.soulMdPath}]` : ''
      return `- ${c.name}: ${c.description}${soul}`
    })

    const output =
      lines.length > 0
        ? `Character bible ready:\n${lines.join('\n')}`
        : 'No characters defined — skipping character refinement.'

    return { step: this.name, success: true, output }
  }
}
