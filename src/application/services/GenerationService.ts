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

export type GenerationProgressHandler = (payload: {
  storyId: string
  step: string
  index: number
  total: number
  result?: PipelineStepResult
}) => void

export class GenerationService {
  private readonly pipeline: GenerationPipeline
  private readonly ffmpeg: FfmpegService
  private readonly mediaRoot: string

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
    this.mediaRoot = options?.mediaRoot ?? join(process.cwd(), '.media')
  }

  async run(
    storyId: string,
    onProgress?: GenerationProgressHandler
  ): Promise<GenerationResult> {
    const story = await this.loadStory(storyId)
    if (!canStartGeneration(story.status)) {
      throw new AppError(
        'CONFLICT',
        `Cannot start generation while story status is ${story.status}`
      )
    }

    await this.prisma.story.update({
      where: { id: storyId },
      data: { status: 'GENERATING' }
    })

    try {
      const detail = story as unknown as StoryDetail
      const result = await this.pipeline.run(detail, {
        onStepComplete: (stepResult, index, total) => {
          onProgress?.({
            storyId,
            step: stepResult.step,
            index,
            total,
            result: stepResult
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
          }
        },
        media: {
          exportStoryboard: async (sid) => {
            const { outputPath } = await this.exportStoryboard(sid)
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
    }
  }

  async exportStoryboard(storyId: string): Promise<{ outputPath: string }> {
    const story = await this.loadStory(storyId)

    const charMap = new Map(story.characters.map((c) => [c.id, c.name]))
    const sceneMap = new Map(
      story.scenes.map((s) => [s.id, `Scene ${s.sceneNumber}`])
    )
    const propMap = new Map(story.props.map((p) => [p.id, p.name]))

    const clips = story.timeline.map((e) => ({
      startTime: e.startTime,
      endTime: e.endTime,
      label:
        (e.characterId && charMap.get(e.characterId)) ||
        (e.sceneId && sceneMap.get(e.sceneId)) ||
        (e.propId && propMap.get(e.propId)) ||
        `Clip ${e.order + 1}`,
      dialogue: e.dialogue,
      imagePath: null as string | null
    }))

    const outDir = join(this.mediaRoot, storyId, 'exports')
    const safeTitle =
      story.title.replace(/[^\w\u4e00-\u9fff-]+/g, '_').slice(0, 40) || 'story'
    const outputPath = await this.ffmpeg.exportStoryboard({
      outDir,
      fileName: `${safeTitle}_${Date.now()}.mp4`,
      title: story.title,
      clips
    })
    return { outputPath }
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
