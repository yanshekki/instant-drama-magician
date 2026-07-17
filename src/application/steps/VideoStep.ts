import type { PipelineContext, PipelineStep, PipelineStepResult } from '../../types/domain'
import { DEFAULT_MAX_CLIP_SECONDS } from '../../domain/timeline'
import { snapVideoSeconds } from '../../domain/videoDuration'
import {
  buildClipPrompt,
  previousClipContext
} from '../../domain/promptContinuity'
import { mapPool } from '../../infrastructure/ai/video/httpUtils'

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
    const concurrency = Math.max(1, context.videoConcurrency ?? 1)

    const results = await mapPool(
      targets,
      concurrency,
      async (entry, i) => {
        if (signal?.aborted) throw new Error('Cancelled')

        const clipDur = Math.min(
          DEFAULT_MAX_CLIP_SECONDS,
          Math.max(0.5, entry.endTime - entry.startTime)
        )
        const seconds = snapVideoSeconds(clipDur)
        const character = entry.characterId ? charMap.get(entry.characterId) : undefined
        const scene = entry.sceneId ? sceneMap.get(entry.sceneId) : undefined
        const prop = entry.propId ? propMap.get(entry.propId) : undefined
        const prev = previousClipContext(entries, entry.id, {
          characters: charMap,
          scenes: sceneMap,
          props: propMap
        })
        const prompt = buildClipPrompt({
          storyTitle: story.title,
          styleNote: story.styleNote,
          character,
          scene,
          prop,
          dialogue: entry.dialogue,
          seconds,
          previousContext: prev
        })

        const outputPath =
          media?.clipOutputPath?.(story.id, entry.id) ?? `/tmp/idm-${entry.id}.mp4`

        await persistence?.updateEntryMedia?.(entry.id, {
          mediaStatus: 'GENERATING',
          mediaError: null,
          videoJobId: null
        })
        onClipProgress?.({
          entryId: entry.id,
          index: i,
          total: targets.length,
          status: 'GENERATING'
        })

        try {
          const result = await ai.generateVideo!({
            prompt,
            durationSeconds: seconds,
            refImagePath: character?.refImagePath,
            outputPath,
            aspectRatio: context.aspectRatio
          })
          await persistence?.updateEntryMedia?.(entry.id, {
            mediaPath: result.outputPath,
            mediaStatus: 'READY',
            mediaError: null,
            videoJobId: result.jobId ?? null
          })
          onClipProgress?.({
            entryId: entry.id,
            index: i,
            total: targets.length,
            status: 'READY',
            jobId: result.jobId
          })
          return {
            ok: true as const,
            degraded: Boolean(result.degraded),
            line: `✓ ${entry.id} ${seconds}s → ${result.outputPath}${result.jobId ? ` job=${result.jobId}` : ''}${result.degraded ? ' (stub)' : ''}`
          }
        } catch (error) {
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
          return { ok: false as const, degraded: false, line: `✗ ${entry.id}: ${message}` }
        }
      },
      () => Boolean(signal?.aborted)
    ).catch((error) => {
      if (error instanceof Error && error.message === 'Cancelled') return null
      throw error
    })

    if (results === null) {
      return {
        step: this.name,
        success: false,
        error: 'Cancelled',
        output: lines.join('\n')
      }
    }

    for (const r of results) {
      lines.push(r.line)
      if (!r.ok) failures += 1
      if (r.degraded) degraded = true
    }

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
      output: `Video clips: ${targets.length - failures}/${targets.length} ready (concurrency=${concurrency}, seconds=6|10)\n${lines.join('\n')}`,
      error: failures === targets.length ? 'All clip generations failed' : undefined
    }
  }
}
