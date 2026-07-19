import type { PipelineContext, PipelineStep, PipelineStepResult } from '../../types/domain'
import { chatContentText } from '../../types/domain'

export class ScriptStep implements PipelineStep {
  readonly name = 'script' as const

  async run(context: PipelineContext): Promise<PipelineStepResult> {
    const { story, ai, persistence } = context
    const sceneHints = story.scenes
      .map((s) => `Scene ${s.sceneNumber} [id=${s.id}]: ${s.description}`)
      .join('\n')

    try {
      const status = await ai.getStatus()
      if (!status.available) {
        const fallback = story.scenes
          .map(
            (s) =>
              `## Scene ${s.sceneNumber}\n${s.description}\n\n[Placeholder dialogue — Grok CLI offline]`
          )
          .join('\n\n')

        for (const scene of story.scenes) {
          const piece = `INT. — ${scene.description}\n\nCHARACTER\n(placeholder)\nOffline script seed.`
          await persistence?.updateSceneScript?.(scene.id, piece, 'PENDING')
        }

        return {
          step: this.name,
          success: true,
          degraded: true,
          output: fallback || `(no scenes)\n${status.message}`
        }
      }

      const completion = await ai.chat({
        messages: [
          {
            role: 'system',
            content:
              'You are a professional short-drama screenwriter. For each scene, write a compact screenplay block suitable for AI video clips under 10 seconds. Format every scene as:\n### SCENE <number> | id=<id>\n<script body>'
          },
          {
            role: 'user',
            content: `Story: "${story.title}"\n\nCharacters: ${
              story.characters.map((c) => `${c.name}: ${c.description}`).join('; ') ||
              '(none)'
            }\n\nProps: ${
              story.props.map((p) => p.name).join(', ') || '(none)'
            }\n\nScenes:\n${sceneHints || '(none — invent 2 short scenes)'}`
          }
        ],
        temperature: 0.7,
        max_tokens: 3000
      })

      const output = chatContentText(completion.choices[0]?.message.content)

      // Write back per-scene scripts when ids are present
      for (const scene of story.scenes) {
        const re = new RegExp(
          `###\\s*SCENE\\s*${scene.sceneNumber}[^\\n]*id=${scene.id}[^\\n]*\\n([\\s\\S]*?)(?=###\\s*SCENE|$)`,
          'i'
        )
        const alt = new RegExp(
          `###\\s*SCENE\\s*${scene.sceneNumber}[^\\n]*\\n([\\s\\S]*?)(?=###\\s*SCENE|$)`,
          'i'
        )
        const match = output.match(re) ?? output.match(alt)
        if (match?.[1]) {
          await persistence?.updateSceneScript?.(
            scene.id,
            match[1].trim(),
            'COMPLETED'
          )
        }
      }

      return { step: this.name, success: true, output }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { step: this.name, success: false, error: message }
    }
  }
}
