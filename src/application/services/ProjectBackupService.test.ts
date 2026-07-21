import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { ProjectBackupService } from './ProjectBackupService'
import { createMockPrisma } from '../../test/mockPrisma'
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  readFileSync,
  existsSync,
  mkdirSync
} from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import JSZip from 'jszip'

describe('ProjectBackupService', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'idm-pb-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  function mediaStub(root = dir) {
    return {
      mediaRoot: root,
      ensureTmpDir: () => undefined,
      ensureStoryDirs: vi.fn(),
      clipPath: (storyId: string, name: string) => join(root, storyId, `${name}.mp4`)
    }
  }

  it('constructs with prisma + media store', () => {
    const prisma = createMockPrisma()
    const svc = new ProjectBackupService(prisma as never, mediaStub() as never)
    expect(svc).toBeTruthy()
  })

  it('exportStoryToZip throws for missing story', async () => {
    const prisma = createMockPrisma()
    ;(prisma.story.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const svc = new ProjectBackupService(prisma as never, mediaStub() as never)
    await expect(
      svc.exportStoryToZip('missing', join(dir, 'out.zip'))
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('exportStoryToZip writes manifest story and clip media', async () => {
    const clip = join(dir, 'clip.mp4')
    writeFileSync(clip, Buffer.from('fake-mp4'))
    const prisma = createMockPrisma()
    ;(prisma.story.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 's1',
      title: 'Rain',
      styleNote: 'neon',
      storyCharacters: [
        { character: { id: 'c1', name: 'Ming', description: 'courier' } }
      ],
      storyScenes: [
        {
          sceneNumber: 1,
          scene: {
            id: 'sc1',
            description: 'alley',
            script: 'go',
            status: 'PENDING',
            title: 'Alley'
          }
        }
      ],
      storyProps: [{ prop: { id: 'p1', name: 'Bag', description: 'red' } }],
      timeline: [
        {
          id: 'e1',
          order: 0,
          startTime: 0,
          endTime: 6,
          characterId: 'c1',
          sceneId: 'sc1',
          propId: 'p1',
          dialogue: 'hi',
          mediaPath: clip
        },
        {
          id: 'e2',
          order: 1,
          startTime: 6,
          endTime: 12,
          characterId: null,
          sceneId: null,
          propId: null,
          dialogue: null,
          mediaPath: join(dir, 'missing.mp4')
        }
      ]
    })
    const zipPath = join(dir, 'story.zip')
    const svc = new ProjectBackupService(prisma as never, mediaStub() as never)
    const out = await svc.exportStoryToZip('s1', zipPath)
    expect(out).toBe(zipPath)
    expect(existsSync(zipPath)).toBe(true)
    const zip = await JSZip.loadAsync(readFileSync(zipPath))
    expect(zip.file('manifest.json')).toBeTruthy()
    expect(zip.file('story.json')).toBeTruthy()
    expect(zip.file('media/clips/e1.mp4')).toBeTruthy()
  })

  it('importZipAsNewStory missing file', async () => {
    const prisma = createMockPrisma()
    const svc = new ProjectBackupService(prisma as never, mediaStub() as never)
    await expect(
      svc.importZipAsNewStory(join(dir, 'nope.zip'))
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('importZipAsNewStory missing story.json', async () => {
    const zip = new JSZip()
    zip.file('manifest.json', '{}')
    const zipPath = join(dir, 'bad.zip')
    writeFileSync(zipPath, await zip.generateAsync({ type: 'nodebuffer' }))
    const prisma = createMockPrisma()
    const svc = new ProjectBackupService(prisma as never, mediaStub() as never)
    await expect(svc.importZipAsNewStory(zipPath)).rejects.toMatchObject({
      code: 'VALIDATION'
    })
  })

  it('importZipAsNewStory recreates story graph and media', async () => {
    const zip = new JSZip()
    zip.file(
      'story.json',
      JSON.stringify({
        title: 'Imported',
        styleNote: '  noir  ',
        characters: [
          { name: 'Ming', description: 'courier' },
          { name: 'Yau', description: 'clerk' }
        ],
        scenes: [
          {
            sceneNumber: 1,
            description: 'bus',
            script: 'wait',
            status: 'PENDING',
            title: 'Stop'
          },
          {
            description: 'door',
            script: null
          }
        ],
        props: [{ name: 'Book', description: 'old' }],
        timeline: [
          {
            id: 'old-e1',
            startTime: 0,
            endTime: 6,
            characterId: null,
            sceneId: null,
            propId: null,
            dialogue: 'hi',
            order: 0
          },
          {
            id: 'old-e2',
            startTime: 6,
            endTime: 12,
            characterId: null,
            sceneId: null,
            propId: null,
            dialogue: null,
            order: 1
          }
        ]
      })
    )
    zip.file('media/clips/old-e1.mp4', Buffer.from('video-bytes'))
    zip.file('media/clips/old-e2.webm', Buffer.from('webm-bytes'))
    const zipPath = join(dir, 'in.zip')
    writeFileSync(zipPath, await zip.generateAsync({ type: 'nodebuffer' }))

    const prisma = createMockPrisma()
    let n = 0
    ;(prisma.story.create as ReturnType<typeof vi.fn>).mockImplementation(
      async ({ data }: { data: { title: string } }) => ({
        id: 's-imp',
        title: data.title
      })
    )
    ;(prisma.character.create as ReturnType<typeof vi.fn>).mockImplementation(
      async () => ({ id: `c${++n}` })
    )
    ;(prisma.scene.create as ReturnType<typeof vi.fn>).mockImplementation(
      async () => ({ id: `sc${++n}` })
    )
    ;(prisma.prop.create as ReturnType<typeof vi.fn>).mockImplementation(
      async () => ({ id: `p${++n}` })
    )
    ;(prisma.storyCharacter.create as ReturnType<typeof vi.fn>).mockResolvedValue({})
    ;(prisma.storyScene.create as ReturnType<typeof vi.fn>).mockResolvedValue({})
    ;(prisma.storyProp.create as ReturnType<typeof vi.fn>).mockResolvedValue({})
    ;(prisma.timelineEntry.create as ReturnType<typeof vi.fn>).mockResolvedValue({})

    const media = mediaStub()
    // ensure parent for clipPath writes
    media.ensureStoryDirs = vi.fn((storyId: string) => {
      mkdirSync(join(dir, storyId), { recursive: true })
    })
    const svc = new ProjectBackupService(prisma as never, media as never)
    const r = await svc.importZipAsNewStory(zipPath)
    expect(r.storyId).toBe('s-imp')
    expect(r.title).toContain('(import)')
    expect(prisma.character.create).toHaveBeenCalledTimes(2)
    expect(prisma.scene.create).toHaveBeenCalledTimes(2)
    expect(prisma.timelineEntry.create).toHaveBeenCalledTimes(2)
    expect(media.ensureStoryDirs).toHaveBeenCalledWith('s-imp')
  })

  it('importZipAsNewStory handles empty arrays and null styleNote', async () => {
    const zip = new JSZip()
    zip.file(
      'story.json',
      JSON.stringify({
        title: 'Empty',
        styleNote: '   ',
        characters: [],
        scenes: [],
        props: [],
        timeline: []
      })
    )
    const zipPath = join(dir, 'empty.zip')
    writeFileSync(zipPath, await zip.generateAsync({ type: 'nodebuffer' }))
    const prisma = createMockPrisma()
    ;(prisma.story.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 's2',
      title: 'Empty (import)'
    })
    const media = mediaStub()
    media.ensureStoryDirs = vi.fn()
    const svc = new ProjectBackupService(prisma as never, media as never)
    const r = await svc.importZipAsNewStory(zipPath)
    expect(r.storyId).toBe('s2')
    expect(prisma.story.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ styleNote: null })
      })
    )
  })
})
