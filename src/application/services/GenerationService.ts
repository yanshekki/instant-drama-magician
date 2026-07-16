import { join } from 'path'
import type { PrismaClient } from '../../types/prisma'
import type {
  AIProvider,
  GenerationResult,
  PipelineStepResult,
  StoryDetail
} from '../../types/domain'
import { AppError } from '../../types/errors'
import { canStartGeneration } from '../../domain/story'
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
}) => void

export class GenerationService {
  private readonly pipeline: GenerationPipeline
  private readonly ffmpeg: FfmpegService
  private readonly store: MediaStore
  private abort: AbortController | null = null

  constructor(
    private readonly prisma: PrismaClient,
    ai: AIProvider,
    options?: {
      pipeline?: GenerationPipeline
      ffmpeg?: FfmpegService
      mediaRoot?: string
    }
  ) {
    this.pipeline = options?.pipeline ?? new GenerationPipeline(ai)
    this.ffmpeg = options?.ffmpeg ?? new FfmpegService()
    this.store = new MediaStore(options?.mediaRoot ?? join(process.cwd(), '.media'))
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
            mediaStatus: p.status
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
                mediaError: data.mediaError ?? null
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

      await this.prisma.story.update({
        where: { id: storyId },
        data: { status: result.success ? 'COMPLETED' : 'FAILED' }
      })
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
    const story = await this.loadStory(storyId)
    const clips = this.mapClips(story)
    const outDir = this.store.exportsDir(storyId)
    const safeTitle =
      story.title.replace(/[^\w\u4e00-\u9fff-]+/g, '_').slice(0, 40) || 'story'
    const outputPath = await this.ffmpeg.exportConcat({
      outDir,
      fileName: `${safeTitle}_final_${Date.now()}.mp4`,
      title: story.title,
      clips
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
