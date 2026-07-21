import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  GenerationService,
  safeAsciiExportName,
  resolvePublicExportDir
} from './GenerationService'
import { createMockPrisma } from '../../test/mockPrisma'
import { AppError } from '../../types/errors'

function storyIncludeShape(partial: {
  id?: string
  title?: string
  status?: string
  styleNote?: string | null
  hardRules?: string | null
  exportPath?: string | null
  timeline?: unknown[]
  characters?: unknown[]
  scenes?: unknown[]
  props?: unknown[]
  actions?: unknown[]
}) {
  const id = partial.id ?? 's1'
  const characters = (partial.characters ?? [
    {
      id: 'c1',
      name: 'Ming',
      description: 'courier',
      costume: 'jacket',
      hardRules: null
    }
  ]) as Array<Record<string, unknown>>
  const scenes = (partial.scenes ?? [
    {
      id: 'sc1',
      sceneNumber: 1,
      title: 'Alley',
      description: 'wet',
      script: null,
      status: 'PENDING'
    }
  ]) as Array<Record<string, unknown>>
  const props = (partial.props ?? [
    { id: 'p1', name: 'Umbrella', description: 'red' }
  ]) as Array<Record<string, unknown>>
  const actions = (partial.actions ?? []) as Array<Record<string, unknown>>
  const timeline = (partial.timeline ?? [
    {
      id: 'e1',
      order: 0,
      startTime: 0,
      endTime: 6,
      characterId: 'c1',
      sceneId: 'sc1',
      propId: 'p1',
      actionId: null,
      dialogue: 'hi',
      mediaPath: null,
      mediaStatus: 'EMPTY',
      mediaError: null
    }
  ]) as unknown[]

  return {
    id,
    title: partial.title ?? 'Rain',
    status: partial.status ?? 'DRAFT',
    styleNote: partial.styleNote ?? 'neon',
    hardRules: partial.hardRules ?? null,
    exportPath: partial.exportPath ?? null,
    storyCharacters: characters.map((c) => ({
      character: c,
      costumeId: null,
      costume: null
    })),
    storyScenes: scenes.map((s, i) => ({
      sceneNumber: (s.sceneNumber as number) ?? i + 1,
      scene: s,
      scriptOverride: null,
      statusOverride: null
    })),
    storyProps: props.map((p) => ({ prop: p })),
    storyActions: actions.map((a) => ({ action: a })),
    timeline
  }
}

describe('GenerationService helpers', () => {
  it('safeAsciiExportName sanitizes titles', () => {
    expect(safeAsciiExportName('Hello World!', 'abc123')).toBe('Hello_World')
    expect(safeAsciiExportName('雨夜買包', 'storyxyz123')).toMatch(/^story_/)
    expect(safeAsciiExportName('---', 'id1234567890').startsWith('story_')).toBe(
      true
    )
  })

  it('resolvePublicExportDir falls back to home Videos', () => {
    const dir = resolvePublicExportDir()
    expect(dir).toMatch(/Videos|InstantDrama/)
  })

  it('emptyTimeline returns []', () => {
    expect(GenerationService.emptyTimeline()).toEqual([])
  })
})

