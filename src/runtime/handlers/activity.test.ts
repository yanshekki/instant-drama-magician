import { describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { makeHandlerContext, invokeRegistered } from '../../test/handlerTestUtils'
import { registerActivityHandlers } from './activity'

describe('registerActivityHandlers', () => {
  it('registers domain channels', () => {
    const ctx = makeHandlerContext()
    registerActivityHandlers(ctx)
    const handlers = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(handlers.has('activity:recent')).toBe(true)
    expect(handlers.has('activity:query')).toBe(true)
    expect(handlers.has('activity:clear')).toBe(true)
    expect(handlers.has('diagnostics:full')).toBe(true)
  })

  it('activity recent/query/clear/getPath/openLogFolder', async () => {
    const readRecent = vi.fn(() => [{ kind: 'a', message: 'm', ts: 't' }])
    const query = vi.fn(() => [{ kind: 'ipc', message: 'q', ts: 't' }])
    const clear = vi.fn(() => ({ ok: true as const, path: '/tmp/l' }))
    const kinds = vi.fn(() => ['ipc'])
    const openPath = vi.fn(async () => '')
    const activity = {
      append: vi.fn(),
      readRecent,
      query,
      clear,
      kinds,
      path: '/tmp/idm-test/logs/activity.jsonl'
    }
    const ctx = makeHandlerContext({
      activity: activity as never,
      host: {
        mode: 'headless',
        userData: '/tmp/idm-test',
        mediaRoot: '/tmp/m',
        appVersion: '1',
        isPackaged: false,
        platform: 'linux',
        getPrisma: vi.fn(),
        settingsStore: { load: vi.fn(), save: vi.fn() },
        activity,
        dialog: {},
        shell: { openPath, openExternal: vi.fn(), showItemInFolder: vi.fn() },
        getMainWindow: () => null
      } as never
    })
    registerActivityHandlers(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers

    await expect(
      invokeRegistered(h as never, 'activity:recent', 10)
    ).resolves.toHaveLength(1)
    expect(readRecent).toHaveBeenCalledWith(10)

    const q = (await invokeRegistered(h as never, 'activity:query', {
      kind: 'ipc',
      q: 'x'
    })) as { entries: unknown[]; kinds: string[]; path: string }
    expect(q.entries).toHaveLength(1)
    expect(q.kinds).toEqual(['ipc'])
    expect(q.path).toContain('activity')

    await expect(invokeRegistered(h as never, 'activity:clear')).resolves.toEqual(
      { ok: true, path: '/tmp/l' }
    )
    await expect(
      invokeRegistered(h as never, 'activity:getPath')
    ).resolves.toEqual({ path: activity.path })

    const opened = (await invokeRegistered(
      h as never,
      'activity:openLogFolder'
    )) as { ok: boolean; path: string }
    expect(opened.ok).toBe(true)
    expect(openPath).toHaveBeenCalled()
  })

  it('support:exportReport writes with destPath', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'idm-sup-'))
    try {
      const dest = join(dir, 'report.json')
      const append = vi.fn()
      const ctx = makeHandlerContext({
        activity: {
          append,
          readRecent: vi.fn(() => []),
          query: vi.fn(() => []),
          clear: vi.fn(),
          kinds: vi.fn(() => []),
          path: join(dir, 'a.jsonl')
        } as never,
        settingsStore: {
          load: vi.fn(() => ({
            apiKey: 'secret',
            videoMode: 'auto',
            ttsHttpUrl: ''
          })),
          save: vi.fn(),
          lastLoadMigrated: false
        } as never
      })
      // aiClient getters are on the object - makeHandlerContext already mocks getStatus
      registerActivityHandlers(ctx)
      const h = (ctx as { handlers: Map<string, unknown> }).handlers
      const r = (await invokeRegistered(
        h as never,
        'support:exportReport',
        dest
      )) as { filePath: string }
      expect(r.filePath).toBe(dest)
      expect(append).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'support' })
      )
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('diagnostics:full returns probes and tips', async () => {
    const ctx = makeHandlerContext()
    registerActivityHandlers(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    const d = (await invokeRegistered(h as never, 'diagnostics:full')) as {
      chat: { available: boolean }
      video: { available: boolean }
      tips: string[]
      app: { version: string }
    }
    expect(d.chat).toBeDefined()
    expect(d.video).toBeDefined()
    expect(Array.isArray(d.tips)).toBe(true)
    expect(d.app.version).toBeTruthy()
  })
})
