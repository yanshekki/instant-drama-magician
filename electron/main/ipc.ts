import type {
  BrowserWindow,
  Dialog,
  IpcMain,
  OpenDialogOptions,
  Shell
} from 'electron'
import type { PrismaClient, StoryStatus } from '../../src/types/prisma'
import { readFileSync, existsSync } from 'fs'
import { GrokCliClient } from '../../src/infrastructure/ai/GrokCliClient'
import { GenerationPipeline } from '../../src/application/GenerationPipeline'
import type {
  CreateCharacterInput,
  CreatePropInput,
  CreateSceneInput,
  CreateStoryInput,
  CreateTimelineEntryInput,
  UpdateTimelineEntryInput
} from '../../src/types/domain'

export interface IpcContext {
  ipcMain: IpcMain
  dialog: Dialog
  shell: Shell
  getPrisma: () => PrismaClient
  getMainWindow: () => BrowserWindow | null
}

export function registerIpcHandlers(ctx: IpcContext): void {
  const { ipcMain, dialog, shell, getPrisma, getMainWindow } = ctx
  const aiClient = new GrokCliClient()
  const pipeline = new GenerationPipeline(aiClient)

  // ─── Stories ───────────────────────────────────────────────
  ipcMain.handle('stories:list', async () => {
    return getPrisma().story.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: { characters: true, scenes: true, props: true, timeline: true }
        }
      }
    })
  })

  ipcMain.handle('stories:get', async (_e, id: string) => {
    return getPrisma().story.findUnique({
      where: { id },
      include: {
        characters: true,
        scenes: { orderBy: { sceneNumber: 'asc' } },
        props: true,
        timeline: { orderBy: { order: 'asc' } }
      }
    })
  })

  ipcMain.handle('stories:create', async (_e, input: CreateStoryInput) => {
    return getPrisma().story.create({
      data: { title: input.title }
    })
  })

  ipcMain.handle('stories:update', async (_e, id: string, data: { title?: string; status?: StoryStatus }) => {
    return getPrisma().story.update({ where: { id }, data })
  })

  ipcMain.handle('stories:delete', async (_e, id: string) => {
    await getPrisma().story.delete({ where: { id } })
    return { ok: true }
  })

  // ─── Characters ────────────────────────────────────────────
  ipcMain.handle('characters:list', async (_e, storyId: string) => {
    return getPrisma().character.findMany({
      where: { storyId },
      orderBy: { name: 'asc' }
    })
  })

  ipcMain.handle('characters:create', async (_e, input: CreateCharacterInput) => {
    return getPrisma().character.create({ data: input })
  })

  ipcMain.handle(
    'characters:update',
    async (
      _e,
      id: string,
      data: Partial<Pick<CreateCharacterInput, 'name' | 'description' | 'soulMdPath' | 'refImagePath'>>
    ) => {
      return getPrisma().character.update({ where: { id }, data })
    }
  )

  ipcMain.handle('characters:delete', async (_e, id: string) => {
    await getPrisma().character.delete({ where: { id } })
    return { ok: true }
  })

  ipcMain.handle('characters:importSoulMd', async () => {
    const win = getMainWindow()
    const options: OpenDialogOptions = {
      title: 'Import soul.md',
      filters: [{ name: 'Markdown', extensions: ['md'] }],
      properties: ['openFile']
    }
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options)

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    const filePath = result.filePaths[0]
    if (!existsSync(filePath)) return null
    const content = readFileSync(filePath, 'utf-8')
    return { filePath, content }
  })

  // ─── Scenes ────────────────────────────────────────────────
  ipcMain.handle('scenes:list', async (_e, storyId: string) => {
    return getPrisma().scene.findMany({
      where: { storyId },
      orderBy: { sceneNumber: 'asc' }
    })
  })

  ipcMain.handle('scenes:create', async (_e, input: CreateSceneInput) => {
    return getPrisma().scene.create({ data: input })
  })

  ipcMain.handle(
    'scenes:update',
    async (
      _e,
      id: string,
      data: Partial<Pick<CreateSceneInput, 'sceneNumber' | 'description' | 'script'>>
    ) => {
      return getPrisma().scene.update({ where: { id }, data })
    }
  )

  ipcMain.handle('scenes:delete', async (_e, id: string) => {
    await getPrisma().scene.delete({ where: { id } })
    return { ok: true }
  })

  // ─── Props ─────────────────────────────────────────────────
  ipcMain.handle('props:list', async (_e, storyId: string) => {
    return getPrisma().prop.findMany({
      where: { storyId },
      orderBy: { name: 'asc' }
    })
  })

  ipcMain.handle('props:create', async (_e, input: CreatePropInput) => {
    return getPrisma().prop.create({ data: input })
  })

  ipcMain.handle(
    'props:update',
    async (_e, id: string, data: Partial<Pick<CreatePropInput, 'name' | 'description'>>) => {
      return getPrisma().prop.update({ where: { id }, data })
    }
  )

  ipcMain.handle('props:delete', async (_e, id: string) => {
    await getPrisma().prop.delete({ where: { id } })
    return { ok: true }
  })

  // ─── Timeline ──────────────────────────────────────────────
  ipcMain.handle('timeline:list', async (_e, storyId: string) => {
    return getPrisma().timelineEntry.findMany({
      where: { storyId },
      orderBy: { order: 'asc' }
    })
  })

  ipcMain.handle('timeline:create', async (_e, input: CreateTimelineEntryInput) => {
    return getPrisma().timelineEntry.create({ data: input })
  })

  ipcMain.handle(
    'timeline:update',
    async (_e, id: string, data: UpdateTimelineEntryInput) => {
      return getPrisma().timelineEntry.update({ where: { id }, data })
    }
  )

  ipcMain.handle('timeline:delete', async (_e, id: string) => {
    await getPrisma().timelineEntry.delete({ where: { id } })
    return { ok: true }
  })

  ipcMain.handle(
    'timeline:reorder',
    async (_e, storyId: string, orderedIds: string[]) => {
      const prisma = getPrisma()
      await prisma.$transaction(
        orderedIds.map((id, index) =>
          prisma.timelineEntry.update({
            where: { id },
            data: { order: index }
          })
        )
      )
      return getPrisma().timelineEntry.findMany({
        where: { storyId },
        orderBy: { order: 'asc' }
      })
    }
  )

  // ─── Generation ────────────────────────────────────────────
  ipcMain.handle('generation:run', async (_e, storyId: string) => {
    const story = await getPrisma().story.findUnique({
      where: { id: storyId },
      include: {
        characters: true,
        scenes: true,
        props: true,
        timeline: { orderBy: { order: 'asc' } }
      }
    })
    if (!story) throw new Error(`Story not found: ${storyId}`)

    await getPrisma().story.update({
      where: { id: storyId },
      data: { status: 'GENERATING' }
    })

    try {
      const result = await pipeline.run(story)
      await getPrisma().story.update({
        where: { id: storyId },
        data: { status: 'COMPLETED' }
      })
      return result
    } catch (error) {
      await getPrisma().story.update({
        where: { id: storyId },
        data: { status: 'FAILED' }
      })
      throw error
    }
  })

  ipcMain.handle('ai:status', async () => {
    return aiClient.getStatus()
  })

  // ─── Shell helpers ─────────────────────────────────────────
  ipcMain.handle('shell:openExternal', async (_e, url: string) => {
    await shell.openExternal(url)
    return { ok: true }
  })
}
