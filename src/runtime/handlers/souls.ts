/**
 * Domain IPC handlers (split for maintainability).
 */
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { SoulMdHubClient } from '../../infrastructure/soulmd/SoulMdHubClient'
import { AppError } from '../../types/errors'
import { extractDescriptionFromSoulMd, extractNameFromSoulMd, isSoulMdPath, parseSoulMd } from '../../domain/character'
import type { OpenDialogOptionsLike } from '../HandlerHost'
import type { HandlerContext } from './context'

export function registerSoulsHandlers(ctx: HandlerContext): void {
  const {
    reg,
    host,
    stories,
    characters,
    scenes,
    props,
    actions,
    costumes,
    timeline,
    generation,
    rebindAi,
    mediaRoot,
    activity,
    userDataPath,
    settingsStore
  } = ctx

// ─── SoulMD Hub (public catalogue) ─────────────────────────
let soulIndexBuilding: Promise<unknown> | null = null
const soulHub = new SoulMdHubClient()

reg(
  'souls:list',
  (
    async (
      opts?: { page?: number; limit?: number; q?: string; role?: string }
    ) => soulHub.listSouls({ ...opts, is_nft: 0 })
  )
)
reg(
  'souls:get',
  (async ( id: number) => {
    const detail = await soulHub.getSoul(id)
    const flat = SoulMdHubClient.flattenContent(
      detail.content,
      detail.file_type
    )
    return { ...detail, contentFlat: flat }
  })
)
reg(
  'souls:categories',
  (async () => soulHub.listCategories())
)
reg(
  'souls:ensureIndex',
  (async ( force?: boolean) => {
    const cached = SoulMdHubClient.loadCache(userDataPath())
    if (cached && !force && cached.items.length > 0) {
      return {
        fromCache: true,
        pages: cached.pages,
        count: cached.items.length,
        builtAt: cached.builtAt,
        suggestions: cached.suggestions
      }
    }
    if (!soulIndexBuilding) {
      soulIndexBuilding = soulHub
        .buildIndex(50)
        .then((idx) => {
          SoulMdHubClient.saveCache(userDataPath(), idx)
          return idx
        })
        .finally(() => {
          soulIndexBuilding = null
        })
    }
    const idx = (await soulIndexBuilding) as Awaited<
      ReturnType<SoulMdHubClient['buildIndex']>
    >
    return {
      fromCache: false,
      pages: idx.pages,
      count: idx.items.length,
      builtAt: idx.builtAt,
      suggestions: idx.suggestions
    }
  })
)
reg(
  'souls:suggestions',
  (async () => {
    const cached = SoulMdHubClient.loadCache(userDataPath())
    if (cached) return cached.suggestions
    return []
  })
)
reg(
  'souls:searchLocal',
  (async ( q: string, limit?: number) => {
    const cached = SoulMdHubClient.loadCache(userDataPath())
    if (!cached) return { items: [] as unknown[], fromCache: false }
    return {
      items: SoulMdHubClient.filterIndex(cached, q, limit ?? 24),
      fromCache: true
    }
  })
)
reg(
  'characters:importSoulMd',
  (async () => {
    const win = host.getMainWindow()
    const options: OpenDialogOptionsLike = {
      title: 'Import soul.md',
      filters: [{ name: 'Markdown', extensions: ['md'] }],
      properties: ['openFile']
    }
    const result = win
      ? await host.dialog.showOpenDialog(win, options)
      : await host.dialog.showOpenDialog(options)

    if (result.canceled || result.filePaths.length === 0) return null

    const filePath = result.filePaths[0]
    if (!existsSync(filePath) || !isSoulMdPath(filePath)) {
      throw new AppError('VALIDATION', 'errors.soulFileMustBeMd')
    }
    const content = readFileSync(filePath, 'utf-8')
    return { filePath, content }
  })
)

/**
 * Load full soul.md text for display in the editor.
 * Supports local filesystem paths and soulmd-hub://{id}.
 */
reg(
  'characters:readSoulContent',
  (
    async (
      payload: {
        soulMdPath?: string | null
        soulHubId?: number | null
      }
    ) => {
      if (payload.soulHubId != null && Number.isFinite(payload.soulHubId)) {
        const detail = await soulHub.getSoul(payload.soulHubId)
        const flat = SoulMdHubClient.flattenContent(
          detail.content,
          detail.file_type
        )
        return {
          source: 'hub' as const,
          id: detail.id,
          title: detail.title,
          content: flat || ''
        }
      }
      const path = payload.soulMdPath?.trim()
      if (!path) {
        return { source: 'none' as const, content: '' }
      }
      if (path.startsWith('soulmd-hub://')) {
        const id = Number(path.replace('soulmd-hub://', ''))
        if (!Number.isFinite(id)) {
          throw new AppError('VALIDATION', 'errors.invalidSoulHubId')
        }
        const detail = await soulHub.getSoul(id)
        const flat = SoulMdHubClient.flattenContent(
          detail.content,
          detail.file_type
        )
        return {
          source: 'hub' as const,
          id: detail.id,
          title: detail.title,
          content: flat || ''
        }
      }
      if (!existsSync(path)) {
        throw new AppError('NOT_FOUND', 'errors.soulMdNotFound', String(path))
      }
      const content = readFileSync(path, 'utf-8')
      return {
        source: 'file' as const,
        path,
        content
      }
    }
  )
)

/**
 * Persist soul.md text the user edited in the character form.
 * Reuses a local path when possible; otherwise writes under media/tmp.
 */
reg(
  'characters:writeSoulContent',
  (
    async (
      payload: {
        content: string
        filePath?: string | null
        characterId?: string | null
      }
    ) => {
      const content = payload.content ?? ''
      const store = generation().getMediaStore()
      store.ensureTmpDir()
      let dest = payload.filePath?.trim() || ''
      // Hub pseudo-paths and missing files → new local file
      if (
        !dest ||
        dest.startsWith('soulmd-hub://') ||
        dest.startsWith('http://') ||
        dest.startsWith('https://') ||
        !existsSync(dest)
      ) {
        const slug = (payload.characterId || 'character')
          .replace(/[^\w\u4e00-\u9fff-]+/g, '_')
          .slice(0, 40)
        dest = store.tmpImagePath(`soul_edit_${slug}`, '.md')
      }
      writeFileSync(dest, content, 'utf8')
      activity.append({
        kind: 'character',
        message: 'writeSoulContent',
        meta: { path: dest, chars: content.length }
      })
      return { filePath: dest, content }
    }
  )
)

reg(
  'characters:importSoulMdUrl',
  (async ( url: string) => {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      throw new AppError('VALIDATION', 'errors.invalidSoulUrl')
    }
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
    if (!res.ok) {
      throw new AppError('IO', 'errors.soulFetchFailed', String(res.status))
    }
    const content = await res.text()
    const doc = parseSoulMd(content)
    return {
      url,
      content,
      name: doc.title ?? extractNameFromSoulMd(content),
      description: extractDescriptionFromSoulMd(content),
      parsed: doc
    }
  })
)

}
