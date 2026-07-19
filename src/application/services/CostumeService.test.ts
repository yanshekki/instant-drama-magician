import { describe, expect, it, vi } from 'vitest'
import { CostumeService } from './CostumeService'
import { createMockPrisma } from '../../test/mockPrisma'

describe('CostumeService', () => {
  it('list returns costumes after migration check', async () => {
    const prisma = createMockPrisma()
    ;(prisma.character.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
      []
    )
    ;(prisma.costume.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'co1', name: 'Suit' }
    ])
    const svc = new CostumeService(prisma as never)
    const rows = await svc.list()
    expect(Array.isArray(rows)).toBe(true)
    expect(prisma.costume.findMany).toHaveBeenCalled()
  })

  it('create rejects empty description', async () => {
    const prisma = createMockPrisma()
    const svc = new CostumeService(prisma as never)
    await expect(
      svc.create({ name: 'Suit', description: '   ' })
    ).rejects.toMatchObject({ code: 'VALIDATION' })
  })
})
