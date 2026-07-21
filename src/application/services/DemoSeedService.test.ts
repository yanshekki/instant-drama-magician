import { describe, expect, it, vi } from 'vitest'
import { DemoSeedService } from './DemoSeedService'
import { createMockPrisma } from '../../test/mockPrisma'

function seedPrisma() {
  const prisma = createMockPrisma()
  let n = 0
  const id = (prefix: string) => `${prefix}${++n}`
  ;(prisma.story.create as ReturnType<typeof vi.fn>).mockImplementation(
    async ({ data }: { data: { title: string } }) => ({
      id: id('s'),
      title: data.title
    })
  )
  ;(prisma.character.create as ReturnType<typeof vi.fn>).mockImplementation(
    async ({ data }: { data: { name: string } }) => ({
      id: id('c'),
      name: data.name
    })
  )
  ;(prisma.scene.create as ReturnType<typeof vi.fn>).mockImplementation(
    async ({ data }: { data: { title?: string } }) => ({
      id: id('sc'),
      title: data.title
    })
  )
  ;(prisma.prop.create as ReturnType<typeof vi.fn>).mockImplementation(
    async ({ data }: { data: { name: string } }) => ({
      id: id('p'),
      name: data.name
    })
  )
  ;(prisma.storyCharacter.createMany as ReturnType<typeof vi.fn>).mockResolvedValue({
    count: 2
  })
  ;(prisma.storyScene.createMany as ReturnType<typeof vi.fn>).mockResolvedValue({
    count: 2
  })
  ;(prisma.storyProp.create as ReturnType<typeof vi.fn>).mockResolvedValue({})
  ;(prisma.timelineEntry.createMany as ReturnType<typeof vi.fn>).mockResolvedValue({
    count: 2
  })
  return prisma
}

describe('DemoSeedService', () => {
  it('is constructible', () => {
    const fake = {} as ConstructorParameters<typeof DemoSeedService>[0]
    expect(() => new DemoSeedService(fake)).not.toThrow()
  })

  it('seed zh-HK creates full demo graph', async () => {
    const prisma = seedPrisma()
    const svc = new DemoSeedService(prisma as never)
    const r = await svc.seed('zh-HK')
    expect(r.storyId).toMatch(/^s/)
    expect(r.title).toContain('Demo')
    expect(prisma.story.create).toHaveBeenCalled()
    expect(prisma.character.create).toHaveBeenCalledTimes(2)
    expect(prisma.scene.create).toHaveBeenCalledTimes(2)
    expect(prisma.prop.create).toHaveBeenCalledTimes(1)
    expect(prisma.storyCharacter.createMany).toHaveBeenCalled()
    expect(prisma.storyScene.createMany).toHaveBeenCalled()
    expect(prisma.timelineEntry.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            startTime: 0,
            endTime: 8,
            order: 0,
            mediaStatus: 'EMPTY'
          }),
          expect.objectContaining({
            startTime: 8,
            endTime: 16,
            order: 1
          })
        ])
      })
    )
  })

  it('seed en uses English copy', async () => {
    const prisma = seedPrisma()
    const svc = new DemoSeedService(prisma as never)
    const r = await svc.seed('en')
    expect(r.title).toMatch(/School Bus|Last Stop/i)
    const storyCall = (prisma.story.create as ReturnType<typeof vi.fn>).mock
      .calls[0][0]
    expect(storyCall.data.styleNote).toMatch(/gold-light|cinematic/i)
    const charNames = (prisma.character.create as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: [{ data: { name: string } }]) => c[0].data.name
    )
    expect(charNames).toContain('Ming')
    expect(charNames).toContain('Yau')
  })

  it('seed defaults to zh-HK', async () => {
    const prisma = seedPrisma()
    const svc = new DemoSeedService(prisma as never)
    const r = await svc.seed()
    expect(r.title).toMatch(/Demo/)
  })
})
