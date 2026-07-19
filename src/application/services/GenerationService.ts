import { copyFileSync, existsSync, mkdirSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import type { PrismaClient } from '../../types/prisma'
import type {
  AIProvider,
  GenerationResult,
  PipelineStepResult,
  StoryDetail,
  TimelineEntry
} from '../../types/domain'
import { snapVideoSeconds } from '../../domain/videoDuration'
import type { AppSettings } from '../../types/settings'
import { DEFAULT_SETTINGS } from '../../types/settings'
import { AppError } from '../../types/errors'
import { canStartGeneration } from '../../domain/story'
import { buildSrt } from '../../domain/subtitle'
import {
  buildClipPrompt,
  previousClipContext,
  getPreviousTimelineEntry,
  buildContinuityLockPrompt,
  timelineBeatDisplayIndex
} from '../../domain/promptContinuity'
import { characterVideoPromptBlock } from '../../domain/characterMasterPrompt'
import { GenerationPipeline } from '../GenerationPipeline'
import { FfmpegService } from '../../infrastructure/ffmpeg/FfmpegService'
import { MediaStore } from '../../infrastructure/media/MediaStore'
import { hydrateTimelineBindings } from '../../domain/timelineBindings'

export type GenerationProgressHandler = (payload: {
  storyId: string
  step: string
  index: number
  total: number
  result?: PipelineStepResult
  entryId?: string
  mediaStatus?: string
  jobId?: string
}) => void

export class GenerationService {
  private pipeline: GenerationPipeline
  private ai: AIProvider
  private readonly ffmpeg: FfmpegService
  private readonly store: MediaStore
  private abort: AbortController | null = null
  private settings: AppSettings

  constructor(
    private readonly prisma: PrismaClient,
    ai: AIProvider,
    options?: {
      pipeline?: GenerationPipeline
      ffmpeg?: FfmpegService
      mediaRoot?: string
      settings?: AppSettings
    }
  ) {
    this.ai = ai
    this.pipeline = options?.pipeline ?? new GenerationPipeline(ai)
    this.ffmpeg = options?.ffmpeg ?? new FfmpegService()
    this.store = new MediaStore(options?.mediaRoot ?? join(process.cwd(), '.media'))
    this.settings = options?.settings ?? { ...DEFAULT_SETTINGS }
  }

  rebindAi(ai: AIProvider, settings?: AppSettings): void {
    this.ai = ai
    this.pipeline = new GenerationPipeline(ai)
    if (settings) this.settings = settings
  }

  cancel(): void {
    this.abort?.abort()
  }

  /**
   * Generate video for a single timeline entry (no full pipeline).
   * Honour cancel() via AbortController.
   */
  async generateClip(
    storyId: string,
    entryId: string,
    onProgress?: GenerationProgressHandler,
    opts?: { revisionPrompt?: string | null }
  ): Promise<{ entryId: string; mediaPath: string; jobId?: string; degraded?: boolean }> {
    if (!this.ai.generateVideo) {
      throw new AppError('AI_UNAVAILABLE', 'AI provider has no generateVideo')
    }
    const story = await this.loadStory(storyId)
    const entry = story.timeline.find((e) => e.id === entryId)
    if (!entry) throw new AppError('NOT_FOUND', `Timeline entry not found: ${entryId}`)

    this.abort = new AbortController()
    const signal = this.abort.signal
    this.store.ensureStoryDirs(storyId)
    const { parseIdList } = await import('../../domain/timelineBindings')
    const raw = entry as {
      characterIds?: string | string[] | null
      sceneIds?: string | string[] | null
      propIds?: string | string[] | null
    }
    const asList = (
      multi: string | string[] | null | undefined,
      primary: string | null
    ): string[] => {
      if (Array.isArray(multi) && multi.length > 0) return multi
      if (typeof multi === 'string') return parseIdList(multi, primary)
      return parseIdList(null, primary)
    }
    const charIdList = asList(raw.characterIds, entry.characterId)
    const sceneIdList = asList(raw.sceneIds, entry.sceneId)
    const propIdList = asList(raw.propIds, entry.propId)
    const chars = charIdList
      .map((id) => story.characters.find((c) => c.id === id))
      .filter(Boolean) as typeof story.characters
    const scenesBound = sceneIdList
      .map((id) => story.scenes.find((s) => s.id === id))
      .filter(Boolean) as typeof story.scenes
    const propsBound = propIdList
      .map((id) => story.props.find((p) => p.id === id))
      .filter(Boolean) as typeof story.props
    const char = chars[0]
    const scene = scenesBound[0]
    const prop = propsBound[0]
    const charMap = new Map(story.characters.map((c) => [c.id, c]))
    const sceneMap = new Map(story.scenes.map((s) => [s.id, s]))
    const propMap = new Map(story.props.map((p) => [p.id, p]))
    const timelineDomain = story.timeline.map((e) =>
      hydrateTimelineBindings(e)
    ) as TimelineEntry[]
    const prev = previousClipContext(timelineDomain, entryId, {
      characters: charMap,
      scenes: sceneMap,
      props: propMap
    })
    const seconds = snapVideoSeconds(entry.endTime - entry.startTime)
    const outputPath = this.store.clipPath(storyId, entryId)

    await this.prisma.timelineEntry.update({
      where: { id: entryId },
      data: { mediaStatus: 'GENERATING', mediaError: null, videoJobId: null }
    })
    onProgress?.({
      storyId,
      step: 'video',
      index: 0,
      total: 1,
      entryId,
      mediaStatus: 'GENERATING'
    })

    try {
      if (signal.aborted) {
        throw new AppError('CANCELLED', 'Cancelled')
      }

      const parseLangs = (c: (typeof chars)[0]): string[] | undefined => {
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
      const charBlocks = chars.map((c) =>
        characterVideoPromptBlock({
          name: c.name,
          description: c.description,
          ageRange: c.ageRange ?? undefined,
          gender: c.gender ?? undefined,
          appearance: c.appearance ?? c.description,
          costume: c.costume ?? undefined,
          personality: c.personality ?? undefined,
          backstory: c.backstory ?? undefined,
          relationships: c.relationships ?? undefined,
          mannerisms: c.mannerisms ?? undefined,
          voiceDesc: c.voiceDesc ?? undefined,
          visualTags: c.visualTags ?? undefined,
          artStyle: (c as { artStyle?: string | null }).artStyle ?? undefined,
          spokenLanguages: parseLangs(c)
        })
      )
      const multiCastNote =
        chars.length > 1 || scenesBound.length > 1 || propsBound.length > 1
          ? [
              'MULTI-SUBJECT CLIP:',
              chars.length
                ? `Characters (primary first): ${chars.map((c) => c.name).join(', ')}.`
                : null,
              scenesBound.length > 1
                ? `Locations: ${scenesBound.map((s) => s.title || s.description.slice(0, 40)).join(' | ')}.`
                : null,
              propsBound.length > 1
                ? `Props: ${propsBound.map((p) => p.name).join(', ')}.`
                : null,
              'Keep all listed subjects visible/consistent; primary character is the action focus.'
            ]
              .filter(Boolean)
              .join(' ')
          : null
      const { resolveClipRefImage, appendRevisionToClipPrompt } = await import(
        '../../domain/promptContinuity'
      )
      const { polishThenGenerateVideo } = await import(
        '../video/polishVideoPrompt'
      )
      const {
        buildClipVideoPolishUserPrompt
      } = await import('../../domain/videoPromptPolish')
      const { beatContentToClipPromptBlock, parseBeatContent } = await import(
        '../../domain/beatContent'
      )
      // Chain from previous beat's continuity keyframe when available.
      const timelineDomain = story.timeline.map((e) =>
        hydrateTimelineBindings(e)
      ) as TimelineEntry[]
      const prevEntry = getPreviousTimelineEntry(timelineDomain, entryId)
      let previousContinuityPath: string | null = null
      let prevBeatIndex = 0
      if (prevEntry) {
        prevBeatIndex = timelineBeatDisplayIndex(timelineDomain, prevEntry.id)
        const contPath = this.store.clipContinuityStillPath(
          storyId,
          prevEntry.id
        )
        if (existsSync(contPath)) {
          previousContinuityPath = contPath
        }
      }
      const sameCharacter = Boolean(
        char &&
          prevEntry?.characterId &&
          char.id === prevEntry.characterId
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
      const beatOrDialogue =
        beatContentToClipPromptBlock(
          parseBeatContent(
            entry.dialogue,
            (entry as { beatContentJson?: string | null }).beatContentJson
          ),
          entry.dialogue
        ) || entry.dialogue || null
      const fallbackPrompt = appendRevisionToClipPrompt(
        [
          buildClipPrompt({
            storyTitle: story.title,
            styleNote: story.styleNote,
            character: char,
            scene,
            prop,
            dialogue: entry.dialogue,
            beatContentJson:
              (entry as { beatContentJson?: string | null }).beatContentJson,
            seconds,
            previousContext: prevWithLock || prev
          }),
          multiCastNote,
          ...charBlocks
        ]
          .filter(Boolean)
          .join('\n'),
        opts?.revisionPrompt
      )
      const ref = resolveClipRefImage({
        character: char,
        scene,
        prop,
        previousContinuityPath
      })
      const locale: 'zh-HK' | 'en' =
        String(this.settings.uiLanguage || '').startsWith('en')
          ? 'en'
          : 'zh-HK'
      onProgress?.({
        storyId,
        step: 'video',
        index: 0,
        total: 1,
        entryId,
        mediaStatus: 'GENERATING',
        jobId: undefined
      })
      const result = await polishThenGenerateVideo({
        ai: this.ai,
        locale,
        fallbackPrompt,
        polishUserContent: buildClipVideoPolishUserPrompt({
          locale,
          seconds,
          aspectRatio: this.settings.aspectRatio,
          hasRefImage: Boolean(ref?.path),
          fallbackPrompt,
          storyTitle: story.title,
          styleNote: story.styleNote,
          characterBlocks: charBlocks,
          sceneBlock: scene
            ? [
                `#${scene.sceneNumber} ${scene.title || ''}`,
                scene.description,
                scene.mood ? `mood: ${scene.mood}` : null,
                scene.lighting ? `lighting: ${scene.lighting}` : null
              ]
                .filter(Boolean)
                .join('\n')
            : null,
          propBlock: prop
            ? `${prop.name}: ${prop.description}`
            : null,
          beatOrDialogue,
          previousContext: prevWithLock || prev,
          multiCastNote,
          revisionPrompt: opts?.revisionPrompt
        }),
        videoRequest: {
          durationSeconds: seconds,
          refImagePath: ref?.path,
          outputPath,
          aspectRatio: this.settings.aspectRatio
        },
        signal,
        onPhase: (phase) => {
          onProgress?.({
            storyId,
            step: phase === 'llm' ? 'video' : 'video',
            index: 0,
            total: 1,
            entryId,
            mediaStatus: phase === 'llm' ? 'QUEUED' : 'GENERATING'
          })
        }
      })

      if (signal.aborted) {
        throw new AppError('CANCELLED', 'Cancelled')
      }

      await this.prisma.timelineEntry.update({
        where: { id: entryId },
        data: {
          mediaPath: result.outputPath,
          mediaStatus: 'READY',
          mediaError: null,
          videoJobId: result.jobId ?? null
        }
      })
      onProgress?.({
        storyId,
        step: 'video',
        index: 0,
        total: 1,
        entryId,
        mediaStatus: 'READY',
        jobId: result.jobId
      })
      return {
        entryId,
        mediaPath: result.outputPath,
        jobId: result.jobId,
        degraded: result.degraded
      }
    } catch (error) {
      const cancelled =
        signal.aborted ||
        (error instanceof AppError && error.code === 'CANCELLED') ||
        (error instanceof Error && /cancell?ed/i.test(error.message))
      const message = cancelled
        ? 'Cancelled'
        : error instanceof Error
          ? error.message
          : String(error)
      await this.prisma.timelineEntry.update({
        where: { id: entryId },
        data: {
          mediaStatus: 'FAILED',
          mediaError: message
        }
      })
      onProgress?.({
        storyId,
        step: 'video',
        index: 0,
        total: 1,
        entryId,
        mediaStatus: 'FAILED'
      })
      if (cancelled) throw new AppError('CANCELLED', 'Cancelled')
      throw error
    } finally {
      this.abort = null
    }
  }

  async exportPreflight(storyId: string): Promise<{
    ffmpeg: boolean
    ffmpegMessage: string
    readyClips: number
    totalClips: number
    willUseFallback: boolean
    warnings: string[]
    canExport: boolean
  }> {
    const story = await this.loadStory(storyId)
    const warnings: string[] = []
    let ffmpeg = true
    let ffmpegMessage = 'ffmpeg OK'
    try {
      await this.ffmpeg.ensureAvailable()
    } catch (error) {
      ffmpeg = false
      ffmpegMessage = error instanceof Error ? error.message : String(error)
      warnings.push(ffmpegMessage)
    }

    const totalClips = story.timeline.length
    const readyClips = story.timeline.filter((e) => e.mediaStatus === 'READY').length
    const willUseFallback = totalClips === 0 || readyClips < totalClips
    if (totalClips === 0) {
      warnings.push('Timeline is empty — export will use a short placeholder.')
    } else if (readyClips === 0) {
      warnings.push('No READY clips — all segments will be color fallbacks.')
    } else if (readyClips < totalClips) {
      warnings.push(
        `${totalClips - readyClips} clip(s) not READY — those will use color fallbacks.`
      )
    }

    return {
      ffmpeg,
      ffmpegMessage,
      readyClips,
      totalClips,
      willUseFallback,
      warnings,
      canExport: ffmpeg
    }
  }

  async run(
    storyId: string,
    onProgress?: GenerationProgressHandler,
    opts?: { onlyFailedVideos?: boolean; interactiveVideo?: boolean }
  ): Promise<GenerationResult> {
    const story = await this.loadStory(storyId)
    if (!canStartGeneration(story.status) && !opts?.onlyFailedVideos) {
      throw new AppError(
        'CONFLICT',
        `Cannot start generation while story status is ${story.status}`
      )
    }

    this.abort = new AbortController()
    await this.prisma.story.update({
      where: { id: storyId },
      data: { status: 'GENERATING' }
    })

    try {
      const detail = story as unknown as StoryDetail
      this.store.ensureStoryDirs(storyId)

      const result = await this.pipeline.run(detail, {
        signal: this.abort.signal,
        onlyFailedVideos: opts?.onlyFailedVideos,
        interactiveVideo: opts?.interactiveVideo,
        videoConcurrency: this.settings.videoConcurrency,
        aspectRatio: this.settings.aspectRatio,
        onStepComplete: (stepResult, index, total) => {
          onProgress?.({
            storyId,
            step: stepResult.step,
            index,
            total,
            result: stepResult
          })
        },
        onClipProgress: (p) => {
          onProgress?.({
            storyId,
            step: 'video',
            index: p.index,
            total: p.total,
            entryId: p.entryId,
            mediaStatus: p.status,
            jobId: p.jobId
          })
        },
        persistence: {
          updateSceneScript: async (sceneId, script, status) => {
            await this.prisma.scene.update({
              where: { id: sceneId },
              data: {
                script,
                ...(status ? { status } : {})
              }
            })
          },
          replaceTimelineSuggestions: async (sid, entries) => {
            await this.prisma.timelineEntry.deleteMany({ where: { storyId: sid } })
            if (entries.length === 0) return
            await this.prisma.timelineEntry.createMany({
              data: entries.map((e) => ({
                storyId: sid,
                startTime: e.startTime,
                endTime: e.endTime,
                sceneId: e.sceneId ?? null,
                characterId: e.characterId ?? null,
                dialogue: e.dialogue ?? null,
                order: e.order
              }))
            })
          },
          setExportPath: async (sid, path) => {
            await this.prisma.story.update({
              where: { id: sid },
              data: { exportPath: path }
            })
          },
          updateEntryMedia: async (entryId, data) => {
            await this.prisma.timelineEntry.update({
              where: { id: entryId },
              data: {
                mediaPath: data.mediaPath === undefined ? undefined : data.mediaPath,
                mediaStatus: data.mediaStatus,
                mediaError: data.mediaError ?? null,
                videoJobId: data.videoJobId === undefined ? undefined : data.videoJobId
              }
            })
          },
          listTimeline: async (sid) => {
            return this.prisma.timelineEntry.findMany({
              where: { storyId: sid },
              orderBy: { order: 'asc' }
            }) as unknown as import('../../types/domain').TimelineEntry[]
          }
        },
        media: {
          clipOutputPath: (sid, entryId) => this.store.clipPath(sid, entryId),
          clipContinuityStillPath: (sid, entryId) =>
            this.store.clipContinuityStillPath(sid, entryId),
          exportStoryboard: async (sid) => {
            const { outputPath } = await this.exportStoryboard(sid)
            return outputPath
          },
          exportConcat: async (sid) => {
            const { outputPath } = await this.exportConcat(sid)
            return outputPath
          }
        }
      })

      const degraded = result.steps.some((s) => s.degraded)
      // Persist degraded flag via settings file is done in main if needed;
      // return steps with degraded for UI.
      await this.prisma.story.update({
        where: { id: storyId },
        data: { status: result.success ? 'COMPLETED' : 'FAILED' }
      })
      void degraded
      return result
    } catch (error) {
      await this.prisma.story.update({
        where: { id: storyId },
        data: { status: 'FAILED' }
      })
      throw error
    } finally {
      this.abort = null
    }
  }

  async exportStoryboard(storyId: string): Promise<{ outputPath: string }> {
    const story = await this.loadStory(storyId)
    const clips = this.mapClips(story)
    const outDir = this.store.exportsDir(storyId)
    const safeTitle = safeAsciiExportName(story.title, storyId)
    const fileName = `${safeTitle}_board_${Date.now()}.mp4`
    const workPath = await this.ffmpeg.exportStoryboard({
      outDir,
      fileName,
      title: story.title,
      clips
    })
    const outputPath = publishExportToVideos(workPath, fileName)
    this.store.recordExportHistory(storyId, {
      kind: 'board',
      path: outputPath,
      workPath,
      fileName
    })
    await this.prisma.story.update({
      where: { id: storyId },
      data: { exportPath: outputPath }
    })
    return { outputPath }
  }

  async exportConcat(storyId: string): Promise<{ outputPath: string }> {
    return this.exportFinal(storyId)
  }

  async listExports(storyId: string): Promise<{
    items: import('../../domain/exportHistory').ExportHistoryItem[]
    latestPath: string | null
  }> {
    const story = await this.prisma.story.findUnique({
      where: { id: storyId },
      select: { id: true, title: true, exportPath: true }
    })
    if (!story) {
      throw new AppError('NOT_FOUND', 'Story not found')
    }
    const prefix = safeAsciiExportName(story.title, storyId)
    const items = this.store.listExportHistory(storyId, {
      publicDir: resolvePublicExportDir(),
      latestPath: story.exportPath,
      fileNamePrefix: prefix
    })
    // Keep manifest in sync with disk discovery
    if (items.length > 0) {
      this.store.writeExportHistory(storyId, items)
    }
    const latestPath =
      (story.exportPath && existsSync(story.exportPath)
        ? story.exportPath
        : null) ||
      items[0]?.path ||
      null
    return { items, latestPath }
  }

  async deleteExport(
    storyId: string,
    exportId: string
  ): Promise<{
    ok: boolean
    items: import('../../domain/exportHistory').ExportHistoryItem[]
    latestPath: string | null
  }> {
    if (!exportId?.trim()) {
      throw new AppError('VALIDATION', 'exportId is required')
    }
    const story = await this.prisma.story.findUnique({
      where: { id: storyId },
      select: { id: true, title: true, exportPath: true }
    })
    if (!story) {
      throw new AppError('NOT_FOUND', 'Story not found')
    }
    const before = this.store.listExportHistory(storyId, {
      publicDir: resolvePublicExportDir(),
      latestPath: story.exportPath,
      fileNamePrefix: safeAsciiExportName(story.title, storyId)
    })
    const target = before.find(
      (h) =>
        h.id === exportId ||
        h.path === exportId ||
        h.fileName === exportId
    )
    const result = this.store.deleteExportHistoryItem(storyId, exportId)
    let latestPath = story.exportPath
    if (
      target &&
      latestPath &&
      (latestPath === target.path ||
        basenameMatch(latestPath, target.fileName))
    ) {
      latestPath = result.remaining[0]?.path ?? null
      await this.prisma.story.update({
        where: { id: storyId },
        data: { exportPath: latestPath }
      })
    }
    const listed = await this.listExports(storyId)
    return {
      ok: result.deleted,
      items: listed.items,
      latestPath: listed.latestPath
    }
  }

  async exportFinal(
    storyId: string,
    options?: Partial<{
      exportProfile: 'balanced' | 'fast'
      burnSubtitles: boolean
      includeSilentAudio: boolean
      bgmVolume: number
      dialogueVolume: number
    }>
  ): Promise<{ outputPath: string }> {
    const story = await this.loadStory(storyId)
    const clips = this.mapClips(story)
    // Work dir under app media (intermediates); final file also copied to ~/Videos
    const outDir = this.store.exportsDir(storyId)
    this.store.ensureStoryDirs(storyId)
    // ASCII-only name: Snap VLC cannot open paths under ~/.config, and
    // some players mishandle CJK filenames when opened via file:// URLs.
    const safeTitle = safeAsciiExportName(story.title, storyId)
    const { extractSpokenLines, parseBeatContent } = await import(
      '../../domain/beatContent'
    )
    const { defaultExportFinalOptions } = await import(
      '../../domain/exportOptions'
    )
    const exp = defaultExportFinalOptions({
      exportProfile: options?.exportProfile ?? this.settings.exportProfile,
      burnSubtitles: options?.burnSubtitles ?? this.settings.burnSubtitles,
      includeSilentAudio:
        options?.includeSilentAudio ?? this.settings.includeSilentAudio,
      bgmVolume: options?.bgmVolume ?? this.settings.bgmVolume,
      dialogueVolume: options?.dialogueVolume ?? this.settings.dialogueVolume,
      openExportFolder: this.settings.openExportFolder
    })

    const srt = buildSrt(
      story.timeline.map((e) => {
        const spoken = extractSpokenLines(
          parseBeatContent(
            e.dialogue,
            (e as { beatContentJson?: string | null }).beatContentJson
          )
        )
        return {
          startSeconds: e.startTime,
          endSeconds: e.endTime,
          text: spoken
        }
      })
    )

    const dialogueAudioPaths: Array<{
      path: string
      startSeconds: number
      endSeconds: number
    }> = []
    if (this.settings.ttsEnabled) {
      try {
        const { CompositeTtsProvider } = await import(
          '../../infrastructure/audio/TtsProvider'
        )
        const tts = new CompositeTtsProvider(
          this.settings.ttsHttpUrl,
          this.settings.apiKey
        )
        if (await tts.available()) {
          for (const e of story.timeline) {
            const spokenText = extractSpokenLines(
              parseBeatContent(
                e.dialogue,
                (e as { beatContentJson?: string | null }).beatContentJson
              )
            )
            if (!spokenText.trim()) continue
            const out = this.store.ttsPath(storyId, e.id)
            try {
              const spoken = await tts.speak({
                text: spokenText,
                outputPath: out,
                voice: this.settings.ttsVoice
              })
              if (spoken.outputPath && existsSync(spoken.outputPath)) {
                dialogueAudioPaths.push({
                  path: spoken.outputPath,
                  startSeconds: e.startTime,
                  endSeconds: e.endTime
                })
              }
            } catch {
              // skip clip TTS failure
            }
          }
        }
      } catch {
        // TTS stack optional
      }
    }

    const fileName = `${safeTitle}_final_${Date.now()}.mp4`
    const workPath = await this.ffmpeg.exportFinal({
      outDir,
      fileName,
      title: story.title,
      clips,
      srtContent: srt,
      burnSubtitles: exp.burnSubtitles,
      includeSilentAudio: exp.includeSilentAudio,
      profile: exp.exportProfile,
      bgmPath: this.settings.bgmPath,
      bgmVolume: exp.bgmVolume,
      dialogueVolume: exp.dialogueVolume,
      duckRatio: this.settings.duckRatio,
      dialogueAudioPaths,
      aspectRatio: this.settings.aspectRatio,
      transitionMode: this.settings.transitionMode,
      transitionSec: this.settings.transitionSec
    })
    const outputPath = publishExportToVideos(workPath, fileName)
    this.store.recordExportHistory(storyId, {
      kind: 'final',
      path: outputPath,
      workPath,
      fileName
    })
    await this.prisma.story.update({
      where: { id: storyId },
      data: { exportPath: outputPath }
    })
    return { outputPath }
  }

  getMediaStore(): MediaStore {
    return this.store
  }

  private mapClips(story: Awaited<ReturnType<GenerationService['loadStory']>>) {
    const charMap = new Map(story.characters.map((c) => [c.id, c.name]))
    const sceneMap = new Map(
      story.scenes.map((s) => [s.id, `Scene ${s.sceneNumber}`])
    )
    const propMap = new Map(story.props.map((p) => [p.id, p.name]))

    return story.timeline.map((e) => ({
      startTime: e.startTime,
      endTime: e.endTime,
      label:
        (e.characterId && charMap.get(e.characterId)) ||
        (e.sceneId && sceneMap.get(e.sceneId)) ||
        (e.propId && propMap.get(e.propId)) ||
        `Clip ${e.order + 1}`,
      dialogue: e.dialogue,
      mediaPath: e.mediaPath,
      imagePath: null as string | null
    }))
  }

  private async loadStory(storyId: string) {
    const story = await this.prisma.story.findUnique({
      where: { id: storyId },
      include: {
        storyCharacters: {
          include: {
            character: true,
            costume: true
          }
        },
        storyScenes: {
          orderBy: { sceneNumber: 'asc' },
          include: { scene: true }
        },
        storyProps: { include: { prop: true } },
        timeline: { orderBy: { order: 'asc' } }
      }
    })
    if (!story) throw new AppError('NOT_FOUND', `Story not found: ${storyId}`)
    return {
      ...story,
      characters: story.storyCharacters.map((l) => {
        const storyCostumeText =
          l.costume?.description?.trim() ||
          l.costume?.name?.trim() ||
          null
        return {
          ...l.character,
          storyCostumeId: l.costumeId,
          /** Prefer story wardrobe text for prompts when set. */
          costume: storyCostumeText || l.character.costume,
          storyCostumeRefImagePath: l.costume?.refImagePath ?? null
        }
      }),
      scenes: story.storyScenes.map((l) => ({
        ...l.scene,
        sceneNumber: l.sceneNumber,
        script: l.scriptOverride ?? l.scene.script,
        status: l.statusOverride ?? l.scene.status
      })),
      props: story.storyProps.map((l) => l.prop)
    }
  }

  // keep TimelineEntry type referenced for future typed helpers
  static emptyTimeline(): TimelineEntry[] {
    return []
  }
}

function basenameMatch(path: string, fileName: string): boolean {
  const base = path.split(/[/\\]/).pop() || path
  return base === fileName
}

/** ASCII filename base so players/shells do not choke on CJK paths. */
export function safeAsciiExportName(title: string, storyId: string): string {
  const ascii = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40)
  return ascii || `story_${storyId.slice(0, 10)}`
}

/**
 * Prefer ~/Videos (Snap VLC can read home Videos; not ~/.config).
 */
export function resolvePublicExportDir(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { app } = require('electron') as typeof import('electron')
    if (app?.getPath) {
      return join(app.getPath('videos'), 'InstantDrama Magician')
    }
  } catch {
    /* unit tests / non-electron */
  }
  return join(homedir(), 'Videos', 'InstantDrama Magician')
}

function publishExportToVideos(workPath: string, fileName: string): string {
  const publicDir = resolvePublicExportDir()
  try {
    mkdirSync(publicDir, { recursive: true })
    const outputPath = join(publicDir, fileName)
    copyFileSync(workPath, outputPath)
    return outputPath
  } catch {
    return workPath
  }
}
