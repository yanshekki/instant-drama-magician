import { describe, expect, it, vi } from 'vitest'
import { makeHandlerContext, invokeRegistered } from '../../test/handlerTestUtils'
import { registerStorycastHandlers } from './storyCast'

describe('registerStorycastHandlers', () => {
  it('registers domain channels', () => {
    const ctx = makeHandlerContext()
    registerStorycastHandlers(ctx)
    const handlers = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(handlers.has('stories:linkCharacter')).toBe(true)
    expect(handlers.has('stories:setCharacterCostume')).toBe(true)
    expect(handlers.has('stories:unlinkCharacter')).toBe(true)
    expect(handlers.has('stories:linkScene')).toBe(true)
    expect(handlers.has('stories:linkProp')).toBe(true)
  })

  it('delegates link/unlink via StoryCastService prisma', async () => {
    const linkCharacter = vi.fn(async () => ({ ok: true }))
    const unlinkCharacter = vi.fn(async () => ({ ok: true }))
    const setCharacterCostume = vi.fn(async () => ({ ok: true }))
    const linkScene = vi.fn(async () => ({ ok: true }))
    const unlinkScene = vi.fn(async () => ({ ok: true }))
    const linkProp = vi.fn(async () => ({ ok: true }))
    const unlinkProp = vi.fn(async () => ({ ok: true }))

    // StoryCastService is constructed with prisma — mock module methods by
    // patching prototype for this test file.
    const { StoryCastService } = await import(
      '../../application/services/StoryCastService'
    )
    vi.spyOn(StoryCastService.prototype, 'linkCharacter').mockImplementation(
      linkCharacter as never
    )
    vi.spyOn(StoryCastService.prototype, 'unlinkCharacter').mockImplementation(
      unlinkCharacter as never
    )
    vi.spyOn(
      StoryCastService.prototype,
      'setCharacterCostume'
    ).mockImplementation(setCharacterCostume as never)
    vi.spyOn(StoryCastService.prototype, 'linkScene').mockImplementation(
      linkScene as never
    )
    vi.spyOn(StoryCastService.prototype, 'unlinkScene').mockImplementation(
      unlinkScene as never
    )
    vi.spyOn(StoryCastService.prototype, 'linkProp').mockImplementation(
      linkProp as never
    )
    vi.spyOn(StoryCastService.prototype, 'unlinkProp').mockImplementation(
      unlinkProp as never
    )

    const ctx = makeHandlerContext({
      host: {
        mode: 'headless',
        userData: '/tmp/u',
        mediaRoot: '/tmp/m',
        appVersion: '1',
        isPackaged: false,
        platform: 'linux',
        getPrisma: vi.fn(() => ({})),
        settingsStore: { load: vi.fn(() => ({})), save: vi.fn() },
        activity: { append: vi.fn() },
        dialog: {},
        shell: {},
        getMainWindow: () => null
      } as never
    })
    registerStorycastHandlers(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers

    await invokeRegistered(h as never, 'stories:linkCharacter', {
      storyId: 's1',
      characterId: 'c1',
      roleNote: 'lead'
    })
    expect(linkCharacter).toHaveBeenCalled()

    await invokeRegistered(h as never, 'stories:setCharacterCostume', {
      storyId: 's1',
      characterId: 'c1',
      costumeId: 'cos1'
    })
    expect(setCharacterCostume).toHaveBeenCalled()

    await invokeRegistered(h as never, 'stories:unlinkCharacter', {
      storyId: 's1',
      characterId: 'c1'
    })
    await invokeRegistered(h as never, 'stories:linkScene', {
      storyId: 's1',
      sceneId: 'sc1',
      sceneNumber: 1
    })
    await invokeRegistered(h as never, 'stories:unlinkScene', {
      storyId: 's1',
      sceneId: 'sc1'
    })
    await invokeRegistered(h as never, 'stories:linkProp', {
      storyId: 's1',
      propId: 'p1'
    })
    if (h.has('stories:unlinkProp')) {
      await invokeRegistered(h as never, 'stories:unlinkProp', {
        storyId: 's1',
        propId: 'p1'
      })
    }
    expect(unlinkCharacter).toHaveBeenCalled()
    expect(linkScene).toHaveBeenCalled()
  })
})
