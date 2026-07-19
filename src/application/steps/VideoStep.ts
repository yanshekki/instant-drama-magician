import type { PipelineContext, PipelineStep, PipelineStepResult } from '../../types/domain'
import { DEFAULT_MAX_CLIP_SECONDS } from '../../domain/timeline'
import { snapVideoSeconds } from '../../domain/videoDuration'
import {
  buildClipPrompt,
  previousClipContext,
  resolveClipRefImage,
  getPreviousTimelineEntry,
  buildContinuityLockPrompt,
  timelineBeatDisplayIndex
} from '../../domain/promptContinuity'
import { existsSync } from 'fs'
import { characterVideoPromptBlock } from '../../domain/characterMasterPrompt'
import {
  beatContentToClipPromptBlock,
  parseBeatContent
} from '../../domain/beatContent'
import { buildClipVideoPolishUserPrompt } from '../../domain/videoPromptPolish'
import { polishThenGenerateVideo } from '../video/polishVideoPrompt'
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
        const prevEntry = getPreviousTimelineEntry(entries, entry.id)
        let previousContinuityPath: string | null = null
        let prevBeatIndex = 0
        if (prevEntry) {
          prevBeatIndex = timelineBeatDisplayIndex(entries, prevEntry.id)
          const contPath =
            media?.clipContinuityStillPath?.(story.id, prevEntry.id) ?? null
          if (contPath && existsSync(contPath)) {
            previousContinuityPath = contPath
          }
        }
        const sameCharacter = Boolean(
          character &&
            prevEntry?.characterId &&
            character.id === prevEntry.characterId
        )
        const sameScene = Boolean(
          scene && prevEntry?.sceneId && scene.id === prevEntry.sceneId
        )
        const continuityLock = prevEntry
          ? buildContinuityLockPrompt({
              previousBeatIndex: prevBeatIndex,
              previousDialogueSnippet: prev,
              sameCharacter,
              sameScene,
              hasContinuityImage: Boolean(previousContinuityPath)
            })
          : null
        const prevWithLock = [prev, continuityLock].filter(Boolean).join('\n')
        const parseLangs = (c: NonNullable<typeof character>): string[] | undefined => {
          try {
            const raw = (c as { spokenLanguages?: string | null }).spokenLanguages
            if (!raw?.trim()) return undefined
            const parsed = JSON.parse(raw) as unknown
            return Array.isArray(parsed)
              ? parsed.filter((x): x is string => typeof x === 'string')
              : undefined
          } catch {
            return undefined
          }
        }
        const charBlock = character
          ? characterVideoPromptBlock({
              name: character.name,
              description: character.description,
              ageRange: character.ageRange ?? undefined,
              gender: character.gender ?? undefined,
              appearance: character.appearance ?? character.description,
              costume: character.costume ?? undefined,
              personality: character.personality ?? undefined,
              backstory: character.backstory ?? undefined,
              relationships: character.relationships ?? undefined,
              mannerisms: character.mannerisms ?? undefined,
              voiceDesc: character.voiceDesc ?? undefined,
              visualTags: character.visualTags ?? undefined,
              artStyle:
                (character as { artStyle?: string | null }).artStyle ?? undefined,
              spokenLanguages: parseLangs(character)
            })
          : null
        const beatOrDialogue =
          beatContentToClipPromptBlock(
            parseBeatContent(
              entry.dialogue,
              (entry as { beatContentJson?: string | null }).beatContentJson
            ),
            entry.dialogue
          ) || entry.dialogue || null
        const fallbackPrompt = [
          buildClipPrompt({
            storyTitle: story.title,
            styleNote: story.styleNote,
            character,
            scene,
            prop,
            dialogue: entry.dialogue,
            beatContentJson: (entry as { beatContentJson?: string | null })
              .beatContentJson,
            seconds,
            previousContext: prevWithLock || prev
          }),
          charBlock
        ]
          .filter(Boolean)
          .join('\n')

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
          const ref = resolveClipRefImage({
            character,
            scene,
            prop,
            previousContinuityPath
          })
          const locale = 'zh-HK' as const
          const result = await polishThenGenerateVideo({
            ai,
            locale,
            fallbackPrompt,
            polishUserContent: buildClipVideoPolishUserPrompt({
              locale,
              seconds,
              aspectRatio: context.aspectRatio,
              hasRefImage: Boolean(ref?.path),
              fallbackPrompt,
              storyTitle: story.title,
              styleNote: story.styleNote,
              characterBlocks: charBlock ? [charBlock] : [],
              sceneBlock: scene
                ? [
                    `#${scene.sceneNumber} ${scene.title || ''}`,
                    scene.description,
                    scene.mood ? `mood: ${scene.mood}` : null
                  ]
                    .filter(Boolean)
                    .join('\n')
                : null,
              propBlock: prop ? `${prop.name}: ${prop.description}` : null,
              beatOrDialogue,
              previousContext: prevWithLock || prev
            }),
            videoRequest: {
              durationSeconds: seconds,
              refImagePath: ref?.path,
              outputPath,
              aspectRatio: context.aspectRatio
            },
            signal
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
            line: `✓ ${entry.id} ${seconds}s → ${result.outputPath}${result.jobId ? ` job=${result.jobId}` : ''}${result.degraded ? ' (stub)' : ''}${result.polished ? ' (llm-prompt)' : ' (template)'}`
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
