import type { PipelineContext, PipelineStep, PipelineStepResult } from '../../types/domain'

export class TimelineStep implements PipelineStep {
  readonly name = 'timeline' as const

  async run(context: PipelineContext): Promise<PipelineStepResult> {
    const { story } = context
    const entries = [...story.timeline].sort((a, b) => a.order - b.order)

    if (entries.length === 0) {
      return {
        step: this.name,
        success: true,
        output: 'No timeline entries — linear schedule empty.'
      }
    }

    const lines = entries.map((e) => {
      const refs = [
        e.characterId ? `char:${e.characterId}` : null,
        e.sceneId ? `scene:${e.sceneId}` : null,
        e.propId ? `prop:${e.propId}` : null
      ]
        .filter(Boolean)
        .join(', ')

      return `[${e.startTime.toFixed(1)}s–${e.endTime.toFixed(1)}s] order=${e.order} ${refs}${e.dialogue ? ` | "${e.dialogue}"` : ''}`
    })

    const total = entries.reduce(
      (max, e) => Math.max(max, e.endTime),
      0
    )

    return {
      step: this.name,
      success: true,
      output: `Linear timeline (${total.toFixed(1)}s total):\n${lines.join('\n')}`
    }
  }
}
