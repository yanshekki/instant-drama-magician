import { describe, expect, it, vi } from 'vitest'
import { SceneService } from './SceneService'
import { createMockPrisma } from '../../test/mockPrisma'

describe('SceneService', () => {
  it('create validates description', async () => {
    const prisma = createMockPrisma()
    const svc = new SceneService(prisma as never)
    await expect(svc.create({ description: '' })).rejects.toMatchObject({
      code: 'VALIDATION'
    })
  })

  it('create persists trimmed description', async () => {
    const prisma = createMockPrisma()
    ;(prisma.scene.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'sc1',
      description: 'Hallway'
    })
    const svc = new SceneService(prisma as never)
    await svc.create({ description: '  Hallway  ' })
    expect(prisma.scene.create).toHaveBeenCalled()
  })

  it('get throws NOT_FOUND', async () => {
    const prisma = createMockPrisma()
    const svc = new SceneService(prisma as never)
    await expect(svc.get('x')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('list supports query', () => {
    const prisma = createMockPrisma()
    const svc = new SceneService(prisma as never)
    void svc.list({ q: 'rain' })
    expect(prisma.scene.findMany).toHaveBeenCalled()
  })
})
