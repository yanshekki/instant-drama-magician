import type { PipelineContext, PipelineStep, PipelineStepResult } from '../../types/domain'
import { DEFAULT_MAX_CLIP_SECONDS } from '../../domain/timeline'
import { snapVideoSeconds } from '../../domain/videoDuration'
import { buildClipPrompt, getPreviousTimelineEntry } from '../../domain/promptContinuity'
import { buildClipContinuityContext } from '../../domain/clipContinuityContext'
import {
  coerceContinuityMode,
  coerceMotionPriority,
  effectiveVideoConcurrency
} from '../../domain/generationModes'
import {
  auditChainEndWait,
  auditContinuityWriteFailed,
  auditGrokVoicesDropped,
  auditMissingEndFrame
} from '../../domain/generationAudit'
import { AppError } from '../../types/errors'
import { existsSync } from 'fs'
import { characterVideoPromptBlock } from '../../domain/characterMasterPrompt'
import {
  beatContentToClipPromptBlock,
  parseBeatContent
} from '../../domain/beatContent'
import { buildClipVideoPolishUserPrompt } from '../../domain/videoPromptPolish'
import { polishThenGenerateVideo } from '../video/polishVideoPrompt'
import { mapGrokClipVoices } from '../../domain/grokVideoVoices'
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
    const actionMap = new Map(
      (story.actions ?? []).map((a) => [a.id, a] as const)
    )

    const lines: string[] = []
    let degraded = false
    let failures = 0
    const continuityMode = coerceContinuityMode(context.continuityMode)
    const motionPriority = coerceMotionPriority(context.motionPriority)
    const concurrency = effectiveVideoConcurrency(
      context.videoConcurrency,
      continuityMode
    )

    const results = await mapPool(
      targets,
      concurrency,
      async (entry, i) => {
        if (signal?.aborted) throw new AppError('CANCELLED', 'errors.cancelled')

        const clipDur = Math.min(
          DEFAULT_MAX_CLIP_SECONDS,
          Math.max(0.5, entry.endTime - entry.startTime)
        )
        const seconds = snapVideoSeconds(clipDur)
        const charIds = [
          entry.characterId,
          ...((entry as { characterIds?: string[] }).characterIds ?? [])
        ].filter(Boolean) as string[]
        const sceneIds = [
          entry.sceneId,
          ...((entry as { sceneIds?: string[] }).sceneIds ?? [])
        ].filter(Boolean) as string[]
        const propIds = [
          entry.propId,
          ...((entry as { propIds?: string[] }).propIds ?? [])
        ].filter(Boolean) as string[]
        const actionIds = [
          entry.actionId,
          ...((entry as { actionIds?: string[] }).actionIds ?? [])
        ].filter(Boolean) as string[]
        const charsBound = charIds
          .map((id) => charMap.get(id))
          .filter(Boolean) as NonNullable<ReturnType<typeof charMap.get>>[]
        const scenesBound = sceneIds
          .map((id) => sceneMap.get(id))
          .filter(Boolean) as NonNullable<ReturnType<typeof sceneMap.get>>[]
        const propsBound = propIds
          .map((id) => propMap.get(id))
          .filter(Boolean) as NonNullable<ReturnType<typeof propMap.get>>[]
        const actionsBound = actionIds
          .map((id) => actionMap.get(id))
          .filter(Boolean) as NonNullable<ReturnType<typeof actionMap.get>>[]
        const character = charsBound[0]
        const scene = scenesBound[0]
        const prop = propsBound[0]
        const action = actionsBound[0]
        const prevEntry = getPreviousTimelineEntry(entries, entry.id)
        let previousContinuityPath: string | null = null
        if (prevEntry) {
          const contPath =
            media?.clipContinuityStillPath?.(story.id, prevEntry.id) ?? null
          if (contPath && existsSync(contPath)) {
            previousContinuityPath = contPath
          }
        }
        const cont = buildClipContinuityContext({
          entries,
          currentId: entry.id,
          character,
          scene,
          prop,
          action: action
            ? { refImagePath: action.refImagePath ?? null }
            : null,
          extraActionPaths: actionsBound
            .slice(1)
            .map((a) => a.refImagePath ?? null),
          maps: {
            characters: charMap,
            scenes: sceneMap,
            props: propMap
          },
          previousContinuityPath,
          continuityMode,
          motionPriority,
          locale: context.locale || 'zh-HK',
          pathExists: (p) => existsSync(p),
          ownStillPath: media?.clipContinuityStillPath?.(story.id, entry.id)
        })
        if (cont.missingEndFrame) {
          context.onAudit?.(
            auditMissingEndFrame({
              entryId: entry.id,
              previousBeatIndex: cont.previousBeatIndex
            })
          )
        }
        if (cont.sequentialRequired && i > 0) {
          context.onAudit?.(auditChainEndWait({ entryId: entry.id }))
        }
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
        const { collectTimelineHardRules, ensureHardRules } = await import(
          '../../domain/promptHardRules'
        )
        const { resolveGenerationLocale } = await import(
          '../../domain/generationLocale'
        )
        const genLocale = resolveGenerationLocale({
          spokenLanguages: character
            ? (character as { spokenLanguages?: string | null }).spokenLanguages
            : null,
          uiLanguage: context.locale || 'zh-HK'
        })
        const clipHardRules = collectTimelineHardRules(
          {
            story: story as { hardRules?: string | null; title?: string | null },
            characters: charsBound,
            scenes: scenesBound,
            props: propsBound,
            actions: actionsBound
          },
          { uiLocale: genLocale }
        )
        const fallbackPrompt = ensureHardRules(
          [
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
              previousContext: cont.prevWithLock || cont.previousContext,
              locale: genLocale
            }),
            charBlock
          ]
            .filter(Boolean)
            .join('\n'),
          clipHardRules,
          genLocale
        )

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
          status: 'GENERATING',
          waitingPrevious: Boolean(cont.sequentialRequired && i > 0)
        })

        try {
          const refPath = cont.editBase
          const locale = genLocale
          let videoRef = refPath
          const stillOut = media?.clipContinuityStillPath?.(story.id, entry.id)
          if (
            stillOut &&
            typeof (ai as { generateImage?: unknown }).generateImage ===
              'function' &&
            typeof (ai as { editImage?: unknown }).editImage === 'function'
          ) {
            try {
              const { ensureTimelineClipStill } = await import(
                '../video/ensureTimelineClipStill'
              )
              const { timelineBeatDisplayIndex } = await import(
                '../../domain/promptContinuity'
              )
              const ensured = await ensureTimelineClipStill({
                ai,
                outputPath: stillOut,
                skipIfExists: true,
                locale,
                aspectRatio: context.aspectRatio,
                hardRules: clipHardRules,
                promptTemplateId: context.promptTemplateId,
                signal,
                sourceImagePath: refPath,
                storyTitle: story.title,
                displayIndex: timelineBeatDisplayIndex(entries, entry.id),
                dialogue: entry.dialogue,
                beatBlock: beatOrDialogue,
                previousContinuityPath: cont.previousContinuityPath,
                previousBeatIndex: cont.previousBeatIndex,
                continuityLockText: cont.continuityLock,
                characters: charsBound.map((c) => ({
                  id: c.id,
                  name: c.name,
                  imagePath: c.refImagePath ?? null
                })),
                scenes: scenesBound.map((s) => ({
                  id: s.id,
                  name: s.title || s.description,
                  imagePath: s.refImagePath ?? null
                })),
                props: propsBound.map((p) => ({
                  id: p.id,
                  name: p.name,
                  imagePath: p.refImagePath ?? null
                })),
                actions: actionsBound.map((a) => ({
                  id: a.id,
                  name: a.name,
                  imagePath: a.refImagePath ?? null
                })),
                continuityMode,
                motionPriority,
                styleNote: story.styleNote,
                durationSeconds: seconds,
                fallbackPrompt
              })
              if (ensured.stillPath) {
                videoRef =
                  continuityMode === 'chain-end' && refPath
                    ? refPath
                    : ensured.stillPath
              }
            } catch {
              /* keep editBase */
            }
          }
          let lastFramePath = cont.lastFramePath ?? undefined
          if (
            continuityMode === 'chain-end' &&
            stillOut &&
            existsSync(stillOut) &&
            stillOut !== previousContinuityPath
          ) {
            lastFramePath = stillOut
          }
          const result = await polishThenGenerateVideo({
            ai,
            locale,
            fallbackPrompt,
            hardRules: clipHardRules,
            promptTemplateId: context.promptTemplateId,
            polishUserContent: buildClipVideoPolishUserPrompt({
              locale,
              seconds,
              aspectRatio: context.aspectRatio,
              hasRefImage: Boolean(refPath),
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
              actionBlock: action
                ? `Motion guide "${action.name}": ${action.description || ''}`
                : null,
              hardRules: clipHardRules,
              beatOrDialogue,
              previousContext: cont.prevWithLock || cont.previousContext
            }),
            videoRequest: {
              durationSeconds: seconds,
              refImagePath: videoRef ?? undefined,
              lastFramePath,
              generateAudio: context.generateAudio === true,
              voices:
                context.generateAudio === true
                  ? mapGrokClipVoices(
                      charsBound.map((c) => ({
                        gender: c.gender,
                        voiceDesc: c.voiceDesc
                      })),
                      context.grokVideoVoice
                    )
                  : undefined,
              outputPath,
              aspectRatio: context.aspectRatio
            },
            signal
          })
          if (result.voicesDropped) {
            context.onAudit?.(auditGrokVoicesDropped({ entryId: entry.id }))
          }
          await persistence?.updateEntryMedia?.(entry.id, {
            mediaPath: result.outputPath,
            mediaStatus: 'READY',
            mediaError: null,
            videoJobId: result.jobId ?? null
          })
          // End-frame continuity for next beat (best-effort)
          try {
            const contFn = media?.clipContinuityStillPath
            if (contFn && result.outputPath) {
              const { writeClipContinuityStillFromVideo } = await import(
                '../video/writeClipContinuityStill'
              )
              const { FfmpegService } = await import(
                '../../infrastructure/ffmpeg/FfmpegService'
              )
              await writeClipContinuityStillFromVideo({
                ffmpeg: new FfmpegService(),
                store: {
                  ensureStoryDirs: () => undefined,
                  clipContinuityStillPath: (sid: string, eid: string) =>
                    contFn(sid, eid),
                  isEntryStillUserCleared: () => false
                } as never,
                storyId: story.id,
                entryId: entry.id,
                videoPath: result.outputPath,
                skipIfUserCleared: false
              }).then((written) => {
                if (!written) {
                  context.onAudit?.(auditContinuityWriteFailed({ entryId: entry.id }))
                }
              })
            }
          } catch {
            /* best-effort */
          }
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
      if (error instanceof Error && error.message === 'errors.cancelled') return null
      throw error
    })

    if (results === null) {
      return {
        step: this.name,
        success: false,
        error: 'errors.cancelled',
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
