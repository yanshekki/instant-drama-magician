import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import JSZip from 'jszip'
import type { PrismaClient } from '../../types/prisma'
import { AppError } from '../../types/errors'
import { MediaStore } from '../../infrastructure/media/MediaStore'

const BACKUP_VERSION = 1

export class ProjectBackupService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly media: MediaStore
  ) {}

  async exportStoryToZip(storyId: string, zipPath: string): Promise<string> {
    const story = await this.prisma.story.findUnique({
      where: { id: storyId },
      include: {
        characters: true,
        scenes: true,
        props: true,
        timeline: { orderBy: { order: 'asc' } }
      }
    })
    if (!story) throw new AppError('NOT_FOUND', `Story not found: ${storyId}`)

    const zip = new JSZip()
    zip.file(
      'manifest.json',
      JSON.stringify(
        {
          version: BACKUP_VERSION,
          exportedAt: new Date().toISOString(),
          storyId: story.id,
          title: story.title
        },
        null,
        2
      )
    )
    zip.file('story.json', JSON.stringify(story, null, 2))

    const mediaFolder = zip.folder('media')
    if (mediaFolder) {
      for (const e of story.timeline) {
        if (e.mediaPath && existsSync(e.mediaPath)) {
          mediaFolder.file(
            `clips/${e.id}${extOf(e.mediaPath)}`,
            readFileSync(e.mediaPath)
          )
        }
      }
    }

    const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
    mkdirSync(join(zipPath, '..'), { recursive: true })
    writeFileSync(zipPath, buf)
    return zipPath
  }

  async importZipAsNewStory(zipPath: string): Promise<{ storyId: string; title: string }> {
    if (!existsSync(zipPath)) throw new AppError('NOT_FOUND', 'Backup zip not found')
    const zip = await JSZip.loadAsync(readFileSync(zipPath))
    const storyFile = zip.file('story.json')
    if (!storyFile) throw new AppError('VALIDATION', 'Invalid backup: missing story.json')
    const raw = JSON.parse(await storyFile.async('string')) as {
      title: string
      characters: Array<{
        name: string
        description: string
        soulMdPath: string | null
        refImagePath: string | null
      }>
      scenes: Array<{
        sceneNumber: number
        description: string
        script: string | null
        status?: string
      }>
      props: Array<{ name: string; description: string }>
      timeline: Array<{
        id: string
        startTime: number
        endTime: number
        characterId: string | null
        sceneId: string | null
        propId: string | null
        dialogue: string | null
        order: number
        mediaPath?: string | null
      }>
    }

    const title = `${raw.title} (import)`
    const created = await this.prisma.story.create({ data: { title } })

    const charIdMap = new Map<string, string>()
    const sceneIdMap = new Map<string, string>()
    const propIdMap = new Map<string, string>()

    // Rebuild without old ids — re-link timeline by order only for simplicity
    for (const c of raw.characters ?? []) {
      const row = await this.prisma.character.create({
        data: {
          storyId: created.id,
          name: c.name,
          description: c.description,
          soulMdPath: null,
          refImagePath: null
        }
      })
      // name as soft key
      charIdMap.set(c.name, row.id)
    }
    for (const s of raw.scenes ?? []) {
      const row = await this.prisma.scene.create({
        data: {
          storyId: created.id,
          sceneNumber: s.sceneNumber,
          description: s.description,
          script: s.script,
          status: (s.status as 'PENDING') ?? 'PENDING'
        }
      })
      sceneIdMap.set(String(s.sceneNumber), row.id)
    }
    for (const p of raw.props ?? []) {
      const row = await this.prisma.prop.create({
        data: {
          storyId: created.id,
          name: p.name,
          description: p.description
        }
      })
      propIdMap.set(p.name, row.id)
    }

    this.media.ensureStoryDirs(created.id)
    for (const e of raw.timeline ?? []) {
      let mediaPath: string | null = null
      const mediaFile = zip.file(`media/clips/${e.id}.mp4`) || zip.file(`media/clips/${e.id}.webm`)
      if (mediaFile) {
        const dest = this.media.clipPath(created.id, `imp_${e.order}`)
        writeFileSync(dest, await mediaFile.async('nodebuffer'))
        mediaPath = dest
      }
      await this.prisma.timelineEntry.create({
        data: {
          storyId: created.id,
          startTime: e.startTime,
          endTime: e.endTime,
          dialogue: e.dialogue,
          order: e.order,
          characterId: null,
          sceneId: null,
          propId: null,
          mediaPath,
          mediaStatus: mediaPath ? 'READY' : 'EMPTY'
        }
      })
    }

    return { storyId: created.id, title }
  }
}

function extOf(p: string): string {
  const i = p.lastIndexOf('.')
  return i >= 0 ? p.slice(i) : '.mp4'
}
