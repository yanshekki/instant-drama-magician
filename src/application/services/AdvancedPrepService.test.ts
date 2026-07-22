import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { AdvancedPrepService } from './AdvancedPrepService'
import { createMockPrisma } from '../../test/mockPrisma'
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  mkdirSync,
  existsSync
} from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import {
  serializeStoryCastPrep,
  serializeEntryStillPromptCache
} from '../../domain/advancedPrep'

describe('AdvancedPrepService', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'idm-adv-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  function makeStore(overrides: Record<string, unknown> = {}) {
    const stills = new Map<string, string>()
    const caches = new Map<string, string>()
    const cleared = new Set<string>()
    const castPrep = new Map<string, string>()
    return {
      mediaRoot: dir,
      ensureTmpDir: () => undefined,
      ensureStoryDirs: vi.fn((storyId: string) => {
        mkdirSync(join(dir, storyId), { recursive: true })
      }),
      readStoryCastPrepJson: vi.fn((storyId: string) => castPrep.get(storyId) ?? null),
      writeStoryCastPrepJson: vi.fn((storyId: string, json: string) => {
        castPrep.set(storyId, json)
      }),
      readEntryStillPromptJson: vi.fn((storyId: string, entryId: string) =>
        caches.get(`${storyId}:${entryId}`) ?? null
      ),
      writeEntryStillPromptJson: vi.fn(
        (storyId: string, entryId: string, json: string) => {
          caches.set(`${storyId}:${entryId}`, json)
        }
      ),
      entryStillPromptPath: (storyId: string, entryId: string) =>
        join(dir, storyId, `${entryId}.prompt.json`),
      clipContinuityStillPath: (storyId: string, entryId: string) => {
        const p = stills.get(`${storyId}:${entryId}`)
        return p ?? join(dir, storyId, `${entryId}.still.png`)
      },
      isEntryStillUserCleared: vi.fn((storyId: string, entryId: string) =>
        cleared.has(`${storyId}:${entryId}`)
      ),
      markEntryStillUserCleared: vi.fn((storyId: string, entryId: string) => {
        cleared.add(`${storyId}:${entryId}`)
      }),
      clearEntryStillUserCleared: vi.fn((storyId: string, entryId: string) => {
        cleared.delete(`${storyId}:${entryId}`)
      }),
      _stills: stills,
      _caches: caches,
      _cleared: cleared,
      _castPrep: castPrep,
      ...overrides
    }
  }

  function makeSvc(opts?: {
    prisma?: ReturnType<typeof createMockPrisma>
    store?: ReturnType<typeof makeStore>
    ffmpeg?: { extractStillFrame: ReturnType<typeof vi.fn> }
  }) {
    const prisma = opts?.prisma ?? createMockPrisma()
    const store = opts?.store ?? makeStore()
    const ffmpeg = opts?.ffmpeg ?? {
      extractStillFrame: vi.fn().mockResolvedValue(undefined)
    }
    const svc = new AdvancedPrepService(
      prisma as never,
      store as never,
      () =>
        ({
          generateImage: async () => ({ b64: 'x' }),
          editImage: async () => ({ b64: 'x' })
        }) as never,
      () => ({ aspectRatio: '16:9', uiLanguage: 'en' }),
      ffmpeg as never
    )
    return { svc, prisma, store, ffmpeg }
  }

  it('is constructible with deps', () => {
    const { svc } = makeSvc()
    expect(svc).toBeTruthy()
  })

  it('loadCastPrep / saveCastPrep round-trip', () => {
    const { svc, store } = makeSvc()
    const empty = svc.loadCastPrep('s1')
    expect(empty).toBeTruthy()
    const saved = svc.saveCastPrep('s1', {
      version: 1,
      characters: {
        c1: { refImagePath: '/r.png', costumeId: null }
      }
    })
    expect(store.writeStoryCastPrepJson).toHaveBeenCalled()
    expect(saved.characters.c1).toBeTruthy()
  })

  it('loadStillCache / saveStillCache', () => {
    const { svc, store } = makeSvc()
    expect(svc.loadStillCache('s1', 'e1')).toBeNull()
    svc.saveStillCache('s1', 'e1', {
      version: 1,
      promptHash: 'h1',
      professionalPrompt: 'prompt',
      userExtraPrompt: '',
      materialsSummary: 'm',
      sourceImagePath: null,
      stillPath: '/still.png',
      updatedAt: new Date().toISOString()
    })
    expect(store.writeEntryStillPromptJson).toHaveBeenCalled()
  })

  it('getSnapshot throws when story missing', async () => {
    const prisma = createMockPrisma()
    ;(prisma.story.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const { svc } = makeSvc({ prisma })
    await expect(svc.getSnapshot('missing')).rejects.toMatchObject({
      code: 'NOT_FOUND'
    })
  })

  it('getSnapshot builds cells cast cards and summary', async () => {
    const prisma = createMockPrisma()
    const store = makeStore()
    const stillPath = join(dir, 's1', 'e1.still.png')
    mkdirSync(join(dir, 's1'), { recursive: true })
    writeFileSync(stillPath, 'png')
    store._stills.set('s1:e1', stillPath)
    store._caches.set(
      's1:e1',
      serializeEntryStillPromptCache({
        version: 1,
        promptHash: 'other',
        professionalPrompt: 'cached prompt',
        userExtraPrompt: '',
        materialsSummary: 'mat',
        sourceImagePath: null,
        stillPath: stillPath,
        updatedAt: new Date().toISOString()
      })
    )
    store.writeStoryCastPrepJson(
      's1',
      serializeStoryCastPrep({
        version: 1,
        characters: {
          c1: {
            refImagePath: '/cast.png',
            costumeId: null
          }
        }
      })
    )

    ;(prisma.story.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 's1',
      title: 'Rain',
      styleNote: 'neon',
      timeline: [
        {
          id: 'e1',
          order: 0,
          startTime: 0,
          endTime: 6,
          dialogue: 'hello world dialogue',
          characterId: 'c1',
          characterIds: null,
          sceneId: 'sc1',
          sceneIds: null,
          propId: null,
          propIds: null,
          mediaPath: null,
          mediaStatus: 'EMPTY',
          beatContentJson: null
        },
        {
          id: 'e2',
          order: 1,
          startTime: 6,
          endTime: 12,
          dialogue: 'second',
          characterId: null,
          characterIds: JSON.stringify(['c2']),
          sceneId: null,
          sceneIds: 'sc1',
          propId: null,
          propIds: ['p1'],
          mediaPath: null,
          mediaStatus: 'READY',
          beatContentJson: null
        }
      ],
      storyCharacters: [
        {
          character: {
            id: 'c1',
            name: 'Ming',
            description: 'courier',
            refImagePath: '/c1.png',
            costume: null
          }
        }
      ]
    })
    ;(prisma.character.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'c2',
      name: 'Yau',
      description: 'clerk',
      refImagePath: null,
      costume: null
    })

    const { svc } = makeSvc({ prisma, store })
    const snap = await svc.getSnapshot('s1')
    expect(snap.storyTitle).toBe('Rain')
    expect(snap.cells).toHaveLength(2)
    expect(snap.cells[0].displayIndex).toBe(1)
    expect(snap.cells[0].continuityKind).toBe('first')
    expect(snap.cells[1].continuityKind).toMatch(/locked|text-only/)
    expect(snap.castCards.length).toBeGreaterThanOrEqual(1)
    expect(snap.summary.stillTotal).toBe(2)
    expect(snap.summary.videoReady).toBe(1)
  })

  it('getSnapshot heals still from video when missing', async () => {
    const prisma = createMockPrisma()
    const store = makeStore()
    const videoPath = join(dir, 'clip.mp4')
    writeFileSync(videoPath, 'mp4')
    const stillPath = join(dir, 's1', 'e1.still.png')
    store._stills.set('s1:e1', stillPath)

    ;(prisma.story.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 's1',
      title: 'T',
      styleNote: null,
      timeline: [
        {
          id: 'e1',
          order: 0,
          startTime: 0,
          endTime: 6,
          dialogue: null,
          characterId: null,
          characterIds: null,
          sceneId: null,
          sceneIds: null,
          propId: null,
          propIds: null,
          mediaPath: videoPath,
          mediaStatus: 'READY'
        }
      ],
      storyCharacters: []
    })
    const ffmpeg = {
      extractStillFrame: vi.fn().mockImplementation(async ({ outputPath }) => {
        mkdirSync(join(dir, 's1'), { recursive: true })
        writeFileSync(outputPath, 'frame')
      })
    }
    const { svc } = makeSvc({ prisma, store, ffmpeg })
    await svc.getSnapshot('s1')
    expect(ffmpeg.extractStillFrame).toHaveBeenCalledWith(
      expect.objectContaining({ atSeconds: 'end' })
    )
  })

  it('getSnapshot skips heal when user cleared still', async () => {
    const prisma = createMockPrisma()
    const store = makeStore()
    const videoPath = join(dir, 'clip.mp4')
    writeFileSync(videoPath, 'mp4')
    store._cleared.add('s1:e1')
    ;(prisma.story.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 's1',
      title: 'T',
      styleNote: null,
      timeline: [
        {
          id: 'e1',
          order: 0,
          startTime: 0,
          endTime: 6,
          dialogue: null,
          characterId: null,
          characterIds: null,
          sceneId: null,
          sceneIds: null,
          propId: null,
          propIds: null,
          mediaPath: videoPath,
          mediaStatus: 'READY'
        }
      ],
      storyCharacters: []
    })
    const ffmpeg = { extractStillFrame: vi.fn() }
    const { svc } = makeSvc({ prisma, store, ffmpeg })
    await svc.getSnapshot('s1')
    expect(ffmpeg.extractStillFrame).not.toHaveBeenCalled()
  })

  it('getSnapshot ignores extractStillFrame failures', async () => {
    const prisma = createMockPrisma()
    const store = makeStore()
    const videoPath = join(dir, 'clip.mp4')
    writeFileSync(videoPath, 'mp4')
    ;(prisma.story.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 's1',
      title: 'T',
      styleNote: null,
      timeline: [
        {
          id: 'e1',
          order: 0,
          startTime: 0,
          endTime: 6,
          dialogue: null,
          characterId: null,
          characterIds: null,
          sceneId: null,
          sceneIds: null,
          propId: null,
          propIds: null,
          mediaPath: videoPath,
          mediaStatus: 'READY'
        }
      ],
      storyCharacters: []
    })
    const ffmpeg = {
      extractStillFrame: vi.fn().mockRejectedValue(new Error('ff fail'))
    }
    const { svc } = makeSvc({ prisma, store, ffmpeg })
    const snap = await svc.getSnapshot('s1')
    expect(snap.cells[0].stillStatus).toBe('missing')
  })

  it('clearEntryStill removes files and marks cleared', () => {
    const store = makeStore()
    const still = join(dir, 's1', 'e1.still.png')
    const prompt = join(dir, 's1', 'e1.prompt.json')
    mkdirSync(join(dir, 's1'), { recursive: true })
    writeFileSync(still, 'x')
    writeFileSync(prompt, '{}')
    store.clipContinuityStillPath = () => still
    store.entryStillPromptPath = () => prompt
    const { svc } = makeSvc({ store })
    const r = svc.clearEntryStill('s1', 'e1')
    expect(r.ok).toBe(true)
    expect(store.markEntryStillUserCleared).toHaveBeenCalledWith('s1', 'e1')
    expect(existsSync(still)).toBe(false)
  })

  it('clearEntryStill tolerates missing files', () => {
    const { svc, store } = makeSvc()
    expect(svc.clearEntryStill('s1', 'none').ok).toBe(true)
    expect(store.markEntryStillUserCleared).toHaveBeenCalled()
  })

  it('clearEntryStill ignores unlink errors', () => {
    const store = makeStore()
    // point at a directory so unlinkSync throws EISDIR
    const bad = join(dir, 's1-dir')
    mkdirSync(bad, { recursive: true })
    store.clipContinuityStillPath = () => bad
    store.entryStillPromptPath = () => bad
    const { svc } = makeSvc({ store })
    expect(svc.clearEntryStill('s1', 'e1').ok).toBe(true)
  })

  it('openFromStill defaults aspectRatio when settings invalid', async () => {
    const prisma = createMockPrisma()
    const store = makeStore()
    const stillPath = join(dir, 's1', 'e1.still.png')
    mkdirSync(join(dir, 's1'), { recursive: true })
    writeFileSync(stillPath, 'png')
    store._stills.set('s1:e1', stillPath)
    ;(prisma.story.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 's1',
      title: 'T',
      styleNote: null,
      timeline: [
        {
          id: 'e1',
          order: 0,
          startTime: 0,
          endTime: 6,
          dialogue: 'x',
          characterId: null,
          characterIds: null,
          sceneId: null,
          sceneIds: null,
          propId: null,
          propIds: null,
          mediaPath: null,
          mediaStatus: 'EMPTY'
        }
      ],
      storyCharacters: []
    })
    const ffmpeg = { extractStillFrame: vi.fn() }
    const svc = new AdvancedPrepService(
      prisma as never,
      store as never,
      () => ({ generateImage: async () => ({ b64: '' }), editImage: async () => ({ b64: '' }) }) as never,
      () => ({ aspectRatio: '1:1' as '16:9' }),
      ffmpeg as never
    )
    const draft = await svc.openFromStill({ storyId: 's1', entryId: 'e1' })
    expect(draft.aspectRatio).toBe('16:9')
  })

  it('prepareForStillRegen clears marker', () => {
    const { svc, store } = makeSvc()
    svc.prepareForStillRegen('s1', 'e1')
    expect(store.clearEntryStillUserCleared).toHaveBeenCalledWith('s1', 'e1')
  })

  it('openFromStill validates entry and still existence', async () => {
    const prisma = createMockPrisma()
    ;(prisma.story.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 's1',
      title: 'T',
      styleNote: null,
      timeline: [
        {
          id: 'e1',
          order: 0,
          startTime: 0,
          endTime: 6,
          dialogue: 'beat',
          characterId: null,
          characterIds: null,
          sceneId: null,
          sceneIds: null,
          propId: null,
          propIds: null,
          mediaPath: null,
          mediaStatus: 'EMPTY'
        }
      ],
      storyCharacters: []
    })
    const { svc } = makeSvc({ prisma })
    await expect(
      svc.openFromStill({ storyId: 's1', entryId: 'missing' })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(
      svc.openFromStill({ storyId: 's1', entryId: 'e1' })
    ).rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('openFromStill returns draft with cached prompt', async () => {
    const prisma = createMockPrisma()
    const store = makeStore()
    const stillPath = join(dir, 's1', 'e1.still.png')
    mkdirSync(join(dir, 's1'), { recursive: true })
    writeFileSync(stillPath, 'png')
    store._stills.set('s1:e1', stillPath)
    store._caches.set(
      's1:e1',
      serializeEntryStillPromptCache({
        version: 1,
        promptHash: 'h',
        professionalPrompt: 'pro prompt',
        userExtraPrompt: 'extra',
        materialsSummary: 'materials',
        sourceImagePath: '/src.png',
        stillPath: stillPath,
        updatedAt: new Date().toISOString()
      })
    )
    ;(prisma.story.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 's1',
      title: 'T',
      styleNote: null,
      timeline: [
        {
          id: 'e1',
          order: 0,
          startTime: 0,
          endTime: 6,
          dialogue: 'beat',
          characterId: null,
          characterIds: null,
          sceneId: null,
          sceneIds: null,
          propId: null,
          propIds: null,
          mediaPath: null,
          mediaStatus: 'EMPTY'
        }
      ],
      storyCharacters: []
    })
    const { svc } = makeSvc({ prisma, store })
    // still may be stale due to hash mismatch — force path uses prompt
    const draft = await svc.openFromStill({
      storyId: 's1',
      entryId: 'e1',
      forcePolish: true
    })
    expect(draft.skippedStill).toBe(true)
    expect(draft.stillPath).toBe(stillPath)
    expect(draft.professionalPrompt.length).toBeGreaterThan(0)
    expect(draft.aspectRatio).toBe('16:9')
  })

  it('openFromStill builds fallback prompt when cache empty', async () => {
    const prisma = createMockPrisma()
    const store = makeStore()
    const stillPath = join(dir, 's1', 'e1.still.png')
    mkdirSync(join(dir, 's1'), { recursive: true })
    writeFileSync(stillPath, 'png')
    store._stills.set('s1:e1', stillPath)
    ;(prisma.story.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 's1',
      title: 'T',
      styleNote: null,
      timeline: [
        {
          id: 'e1',
          order: 0,
          startTime: 0,
          endTime: 6,
          dialogue: 'snippet text',
          characterId: null,
          characterIds: null,
          sceneId: null,
          sceneIds: null,
          propId: null,
          propIds: null,
          mediaPath: null,
          mediaStatus: 'EMPTY'
        }
      ],
      storyCharacters: []
    })
    const { svc } = makeSvc({ prisma, store })
    const draft = await svc.openFromStill({ storyId: 's1', entryId: 'e1' })
    expect(draft.professionalPrompt).toMatch(/keyframe|snippet/i)
    expect(draft.polished).toBe(false)
  })

  it('asList paths via characterIds array and string', async () => {
    const prisma = createMockPrisma()
    ;(prisma.story.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 's1',
      title: 'T',
      styleNote: null,
      timeline: [
        {
          id: 'e1',
          order: 0,
          startTime: 0,
          endTime: 3,
          dialogue: null,
          characterId: 'c1',
          characterIds: ['c1', '  ', 'c2'],
          sceneId: 'sc1',
          sceneIds: ['sc1'],
          propId: 'p1',
          propIds: 'p1,p2',
          mediaPath: null,
          mediaStatus: 'EMPTY'
        }
      ],
      storyCharacters: []
    })
    ;(prisma.character.findUnique as ReturnType<typeof vi.fn>).mockImplementation(
      async ({ where }: { where: { id: string } }) => ({
        id: where.id,
        name: where.id,
        description: '',
        refImagePath: null
      })
    )
    const { svc } = makeSvc({ prisma })
    const snap = await svc.getSnapshot('s1')
    expect(snap.cells[0].characterIds).toContain('c1')
  })
})
