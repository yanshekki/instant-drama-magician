import type { PipelineContext, PipelineStep, PipelineStepResult } from '../../types/domain'
import { DEFAULT_MAX_CLIP_SECONDS } from '../../domain/timeline'

export class TimelineStep implements PipelineStep {
  readonly name = 'timeline' as const

  async run(context: PipelineContext): Promise<PipelineStepResult> {
    const { story, persistence } = context
    const existing = [...story.timeline].sort((a, b) => a.order - b.order)

    // If timeline already has entries, summarize without overwriting
    if (existing.length > 0) {
      const lines = existing.map((e) => {
        const refs = [
          e.characterId ? `char:${e.characterId}` : null,
          e.sceneId ? `scene:${e.sceneId}` : null,
          e.propId ? `prop:${e.propId}` : null
        ]
          .filter(Boolean)
          .join(', ')
        return `[${e.startTime.toFixed(1)}s–${e.endTime.toFixed(1)}s] order=${e.order} ${refs}${
          e.dialogue ? ` | "${e.dialogue}"` : ''
        }`
      })
      const total = existing.reduce((max, e) => Math.max(max, e.endTime), 0)
      return {
        step: this.name,
        success: true,
        output: `Existing linear timeline (${total.toFixed(1)}s):\n${lines.join('\n')}`
      }
    }

    // Auto-suggest clips from scenes (each <= max AI clip length)
    const duration = Math.min(DEFAULT_MAX_CLIP_SECONDS, 6)
    const suggestions = story.scenes.map((scene, index) => {
      const startTime = index * duration
      return {
        startTime,
        endTime: startTime + duration,
        sceneId: scene.id,
        characterId: story.characters[0]?.id ?? null,
        dialogue: scene.script?.split('\n').find((l) => l.trim().length > 0) ?? null,
        order: index
      }
    })

    if (suggestions.length > 0 && persistence?.replaceTimelineSuggestions) {
      await persistence.replaceTimelineSuggestions(story.id, suggestions)
    }

    if (suggestions.length === 0) {
      return {
        step: this.name,
        success: true,
        output: 'No timeline entries and no scenes — schedule empty.'
      }
    }

    const lines = suggestions.map(
      (e) =>
        `[${e.startTime.toFixed(1)}s–${e.endTime.toFixed(1)}s] scene=${e.sceneId} order=${e.order}`
    )
    return {
      step: this.name,
      success: true,
      output: `Suggested linear timeline (${suggestions.length} clips, ${duration}s each):\n${lines.join('\n')}`
    }
  }
}
