import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync
} from 'fs'
import { basename, dirname, extname, join, resolve, sep } from 'path'
import {
  createdAtFromExportFileName,
  inferExportKindFromFileName,
  isUserFacingExportFileName,
  parseExportHistoryJson,
  serializeExportHistory,
  sortExportHistoryNewestFirst,
  type ExportHistoryItem,
  type ExportKind
} from '../../domain/exportHistory'

/**
 * Local media layout under a root directory:
 *   {root}/{storyId}/clips|exports|tts   — story outputs only
 *   {root}/library/chars|scenes|props|costumes — global library assets (M2M)
 *   {root}/tmp                           — draft images
 */
export class MediaStore {
  constructor(private readonly root: string) {}

  get rootDir(): string {
    return this.root
  }

  storyDir(storyId: string): string {
    return join(this.root, storyId)
  }

  clipsDir(storyId: string): string {
    return join(this.storyDir(storyId), 'clips')
  }

  exportsDir(storyId: string): string {
    return join(this.storyDir(storyId), 'exports')
  }

  /** JSON manifest of all final/board export versions for a story. */
  exportHistoryPath(storyId: string): string {
    return join(this.exportsDir(storyId), 'exports-history.json')
  }

  ttsDir(storyId: string): string {
    return join(this.storyDir(storyId), 'tts')
  }

  clipPath(storyId: string, entryId: string, ext = '.mp4'): string {
    return join(this.clipsDir(storyId), `${entryId}${ext}`)
  }

  /**
   * Keyframe still for clip-to-clip continuity (feeds next beat as image ref).
   * Written after video-prep still / confirm.
   */
  clipContinuityStillPath(storyId: string, entryId: string, ext = '.png'): string {
    return join(this.clipsDir(storyId), `${entryId}_continuity${ext}`)
  }

  /** Story-level cast prep (ref image + costume look per character). */
  storyCastPrepPath(storyId: string): string {
    return join(this.storyDir(storyId), 'cast-prep.json')
  }

  /** Cached video-prep prompt/still metadata per timeline entry. */
  entryStillPromptPath(storyId: string, entryId: string): string {
    return join(this.clipsDir(storyId), `${entryId}_still_prompt.json`)
  }

  /**
   * Marker: user explicitly removed the continuity still.
   * Prevents auto re-extract from video on the next Advanced Prep load.
   */
  entryStillClearedPath(storyId: string, entryId: string): string {
    return join(this.clipsDir(storyId), `${entryId}_still_cleared`)
  }

  isEntryStillUserCleared(storyId: string, entryId: string): boolean {
    return existsSync(this.entryStillClearedPath(storyId, entryId))
  }

  markEntryStillUserCleared(storyId: string, entryId: string): void {
    this.ensureStoryDirs(storyId)
    mkdirSync(this.clipsDir(storyId), { recursive: true })
    writeFileSync(
      this.entryStillClearedPath(storyId, entryId),
      JSON.stringify({ clearedAt: new Date().toISOString() }),
      'utf-8'
    )
  }

  clearEntryStillUserCleared(storyId: string, entryId: string): void {
    const p = this.entryStillClearedPath(storyId, entryId)
    try {
      if (existsSync(p)) unlinkSync(p)
    } catch {
      /* ignore */
    }
  }

  readStoryCastPrepJson(storyId: string): string | null {
    const p = this.storyCastPrepPath(storyId)
    if (!existsSync(p)) return null
    try {
      return readFileSync(p, 'utf-8')
    } catch {
      return null
    }
  }

  writeStoryCastPrepJson(storyId: string, json: string): void {
    this.ensureStoryDirs(storyId)
    writeFileSync(this.storyCastPrepPath(storyId), json, 'utf-8')
  }

  readEntryStillPromptJson(
    storyId: string,
    entryId: string
  ): string | null {
    const p = this.entryStillPromptPath(storyId, entryId)
    if (!existsSync(p)) return null
    try {
      return readFileSync(p, 'utf-8')
    } catch {
      return null
    }
  }

  writeEntryStillPromptJson(
    storyId: string,
    entryId: string,
    json: string
  ): void {
    this.ensureStoryDirs(storyId)
    mkdirSync(this.clipsDir(storyId), { recursive: true })
    writeFileSync(this.entryStillPromptPath(storyId, entryId), json, 'utf-8')
  }

