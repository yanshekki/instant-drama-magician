import type { PipelineContext, PipelineStep, PipelineStepResult } from '../../types/domain'
import { DEFAULT_MAX_CLIP_SECONDS } from '../../domain/timeline'

export class VideoStep implements PipelineStep {
  readonly name = 'video' as const

  async run(context: PipelineContext): Promise<PipelineStepResult> {
    const { story, ai, persistence, media, signal, onlyFailedVideos, onClipProgress } =
      context

    const entries = [...story.timeline].sort((a, b) => a.order - b.order)
    if (entries.length === 0) {
      return {
        step: this.name,
        success: true,
        output: 'No timeline entries — skip video generation.'
      }
    }

    if (!ai.generateVideo) {
      return {
        step: this.name,
        success: true,
        degraded: true,
        output: 'AI provider has no generateVideo — skipped.'
      }
    }

    const targets = onlyFailedVideos
      ? entries.filter((e) => e.mediaStatus === 'FAILED' || e.mediaStatus === 'EMPTY')
      : entries

    if (targets.length === 0) {
      return {
        step: this.name,
        success: true,
        output: 'No clips need video generation.'
      }
    }

    const charMap = new Map(story.characters.map((c) => [c.id, c]))
    const sceneMap = new Map(story.scenes.map((s) => [s.id, s]))
    const propMap = new Map(story.props.map((p) => [p.id, p]))

    const lines: string[] = []
    let degraded = false
    let failures = 0

    for (let i = 0; i < targets.length; i++) {
      if (signal?.aborted) {
        return {
          step: this.name,
          success: false,
          error: 'Cancelled',
          output: lines.join('\n')
        }
      }

      const entry = targets[i]
      const duration = Math.min(
        DEFAULT_MAX_CLIP_SECONDS,
        Math.max(0.5, entry.endTime - entry.startTime)
      )
      const character = entry.characterId ? charMap.get(entry.characterId) : undefined
      const scene = entry.sceneId ? sceneMap.get(entry.sceneId) : undefined
      const prop = entry.propId ? propMap.get(entry.propId) : undefined

      const prompt = [
        `Short drama clip for story "${story.title}".`,
        character ? `Character: ${character.name} — ${character.description}` : null,
        scene ? `Scene #${scene.sceneNumber}: ${scene.description}` : null,
        scene?.script ? `Script: ${scene.script.slice(0, 400)}` : null,
        prop ? `Prop: ${prop.name}` : null,
        entry.dialogue ? `Dialogue: ${entry.dialogue}` : null,
        `Duration: ${duration.toFixed(1)}s. Cinematic, continuous action.`
      ]
        .filter(Boolean)
        .join('\n')

      const outputPath =
        media?.clipOutputPath?.(story.id, entry.id) ??
        `/tmp/idm-${entry.id}.mp4`

      await persistence?.updateEntryMedia?.(entry.id, {
        mediaStatus: 'GENERATING',
        mediaError: null
      })
      onClipProgress?.({
        entryId: entry.id,
        index: i,
        total: targets.length,
        status: 'GENERATING'
      })

      try {
        const result = await ai.generateVideo({
          prompt,
          durationSeconds: duration,
          refImagePath: character?.refImagePath,
          outputPath
        })
        if (result.degraded) degraded = true
        await persistence?.updateEntryMedia?.(entry.id, {
          mediaPath: result.outputPath,
          mediaStatus: 'READY',
          mediaError: null
        })
        onClipProgress?.({
          entryId: entry.id,
          index: i,
          total: targets.length,
          status: 'READY'
        })
        lines.push(
          `✓ ${entry.id} → ${result.outputPath}${result.degraded ? ' (stub)' : ''}`
        )
      } catch (error) {
        failures += 1
        const message = error instanceof Error ? error.message : String(error)
        await persistence?.updateEntryMedia?.(entry.id, {
          mediaStatus: 'FAILED',
          mediaError: message
        })
        onClipProgress?.({
          entryId: entry.id,
          index: i,
          total: targets.length,
          status: 'FAILED'
        })
        lines.push(`✗ ${entry.id}: ${message}`)
      }
    }

    // Refresh story timeline in context for export step
    if (persistence?.listTimeline) {
      context.story = {
        ...story,
        timeline: await persistence.listTimeline(story.id)
      }
    }

    return {
      step: this.name,
      success: failures < targets.length || targets.length === 0,
      degraded,
      output: `Video clips: ${targets.length - failures}/${targets.length} ready\n${lines.join('\n')}`,
      error: failures === targets.length ? 'All clip generations failed' : undefined
    }
  }
}
