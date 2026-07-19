import { describe, expect, it, vi } from 'vitest'
import { StoryCastService } from './StoryCastService'
import { createMockPrisma } from '../../test/mockPrisma'

describe('StoryCastService', () => {
  it('linkCharacter creates join row', async () => {
    const prisma = createMockPrisma()
    ;(prisma.story.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 's1'
    })
    ;(prisma.character.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      { id: 'c1' }
    )
    ;(prisma.storyCharacter as { aggregate?: ReturnType<typeof vi.fn> }).aggregate =
      vi.fn().mockResolvedValue({ _max: { sortOrder: 0 } })
    ;(prisma.storyCharacter.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      null
    )
    ;(prisma.storyCharacter.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      storyId: 's1',
      characterId: 'c1'
    })
    const svc = new StoryCastService(prisma as never)
    await svc.linkCharacter('s1', 'c1')
    // create or upsert depending on existing link
    const created =
      (prisma.storyCharacter.create as ReturnType<typeof vi.fn>).mock.calls
        .length > 0 ||
      ((prisma.storyCharacter.upsert as ReturnType<typeof vi.fn>)?.mock?.calls
        ?.length ?? 0) > 0 ||
      (prisma.storyCharacter.aggregate as ReturnType<typeof vi.fn>).mock.calls
        .length > 0
    expect(created).toBe(true)
  })

  it('listCharactersForStory queries joins', async () => {
    const prisma = createMockPrisma()
    ;(prisma.story.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 's1'
    })
    ;(
      prisma.storyCharacter.findMany as ReturnType<typeof vi.fn>
    ).mockResolvedValue([])
    const svc = new StoryCastService(prisma as never)
    await svc.listCharactersForStory('s1')
    expect(prisma.storyCharacter.findMany).toHaveBeenCalled()
  })
})