  ttsPath(storyId: string, entryId: string, ext = '.wav'): string {
    return join(this.ttsDir(storyId), `${entryId}${ext}`)
  }

  libraryDir(): string {
    return join(this.root, 'library')
  }

  libraryCharsDir(): string {
    return join(this.libraryDir(), 'chars')
  }

  libraryScenesDir(): string {
    return join(this.libraryDir(), 'scenes')
  }

  libraryPropsDir(): string {
    return join(this.libraryDir(), 'props')
  }

  libraryCostumesDir(): string {
    return join(this.libraryDir(), 'costumes')
  }

  libraryStoriesDir(): string {
    return join(this.libraryDir(), 'stories')
  }

  libraryActionsDir(): string {
    return join(this.libraryDir(), 'actions')
  }

  ensureLibraryDirs(): void {
    mkdirSync(this.libraryCharsDir(), { recursive: true })
    mkdirSync(this.libraryScenesDir(), { recursive: true })
    mkdirSync(this.libraryPropsDir(), { recursive: true })
    mkdirSync(this.libraryCostumesDir(), { recursive: true })
    mkdirSync(this.libraryStoriesDir(), { recursive: true })
    mkdirSync(this.libraryActionsDir(), { recursive: true })
  }

  characterImagePath(characterId: string, kind: string, ext = '.png'): string {
    const stamp = Date.now()
    const rand = Math.random().toString(36).slice(2, 8)
    return join(
      this.libraryCharsDir(),
      `${characterId}_${kind}_${stamp}_${rand}${ext}`
    )
  }

  /** Self-intro / casting video derived from a still. */
  characterVideoPath(characterId: string, kind = 'intro', ext = '.mp4'): string {
    const stamp = Date.now()
    const rand = Math.random().toString(36).slice(2, 8)
    return join(
      this.libraryCharsDir(),
      `${characterId}_${kind}_${stamp}_${rand}${ext}`
    )
  }

  sceneImagePath(sceneId: string, kind: string, ext = '.png'): string {
    const stamp = Date.now()
    const rand = Math.random().toString(36).slice(2, 8)
    return join(
      this.libraryScenesDir(),
      `${sceneId}_${kind}_${stamp}_${rand}${ext}`
    )
  }

  /** Location intro / atmosphere video derived from a still. */
  sceneVideoPath(sceneId: string, kind = 'intro', ext = '.mp4'): string {
    const stamp = Date.now()
    const rand = Math.random().toString(36).slice(2, 8)
    return join(
      this.libraryScenesDir(),
      `${sceneId}_${kind}_${stamp}_${rand}${ext}`
    )
  }

  propImagePath(propId: string, kind: string, ext = '.png'): string {
    const stamp = Date.now()
    const rand = Math.random().toString(36).slice(2, 8)
    return join(
      this.libraryPropsDir(),
      `${propId}_${kind}_${stamp}_${rand}${ext}`
    )
  }

  /** Prop hero / detail intro video derived from a still. */
  propVideoPath(propId: string, kind = 'intro', ext = '.mp4'): string {
    const stamp = Date.now()
    const rand = Math.random().toString(36).slice(2, 8)
    return join(
      this.libraryPropsDir(),
      `${propId}_${kind}_${stamp}_${rand}${ext}`
    )
  }

  costumeImagePath(costumeId: string, kind: string, ext = '.png'): string {
    const stamp = Date.now()
    const rand = Math.random().toString(36).slice(2, 8)
    return join(
      this.libraryCostumesDir(),
      `${costumeId}_${kind}_${stamp}_${rand}${ext}`
    )
  }

  /** Costume look intro video derived from a still. */
  costumeVideoPath(costumeId: string, kind = 'intro', ext = '.mp4'): string {
    const stamp = Date.now()
    const rand = Math.random().toString(36).slice(2, 8)
    return join(
      this.libraryCostumesDir(),
      `${costumeId}_${kind}_${stamp}_${rand}${ext}`
    )
  }

  actionImagePath(actionId: string, kind: string, ext = '.png'): string {
    const stamp = Date.now()
    const rand = Math.random().toString(36).slice(2, 8)
    return join(
      this.libraryActionsDir(),
      `${actionId}_${kind}_${stamp}_${rand}${ext}`
    )
  }

  /** Motion demo video derived from an instruction plate. */
  actionVideoPath(actionId: string, kind = 'intro', ext = '.mp4'): string {
    const stamp = Date.now()
    const rand = Math.random().toString(36).slice(2, 8)
    return join(
      this.libraryActionsDir(),
      `${actionId}_${kind}_${stamp}_${rand}${ext}`
    )
  }

