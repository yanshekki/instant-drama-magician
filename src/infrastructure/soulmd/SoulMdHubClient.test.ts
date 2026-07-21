import { describe, expect, it, vi, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { SoulMdHubClient } from './SoulMdHubClient'

describe('SoulMdHubClient', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('flattens content formats', () => {
    expect(SoulMdHubClient.flattenContent('', 'single_md')).toBe('')
    expect(SoulMdHubClient.flattenContent('## Identity\nHello', 'single_md')).toContain(
      'Hello'
    )
    const content = JSON.stringify({
      'SOUL.md': 'You are a hero',
      'STYLE.md': 'Speak softly',
      'EXTRA.md': 'x',
      num: 1
    })
    const t = SoulMdHubClient.flattenContent(content, 'full_soul_folder')
    expect(t).toContain('hero')
    expect(t).toContain('softly')
    expect(t).toContain('EXTRA')
    expect(SoulMdHubClient.flattenContent('{bad', 'full_soul_folder')).toContain(
      '{bad'
    )
    expect(
      SoulMdHubClient.flattenContent(JSON.stringify({ a: '1' }), undefined)
    ).toContain('a')
  })

  it('filters local index', () => {
    const index = {
      builtAt: new Date().toISOString(),
      pages: 1,
      items: [
        {
          id: 1,
          title: '香港律師',
          description: '法律顧問',
          role: 'Writer',
          domain: 'Legal',
          username: 'u'
        },
        {
          id: 2,
          title: 'Developer · Code',
          description: 'codes',
          role: 'Developer',
          domain: 'Tech, Art'
        }
      ],
      suggestions: []
    }
    expect(SoulMdHubClient.filterIndex(index, '法律', 10)).toHaveLength(1)
    expect(SoulMdHubClient.filterIndex(index, '', 1)).toHaveLength(1)
    expect(SoulMdHubClient.filterIndex(index, 'zzz', 5)).toHaveLength(0)
  })

  it('list/get/categories and buildIndex cache', async () => {
    let pageCalls = 0
    const fetchFn = vi.fn(async (url: string) => {
      const u = String(url)
      if (u.includes('/api/souls')) {
        pageCalls++
        const page = Number(new URL(u).searchParams.get('page') || 1)
        return {
          ok: true,
          json: async () => ({
            success: true,
            count: page === 1 ? 1 : 0,
            data:
              page === 1
                ? [
                    {
                      id: 1,
                      title: 'Hero · A',
                      description: 'D',
                      role: 'Writer',
                      domain: 'Legal / Art',
                      username: 'u'
                    },
                    {
                      id: 1,
                      title: 'Hero · A',
                      description: 'dup',
                      role: 'Writer',
                      domain: 'Legal'
                    }
                  ]
                : []
          })
        }
      }
      if (u.includes('/api/soul/')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              id: 1,
              title: 'T',
              description: 'D',
              role: 'R',
              domain: 'Dom',
              content: 'body'
            }
          })
        }
      }
      if (u.includes('/api/categories')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: [{ id: 1, name: 'n', slug: 's', icon: 'i' }]
          })
        }
      }
      return { ok: false, status: 500 }
    })

    const c = new SoulMdHubClient('https://hub.test', fetchFn as never)
    await c.listSouls({ q: 'a', role: 'r', sort: 'new', page: 1, limit: 5 })
    expect(await c.getSoul(1)).toMatchObject({ content: 'body' })
    expect(await c.listCategories()).toHaveLength(1)

    const prog: number[] = []
    const idx = await c.buildIndex(2, (p, t) => prog.push(p + t))
    expect(idx.items.length).toBe(1)
    expect(idx.suggestions.length).toBeGreaterThan(0)
    expect(prog.length).toBeGreaterThan(0)

    // error pages still progress
    const flaky = new SoulMdHubClient(
      'https://hub.test',
      vi.fn(async () => {
        throw new Error('net')
      }) as never
    )
    const empty = await flaky.buildIndex(1)
    expect(empty.items).toEqual([])

    const bad = new SoulMdHubClient(
      'https://hub.test',
      vi.fn(async () => ({ ok: false, status: 503 })) as never
    )
    await expect(bad.listSouls()).rejects.toMatchObject({ code: 'IO' })
    await expect(bad.getSoul(1)).rejects.toMatchObject({ code: 'IO' })
    await expect(bad.listCategories()).rejects.toMatchObject({ code: 'IO' })

    const badJson = new SoulMdHubClient(
      'https://hub.test',
      vi.fn(async (url: string) => {
        if (String(url).includes('/souls')) {
          return { ok: true, json: async () => ({ success: false }) }
        }
        if (String(url).includes('/soul/')) {
          return { ok: true, json: async () => ({ success: false }) }
        }
        return { ok: true, json: async () => ({ success: true, data: null }) }
      }) as never
    )
    await expect(badJson.listSouls()).rejects.toMatchObject({
      code: 'VALIDATION'
    })
    await expect(badJson.getSoul(1)).rejects.toMatchObject({
      code: 'VALIDATION'
    })

    const dir = mkdtempSync(join(tmpdir(), 'soul-'))
    expect(SoulMdHubClient.loadCache(dir)).toBeNull()
    mkdirSync(join(dir, 'cache'), { recursive: true })
    writeFileSync(join(dir, 'cache', 'soulmd-index.json'), 'not-json')
    expect(SoulMdHubClient.loadCache(dir)).toBeNull()
    SoulMdHubClient.saveCache(dir, idx)
    expect(SoulMdHubClient.loadCache(dir)?.items.length).toBe(1)
    expect(SoulMdHubClient.cachePath(dir)).toContain('soulmd-index')
    rmSync(dir, { recursive: true, force: true })
    void pageCalls
  })
})
