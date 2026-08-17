import { describe, expect, it, vi } from 'vitest'
import { makeHandlerContext, invokeRegistered } from '../../test/handlerTestUtils'
import { registerChaptersHandlers } from './chapters'
import { createMockPrisma } from '../../test/mockPrisma'

const CHAPTERS_JSON = JSON.stringify([
  { title: 'Night', body: 'Rain on the roof.' },
  { title: 'Dawn', body: 'They leave.' }
])

const CAST_JSON = JSON.stringify({
  characters: [{ name: 'Ming', description: 'courier', roleNote: 'lead' }],
  scenes: [{ title: 'Roof', description: 'rain' }],
  props: [{ name: 'Umbrella', description: 'black' }],
  actions: [{ name: 'Sprint', description: 'run' }]
})

function prismaWithChapters(
  rows: Array<Record<string, unknown>> = [
    { id: 'ch1', storyId: 's1', order: 0, title: 'Night', body: 'Rain.' }
  ]
) {
  const prisma = createMockPrisma()
  ;(prisma.story.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
    id: 's1',
    artStyle: 'noir'
  })
  ;(prisma.chapter.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(rows)
  ;(prisma.storyCharacter.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
    []
  )
  ;(prisma.storyScene.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
  ;(prisma.storyProp.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
  ;(prisma.storyAction.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
  ;(prisma.character.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
  ;(prisma.scene.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
  ;(prisma.prop.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
  ;(prisma.action.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
  return prisma
}

describe('registerChaptersHandlers', () => {
  it('registers CRUD channels', async () => {
    const svc = {
      list: vi.fn(async () => [{ id: 'ch1' }]),
      create: vi.fn(async (input: unknown) => input),
      update: vi.fn(async (id: string, data: unknown) => ({
        id,
        ...(data as object)
      })),
      delete: vi.fn(async () => ({ ok: true })),
      reorder: vi.fn(async () => [{ id: 'ch1' }]),
      replaceAll: vi.fn(async () => [])
    }
    const ctx = makeHandlerContext({ chapters: () => svc as never })
    registerChaptersHandlers(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(h.has('chapters:list')).toBe(true)
    expect(h.has('chapters:generateCast')).toBe(true)

    await expect(
      invokeRegistered(h as never, 'chapters:list', 's1')
    ).resolves.toEqual([{ id: 'ch1' }])
    await invokeRegistered(h as never, 'chapters:create', {
      storyId: 's1',
      title: 'One'
    })
    await invokeRegistered(h as never, 'chapters:update', 'ch1', { title: 'T' })
    await invokeRegistered(h as never, 'chapters:delete', 'ch1')
    await invokeRegistered(h as never, 'chapters:reorder', 's1', ['ch1'])
    expect(svc.reorder).toHaveBeenCalledWith('s1', ['ch1'])
  })

  it('aiFill appends without replaceAll and interpolates count/words', async () => {
    const chat = vi.fn().mockResolvedValue({
      choices: [{ message: { content: CHAPTERS_JSON } }]
    })
    const svc = {
      list: vi.fn(async () => [{ id: 'ch1', title: 'Old', body: 'x' }]),
      replaceAll: vi.fn(),
      appendAll: vi.fn(async () => [
        { id: 'ch1', title: 'Old', body: 'x' },
        { id: 'n1', title: 'Night', body: 'Rain on the roof.' }
      ]),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      reorder: vi.fn()
    }
    const ctx = makeHandlerContext({
      aiClient: { chat, generateImage: vi.fn() },
      chapters: () => svc as never,
      stories: () =>
        ({
          get: vi.fn(async () => ({ id: 's1', title: 'Rain' }))
        }) as never
    })
    registerChaptersHandlers(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    const appended = (await invokeRegistered(h as never, 'chapters:aiFill', {
      storyId: 's1',
      idea: 'chase',
      locale: 'en',
      replace: false,
      chapterCount: 6,
      wordsPerChapter: 200
    })) as { replaced: boolean; chapters: unknown[] }
    expect(appended.replaced).toBe(false)
    expect(appended.chapters).toHaveLength(2)
    expect(svc.appendAll).toHaveBeenCalled()
    expect(svc.replaceAll).not.toHaveBeenCalled()
    const req = chat.mock.calls[0][0] as {
      messages: Array<{ content: string }>
      max_tokens: number
    }
    expect(req.messages[0].content).toMatch(/exactly 6 chapters/)
    expect(req.messages[0].content).toMatch(/about 200 words/)
    expect(req.max_tokens).toBe(2800)

    chat.mockClear()
    svc.appendAll.mockClear()
    svc.replaceAll.mockResolvedValue([
      { id: 'n1', title: 'Night', body: 'Rain on the roof.' }
    ])
    const filled = (await invokeRegistered(h as never, 'chapters:aiFill', {
      storyId: 's1',
      idea: 'chase',
      locale: 'en',
      replace: true
    })) as { replaced: boolean }
    expect(filled.replaced).toBe(true)
    expect(svc.replaceAll).toHaveBeenCalled()
    expect(svc.appendAll).not.toHaveBeenCalled()
  })

  it('aiPolish updates one chapter', async () => {
    const chat = vi.fn(async () => ({
      choices: [
        { message: { content: '{"title":"Polished","body":"Clearer rain."}' } }
      ]
    }))
    const svc = {
      list: vi.fn(async () => [
        { id: 'ch1', title: 'Old', body: 'Rain.' }
      ]),
      update: vi.fn(async () => ({
        id: 'ch1',
        title: 'Polished',
        body: 'Clearer rain.'
      })),
      replaceAll: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      reorder: vi.fn()
    }
    const ctx = makeHandlerContext({
      aiClient: { chat, generateImage: vi.fn() },
      chapters: () => svc as never,
      stories: () =>
        ({
          get: vi.fn(async () => ({ id: 's1', title: 'Rain' }))
        }) as never
    })
    registerChaptersHandlers(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    await expect(
      invokeRegistered(h as never, 'chapters:aiPolish', { storyId: 's1' })
    ).rejects.toMatchObject({ message: 'errors.storyIdRequired' })
    const r = (await invokeRegistered(h as never, 'chapters:aiPolish', {
      storyId: 's1',
      chapterId: 'ch1',
      locale: 'en'
    })) as { chapter: { title: string } }
    expect(r.chapter.title).toBe('Polished')
    expect(svc.update).toHaveBeenCalledWith(
      'ch1',
      expect.objectContaining({ title: 'Polished' })
    )
  })

  it('generateCast preview does not write; drafts skip a second LLM', async () => {
    const chat = vi.fn(async () => ({
      choices: [{ message: { content: CAST_JSON } }]
    }))
    const prisma = prismaWithChapters()
    const ctx = makeHandlerContext({
      aiClient: { chat, generateImage: vi.fn() },
      stories: () =>
        ({
          get: vi.fn(async () => ({
            id: 's1',
            title: 'Rain',
            characters: [],
            scenes: [],
            props: []
          }))
        }) as never,
      host: {
        ...(makeHandlerContext().host as object),
        getPrisma: () => prisma
      } as never
    })
    registerChaptersHandlers(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers

    await expect(
      invokeRegistered(h as never, 'chapters:generateCast', { storyId: '' })
    ).rejects.toMatchObject({ message: 'errors.storyIdRequired' })

    const preview = (await invokeRegistered(h as never, 'chapters:generateCast', {
      storyId: 's1',
      locale: 'en',
      preview: true
    })) as {
      preview: boolean
      summary: { create: number }
      drafts: { characters: unknown[] }
    }
    expect(preview.preview).toBe(true)
    expect(preview.summary.create).toBeGreaterThan(0)
    expect(chat).toHaveBeenCalledTimes(1)

    chat.mockClear()
    const applied = (await invokeRegistered(h as never, 'chapters:generateCast', {
      storyId: 's1',
      locale: 'en',
      preview: true,
      drafts: preview.drafts
    })) as { preview: boolean }
    expect(applied.preview).toBe(true)
    expect(chat).not.toHaveBeenCalled()
  })

  it('generateCast throws when no chapter body', async () => {
    const prisma = prismaWithChapters([
      { id: 'ch1', storyId: 's1', order: 0, title: 'Empty', body: '' }
    ])
    const ctx = makeHandlerContext({
      host: {
        ...(makeHandlerContext().host as object),
        getPrisma: () => prisma
      } as never
    })
    registerChaptersHandlers(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    await expect(
      invokeRegistered(h as never, 'chapters:generateCast', { storyId: 's1' })
    ).rejects.toMatchObject({ message: 'errors.chaptersRequired' })
  })

  it('aiFill requires storyId; aiPolish requires an existing chapter', async () => {
    const svc = {
      list: vi.fn(async () => [{ id: 'ch1', title: 'Old', body: 'Rain.' }]),
      update: vi.fn(),
      replaceAll: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      reorder: vi.fn()
    }
    const ctx = makeHandlerContext({
      chapters: () => svc as never,
      stories: () =>
        ({ get: vi.fn(async () => ({ id: 's1', title: 'Rain' })) }) as never
    })
    registerChaptersHandlers(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    await expect(
      invokeRegistered(h as never, 'chapters:aiFill', { idea: 'x' })
    ).rejects.toMatchObject({ message: 'errors.storyIdRequired' })
    await expect(
      invokeRegistered(h as never, 'chapters:aiPolish', {
        storyId: 's1',
        chapterId: 'missing'
      })
    ).rejects.toMatchObject({ message: 'errors.chapterNotFound' })
  })

  it('generateCast apply writes the plan when preview is false', async () => {
    const { ChapterCastService } = await import(
      '../../application/services/ChapterCastService'
    )
    const apply = vi
      .spyOn(ChapterCastService.prototype, 'applyPlan')
      .mockResolvedValue({} as never)
    const chat = vi.fn(async () => ({
      choices: [{ message: { content: CAST_JSON } }]
    }))
    const prisma = prismaWithChapters()
    const ctx = makeHandlerContext({
      aiClient: { chat, generateImage: vi.fn() },
      stories: () =>
        ({
          get: vi.fn(async () => ({
            id: 's1',
            title: 'Rain',
            characters: [],
            scenes: [],
            props: []
          }))
        }) as never,
      host: {
        ...(makeHandlerContext().host as object),
        getPrisma: () => prisma
      } as never
    })
    registerChaptersHandlers(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    const applied = (await invokeRegistered(h as never, 'chapters:generateCast', {
      storyId: 's1',
      locale: 'en',
      preview: false
    })) as { preview: boolean }
    expect(applied.preview).toBe(false)
    expect(apply).toHaveBeenCalled()
    apply.mockRestore()
  })
})
