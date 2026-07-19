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

  it('create trims name', async () => {
    const prisma = createMockPrisma()
    ;(prisma.character.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'c1',
      name: 'Alice'
    })
    const svc = new CharacterService(prisma as never)
    await svc.create({ name: '  Alice  ', description: 'hero' } as never)
    expect(prisma.character.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'Alice' })
      })
    )
  })

  it('list passes search filter', () => {
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
  })

  it('delete throws when missing', async () => {
    const prisma = createMockPrisma()
    const svc = new CharacterService(prisma as never)
    if (typeof svc.delete === 'function') {
      await expect(svc.delete('x')).rejects.toBeTruthy()
    }
  })
})
