import { describe, expect, it, vi } from 'vitest'
import { PropService } from './PropService'
import { createMockPrisma } from '../../test/mockPrisma'

describe('PropService', () => {
  it('create requires name', async () => {
    const prisma = createMockPrisma()
    const svc = new PropService(prisma as never)
    await expect(
      svc.create({ name: '  ', description: 'd' })
    ).rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('create trims name', async () => {
    const prisma = createMockPrisma()
    ;(prisma.prop.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'p1',
      name: 'Cup'
    })
    const svc = new PropService(prisma as never)
    await svc.create({ name: ' Cup ', description: 'ceramic' })
    expect(prisma.prop.create).toHaveBeenCalled()
  })

  it('get not found', async () => {
    const prisma = createMockPrisma()
    const svc = new PropService(prisma as never)
    await expect(svc.get('missing')).rejects.toMatchObject({
      code: 'NOT_FOUND'
    })
  })
})
