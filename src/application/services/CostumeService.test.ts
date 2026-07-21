import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createMockPrisma } from '../../test/mockPrisma'

// Module-level migrateDone cache — reimport after reset for clean migration tests
async function loadService() {
  vi.resetModules()
  const mod = await import('./CostumeService')
  return mod.CostumeService
}

function costumeRow(partial: Record<string, unknown> = {}) {
  return {
    id: 'co1',
    name: 'Suit',
    description: 'black suit',
    artStyle: null,
    refImagePath: null,
    refGalleryJson: null,
    seedPrompt: null,
    hardRules: null,
    characterLinks: [],
    ...partial
  }
}

describe('CostumeService', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('list returns costumes after migration check', async () => {
    const CostumeService = await loadService()
    const prisma = createMockPrisma()
    ;(prisma.character.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(prisma.costume.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      costumeRow()
    ])
    const svc = new CostumeService(prisma as never)
    const rows = await svc.list()
    expect(Array.isArray(rows)).toBe(true)
    expect(prisma.costume.findMany).toHaveBeenCalled()
  })

  it('create rejects empty description', async () => {
    const CostumeService = await loadService()
    const prisma = createMockPrisma()
    const svc = new CostumeService(prisma as never)
    await expect(
      svc.create({ name: 'Suit', description: '   ' })
    ).rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('ensureMigratedFromJson migrates costumesJson and active costume', async () => {
    const CostumeService = await loadService()
    const prisma = createMockPrisma()
    ;(prisma.character.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 'c1',
        costume: 'red jacket',
        artStyle: 'noir',
        costumesJson: JSON.stringify([
          {
            id: 'e1',
            name: 'Jacket',
            description: 'red jacket',
            artStyle: 'noir',
            imagePath: '/j.png',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          {
            id: 'e2',
            name: 'Dup',
            description: 'red jacket',
            artStyle: null,
            imagePath: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          {
            id: 'e3',
            name: 'Empty',
            description: '   ',
            artStyle: null,
            imagePath: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ])
      },
      {
        id: 'c2',
        costume: 'blue coat',
        artStyle: null,
        costumesJson: null
      }
    ])
    ;(prisma.costume.findFirst as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
    ;(prisma.costume.create as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ id: 'co-new1' })
      .mockResolvedValueOnce({ id: 'co-new2' })
    ;(prisma.characterCostume.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      null
    )
    ;(prisma.characterCostume.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({})

    const svc = new CostumeService(prisma as never)
    const r1 = await svc.ensureMigratedFromJson()
    expect(r1.created).toBeGreaterThanOrEqual(1)
    // second call short-circuits after migrateDone
    const r2 = await svc.ensureMigratedFromJson()
    expect(r2).toEqual({ created: 0, linked: 0 })
  })

  it('ensureMigratedFromJson handles concurrent create race', async () => {
    const CostumeService = await loadService()
    const prisma = createMockPrisma()
    ;(prisma.character.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 'c1',
        costume: null,
        artStyle: null,
        costumesJson: JSON.stringify([
          {
            id: 'e1',
            name: 'A',
            description: 'look A',
            artStyle: null,
            imagePath: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ])
      }
    ])
    ;(prisma.costume.findFirst as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'co-race' })
    ;(prisma.costume.create as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('unique')
    )
    ;(prisma.characterCostume.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      characterId: 'c1',
      costumeId: 'co-race'
    })
    ;(prisma.characterCostume.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({})

    const svc = new CostumeService(prisma as never)
    const r = await svc.ensureMigratedFromJson()
    expect(r.created).toBe(0)
    expect(r.linked).toBe(0)
  })

  it('ensureMigratedFromJson throws when race re-fetch fails', async () => {
    const CostumeService = await loadService()
    const prisma = createMockPrisma()
    ;(prisma.character.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 'c1',
        costume: null,
        artStyle: null,
        costumesJson: JSON.stringify([
          {
            id: 'e1',
            name: 'A',
            description: 'look A',
            artStyle: null,
            imagePath: '/a.png',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ])
      }
    ])
    ;(prisma.costume.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    ;(prisma.costume.create as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('unique')
    )
    const svc = new CostumeService(prisma as never)
    await expect(svc.ensureMigratedFromJson()).rejects.toMatchObject({
      code: 'INTERNAL'
    })
  })

  it('ensureMigratedFromJson reuses existing costume description', async () => {
    const CostumeService = await loadService()
    const prisma = createMockPrisma()
    ;(prisma.character.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 'c1',
        costume: null,
        artStyle: null,
        costumesJson: JSON.stringify([
          {
            id: 'e1',
            name: 'A',
            description: 'shared look',
            artStyle: null,
            imagePath: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ])
      }
    ])
    ;(prisma.costume.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'co-existing'
    })
    ;(prisma.characterCostume.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      null
    )
    ;(prisma.characterCostume.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({})
    const svc = new CostumeService(prisma as never)
    const r = await svc.ensureMigratedFromJson()
    expect(r.created).toBe(0)
    expect(r.linked).toBe(1)
    expect(prisma.costume.create).not.toHaveBeenCalled()
  })

  it('list supports q, characterId, unlinkedOnly filters', async () => {
    const CostumeService = await loadService()
    const prisma = createMockPrisma()
    ;(prisma.character.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(prisma.costume.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    const svc = new CostumeService(prisma as never)
    await svc.list({ q: 'suit', characterId: 'c1', unlinkedOnly: true })
    expect(prisma.costume.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.any(Array)
        })
      })
    )
  })

  it('listForCharacter maps dressedImagePath', async () => {
    const CostumeService = await loadService()
    const prisma = createMockPrisma()
    ;(prisma.character.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(
      prisma.characterCostume.findMany as ReturnType<typeof vi.fn>
    ).mockResolvedValue([
      {
        characterId: 'c1',
        dressedImagePath: '/d.png',
        sortOrder: 0,
        costume: costumeRow()
      }
    ])
    const svc = new CostumeService(prisma as never)
    const rows = await svc.listForCharacter('c1')
    expect(rows[0]).toMatchObject({
      id: 'co1',
      dressedImagePath: '/d.png',
      isActive: false
    })
  })

  it('get throws NOT_FOUND', async () => {
    const CostumeService = await loadService()
    const prisma = createMockPrisma()
    ;(prisma.character.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(prisma.costume.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const svc = new CostumeService(prisma as never)
    await expect(svc.get('missing')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('create with characterIds validates and links', async () => {
    const CostumeService = await loadService()
    const prisma = createMockPrisma()
    ;(prisma.character.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const svc = new CostumeService(prisma as never)
    await expect(
      svc.create({ name: 'S', description: 'desc', characterIds: ['bad'] })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })

    ;(prisma.character.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'c1'
    })
    ;(prisma.costume.create as ReturnType<typeof vi.fn>).mockResolvedValue(
      costumeRow({ name: 'desc' })
    )
    await svc.create({
      name: '  ',
      description: '  black suit  ',
      artStyle: '  noir  ',
      refImagePath: '  ',
      characterIds: ['c1', 'c1']
    })
    expect(prisma.costume.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'black suit',
          description: 'black suit',
          artStyle: 'noir',
          refImagePath: null,
          characterLinks: {
            create: [{ characterId: 'c1', sortOrder: 0 }]
          }
        })
      })
    )
  })

  it('create without characterIds omits links', async () => {
    const CostumeService = await loadService()
    const prisma = createMockPrisma()
    ;(prisma.costume.create as ReturnType<typeof vi.fn>).mockResolvedValue(costumeRow())
    const svc = new CostumeService(prisma as never)
    await svc.create({ name: 'Suit', description: 'black' })
    expect(prisma.costume.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          characterLinks: undefined
        })
      })
    )
  })

  it('update validates description and replaces character links', async () => {
    const CostumeService = await loadService()
    const prisma = createMockPrisma()
    ;(prisma.character.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(prisma.costume.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      costumeRow()
    )
    ;(prisma.costume.update as ReturnType<typeof vi.fn>).mockResolvedValue(costumeRow())
    const svc = new CostumeService(prisma as never)

    await expect(svc.update('co1', { description: '  ' })).rejects.toMatchObject({
      code: 'VALIDATION'
    })

    ;(prisma.character.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    await expect(
      svc.update('co1', { characterIds: ['bad'] })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })

    ;(prisma.character.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'c1'
    })
    ;(
      prisma.characterCostume.deleteMany as ReturnType<typeof vi.fn>
    ).mockResolvedValue({ count: 1 })
    ;(
      prisma.characterCostume.createMany as ReturnType<typeof vi.fn>
    ).mockResolvedValue({ count: 1 })
    await svc.update('co1', {
      name: '  New  ',
      description: '  updated  ',
      artStyle: '  a  ',
      refImagePath: null,
      refGalleryJson: '  []  ',
      seedPrompt: '  p  ',
      hardRules: '  r  ',
      characterIds: ['c1']
    })
    expect(prisma.characterCostume.deleteMany).toHaveBeenCalled()
    expect(prisma.characterCostume.createMany).toHaveBeenCalled()
    expect(prisma.costume.update).toHaveBeenCalled()

    // empty characterIds only deletes
    await svc.update('co1', { characterIds: [] })
    // name only without trim empty -> undefined name path
    await svc.update('co1', { name: '   ' })
  })

  it('delete blocks when active on character', async () => {
    const CostumeService = await loadService()
    const prisma = createMockPrisma()
    ;(prisma.character.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(prisma.costume.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      costumeRow({
        description: 'black suit',
        characterLinks: [
          {
            characterId: 'c1',
            character: { id: 'c1', name: 'Ming', costume: 'Black Suit' }
          }
        ]
      })
    )
    const svc = new CostumeService(prisma as never)
    await expect(svc.delete('co1')).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('delete succeeds when not active', async () => {
    const CostumeService = await loadService()
    const prisma = createMockPrisma()
    ;(prisma.character.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(prisma.costume.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      costumeRow({
        characterLinks: [
          {
            characterId: 'c1',
            character: { id: 'c1', name: 'Ming', costume: 'other' }
          }
        ]
      })
    )
    ;(prisma.costume.delete as ReturnType<typeof vi.fn>).mockResolvedValue({})
    const svc = new CostumeService(prisma as never)
    await expect(svc.delete('co1')).resolves.toEqual({ ok: true })
  })

  it('linkCharacter and unlinkCharacter', async () => {
    const CostumeService = await loadService()
    const prisma = createMockPrisma()
    ;(prisma.character.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(prisma.costume.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      costumeRow({
        characterLinks: [
          {
            characterId: 'c1',
            character: { id: 'c1', name: 'Ming', costume: 'black suit' }
          }
        ]
      })
    )
    ;(prisma.character.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const svc = new CostumeService(prisma as never)
    await expect(svc.linkCharacter('co1', 'bad')).rejects.toMatchObject({
      code: 'NOT_FOUND'
    })

    ;(prisma.character.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'c1'
    })
    ;(prisma.characterCostume.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({})
    await svc.linkCharacter('co1', 'c1')
    expect(prisma.characterCostume.upsert).toHaveBeenCalled()

    await expect(svc.unlinkCharacter('co1', 'c1')).rejects.toMatchObject({
      code: 'CONFLICT'
    })

    ;(prisma.costume.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      costumeRow({
        characterLinks: [
          {
            characterId: 'c1',
            character: { id: 'c1', name: 'Ming', costume: 'other' }
          }
        ]
      })
    )
    ;(
      prisma.characterCostume.deleteMany as ReturnType<typeof vi.fn>
    ).mockResolvedValue({ count: 1 })
    await svc.unlinkCharacter('co1', 'c1')
    expect(prisma.characterCostume.deleteMany).toHaveBeenCalled()
  })

  it('setActiveOnCharacter and setDressedImage', async () => {
    const CostumeService = await loadService()
    const prisma = createMockPrisma()
    ;(prisma.character.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(prisma.costume.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      costumeRow({ description: 'black suit', artStyle: 'noir' })
    )
    ;(prisma.character.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'c1'
    })
    ;(prisma.characterCostume.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({})
    ;(prisma.character.update as ReturnType<typeof vi.fn>).mockResolvedValue({})
    ;(prisma.characterCostume.update as ReturnType<typeof vi.fn>).mockResolvedValue({})
    const svc = new CostumeService(prisma as never)
    await svc.setActiveOnCharacter('co1', 'c1')
    expect(prisma.character.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          costume: 'black suit',
          artStyle: 'noir'
        })
      })
    )
    await svc.setDressedImage('co1', 'c1', '/dressed.png')
    expect(prisma.characterCostume.update).toHaveBeenCalled()
  })

  it('setActiveOnCharacter without artStyle omits artStyle field', async () => {
    const CostumeService = await loadService()
    const prisma = createMockPrisma()
    ;(prisma.character.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(prisma.costume.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      costumeRow({ artStyle: null })
    )
    ;(prisma.character.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'c1'
    })
    ;(prisma.characterCostume.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({})
    ;(prisma.character.update as ReturnType<typeof vi.fn>).mockResolvedValue({})
    const svc = new CostumeService(prisma as never)
    await svc.setActiveOnCharacter('co1', 'c1')
    const call = (prisma.character.update as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(call.data.costume).toBe('black suit')
    expect(call.data.artStyle).toBeUndefined()
  })

  it('concurrent ensureMigratedFromJson shares inflight', async () => {
    const CostumeService = await loadService()
    const prisma = createMockPrisma()
    let resolveFind: (v: unknown) => void
    const slow = new Promise((r) => {
      resolveFind = r
    })
    ;(prisma.character.findMany as ReturnType<typeof vi.fn>).mockReturnValue(slow)
    const svc = new CostumeService(prisma as never)
    const p1 = svc.ensureMigratedFromJson()
    const p2 = svc.ensureMigratedFromJson()
    resolveFind!([])
    const [a, b] = await Promise.all([p1, p2])
    expect(a).toEqual(b)
  })
})