  storyImagePath(storyId: string, kind: string, ext = '.png'): string {
    const stamp = Date.now()
    const rand = Math.random().toString(36).slice(2, 8)
    return join(
      this.libraryStoriesDir(),
      `${storyId}_${kind}_${stamp}_${rand}${ext}`
    )
  }

  promoteTmpStoryImage(
    storyId: string,
    tmpPath: string,
    kind: string
  ): string {
    const ext = extname(tmpPath) || '.png'
    const dest = this.storyImagePath(storyId, kind, ext)
    return this.promoteTmpTo(dest, tmpPath)
  }

  tmpDir(): string {
    return join(this.root, 'tmp')
  }

  tmpImagePath(kind: string, ext = '.png'): string {
    const stamp = Date.now()
    const rand = Math.random().toString(36).slice(2, 8)
    return join(this.tmpDir(), `${kind}_${stamp}_${rand}${ext}`)
  }

  ensureTmpDir(): void {
    mkdirSync(this.tmpDir(), { recursive: true })
  }

  private promoteTmpTo(dest: string, tmpPath: string): string {
    if (!existsSync(tmpPath)) {
      throw new Error(`Draft image missing: ${tmpPath}`)
    }
    this.ensureLibraryDirs()
    mkdirSync(dirname(dest), { recursive: true })
    const src = resolve(tmpPath)
    const out = resolve(dest)
    // Already the permanent file (e.g. re-commit after dress gen) — no-op.
    if (src === out) return dest
    copyFileSync(tmpPath, dest)
    // Only delete drafts from tmp/; never unlink permanent library assets.
    const tmpRoot = resolve(this.tmpDir())
    const isTmp = src === tmpRoot || src.startsWith(tmpRoot + sep)
    if (isTmp) {
      try {
        unlinkSync(src)
      } catch {
        /* keep dest */
      }
    }
    return dest
  }

  /** Promote draft character image into global library. */
  promoteTmpImage(
    _storyIdIgnored: string | null | undefined,
    characterId: string,
    tmpPath: string,
    kind: string
  ): string {
    const ext = extname(tmpPath) || '.png'
    const dest = this.characterImagePath(characterId, kind, ext)
    return this.promoteTmpTo(dest, tmpPath)
  }

  promoteTmpSceneImage(
    _storyIdIgnored: string | null | undefined,
    sceneId: string,
    tmpPath: string,
    kind: string
  ): string {
    const ext = extname(tmpPath) || '.png'
    const dest = this.sceneImagePath(sceneId, kind, ext)
    return this.promoteTmpTo(dest, tmpPath)
  }

  promoteTmpPropImage(
    _storyIdIgnored: string | null | undefined,
    propId: string,
    tmpPath: string,
    kind: string
  ): string {
    const ext = extname(tmpPath) || '.png'
    const dest = this.propImagePath(propId, kind, ext)
    return this.promoteTmpTo(dest, tmpPath)
  }

  discardTmp(filePath: string): void {
    if (!filePath || !existsSync(filePath)) return
    const root = resolve(this.tmpDir())
    const resolved = resolve(filePath)
    if (resolved !== root && !resolved.startsWith(root + sep)) {
      return
    }
    try {
      unlinkSync(resolved)
    } catch {
      /* ignore */
    }
  }

  ensureStoryDirs(storyId: string): void {
    mkdirSync(this.clipsDir(storyId), { recursive: true })
    mkdirSync(this.exportsDir(storyId), { recursive: true })
    mkdirSync(this.ttsDir(storyId), { recursive: true })
  }

  importClip(storyId: string, entryId: string, sourcePath: string): string {
    if (!existsSync(sourcePath)) {
      throw new Error(`Source media not found: ${sourcePath}`)
    }
    this.ensureStoryDirs(storyId)
    const ext = extname(sourcePath) || '.mp4'
    const dest = this.clipPath(storyId, entryId, ext)
    mkdirSync(dirname(dest), { recursive: true })
    copyFileSync(sourcePath, dest)
    return dest
  }

  deleteIfExists(filePath: string): void {
    if (existsSync(filePath)) unlinkSync(filePath)
  }

