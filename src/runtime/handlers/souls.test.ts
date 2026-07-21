import { describe, expect, it, vi, afterEach } from 'vitest'
import { writeFileSync, mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { makeHandlerContext, invokeRegistered } from '../../test/handlerTestUtils'
import { registerSoulsHandlers } from './souls'
import { SoulMdHubClient } from '../../infrastructure/soulmd/SoulMdHubClient'

describe('registerSoulsHandlers', () => {
  let dir: string | undefined
  afterEach(() => {
    if (dir) {
      rmSync(dir, { recursive: true, force: true })
      dir = undefined
    }
    vi.restoreAllMocks()
  })

  it('registers domain channels', () => {
    const ctx = makeHandlerContext()
    registerSoulsHandlers(ctx)
    const handlers = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(handlers.has('souls:list')).toBe(true)
    expect(handlers.has('souls:get')).toBe(true)
    expect(handlers.has('souls:categories')).toBe(true)
  })

  it('list/get/categories via hub client', async () => {
    vi.spyOn(SoulMdHubClient.prototype, 'listSouls').mockResolvedValue({
      success: true,
      count: 1,
      data: [{ id: 1, title: 'T', description: 'd', role: null, domain: null }]
    })
    vi.spyOn(SoulMdHubClient.prototype, 'getSoul').mockResolvedValue({
      id: 1,
      title: 'T',
      description: 'd',
      role: null,
      domain: null,
      content: '# Soul\nHello',
      file_type: 'md'
    })
    vi.spyOn(SoulMdHubClient.prototype, 'listCategories').mockResolvedValue([
      { id: 1, name: 'Role', slug: 'r', icon: 'x' }
    ])
    vi.spyOn(SoulMdHubClient, 'flattenContent').mockReturnValue('flat content')

    const ctx = makeHandlerContext()
    registerSoulsHandlers(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    await expect(invokeRegistered(h as never, 'souls:list', { q: 'a' })).resolves.toMatchObject({
      count: 1
    })
    const detail = (await invokeRegistered(h as never, 'souls:get', 1)) as {
      contentFlat: string
    }
    expect(detail.contentFlat).toBe('flat content')
    await expect(invokeRegistered(h as never, 'souls:categories')).resolves.toHaveLength(1)
  })

  it('ensureIndex cache hit, rebuild, suggestions, searchLocal', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-soul-'))
    const cache = {
      builtAt: '2020',
      pages: 2,
      items: [
        {
          id: 1,
          title: 'Courier',
          description: 'rain',
          role: 'lead',
          domain: 'city'
        }
      ],
      suggestions: [{ kind: 'role' as const, label: 'lead' }]
    }
    const loadCache = vi
      .spyOn(SoulMdHubClient, 'loadCache')
      .mockReturnValueOnce(cache) // ensureIndex cache hit
      .mockReturnValueOnce(null) // ensureIndex force rebuild starts from empty? force ignores cache
      .mockReturnValueOnce(cache) // suggestions hit
      .mockReturnValueOnce(null) // suggestions miss
      .mockReturnValueOnce(null) // searchLocal miss
      .mockReturnValueOnce(cache) // searchLocal hit
    const saveCache = vi.spyOn(SoulMdHubClient, 'saveCache').mockImplementation(() => undefined)
    const buildIndex = vi.spyOn(SoulMdHubClient.prototype, 'buildIndex').mockResolvedValue({
      builtAt: '2021',
      pages: 1,
      items: cache.items,
      suggestions: cache.suggestions
    })
    const filterIndex = vi.spyOn(SoulMdHubClient, 'filterIndex').mockReturnValue(cache.items)

    const ctx = makeHandlerContext({ userDataPath: () => dir! })
    registerSoulsHandlers(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers

    const hit = (await invokeRegistered(h as never, 'souls:ensureIndex')) as {
      fromCache: boolean
    }
    expect(hit.fromCache).toBe(true)

    const rebuilt = (await invokeRegistered(h as never, 'souls:ensureIndex', true)) as {
      fromCache: boolean
    }
    expect(rebuilt.fromCache).toBe(false)
    expect(buildIndex).toHaveBeenCalled()
    expect(saveCache).toHaveBeenCalled()

    await expect(invokeRegistered(h as never, 'souls:suggestions')).resolves.toEqual(
      cache.suggestions
    )
    // empty when no cache
    await expect(invokeRegistered(h as never, 'souls:suggestions')).resolves.toEqual([])

    await expect(
      invokeRegistered(h as never, 'souls:searchLocal', 'cou')
    ).resolves.toMatchObject({ fromCache: false, items: [] })
    const search = (await invokeRegistered(h as never, 'souls:searchLocal', 'cou', 10)) as {
      fromCache: boolean
    }
    expect(search.fromCache).toBe(true)
    expect(filterIndex).toHaveBeenCalled()
    expect(loadCache).toHaveBeenCalled()
  })

  it('importSoulMd dialog paths and read/write soul content', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-soul2-'))
    const md = join(dir, 'soul.md')
    writeFileSync(md, '# Name\nDesc body')
    const showOpenDialog = vi
      .fn()
      .mockResolvedValueOnce({ canceled: true, filePaths: [] })
      .mockResolvedValueOnce({ canceled: false, filePaths: [join(dir, 'x.txt')] })
      .mockResolvedValueOnce({ canceled: false, filePaths: [md] })
      .mockResolvedValueOnce({ canceled: false, filePaths: [md] })

    const getSoul = vi.spyOn(SoulMdHubClient.prototype, 'getSoul').mockResolvedValue({
      id: 9,
      title: 'Hub',
      description: 'd',
      role: null,
      domain: null,
      content: '# Hub soul',
      file_type: 'md'
    })
    vi.spyOn(SoulMdHubClient, 'flattenContent').mockReturnValue('hub flat')

    const tmpPath = join(dir, 'soul_edit.md')
    const append = vi.fn()
    const ctx = makeHandlerContext({
      host: {
        ...(makeHandlerContext().host as object),
        getMainWindow: () => ({ id: 1 }),
        dialog: { showOpenDialog, showSaveDialog: vi.fn() }
      } as never,
      activity: {
        append,
        readRecent: vi.fn(),
        query: vi.fn(),
        clear: vi.fn(),
        kinds: vi.fn(),
        path: '/l'
      } as never,
      generation: () =>
        ({
          getMediaStore: () => ({
            ensureTmpDir: vi.fn(),
            tmpImagePath: () => tmpPath
          })
        }) as never
    })
    registerSoulsHandlers(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers

    await expect(
      invokeRegistered(h as never, 'characters:importSoulMd')
    ).resolves.toBeNull()
    await expect(
      invokeRegistered(h as never, 'characters:importSoulMd')
    ).rejects.toMatchObject({ message: 'errors.soulFileMustBeMd' })
    const imp = (await invokeRegistered(h as never, 'characters:importSoulMd')) as {
      filePath: string
      content: string
    }
    expect(imp.filePath).toBe(md)

    // no window
    const ctx2 = makeHandlerContext({
      host: {
        ...(makeHandlerContext().host as object),
        getMainWindow: () => null,
        dialog: {
          showOpenDialog: vi.fn(async () => ({ canceled: false, filePaths: [md] })),
          showSaveDialog: vi.fn()
        }
      } as never
    })
    registerSoulsHandlers(ctx2)
    await invokeRegistered(
      (ctx2 as { handlers: Map<string, unknown> }).handlers as never,
      'characters:importSoulMd'
    )

    // readSoulContent variants
    await expect(
      invokeRegistered(h as never, 'characters:readSoulContent', { soulHubId: 9 })
    ).resolves.toMatchObject({ source: 'hub', content: 'hub flat' })
    await expect(
      invokeRegistered(h as never, 'characters:readSoulContent', {})
    ).resolves.toMatchObject({ source: 'none', content: '' })
    await expect(
      invokeRegistered(h as never, 'characters:readSoulContent', {
        soulMdPath: 'soulmd-hub://9'
      })
    ).resolves.toMatchObject({ source: 'hub' })
    await expect(
      invokeRegistered(h as never, 'characters:readSoulContent', {
        soulMdPath: 'soulmd-hub://not-a-number'
      })
    ).rejects.toMatchObject({ message: 'errors.invalidSoulHubId' })
    await expect(
      invokeRegistered(h as never, 'characters:readSoulContent', {
        soulMdPath: '/missing.md'
      })
    ).rejects.toMatchObject({ message: 'errors.soulMdNotFound' })
    await expect(
      invokeRegistered(h as never, 'characters:readSoulContent', { soulMdPath: md })
    ).resolves.toMatchObject({ source: 'file' })

    // writeSoulContent
    const written = (await invokeRegistered(h as never, 'characters:writeSoulContent', {
      content: '# edited',
      filePath: 'soulmd-hub://1',
      characterId: 'c1'
    })) as { filePath: string }
    expect(written.filePath).toBe(tmpPath)
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'writeSoulContent' })
    )
    // write to existing path
    await invokeRegistered(h as never, 'characters:writeSoulContent', {
      content: '# local',
      filePath: md
    })
    expect(getSoul).toHaveBeenCalled()
  })

  it('importSoulMdUrl validates and fetches', async () => {
    const ctx = makeHandlerContext()
    registerSoulsHandlers(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    await expect(
      invokeRegistered(h as never, 'characters:importSoulMdUrl', 'ftp://x')
    ).rejects.toMatchObject({ message: 'errors.invalidSoulUrl' })

    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => ''
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => '# Title\n\nA soul description paragraph.'
      } as Response)

    await expect(
      invokeRegistered(h as never, 'characters:importSoulMdUrl', 'https://x/soul.md')
    ).rejects.toMatchObject({ message: 'errors.soulFetchFailed' })

    const ok = (await invokeRegistered(
      h as never,
      'characters:importSoulMdUrl',
      'https://x/soul.md'
    )) as { content: string }
    expect(ok.content).toContain('Title')
    expect(fetchMock).toHaveBeenCalled()
  })
})
