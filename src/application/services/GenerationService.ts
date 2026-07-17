import { join } from 'path'
import type { PrismaClient } from '../../types/prisma'
import type {
  AIProvider,
  GenerationResult,
  PipelineStepResult,
  StoryDetail
} from '../../types/domain'
import type { AppSettings } from '../../types/settings'
import { DEFAULT_SETTINGS } from '../../types/settings'
import { AppError } from '../../types/errors'
import { canStartGeneration } from '../../domain/story'
import { buildSrt } from '../../domain/subtitle'
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
    this.pipeline = options?.pipeline ?? new GenerationPipeline(ai)
    this.ffmpeg = options?.ffmpeg ?? new FfmpegService()
    this.store = new MediaStore(options?.mediaRoot ?? join(process.cwd(), '.media'))
    this.settings = options?.settings ?? { ...DEFAULT_SETTINGS }
  }

  rebindAi(ai: AIProvider, settings?: AppSettings): void {
    this.pipeline = new GenerationPipeline(ai)
    if (settings) this.settings = settings
  }

  cancel(): void {
    this.abort?.abort()
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
    const safeTitle =
      story.title.replace(/[^\w\u4e00-\u9fff-]+/g, '_').slice(0, 40) || 'story'
    const srt = buildSrt(
      story.timeline.map((e) => ({
        startSeconds: e.startTime,
        endSeconds: e.endTime,
        text: e.dialogue ?? ''
      }))
    )
    // Optional TTS for dialogues (non-blocking failures)
    if (this.settings.ttsEnabled) {
      try {
        const { CompositeTtsProvider } = await import(
          '../../infrastructure/audio/TtsProvider'
        )
        const { mkdirSync } = await import('fs')
        const { dirname } = await import('path')
        const tts = new CompositeTtsProvider(
          this.settings.ttsHttpUrl,
          this.settings.apiKey
        )
        if (await tts.available()) {
          for (const e of story.timeline) {
            if (!e.dialogue?.trim()) continue
            const out = join(this.store.rootDir, storyId, 'tts', `${e.id}.wav`)
            mkdirSync(dirname(out), { recursive: true })
            try {
              await tts.speak({
                text: e.dialogue,
                outputPath: out,
                voice: this.settings.ttsVoice
              })
            } catch {
              // skip clip
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
      bgmVolume: this.settings.bgmVolume
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
}