  readExportHistory(storyId: string): ExportHistoryItem[] {
    const p = this.exportHistoryPath(storyId)
    if (!existsSync(p)) return []
    try {
      return parseExportHistoryJson(readFileSync(p, 'utf-8'), storyId)
    } catch {
      return []
    }
  }

  writeExportHistory(storyId: string, items: ExportHistoryItem[]): void {
    this.ensureStoryDirs(storyId)
    writeFileSync(
      this.exportHistoryPath(storyId),
      serializeExportHistory(items),
      'utf-8'
    )
  }

  /**
   * Merge history JSON + files on disk (work exports dir + optional public dir)
   * so older versions still show even before history was introduced.
   */
  listExportHistory(
    storyId: string,
    opts?: {
      publicDir?: string | null
      /** Current Story.exportPath fallback */
      latestPath?: string | null
      /** Filename prefix filter for public dir scan, e.g. safeAscii title */
      fileNamePrefix?: string | null
    }
  ): ExportHistoryItem[] {
    const byPath = new Map<string, ExportHistoryItem>()
    const latestResolved = opts?.latestPath?.trim()
      ? resolve(opts.latestPath.trim())
      : null
    const put = (item: ExportHistoryItem): void => {
      if (!item.path) return
      const name = item.fileName || basename(item.path)
      const key = resolve(item.path)
      const isLatest = Boolean(latestResolved && key === latestResolved)
      // Drop FFmpeg intermediates unless this is the story's current exportPath
      if (!isUserFacingExportFileName(name) && !isLatest) return
      const prev = byPath.get(key)
      if (!prev) {
        byPath.set(key, { ...item, path: key, fileName: name })
        return
      }
      byPath.set(key, {
        ...prev,
        ...item,
        path: key,
        fileName: name || prev.fileName,
        id: prev.id || item.id,
        workPath: item.workPath || prev.workPath,
        sizeBytes: item.sizeBytes ?? prev.sizeBytes
      })
    }

    for (const h of this.readExportHistory(storyId)) put(h)

    // Work copies under media/{storyId}/exports
    const workDir = this.exportsDir(storyId)
    if (existsSync(workDir)) {
      try {
        for (const name of readdirSync(workDir)) {
          if (!isUserFacingExportFileName(name)) continue
          const full = join(workDir, name)
          let size: number | null = null
          let mtimeIso: string | null = null
          try {
            const st = statSync(full)
            if (!st.isFile()) continue
            size = st.size
            mtimeIso = st.mtime.toISOString()
          } catch {
            continue
          }
          put({
            id: `exp_${name}`,
            storyId,
            kind: inferExportKindFromFileName(name),
            fileName: name,
            path: full,
            workPath: full,
            createdAt:
              createdAtFromExportFileName(name) ||
              mtimeIso ||
              new Date(0).toISOString(),
            sizeBytes: size
          })
        }
      } catch {
        /* ignore */
      }
    }

    // Public ~/Videos/InstantDrama Magician copies (filter by story title prefix)
    const publicDir = opts?.publicDir?.trim()
    const prefix = opts?.fileNamePrefix?.trim()
    if (publicDir && existsSync(publicDir)) {
      try {
        for (const name of readdirSync(publicDir)) {
          if (!isUserFacingExportFileName(name)) continue
          // Prefer prefix match when known; still accept if no prefix (legacy)
          if (
            prefix &&
            !name.startsWith(prefix + '_') &&
            !name.startsWith(prefix + '.') &&
            // CJK titles used in older exports before safeAscii rename
            !name.includes(prefix)
          ) {
            continue
          }
          const full = join(publicDir, name)
          let size: number | null = null
          let mtimeIso: string | null = null
          try {
            const st = statSync(full)
            if (!st.isFile()) continue
            size = st.size
            mtimeIso = st.mtime.toISOString()
          } catch {
            continue
          }
          put({
            id: `exp_${name}`,
            storyId,
            kind: inferExportKindFromFileName(name),
            fileName: name,
            path: full,
            workPath: null,
            createdAt:
              createdAtFromExportFileName(name) ||
              mtimeIso ||
              new Date(0).toISOString(),
            sizeBytes: size
          })
        }
      } catch {
        /* ignore */
      }
    }

    const latest = opts?.latestPath?.trim()
    if (latest && existsSync(latest)) {
      const name = basename(latest)
      let size: number | null = null
      try {
        size = statSync(latest).size
      } catch {
        /* */
      }
      put({
        id: `exp_${name}`,
        storyId,
        kind: inferExportKindFromFileName(name),
        fileName: name,
        path: latest,
        workPath: null,
        createdAt:
          createdAtFromExportFileName(name) || new Date().toISOString(),
        sizeBytes: size
      })
    }

    // Drop missing files
    const alive = [...byPath.values()].filter((item) => {
      if (existsSync(item.path)) return true
      if (item.workPath && existsSync(item.workPath)) {
        item.path = item.workPath
        return true
      }
      return false
    })

    // Dedupe by fileName preferring public (non-work) paths
    const byName = new Map<string, ExportHistoryItem>()
    for (const item of sortExportHistoryNewestFirst(alive)) {
      const prev = byName.get(item.fileName)
      if (!prev) {
        byName.set(item.fileName, item)
        continue
      }
      const prevIsWork =
        prev.path.includes(`${sep}exports${sep}`) ||
        prev.path.endsWith(`${sep}exports`)
      const curIsWork =
        item.path.includes(`${sep}exports${sep}`) ||
        item.path.endsWith(`${sep}exports`)
      if (prevIsWork && !curIsWork) {
        byName.set(item.fileName, {
          ...item,
          workPath: item.workPath || prev.path,
          id: prev.id
        })
      } else if (!prev.workPath && (item.workPath || curIsWork)) {
        byName.set(item.fileName, {
          ...prev,
          workPath: item.workPath || item.path
        })
      }
    }

    return sortExportHistoryNewestFirst([...byName.values()])
  }

