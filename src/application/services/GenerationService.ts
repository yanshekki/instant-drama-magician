import { existsSync } from 'fs'
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
  previousClipContext
} from '../../domain/promptContinuity'
import { GenerationPipeline } from '../GenerationPipeline'
import { FfmpegService } from '../../infrastructure/ffmpeg/FfmpegService'
import { MediaStore } from '../../infrastructure/media/MediaStore'

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
    onProgress?: GenerationProgressHandler
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
    const char = story.characters.find((c) => c.id === entry.characterId)
    const scene = story.scenes.find((s) => s.id === entry.sceneId)
    const prop = story.props.find((p) => p.id === entry.propId)
    const charMap = new Map(story.characters.map((c) => [c.id, c]))
    const sceneMap = new Map(story.scenes.map((s) => [s.id, s]))
    const propMap = new Map(story.props.map((p) => [p.id, p]))
    const prev = previousClipContext(story.timeline, entryId, {
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

      const prompt = buildClipPrompt({
        storyTitle: story.title,
        styleNote: story.styleNote,
        character: char,
        scene,
        prop,
        dialogue: entry.dialogue,
        seconds,
        previousContext: prev
      })

      const result = await this.ai.generateVideo({
        prompt,
        durationSeconds: seconds,
        refImagePath: char?.refImagePath,
        outputPath,
        aspectRatio: this.settings.aspectRatio
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
    opts?: { onlyFailedVideos?: boolean }
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
    const safeTitle =
      story.title.replace(/[^\w\u4e00-\u9fff-]+/g, '_').slice(0, 40) || 'story'
    const outputPath = await this.ffmpeg.exportStoryboard({
      outDir,
      fileName: `${safeTitle}_board_${Date.now()}.mp4`,
      title: story.title,
      clips
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

  async exportFinal(storyId: string): Promise<{ outputPath: string }> {
    const story = await this.loadStory(storyId)
    const clips = this.mapClips(story)
    const outDir = this.store.exportsDir(storyId)
    this.store.ensureStoryDirs(storyId)
    const safeTitle =
      story.title.replace(/[^\w\u4e00-\u9fff-]+/g, '_').slice(0, 40) || 'story'
    const srt = buildSrt(
      story.timeline.map((e) => ({
        startSeconds: e.startTime,
        endSeconds: e.endTime,
        text: e.dialogue ?? ''
      }))
    )

    const dialogueAudioPaths: Array<{ path: string; startSeconds: number }> = []
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
            if (!e.dialogue?.trim()) continue
            const out = this.store.ttsPath(storyId, e.id)
            try {
              const spoken = await tts.speak({
                text: e.dialogue,
                outputPath: out,
                voice: this.settings.ttsVoice
              })
              if (spoken.outputPath && existsSync(spoken.outputPath)) {
                dialogueAudioPaths.push({
                  path: spoken.outputPath,
                  startSeconds: e.startTime
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

    const outputPath = await this.ffmpeg.exportFinal({
      outDir,
      fileName: `${safeTitle}_final_${Date.now()}.mp4`,
      title: story.title,
      clips,
      srtContent: srt,
      burnSubtitles: this.settings.burnSubtitles,
      includeSilentAudio: this.settings.includeSilentAudio,
      profile: this.settings.exportProfile,
      bgmPath: this.settings.bgmPath,
      bgmVolume: this.settings.bgmVolume,
      dialogueVolume: this.settings.dialogueVolume,
      dialogueAudioPaths
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
        characters: true,
        scenes: { orderBy: { sceneNumber: 'asc' } },
        props: true,
        timeline: { orderBy: { order: 'asc' } }
      }
    })
    if (!story) throw new AppError('NOT_FOUND', `Story not found: ${storyId}`)
    return story
  }

  // keep TimelineEntry type referenced for future typed helpers
  static emptyTimeline(): TimelineEntry[] {
    return []
  }
}