describe('GenerationService', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'idm-gen-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  function makeSvc(opts?: {
    prisma?: ReturnType<typeof createMockPrisma>
    ai?: Record<string, unknown>
    ffmpeg?: { ensureAvailable: ReturnType<typeof vi.fn> }
  }) {
    const prisma = opts?.prisma ?? createMockPrisma()
    const ai = {
      getStatus: vi.fn().mockResolvedValue({ available: true }),
      chat: vi.fn(),
      generateImage: vi.fn(),
      generateVideo: vi.fn().mockResolvedValue({
        outputPath: join(dir, 'clip.mp4'),
        degraded: false
      }),
      ...opts?.ai
    }
    const ffmpeg = opts?.ffmpeg ?? {
      ensureAvailable: vi.fn().mockResolvedValue(undefined),
      exportStoryboard: vi.fn().mockResolvedValue(join(dir, 'board.mp4')),
      exportFinalFilm: vi.fn().mockResolvedValue(join(dir, 'final.mp4'))
    }
    const svc = new GenerationService(prisma as never, ai as never, {
      mediaRoot: dir,
      settings: {
        aspectRatio: '16:9',
        imageSizeWide: '1792x1024',
        videoConcurrency: 1
      } as never,
      ffmpeg: ffmpeg as never
    })
    return { svc, prisma, ai, ffmpeg }
  }

  it('cancel is safe when idle', () => {
    const { svc } = makeSvc()
    expect(() => svc.cancel()).not.toThrow()
  })

  it('rebindAi and getMediaStore', () => {
    const { svc, ai } = makeSvc()
    const store = svc.getMediaStore()
    expect(store).toBeTruthy()
    const nextAi = {
      ...ai,
      generateVideo: vi.fn()
    }
    svc.rebindAi(nextAi as never, {
      aspectRatio: '9:16'
    } as never)
    expect(svc.getMediaStore()).toBe(store)
  })

  it('exportPreflight reports empty timeline and ffmpeg', async () => {
    const prisma = createMockPrisma()
    ;(prisma.story.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      storyIncludeShape({ timeline: [] })
    )
    const { svc, ffmpeg } = makeSvc({ prisma })
    const r = await svc.exportPreflight('s1')
    expect(r.totalClips).toBe(0)
    expect(r.readyClips).toBe(0)
    expect(r.willUseFallback).toBe(true)
    expect(r.canExport).toBe(true)
    expect(r.warnings.some((w) => /empty|placeholder/i.test(w))).toBe(true)
    expect(ffmpeg.ensureAvailable).toHaveBeenCalled()

    ;(ffmpeg.ensureAvailable as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('no ffmpeg')
    )
    const r2 = await svc.exportPreflight('s1')
    expect(r2.ffmpeg).toBe(false)
    expect(r2.canExport).toBe(false)
  })

  it('exportPreflight counts READY clips', async () => {
    const prisma = createMockPrisma()
    ;(prisma.story.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      storyIncludeShape({
        timeline: [
          {
            id: 'e1',
            order: 0,
            startTime: 0,
            endTime: 6,
            characterId: 'c1',
            sceneId: null,
            propId: null,
            mediaStatus: 'READY',
            mediaPath: '/a.mp4',
            dialogue: null
          },
          {
            id: 'e2',
            order: 1,
            startTime: 6,
            endTime: 12,
            characterId: 'c1',
            sceneId: null,
            propId: null,
            mediaStatus: 'EMPTY',
            mediaPath: null,
            dialogue: null
          }
        ]
      })
    )
    const { svc } = makeSvc({ prisma })
    const r = await svc.exportPreflight('s1')
    expect(r.totalClips).toBe(2)
    expect(r.readyClips).toBe(1)
    expect(r.willUseFallback).toBe(true)
  })

  it('listExports and deleteExport', async () => {
    const prisma = createMockPrisma()
    const storyRow = {
      id: 's1',
      title: 'Rain Demo',
      exportPath: null as string | null
    }
    ;(prisma.story.findUnique as ReturnType<typeof vi.fn>).mockImplementation(
      async (args: { select?: unknown }) => {
        if (args?.select) return storyRow
        return storyIncludeShape({ title: storyRow.title })
      }
    )
    const { svc } = makeSvc({ prisma })
    const store = svc.getMediaStore()
    store.ensureStoryDirs('s1')
    // seed a fake history file via store API if available
    if (typeof store.recordExportHistory === 'function') {
      const work = join(dir, 'exports', 's1')
      mkdirSync(work, { recursive: true })
      const fileName = `${safeAsciiExportName('Rain Demo', 's1')}_final_1.mp4`
      const path = join(work, fileName)
      writeFileSync(path, 'x')
      store.recordExportHistory('s1', {
        kind: 'final',
        path,
        workPath: path,
        fileName
      })
    }
    const listed = await svc.listExports('s1')
    expect(listed).toHaveProperty('items')
    expect(listed).toHaveProperty('latestPath')

    await expect(svc.deleteExport('s1', '  ')).rejects.toMatchObject({
      message: 'errors.exportIdRequired'
    })
    const del = await svc.deleteExport('s1', 'nonexistent-id')
    expect(del).toHaveProperty('ok')
    expect(del).toHaveProperty('items')
  })

  it('generateClip throws without video API', async () => {
    const prisma = createMockPrisma()
    ;(prisma.story.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      storyIncludeShape({})
    )
    const { svc } = makeSvc({
      ai: { generateVideo: undefined }
    })
    await expect(svc.generateClip('s1', 'e1')).rejects.toMatchObject({
      message: 'errors.videoUnavailable'
    })
  })

  it('generateClip throws when entry missing', async () => {
    const prisma = createMockPrisma()
    ;(prisma.story.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      storyIncludeShape({ timeline: [] })
    )
    const { svc } = makeSvc({ prisma })
    await expect(svc.generateClip('s1', 'nope')).rejects.toMatchObject({
      message: 'errors.timelineEntryNotFound'
    })
  })

  it('generateClip succeeds with mock video + chat polish', async () => {
    const prisma = createMockPrisma()
    const outClip = join(dir, 'stories', 's1', 'e1.mp4')
    mkdirSync(join(dir, 'stories', 's1'), { recursive: true })
    ;(prisma.story.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      storyIncludeShape({
        timeline: [
          {
            id: 'e1',
            order: 0,
            startTime: 0,
            endTime: 6,
            characterId: 'c1',
            sceneId: 'sc1',
            propId: 'p1',
            actionId: null,
            characterIds: JSON.stringify(['c1']),
            sceneIds: JSON.stringify(['sc1']),
            propIds: JSON.stringify(['p1']),
            dialogue: '又係落雨',
            beatContentJson: null,
            mediaPath: null,
            mediaStatus: 'EMPTY',
            mediaError: null
          }
        ]
      })
    )
    ;(prisma.timelineEntry.update as ReturnType<typeof vi.fn>).mockResolvedValue(
      {}
    )
    const long =
      'POLISHED CLIP PROMPT WITH ENOUGH LENGTH TO BE ACCEPTED AS POLISHED TEXT'
    const generateVideo = vi.fn(async (req: { outputPath: string }) => {
      writeFileSync(req.outputPath, 'mp4')
      return { outputPath: req.outputPath, degraded: false, jobId: 'j1' }
    })
    const chat = vi.fn(async () => ({
      choices: [{ message: { content: long } }]
    }))
    const { svc } = makeSvc({
      prisma,
      ai: { generateVideo, chat }
    })
    const onProgress = vi.fn()
    const r = await svc.generateClip('s1', 'e1', onProgress, {
      revisionPrompt: 'darker'
    })
    expect(r.entryId).toBe('e1')
    expect(r.mediaPath).toBeTruthy()
    expect(generateVideo).toHaveBeenCalled()
    expect(onProgress).toHaveBeenCalled()
    expect(prisma.timelineEntry.update).toHaveBeenCalled()
  })



  it('run rejects when status cannot start', async () => {
    const prisma = createMockPrisma()
    ;(prisma.story.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      storyIncludeShape({ status: 'GENERATING' })
    )
    const { svc } = makeSvc({ prisma })
    await expect(svc.run('s1')).rejects.toMatchObject({
      message: 'errors.cannotStartGeneration'
    })
  })

  it('run with onlyFailedVideos bypasses status check', async () => {
    const prisma = createMockPrisma()
    ;(prisma.story.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      storyIncludeShape({ status: 'GENERATING' })
    )
    const pipeline = {
      run: vi.fn().mockResolvedValue({
        success: true,
        steps: [{ step: 'script', ok: true, degraded: false }]
      })
    }
    const ai = {
      getStatus: vi.fn(),
      chat: vi.fn(),
      generateImage: vi.fn(),
      generateVideo: vi.fn()
    }
    const svc = new GenerationService(prisma as never, ai as never, {
      mediaRoot: dir,
      settings: { aspectRatio: '16:9', videoConcurrency: 1 } as never,
      pipeline: pipeline as never,
      ffmpeg: { ensureAvailable: vi.fn() } as never
    })
    const onProgress = vi.fn()
    const result = await svc.run('s1', onProgress, { onlyFailedVideos: true })
    expect(pipeline.run).toHaveBeenCalled()
    expect(result.success).toBe(true)
    expect(prisma.story.update).toHaveBeenCalled()
  })

  it('loadStory via exportPreflight not found', async () => {
    const prisma = createMockPrisma()
    ;(prisma.story.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      null
    )
    const { svc } = makeSvc({ prisma })
    await expect(svc.exportPreflight('missing')).rejects.toBeInstanceOf(AppError)
  })

  it('exportStoryboard writes board and updates story', async () => {
    const prisma = createMockPrisma()
    ;(prisma.story.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      storyIncludeShape({
        title: 'Board Test',
        timeline: [
          {
            id: 'e1',
            order: 0,
            startTime: 0,
            endTime: 4,
            characterId: 'c1',
            sceneId: null,
            propId: null,
            actionId: null,
            dialogue: 'hi',
            mediaPath: null,
            mediaStatus: 'EMPTY'
          }
        ]
      })
    )
    const boardPath = join(dir, 'board.mp4')
    writeFileSync(boardPath, 'mp4')
    const { svc, ffmpeg } = makeSvc({
      prisma,
      ffmpeg: {
        ensureAvailable: vi.fn().mockResolvedValue(undefined),
        exportStoryboard: vi.fn().mockResolvedValue(boardPath)
      }
    })
    const r = await svc.exportStoryboard('s1')
    expect(r.outputPath).toBeTruthy()
    expect(ffmpeg.exportStoryboard).toHaveBeenCalled()
    expect(prisma.story.update).toHaveBeenCalled()
  })
})