  recordExportHistory(
    storyId: string,
    entry: {
      kind: ExportKind
      path: string
      workPath?: string | null
      fileName?: string
      createdAt?: string
    }
  ): ExportHistoryItem {
    const fileName = entry.fileName || basename(entry.path)
    let sizeBytes: number | null = null
    try {
      if (existsSync(entry.path)) sizeBytes = statSync(entry.path).size
      else if (entry.workPath && existsSync(entry.workPath))
        sizeBytes = statSync(entry.workPath).size
    } catch {
      sizeBytes = null
    }
    const item: ExportHistoryItem = {
      id: `exp_${fileName}`,
      storyId,
      kind: entry.kind,
      fileName,
      path: entry.path,
      workPath: entry.workPath ?? null,
      createdAt: entry.createdAt || new Date().toISOString(),
      sizeBytes
    }
    const prev = this.readExportHistory(storyId).filter(
      (h) =>
        resolve(h.path) !== resolve(item.path) && h.fileName !== item.fileName
    )
    this.writeExportHistory(storyId, [item, ...prev])
    return item
  }

  /**
   * Delete an export version (public + work copies) and update history.
   * Returns remaining items + whether Story.exportPath should be cleared/updated.
   */
  deleteExportHistoryItem(
    storyId: string,
    exportId: string
  ): {
    deleted: boolean
    remaining: ExportHistoryItem[]
    deletedPaths: string[]
  } {
    const listed = this.listExportHistory(storyId)
    const target =
      listed.find((h) => h.id === exportId) ||
      listed.find((h) => h.path === exportId || h.fileName === exportId)
    if (!target) {
      return { deleted: false, remaining: listed, deletedPaths: [] }
    }
    const deletedPaths: string[] = []
    for (const p of [target.path, target.workPath]) {
      if (!p) continue
      try {
        if (existsSync(p)) {
          unlinkSync(p)
          deletedPaths.push(p)
        }
      } catch {
        /* continue */
      }
    }
    // Also remove same fileName under work exports if leftover
    const workTwin = join(this.exportsDir(storyId), target.fileName)
    try {
      if (existsSync(workTwin) && !deletedPaths.includes(workTwin)) {
        unlinkSync(workTwin)
        deletedPaths.push(workTwin)
      }
    } catch {
      /* */
    }

    const remaining = this.listExportHistory(storyId).filter(
      (h) =>
        h.id !== target.id &&
        h.fileName !== target.fileName &&
        resolve(h.path) !== resolve(target.path)
    )
    // Persist cleaned history (drop deleted)
    const saved = this.readExportHistory(storyId).filter(
      (h) =>
        h.id !== target.id &&
        h.fileName !== target.fileName &&
        resolve(h.path) !== resolve(target.path)
    )
    this.writeExportHistory(storyId, saved.length ? saved : remaining)
    return {
      deleted: true,
      remaining: this.listExportHistory(storyId),
      deletedPaths
    }
  }
}
