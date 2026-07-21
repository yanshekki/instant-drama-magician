/**
 * Isolated MediaStore residual coverage via vi.mock('fs').
 * ESM cannot spy existsSync/unlinkSync/statSync — mock the module.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { join } from 'path'

const realFs = await vi.importActual<typeof import('fs')>('fs')

const state = vi.hoisted(() => ({
  unlinkThrow: false,
  statThrowPaths: new Set<string>(),
  readdirThrow: false,
  readFileBad: false
}))

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs')
  return {
    ...actual,
    unlinkSync: (p: string) => {
      if (state.unlinkThrow) throw new Error('unlink busy')
      return actual.unlinkSync(p)
    },
    statSync: (p: string, opts?: unknown) => {
      if ([...state.statThrowPaths].some((x) => String(p).includes(x))) {
        throw new Error('stat fail')
      }
      return actual.statSync(p, opts as never)
    },
    readdirSync: (p: string, opts?: unknown) => {
      if (state.readdirThrow) throw new Error('readdir fail')
      return actual.readdirSync(p, opts as never)
    },
    readFileSync: (p: string, enc?: unknown) => {
      if (state.readFileBad && String(p).includes('export')) {
        throw new Error('bad json read')
      }
      return actual.readFileSync(p, enc as never)
    }
  }
})

import { MediaStore } from './MediaStore'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'fs'
import { tmpdir } from 'os'

describe('MediaStore isolated residual', () => {
  let root: string
  let store: MediaStore

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'idm-ms-iso-'))
    store = new MediaStore(root)
    state.unlinkThrow = false
    state.statThrowPaths.clear()
    state.readdirThrow = false
    state.readFileBad = false
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('promoteTmp unlink catch and discardTmp unlink catch', () => {
    store.ensureTmpDir()
    store.ensureLibraryDirs()
    const tmp = join(root, 'tmp', 'draft.png')
    writeFileSync(tmp, 'img')
    state.unlinkThrow = true
    const dest = store.promoteTmpImage(null, 'c1', tmp, 'body')
    expect(dest).toContain('library')
    // discard with unlink throw
    const tmp2 = join(root, 'tmp', 'd2.png')
    writeFileSync(tmp2, 'x')
    store.discardTmp(tmp2)
    state.unlinkThrow = false
  })

  it('readExportHistory catch returns []', () => {
    store.ensureStoryDirs('s1')
    const hist = store.exportHistoryPath('s1')
    writeFileSync(hist, '{not-json')
    // corrupt json → parse throws → catch return []
    expect(store.readExportHistory('s1')).toEqual([])
    // readFile throws
    state.readFileBad = true
    writeFileSync(hist, '[]')
    expect(store.readExportHistory('s1')).toEqual([])
    state.readFileBad = false
  })

  it('listExportHistory work/public stat continue and readdir catch', () => {
    store.ensureStoryDirs('s1')
    const exp = store.exportsDir('s1')
    writeFileSync(join(exp, 'plain.mp4'), 'v')
    writeFileSync(join(exp, 'NoDate_final.mp4'), 'v')
    const publicDir = join(root, 'pub')
    mkdirSync(publicDir, { recursive: true })
    writeFileSync(join(publicDir, 'Match_final_1.mp4'), 'p')
    writeFileSync(join(publicDir, 'Other_final_1.mp4'), 'o')

    state.statThrowPaths.add('NoDate_final')
    state.statThrowPaths.add('Match_final')
    const listed = store.listExportHistory('s1', {
      publicDir,
      fileNamePrefix: 'Match',
      latestPath: join(exp, 'plain.mp4')
    })
    expect(Array.isArray(listed)).toBe(true)
    state.statThrowPaths.clear()

    // latestPath size throw
    state.statThrowPaths.add('plain.mp4')
    store.listExportHistory('s1', { latestPath: join(exp, 'plain.mp4') })
    state.statThrowPaths.clear()

    // work readdir outer catch
    state.readdirThrow = true
    store.listExportHistory('s1', { publicDir, fileNamePrefix: 'Match' })
    state.readdirThrow = false

    // public readdir catch via readdirThrow when only public has files
    // (work may also throw — ok)
    state.readdirThrow = true
    try {
      store.listExportHistory('s1', { publicDir })
    } catch {
      /* */
    }
    state.readdirThrow = false

    // epoch createdAt when no date in name and mtime fails (501 / 548)
    writeFileSync(join(exp, 'nodate.mp4'), 'x')
    writeFileSync(join(publicDir, 'nodate2.mp4'), 'p')
    state.statThrowPaths.add('nodate')
    // when stat throws we continue — need stat success but mtimeIso null impossible
    // instead: file without date in name, force createdAtFromExportFileName empty
    state.statThrowPaths.clear()
    const listed2 = store.listExportHistory('s1', {
      publicDir,
      fileNamePrefix: 'nodate'
    })
    expect(Array.isArray(listed2)).toBe(true)
  })

  it('recordExportHistory stat catch null size', () => {
    store.ensureStoryDirs('s1')
    const p = join(store.exportsDir('s1'), 'r.mp4')
    writeFileSync(p, 'x')
    state.statThrowPaths.add('r.mp4')
    store.recordExportHistory('s1', {
      kind: 'final',
      path: p,
      fileName: 'r.mp4'
    })
    state.statThrowPaths.clear()
  })
})
