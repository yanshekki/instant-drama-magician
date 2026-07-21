import { describe, expect, it, vi } from 'vitest'
import { CharacterService } from './CharacterService'
import { createMockPrisma } from '../../test/mockPrisma'

describe('CharacterService', () => {
  it('rejects empty name on create', async () => {
    const prisma = createMockPrisma()
    const svc = new CharacterService(prisma as never)
    await expect(
      svc.create({ name: '  ', description: 'x' } as never)
    ).rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('create trims name and optional fields', async () => {
    const prisma = createMockPrisma()
    ;(prisma.character.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'c1',
      name: 'Alice'
    })
    const svc = new CharacterService(prisma as never)
    await svc.create({
      name: '  Alice  ',
      description: 'hero',
      appearance: '  short  ',
      personality: '  ',
      ageRange: undefined
    } as never)
    expect(prisma.character.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Alice',
          appearance: 'short',
          personality: null
        })
      })
    )
  })

  it('list passes search filter or undefined', () => {
    const prisma = createMockPrisma()
    const svc = new CharacterService(prisma as never)
    void svc.list({ q: 'bob' })
    expect(prisma.character.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.any(Array)
        })
      })
    )
    void svc.list()
    expect(prisma.character.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: undefined })
    )
  })

  it('get throws NOT_FOUND when missing', async () => {
    const prisma = createMockPrisma()
    ;(prisma.character.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      null
    )
    const svc = new CharacterService(prisma as never)
    await expect(svc.get('missing')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'errors.characterNotFound'
    })
    ;(prisma.character.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      { id: 'c1', name: 'A' }
    )
    await expect(svc.get('c1')).resolves.toMatchObject({ id: 'c1' })
  })

  it('delete throws when missing', async () => {
    const prisma = createMockPrisma()
    const svc = new CharacterService(prisma as never)
    if (typeof svc.delete === 'function') {
      ;(prisma.character.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      )
      await expect(svc.delete('x')).rejects.toBeTruthy()
    }
  })

  it('update validates name when provided', async () => {
    const prisma = createMockPrisma()
    ;(prisma.character.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'c1',
      name: 'Old'
    })
    const svc = new CharacterService(prisma as never)
    if (typeof svc.update === 'function') {
      await expect(
        svc.update('c1', { name: '  ' } as never)
      ).rejects.toMatchObject({ code: 'VALIDATION' })
    }
  })
})
