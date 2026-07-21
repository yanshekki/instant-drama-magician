import { describe, expect, it, vi, beforeEach } from 'vitest'

const invoke = vi.fn(async (ch: string, ...args: unknown[]) => ({ ch, args }))
const on = vi.fn()
const removeListener = vi.fn()
const exposeInMainWorld = vi.fn()

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: (...a: unknown[]) => exposeInMainWorld(...a)
  },
  ipcRenderer: {
    invoke: (...a: unknown[]) => invoke(...a),
    on: (...a: unknown[]) => on(...a),
    removeListener: (...a: unknown[]) => removeListener(...a)
  }
}))

describe('preload', () => {
  beforeEach(() => {
    invoke.mockClear()
    exposeInMainWorld.mockClear()
    vi.resetModules()
  })

  it('exposes api and routes channels', async () => {
    await import('./index')
    expect(exposeInMainWorld).toHaveBeenCalled()
    const api = exposeInMainWorld.mock.calls[0][1] as Record<string, any>
    expect(api._invoke).toBeTypeOf('function')
    await api._invoke('x', [1])
    await api.stories.list()
    await api.stories.get('id')
    await api.stories.create({ title: 't' })
    await api.stories.update('id', { title: 'n' })
    await api.stories.delete('id')
    await api.stories.generateCover({})
    await api.stories.commitCover({})
    await api.stories.seedDemo('en')
    await api.stories.aiFillMeta({})
    await api.stories.aiFillScript({ storyId: 's' })
    await api.stories.linkCharacter({ storyId: 's', characterId: 'c' })
    await api.stories.setCharacterCostume({
      storyId: 's',
      characterId: 'c',
      costumeId: null
    })
    await api.stories.unlinkCharacter({ storyId: 's', characterId: 'c' })
    await api.stories.linkScene({ storyId: 's', sceneId: 'sc' })
    await api.stories.unlinkScene({ storyId: 's', sceneId: 'sc' })
    await api.stories.linkProp({ storyId: 's', propId: 'p' })
    if (api.stories.unlinkProp) {
      await api.stories.unlinkProp({ storyId: 's', propId: 'p' })
    }

    // walk all namespaces and call every function with empty args
    for (const [ns, val] of Object.entries(api)) {
      if (ns === '_invoke' || typeof val !== 'object' || !val) continue
      for (const [method, fn] of Object.entries(val as object)) {
        if (typeof fn !== 'function') continue
        try {
          const ret = (fn as Function)()
          if (ret && typeof (ret as Promise<unknown>).then === 'function') {
            await ret
          } else if (typeof ret === 'function') {
            // unsubscribe
            ret()
          }
        } catch {
          try {
            await (fn as Function)('a', 'b', 'c')
          } catch {
            /* */
          }
        }
        void method
      }
    }
    expect(invoke.mock.calls.length).toBeGreaterThan(5)

    // Explicitly exercise onProgress / onMenuAction / onState listener paths
    // (use last registered listener — walk above may have registered empty ones)
    const progressCb = vi.fn()
    const unsubProg = api.generation.onProgress(progressCb)
    const progressListeners = on.mock.calls
      .filter((c) => c[0] === 'generation:progress')
      .map((c) => c[1] as Function)
    progressListeners[progressListeners.length - 1](
      {},
      { storyId: 's', step: 'video', index: 0, total: 1 }
    )
    expect(progressCb).toHaveBeenCalled()
    unsubProg()
    expect(removeListener).toHaveBeenCalledWith(
      'generation:progress',
      expect.any(Function)
    )

    const menuCb = vi.fn()
    const unsubMenu = api.app.onMenuAction(menuCb)
    const menuListeners = on.mock.calls
      .filter((c) => c[0] === 'menu:action')
      .map((c) => c[1] as Function)
    menuListeners[menuListeners.length - 1]?.({}, {
      type: 'screenshot-saved',
      filePath: '/x'
    })
    expect(menuCb).toHaveBeenCalled()
    unsubMenu()

    const stateCb = vi.fn()
    const unsubState = api.updates.onState(stateCb)
    const stateListeners = on.mock.calls
      .filter((c) => c[0] === 'updates:state')
      .map((c) => c[1] as Function)
    stateListeners[stateListeners.length - 1]?.(
      {},
      { status: 'idle', currentVersion: '1.0.0', channel: 'desktop-dev' }
    )
    expect(stateCb).toHaveBeenCalled()
    unsubState()
  })
})
