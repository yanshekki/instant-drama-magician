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

  it('exportFinal and exportConcat write final and update story', async () => {
    const prisma = createMockPrisma()
    const clipPath = join(dir, 'clip-ready.mp4')
    writeFileSync(clipPath, 'mp4')
    ;(prisma.story.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      storyIncludeShape({
        title: 'Final Cut',
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
            dialogue: '又係落雨',
            beatContentJson: null,
            mediaPath: clipPath,
            mediaStatus: 'READY',
            mediaError: null
          },
          {
            id: 'e2',
            order: 1,
            startTime: 6,
            endTime: 12,
            characterId: null,
            sceneId: 'sc1',
            propId: null,
            actionId: null,
            dialogue: null,
            mediaPath: null,
            mediaStatus: 'EMPTY',
            mediaError: null
          }
        ]
      })
    )
    const finalWork = join(dir, 'final-work.mp4')
    writeFileSync(finalWork, 'final')
    const exportFinal = vi.fn(async (opts: { fileName: string; outDir: string }) => {
      const p = join(opts.outDir, opts.fileName)
      mkdirSync(opts.outDir, { recursive: true })
      writeFileSync(p, 'final')
      return p
    })
    const { svc, ffmpeg } = makeSvc({
      prisma,
      ffmpeg: {
        ensureAvailable: vi.fn().mockResolvedValue(undefined),
        exportFinal,
        exportStoryboard: vi.fn()
      }
    })
    const r = await svc.exportFinal('s1', {
      exportProfile: 'fast',
      burnSubtitles: true,
      includeSilentAudio: true,
      bgmVolume: 0.2,
      dialogueVolume: 1
    })
    expect(r.outputPath).toBeTruthy()
    expect(exportFinal).toHaveBeenCalled()
    expect(prisma.story.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 's1' },
        data: expect.objectContaining({ exportPath: expect.any(String) })
      })
    )

    exportFinal.mockClear()
    const cat = await svc.exportConcat('s1')
    expect(cat.outputPath).toBeTruthy()
    expect(exportFinal).toHaveBeenCalled()
  })

  it('generateClip multi-cast with action + failure path marks FAILED', async () => {
    const prisma = createMockPrisma()
    ;(prisma.story.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      storyIncludeShape({
        characters: [
          {
            id: 'c1',
            name: 'Ming',
            description: 'courier',
            costume: 'jacket',
            hardRules: null,
            spokenLanguages: JSON.stringify(['yue'])
          },
          {
            id: 'c2',
            name: 'Lin',
            description: 'driver',
            costume: 'coat',
            hardRules: null,
            spokenLanguages: 'bad-json'
          }
        ],
        scenes: [
          {
            id: 'sc1',
            sceneNumber: 1,
            title: 'Alley',
            description: 'wet',
            script: null,
            status: 'PENDING'
          },
          {
            id: 'sc2',
            sceneNumber: 2,
            title: 'Roof',
            description: 'open',
            script: null,
            status: 'PENDING'
          }
        ],
        props: [
          { id: 'p1', name: 'Umbrella', description: 'red' },
          { id: 'p2', name: 'Bag', description: 'leather' }
        ],
        actions: [
          {
            id: 'a1',
            name: 'Dash',
            description: 'sprint',
            motionNotes: 'fast',
            intention: 'escape',
            cameraNotes: 'track',
            refImagePath: null
          }
        ],
        timeline: [
          {
            id: 'e0',
            order: 0,
            startTime: 0,
            endTime: 4,
            characterId: 'c1',
            sceneId: 'sc1',
            propId: null,
            actionId: null,
            characterIds: JSON.stringify(['c1']),
            dialogue: 'prev',
            mediaPath: null,
            mediaStatus: 'READY',
            mediaError: null
          },
          {
            id: 'e1',
            order: 1,
            startTime: 4,
            endTime: 10,
            characterId: 'c1',
            sceneId: 'sc1',
            propId: 'p1',
            actionId: 'a1',
            // JSON strings (DB shape); multi-id lists for multi-cast prompt path
            characterIds: JSON.stringify(['c1', 'c2']),
            sceneIds: JSON.stringify(['sc1', 'sc2']),
            propIds: JSON.stringify(['p1', 'p2']),
            actionIds: JSON.stringify(['a1']),
            dialogue: '走啦',
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
    // seed previous continuity still so sameCharacter / continuityLock runs
    const storeDir = join(dir, 's1', 'clips')
    mkdirSync(storeDir, { recursive: true })
    writeFileSync(join(storeDir, 'e0_continuity.png'), 'still')

    const long =
      'POLISHED MULTI CAST CLIP PROMPT WITH ENOUGH LENGTH TO BE ACCEPTED HERE'
    const generateVideo = vi.fn(async () => {
      throw new Error('provider boom')
    })
    const chat = vi.fn(async () => ({
      choices: [{ message: { content: long } }]
    }))
    const { svc } = makeSvc({
      prisma,
      ai: { generateVideo, chat }
    })
    const onProgress = vi.fn()
    await expect(svc.generateClip('s1', 'e1', onProgress)).rejects.toThrow(
      /provider boom/
    )
    expect(prisma.timelineEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ mediaStatus: 'FAILED' })
      })
    )
    expect(
      onProgress.mock.calls.some(
        (c) => (c[0] as { mediaStatus?: string }).mediaStatus === 'FAILED'
      )
    ).toBe(true)
  })

  it('generateClip cancel mid-flight throws CANCELLED', async () => {
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
            sceneId: 'sc1',
            propId: null,
            actionId: null,
            characterIds: JSON.stringify(['c1']),
            dialogue: 'hi',
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
    let resolveChat: ((v: unknown) => void) | null = null
    const chat = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveChat = resolve
        })
    )
    const generateVideo = vi.fn(async (req: { outputPath: string }) => {
      writeFileSync(req.outputPath, 'mp4')
      return { outputPath: req.outputPath, degraded: false }
    })
    const { svc } = makeSvc({
      prisma,
      ai: { generateVideo, chat }
    })
    const pending = svc.generateClip('s1', 'e1')
    // allow generateClip to set abort controller
    await new Promise((r) => setTimeout(r, 20))
    svc.cancel()
    // unblock polish (may still race)
    resolveChat?.({
      choices: [
        {
          message: {
            content:
              'POLISHED CLIP PROMPT WITH ENOUGH LENGTH TO BE ACCEPTED AS POLISHED'
          }
        }
      ]
    })
    await expect(pending).rejects.toMatchObject({
      message: 'errors.cancelled'
    })
  })

  it('run success and failure update story status', async () => {
    const prisma = createMockPrisma()
    ;(prisma.story.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      storyIncludeShape({ status: 'DRAFT' })
    )
    const pipelineOk = {
      run: vi.fn().mockResolvedValue({
        success: true,
        steps: [{ step: 'script', ok: true, degraded: true }]
      })
    }
    const ai = {
      getStatus: vi.fn(),
      chat: vi.fn(),
      generateImage: vi.fn(),
      generateVideo: vi.fn()
    }
    const svcOk = new GenerationService(prisma as never, ai as never, {
      mediaRoot: dir,
      settings: { aspectRatio: '16:9', videoConcurrency: 1 } as never,
      pipeline: pipelineOk as never,
      ffmpeg: { ensureAvailable: vi.fn() } as never
    })
    const onProgress = vi.fn()
    const result = await svcOk.run('s1', onProgress)
    expect(result.success).toBe(true)
    expect(prisma.story.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'COMPLETED' }
      })
    )
    // exercise pipeline onStepComplete / onClipProgress
    const runArgs = pipelineOk.run.mock.calls[0][1] as {
      onStepComplete: (r: unknown, i: number, t: number) => void
      onClipProgress: (p: {
        index: number
        total: number
        entryId: string
        status: string
        jobId?: string
      }) => void
      persistence: {
        updateSceneScript: (id: string, script: string, status?: string) => Promise<void>
        replaceTimelineSuggestions: (
          sid: string,
          entries: Array<Record<string, unknown>>
        ) => Promise<void>
        setExportPath: (sid: string, path: string) => Promise<void>
        updateEntryMedia: (
          entryId: string,
          data: Record<string, unknown>
        ) => Promise<void>
        listTimeline: (sid: string) => Promise<unknown>
      }
      media: {
        clipOutputPath: (s: string, e: string) => string
        exportStoryboard: (s: string) => Promise<string>
        exportConcat: (s: string) => Promise<string>
      }
    }
    runArgs.onStepComplete({ step: 'script', ok: true }, 0, 1)
    runArgs.onClipProgress({
      index: 0,
      total: 1,
      entryId: 'e1',
      status: 'READY',
      jobId: 'j'
    })
    await runArgs.persistence.updateSceneScript('sc1', 'line', 'DONE')
    await runArgs.persistence.replaceTimelineSuggestions('s1', [
      {
        startTime: 0,
        endTime: 5,
        sceneId: 'sc1',
        characterId: 'c1',
        dialogue: 'x',
        order: 0
      }
    ])
    await runArgs.persistence.replaceTimelineSuggestions('s1', [])
    await runArgs.persistence.setExportPath('s1', '/tmp/out.mp4')
    await runArgs.persistence.updateEntryMedia('e1', {
      mediaPath: '/a.mp4',
      mediaStatus: 'READY',
      mediaError: null,
      videoJobId: 'j1'
    })
    ;(prisma.timelineEntry.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
      []
    )
    await runArgs.persistence.listTimeline('s1')
    expect(runArgs.media.clipOutputPath('s1', 'e1')).toContain('e1')
    // media.exportStoryboard / exportConcat wrappers (call real methods via spy)
    const boardSpy = vi
      .spyOn(svcOk, 'exportStoryboard')
      .mockResolvedValue({ outputPath: join(dir, 'board-from-run.mp4') })
    const concatSpy = vi
      .spyOn(svcOk, 'exportConcat')
      .mockResolvedValue({ outputPath: join(dir, 'concat-from-run.mp4') })
    await expect(runArgs.media.exportStoryboard('s1')).resolves.toContain(
      'board-from-run'
    )
    await expect(runArgs.media.exportConcat('s1')).resolves.toContain(
      'concat-from-run'
    )
    boardSpy.mockRestore()
    concatSpy.mockRestore()

    // failure path
    const pipelineFail = {
      run: vi.fn().mockRejectedValue(new Error('pipeline down'))
    }
    const svcFail = new GenerationService(prisma as never, ai as never, {
      mediaRoot: dir,
      settings: { aspectRatio: '16:9' } as never,
      pipeline: pipelineFail as never,
      ffmpeg: { ensureAvailable: vi.fn() } as never
    })
    await expect(svcFail.run('s1')).rejects.toThrow(/pipeline down/)
    expect(prisma.story.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'FAILED' }
      })
    )
  })

  it('generateClip uses en locale and succeeds with action multi-block', async () => {
    const prisma = createMockPrisma()
    const outClip = join(dir, 's1', 'clips', 'e1.mp4')
    mkdirSync(join(dir, 's1', 'clips'), { recursive: true })
    ;(prisma.story.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      storyIncludeShape({
        actions: [
          {
            id: 'a1',
            name: 'Dash',
            description: 'sprint',
            motionNotes: 'fast',
            intention: 'escape',
            cameraNotes: 'track',
            refImagePath: null
          },
          {
            id: 'a2',
            name: 'Turn',
            description: 'spin',
            motionNotes: null,
            intention: null,
            cameraNotes: null,
            refImagePath: null
          }
        ],
        timeline: [
          {
            id: 'e1',
            order: 0,
            startTime: 0,
            endTime: 6,
            characterId: 'c1',
            sceneId: null,
            propId: null,
            actionId: null,
            characterIds: JSON.stringify(['c1']),
            actionIds: JSON.stringify(['a1', 'a2']),
            dialogue: null,
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
      'POLISHED EN LOCALE CLIP PROMPT WITH ENOUGH LENGTH TO BE ACCEPTED AS TEXT'
    const generateVideo = vi.fn(async (req: { outputPath: string }) => {
      writeFileSync(req.outputPath, 'mp4')
      return { outputPath: req.outputPath, degraded: true, jobId: 'j-en' }
    })
    const chat = vi.fn(async () => ({
      choices: [{ message: { content: long } }]
    }))
    const prisma2 = prisma
    const ai = {
      getStatus: vi.fn().mockResolvedValue({ available: true }),
      chat,
      generateImage: vi.fn(),
      generateVideo
    }
    const svc = new GenerationService(prisma2 as never, ai as never, {
      mediaRoot: dir,
      settings: {
        aspectRatio: '9:16',
        uiLanguage: 'en',
        imageSizeWide: '1792x1024',
        videoConcurrency: 1
      } as never,
      ffmpeg: { ensureAvailable: vi.fn() } as never
    })
    const r = await svc.generateClip('s1', 'e1')
    expect(r.mediaPath).toBeTruthy()
    expect(r.degraded).toBe(true)
    expect(generateVideo).toHaveBeenCalled()
    void outClip
  })

  it('listExports and deleteExport not-found story; delete clears latest', async () => {
    const prisma = createMockPrisma()
    ;(prisma.story.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      null
    )
    const { svc } = makeSvc({ prisma })
    await expect(svc.listExports('missing')).rejects.toMatchObject({
      message: 'errors.storyNotFound'
    })
    await expect(svc.deleteExport('missing', 'x')).rejects.toMatchObject({
      message: 'errors.storyNotFound'
    })

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
    const store = svc.getMediaStore()
    store.ensureStoryDirs('s1')
    const work = join(dir, 's1', 'exports')
    mkdirSync(work, { recursive: true })
    const fileName = `${safeAsciiExportName('Rain Demo', 's1')}_final_1.mp4`
    const path = join(work, fileName)
    writeFileSync(path, 'x')
    const item = store.recordExportHistory('s1', {
      kind: 'final',
      path,
      workPath: path,
      fileName
    })
    storyRow.exportPath = path
    const listed = await svc.listExports('s1')
    expect(listed.items.length).toBeGreaterThan(0)
    expect(listed.latestPath).toBeTruthy()

    const del = await svc.deleteExport('s1', item.id)
    expect(del.ok).toBe(true)
  })

  it('exportPreflight warns when no READY clips', async () => {
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
            mediaStatus: 'EMPTY',
            mediaPath: null,
            dialogue: null
          }
        ]
      })
    )
    const { svc } = makeSvc({ prisma })
    const r = await svc.exportPreflight('s1')
    expect(r.readyClips).toBe(0)
    expect(r.willUseFallback).toBe(true)
    expect(r.warnings.some((w) => /No READY/i.test(w))).toBe(true)
  })

  it('mapClips labels fall through to scene/prop/action/order', async () => {
    const prisma = createMockPrisma()
    const finalWork = join(dir, 'map.mp4')
    writeFileSync(finalWork, 'x')
    ;(prisma.story.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      storyIncludeShape({
        characters: [],
        scenes: [
          {
            id: 'sc1',
            sceneNumber: 3,
            title: 'Dock',
            description: 'fog',
            script: null,
            status: 'PENDING'
          }
        ],
        props: [{ id: 'p1', name: 'Crate', description: 'wood' }],
        actions: [
          {
            id: 'a1',
            name: 'Lift',
            description: 'pick up',
            refImagePath: null
          }
        ],
        timeline: [
          {
            id: 'e1',
            order: 0,
            startTime: 0,
            endTime: 3,
            characterId: null,
            sceneId: 'sc1',
            propId: null,
            actionId: null,
            dialogue: null,
            mediaPath: null,
            mediaStatus: 'EMPTY'
          },
          {
            id: 'e2',
            order: 1,
            startTime: 3,
            endTime: 6,
            characterId: null,
            sceneId: null,
            propId: 'p1',
            actionId: null,
            dialogue: null,
            mediaPath: null,
            mediaStatus: 'EMPTY'
          },
          {
            id: 'e3',
            order: 2,
            startTime: 6,
            endTime: 9,
            characterId: null,
            sceneId: null,
            propId: null,
            actionId: 'a1',
            dialogue: null,
            mediaPath: null,
            mediaStatus: 'EMPTY'
          },
          {
            id: 'e4',
            order: 3,
            startTime: 9,
            endTime: 12,
            characterId: null,
            sceneId: null,
            propId: null,
            actionId: null,
            dialogue: null,
            mediaPath: null,
            mediaStatus: 'EMPTY'
          }
        ]
      })
    )
    const exportFinal = vi.fn(async (opts: { fileName: string; outDir: string }) => {
      const p = join(opts.outDir, opts.fileName)
      mkdirSync(opts.outDir, { recursive: true })
      writeFileSync(p, 'f')
      return p
    })
    const { svc } = makeSvc({
      prisma,
      ffmpeg: {
        ensureAvailable: vi.fn().mockResolvedValue(undefined),
        exportFinal
      }
    })
    await svc.exportFinal('s1')
    const clipsArg = (exportFinal.mock.calls[0][0] as { clips: Array<{ label: string }> })
      .clips
    expect(clipsArg.map((c) => c.label)).toEqual(
      expect.arrayContaining([
        'Scene 3',
        'Crate',
        'Lift',
        'Clip 4'
      ])
    )
  })
})
