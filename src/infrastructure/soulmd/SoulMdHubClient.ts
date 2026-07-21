/**
 * Public client for https://soulmd-hub.ysk.hk
 * @see https://soulmd-hub.ysk.hk/api-docs
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { AppError } from '../../types/errors'

export const SOULMD_HUB_ORIGIN = 'https://soulmd-hub.ysk.hk'

export interface SoulListItem {
  id: number
  title: string
  description: string
  role: string | null
  domain: string | null
  file_type?: string
  like_count?: number
  username?: string
  role_icon?: string | null
  role_name?: string | null
}

export interface SoulDetail extends SoulListItem {
  content: string
  user_id?: number
  is_public?: number
}

export interface SoulListResponse {
  success: boolean
  count: number
  total_count?: number
  current_page?: number
  total_pages?: number
  data: SoulListItem[]
}

export interface SoulCategory {
  id: number
  name: string
  slug: string
  icon: string
}

export interface SoulSuggestion {
  kind: 'role' | 'domain' | 'title'
  label: string
  count?: number
}

export interface SoulIndexCache {
  builtAt: string
  pages: number
  items: SoulListItem[]
  suggestions: SoulSuggestion[]
}

const INDEX_PAGES = 50
const INDEX_LIMIT = 12

export class SoulMdHubClient {
  constructor(
    private readonly origin = SOULMD_HUB_ORIGIN,
    private readonly fetchFn: typeof fetch = fetch.bind(globalThis)
  ) {}

  async listSouls(options?: {
    page?: number
    limit?: number
    q?: string
    role?: string
    is_nft?: 0 | 1
    sort?: string
  }): Promise<SoulListResponse> {
    const u = new URL(`${this.origin}/api/souls`)
    u.searchParams.set('page', String(options?.page ?? 1))
    u.searchParams.set('limit', String(options?.limit ?? 12))
    u.searchParams.set('is_nft', String(options?.is_nft ?? 0))
    if (options?.q?.trim()) u.searchParams.set('q', options.q.trim())
    if (options?.role) u.searchParams.set('role', options.role)
    if (options?.sort) u.searchParams.set('sort', options.sort)

    const res = await this.fetchFn(u.toString(), {
      signal: AbortSignal.timeout(20_000)
    })
    if (!res.ok) {
      throw new AppError('IO', 'errors.soulHubHttpFailed', String(res.status))
    }
    const json = (await res.json()) as SoulListResponse
    if (!json.success) throw new AppError('VALIDATION', 'errors.soulHubListFailed')
    return json
  }

  async getSoul(id: number): Promise<SoulDetail> {
    // Detail path is singular /api/soul/{id} (souls/{id} returns 500)
    const res = await this.fetchFn(`${this.origin}/api/soul/${id}`, {
      signal: AbortSignal.timeout(20_000)
    })
    if (!res.ok) {
      throw new AppError('IO', 'errors.soulHubHttpFailed', String(res.status))
    }
    const json = (await res.json()) as { success: boolean; data: SoulDetail }
    if (!json.success || !json.data) throw new AppError('VALIDATION', 'errors.soulNotFound')
    return json.data
  }

  async listCategories(): Promise<SoulCategory[]> {
    const res = await this.fetchFn(`${this.origin}/api/categories`, {
      signal: AbortSignal.timeout(15_000)
    })
    if (!res.ok) throw new AppError('IO', 'errors.categoriesHttpFailed', String(res.status))
    const json = (await res.json()) as {
      success: boolean
      data: SoulCategory[]
    }
    return json.data ?? []
  }

  /** Flatten soul content (single_md string or full_soul_folder JSON map). */
  static flattenContent(content: string, fileType?: string): string {
    if (!content) return ''
    if (fileType === 'full_soul_folder' || content.trim().startsWith('{')) {
      try {
        const map = JSON.parse(content) as Record<string, string>
        const preferred = ['SOUL.md', 'IDENTITY.md', 'STYLE.md', 'RULES.md']
        const parts: string[] = []
        for (const k of preferred) {
          if (map[k]) parts.push(`## ${k}\n${map[k]}`)
        }
        for (const [k, v] of Object.entries(map)) {
          if (!preferred.includes(k) && typeof v === 'string') {
            parts.push(`## ${k}\n${v}`)
          }
        }
        return parts.join('\n\n')
      } catch {
        return content
      }
    }
    return content
  }

  /**
   * Build search index from first N pages (default 50 × 12 = 600).
   * Concurrent with small pool.
   */
  async buildIndex(
    pages = INDEX_PAGES,
    onProgress?: (page: number, total: number) => void
  ): Promise<SoulIndexCache> {
    const items: SoulListItem[] = []
    const concurrency = 3
    let next = 1
    const total = pages

    const worker = async (): Promise<void> => {
      while (true) {
        const page = next++
        if (page > pages) return
        try {
          const res = await this.listSouls({ page, limit: INDEX_LIMIT, is_nft: 0 })
          items.push(...(res.data ?? []))
          onProgress?.(page, total)
        } catch {
          onProgress?.(page, total)
        }
      }
    }

    await Promise.all(
      Array.from({ length: concurrency }, () => worker())
    )

    // de-dupe by id
    const map = new Map<number, SoulListItem>()
    for (const it of items) map.set(it.id, it)
    const unique = [...map.values()]
    const suggestions = buildSuggestions(unique)

    return {
      builtAt: new Date().toISOString(),
      pages,
      items: unique,
      suggestions
    }
  }

  static filterIndex(
    index: SoulIndexCache,
    q: string,
    limit = 24
  ): SoulListItem[] {
    const query = q.trim().toLowerCase()
    if (!query) return index.items.slice(0, limit)
    return index.items
      .filter((it) => {
        const hay = [
          it.title,
          it.description,
          it.role,
          it.domain,
          it.username
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return hay.includes(query)
      })
      .slice(0, limit)
  }

  static cachePath(userData: string): string {
    return join(userData, 'cache', 'soulmd-index.json')
  }

  static loadCache(userData: string): SoulIndexCache | null {
    const p = SoulMdHubClient.cachePath(userData)
    if (!existsSync(p)) return null
    try {
      return JSON.parse(readFileSync(p, 'utf-8')) as SoulIndexCache
    } catch {
      return null
    }
  }

  static saveCache(userData: string, cache: SoulIndexCache): void {
    const p = SoulMdHubClient.cachePath(userData)
    mkdirSync(dirname(p), { recursive: true })
    writeFileSync(p, JSON.stringify(cache), 'utf-8')
  }
}

