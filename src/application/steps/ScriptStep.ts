import type { PipelineContext, PipelineStep, PipelineStepResult } from '../../types/domain'

export class ScriptStep implements PipelineStep {
  readonly name = 'script' as const

  async run(context: PipelineContext): Promise<PipelineStepResult> {
    const { story, ai } = context
    const sceneHints = story.scenes
      .map((s) => `Scene ${s.sceneNumber}: ${s.description}`)
      .join('\n')

    try {
      const status = await ai.getStatus()
      if (!status.available) {
        // Offline-friendly skeleton output when Grok CLI is not running
        const fallback = [
          `# Script: ${story.title}`,
          '',
          sceneHints || 'No scenes defined yet.',
          '',
          '(Grok CLI offline — placeholder script generated.)'
        ].join('\n')
        return { step: this.name, success: true, output: fallback }
      }

      const completion = await ai.chat({
        messages: [
          {
            role: 'system',
            content:
              'You are a professional short-drama screenwriter. Write concise scene-by-scene scripts suitable for AI video generation with strict duration limits.'
          },
          {
            role: 'user',
            content: `Write a short-drama script for the story "${story.title}".\n\nExisting scenes:\n${sceneHints || '(none)'}\n\nCharacters: ${story.characters.map((c) => c.name).join(', ') || '(none)'}`
          }
        ]
      })

      const output = completion.choices[0]?.message.content ?? ''
      return { step: this.name, success: true, output }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { step: this.name, success: false, error: message }
    }
  }
}