function buildSuggestions(items: SoulListItem[]): SoulSuggestion[] {
  const roles = new Map<string, number>()
  const domains = new Map<string, number>()
  for (const it of items) {
    if (it.role) roles.set(it.role, (roles.get(it.role) ?? 0) + 1)
    if (it.domain) {
      for (const part of it.domain.split(/[,，/|]/)) {
        const d = part.trim()
        if (d) domains.set(d, (domains.get(d) ?? 0) + 1)
      }
    }
  }
  const roleSugs: SoulSuggestion[] = [...roles.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 16)
    .map(([label, count]) => ({ kind: 'role' as const, label, count }))
  const domainSugs: SoulSuggestion[] = [...domains.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 16)
    .map(([label, count]) => ({ kind: 'domain' as const, label, count }))
  // Title prefixes (first segment before ·)
  const titles = new Map<string, number>()
  for (const it of items) {
    const head = it.title.split(/[·|｜]/)[0]?.trim()
    if (head && head.length >= 2 && head.length <= 24) {
      titles.set(head, (titles.get(head) ?? 0) + 1)
    }
  }
  const titleSugs: SoulSuggestion[] = [...titles.entries()]
    .filter(([, c]) => c >= 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([label, count]) => ({ kind: 'title' as const, label, count }))

  return [...roleSugs, ...domainSugs, ...titleSugs]
}
