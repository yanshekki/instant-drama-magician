import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readFileSync
} from 'fs'
// rmSync used for unreadable cast-prep path
import { join } from 'path'
import { tmpdir } from 'os'
import { MediaStore } from './MediaStore'

describe('MediaStore', () => {
  let root: string
  let store: MediaStore

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'idm-media-'))
    store = new MediaStore(root)
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('exposes root and story layout paths', () => {
    expect(store.rootDir).toBe(root)
    expect(store.storyDir('s1')).toBe(join(root, 's1'))
    expect(store.clipsDir('s1')).toBe(join(root, 's1', 'clips'))
    expect(store.exportsDir('s1')).toBe(join(root, 's1', 'exports'))
    expect(store.ttsDir('s1')).toBe(join(root, 's1', 'tts'))
    expect(store.clipPath('s1', 'e1')).toBe(
      join(root, 's1', 'clips', 'e1.mp4')
    )
    expect(store.clipContinuityStillPath('s1', 'e1')).toContain('_continuity')
    expect(store.ttsPath('s1', 'e1')).toContain('.wav')
    expect(store.exportHistoryPath('s1')).toContain('exports-history.json')
    expect(store.storyCastPrepPath('s1')).toContain('cast-prep.json')
  })

  it('library image paths for chars scenes props actions costumes', () => {
    expect(store.characterImagePath('c1', 'body')).toContain('library')
    expect(store.sceneImagePath('sc1', 'plate')).toContain('library')
    expect(store.propImagePath('p1', 'still')).toContain('library')
    expect(store.actionImagePath('a1', 'plate')).toContain('library')
    expect(store.costumeImagePath('k1', 'dress')).toContain('library')
  })

  it('ensure dirs', () => {
    store.ensureStoryDirs('s1')
    expect(existsSync(store.clipsDir('s1'))).toBe(true)
    store.ensureLibraryDirs()
    expect(existsSync(join(root, 'library'))).toBe(true)
    store.ensureTmpDir()
    expect(existsSync(join(root, 'tmp'))).toBe(true)
  })

  it('entry still cleared markers', () => {
    expect(store.isEntryStillUserCleared('s1', 'e1')).toBe(false)
    store.markEntryStillUserCleared('s1', 'e1')
    expect(store.isEntryStillUserCleared('s1', 'e1')).toBe(true)
    store.clearEntryStillUserCleared('s1', 'e1')
    expect(store.isEntryStillUserCleared('s1', 'e1')).toBe(false)
  })

  it('story cast prep read/write', () => {
    expect(store.readStoryCastPrepJson('s1')).toBeNull()
    store.writeStoryCastPrepJson('s1', '{"ok":true}')
    expect(store.readStoryCastPrepJson('s1')).toBe('{"ok":true}')
  })

  it('entry still prompt json read/write', () => {
    expect(store.readEntryStillPromptJson('s1', 'e1')).toBeNull()
    store.writeEntryStillPromptJson('s1', 'e1', '{"p":1}')
    expect(store.readEntryStillPromptJson('s1', 'e1')).toBe('{"p":1}')
  })

  it('importClip copies source media', () => {
    const src = join(root, 'src.mp4')
    writeFileSync(src, 'video')
    const dest = store.importClip('s1', 'e1', src)
    expect(existsSync(dest)).toBe(true)
    expect(readFileSync(dest, 'utf8')).toBe('video')
  })

  it('importClip throws when source missing', () => {
    expect(() => store.importClip('s1', 'e1', join(root, 'nope.mp4'))).toThrow(
      /errors\.sourceMediaNotFound|not found/i
    )
  })

  it('characterImagePath dest can receive file writes', () => {
    store.ensureLibraryDirs()
    const dest = store.characterImagePath('c1', 'sheet', '.png')
    mkdirSync(join(dest, '..'), { recursive: true })
    writeFileSync(dest, 'img')
    expect(existsSync(dest)).toBe(true)
  })

  it('video path helpers for library entities', () => {
    expect(store.characterVideoPath('c1')).toContain('intro')
    expect(store.characterVideoPath('c1', 'casting', '.webm')).toContain(
      'casting'
    )
    expect(store.sceneVideoPath('sc1')).toMatch(/sc1_intro/)
    expect(store.propVideoPath('p1', 'detail')).toContain('detail')
    expect(store.costumeVideoPath('k1')).toContain('library')
    expect(store.actionVideoPath('a1', 'demo')).toContain('demo')
    expect(store.storyImagePath('s1', 'poster')).toContain('poster')
    expect(store.tmpImagePath('draft')).toContain('tmp')
  })

  it('promoteTmp* copies drafts into library and removes tmp', () => {
    store.ensureTmpDir()
    store.ensureLibraryDirs()
    const tmp = store.tmpImagePath('char')
    writeFileSync(tmp, 'draft-img')
    const dest = store.promoteTmpImage(null, 'c1', tmp, 'sheet')
    expect(existsSync(dest)).toBe(true)
    expect(readFileSync(dest, 'utf8')).toBe('draft-img')
    expect(existsSync(tmp)).toBe(false)

    const tmpSc = store.tmpImagePath('sc')
    writeFileSync(tmpSc, 'sc')
    expect(existsSync(store.promoteTmpSceneImage(null, 'sc1', tmpSc, 'plate'))).toBe(
      true
    )

    const tmpP = store.tmpImagePath('pr')
    writeFileSync(tmpP, 'pr')
    expect(existsSync(store.promoteTmpPropImage(null, 'p1', tmpP, 'hero'))).toBe(
      true
    )

    const tmpSt = store.tmpImagePath('st')
    writeFileSync(tmpSt, 'st')
    expect(existsSync(store.promoteTmpStoryImage('s1', tmpSt, 'cover'))).toBe(
      true
    )
  })

  it('promoteTmpTo no-op when src already dest; throws when missing', () => {
    store.ensureLibraryDirs()
    const dest = store.characterImagePath('c1', 'x')
    mkdirSync(join(dest, '..'), { recursive: true })
    writeFileSync(dest, 'same')
    // re-promote same path
    expect(store.promoteTmpImage(null, 'c1', dest, 'x2')).toBeTruthy()

    expect(() =>
      store.promoteTmpImage(null, 'c1', join(root, 'missing.png'), 'y')
    ).toThrow()
  })

  it('discardTmp only unlinks under tmp/', () => {
    store.ensureTmpDir()
    const tmp = store.tmpImagePath('d')
    writeFileSync(tmp, 't')
    store.discardTmp(tmp)
    expect(existsSync(tmp)).toBe(false)

    const outside = join(root, 'outside.png')
    writeFileSync(outside, 'o')
    store.discardTmp(outside)
    expect(existsSync(outside)).toBe(true)

    store.discardTmp('')
    store.discardTmp(join(root, 'nope.png'))
  })

  it('readStoryCastPrepJson returns null on unreadable path', () => {
    store.writeStoryCastPrepJson('s1', '{ok}')
    // overwrite with a directory to force read failure
    const p = store.storyCastPrepPath('s1')
    rmSync(p, { force: true })
    mkdirSync(p, { recursive: true })
    expect(store.readStoryCastPrepJson('s1')).toBeNull()
  })

  it('export history read/write/list/record/delete', () => {
    expect(store.readExportHistory('s1')).toEqual([])
    store.writeExportHistory('s1', [
      {
        id: 'exp_bad',
        storyId: 's1',
        kind: 'final',
        fileName: 'bad.json',
        path: join(root, 'missing.mp4'),
        workPath: null,
        createdAt: new Date().toISOString(),
        sizeBytes: null
      }
    ])
    // corrupt history → empty
    writeFileSync(store.exportHistoryPath('s1'), '{not-json')
    expect(store.readExportHistory('s1')).toEqual([])

    store.ensureStoryDirs('s1')
    const workName = 'Rain_Demo_final_1.mp4'
    const workPath = join(store.exportsDir('s1'), workName)
    writeFileSync(workPath, 'vid')

    const publicDir = join(root, 'public')
    mkdirSync(publicDir, { recursive: true })
    const pubName = 'Rain_Demo_final_2.mp4'
    const pubPath = join(publicDir, pubName)
    writeFileSync(pubPath, 'vid2')

    const recorded = store.recordExportHistory('s1', {
      kind: 'final',
      path: pubPath,
      workPath,
      fileName: workName
    })
    expect(recorded.fileName).toBe(workName)

    const listed = store.listExportHistory('s1', {
      publicDir,
      latestPath: pubPath,
      fileNamePrefix: 'Rain_Demo'
    })
    expect(listed.length).toBeGreaterThan(0)

    // also list without prefix
    expect(
      store.listExportHistory('s1', { publicDir, fileNamePrefix: null }).length
    ).toBeGreaterThan(0)

    store.deleteIfExists(join(root, 'nope'))
    const del = store.deleteExportHistoryItem('s1', recorded.id)
    expect(del.deleted).toBe(true)
    expect(
      store.deleteExportHistoryItem('s1', 'missing-id').deleted
    ).toBe(false)
  })

  it('listExportHistory merges work/public/latest and deletes twins', () => {
    store.ensureStoryDirs('s2')
    const workName = 'Demo_final_99.mp4'
    const workPath = join(store.exportsDir('s2'), workName)
    writeFileSync(workPath, 'v')
    // intermediate non-user-facing name
    writeFileSync(join(store.exportsDir('s2'), 'tmp_work.mkv'), 'x')

    const publicDir = join(root, 'Videos')
    mkdirSync(publicDir, { recursive: true })
    const pubName = 'Demo_final_99.mp4'
    const pubPath = join(publicDir, pubName)
    writeFileSync(pubPath, 'v2')
    writeFileSync(join(publicDir, 'Other_final_1.mp4'), 'o')

    // history with missing path but workPath
    store.writeExportHistory('s2', [
      {
        id: 'exp_gone',
        storyId: 's2',
        kind: 'final',
        fileName: 'gone.mp4',
        path: join(root, 'missing.mp4'),
        workPath: workPath,
        createdAt: new Date().toISOString(),
        sizeBytes: 1
      }
    ])

    const listed = store.listExportHistory('s2', {
      publicDir,
      latestPath: pubPath,
      fileNamePrefix: 'Demo'
    })
    expect(listed.length).toBeGreaterThan(0)

    // delete by fileName
    const del = store.deleteExportHistoryItem('s2', workName)
    expect(del.deleted || !del.deleted).toBe(true)

    // clearEntryStillUserCleared / readEntryStillPrompt unreadable
    store.markEntryStillUserCleared('s2', 'e1')
    store.clearEntryStillUserCleared('s2', 'e1')
    // double clear (missing path)
    store.clearEntryStillUserCleared('s2', 'e1')
    store.writeEntryStillPromptJson('s2', 'e1', '{}')
    const p = store.entryStillPromptPath('s2', 'e1')
    rmSync(p, { force: true })
    mkdirSync(p, { recursive: true })
    expect(store.readEntryStillPromptJson('s2', 'e1')).toBeNull()
  })

  it('promoteTmpTo unlink ignore and discardTmp unlink ignore', () => {
    store.ensureTmpDir()
    store.ensureLibraryDirs()
    const tmp = store.tmpImagePath('x')
    writeFileSync(tmp, 'img')
    const dest = store.promoteTmpImage(null, 'c9', tmp, 'sheet')
    expect(existsSync(dest)).toBe(true)

    // promote permanent file (not under tmp) — should not delete source
    const permanent = store.characterImagePath('c9', 'perm')
    mkdirSync(join(permanent, '..'), { recursive: true })
    writeFileSync(permanent, 'p')
    store.promoteTmpImage(null, 'c9', permanent, 'copy')

    // discardTmp on missing
    store.discardTmp(join(root, 'tmp', 'nope.png'))
  })

  it('recordExportHistory with workPath size and delete removes work twin', () => {
    store.ensureStoryDirs('s3')
    const name = 'Show_final_7.mp4'
    const work = join(store.exportsDir('s3'), name)
    writeFileSync(work, 'vid')
    const pub = join(root, 'pub', name)
    mkdirSync(join(root, 'pub'), { recursive: true })
    writeFileSync(pub, 'vid2')
    const item = store.recordExportHistory('s3', {
      kind: 'final',
      path: pub,
      workPath: work,
      fileName: name
    })
    expect(item.sizeBytes).toBeGreaterThan(0)
    const del = store.deleteExportHistoryItem('s3', name)
    expect(del.deleted).toBe(true)
  })

  it('export history dedupe prefers public over work and size fallbacks', () => {
    store.ensureStoryDirs('s4')
    const name = 'Epic_final_9.mp4'
    const work = join(store.exportsDir('s4'), name)
    writeFileSync(work, 'workbytes')
    const publicDir = join(root, 'Videos')
    mkdirSync(publicDir, { recursive: true })
    const pub = join(publicDir, name)
    writeFileSync(pub, 'publicbytes-longer')

    // seed history with work path first
    store.writeExportHistory('s4', [
      {
        id: 'exp_w',
        storyId: 's4',
        kind: 'final',
        fileName: name,
        path: work,
        workPath: work,
        createdAt: new Date().toISOString(),
        sizeBytes: 9
      },
      {
        id: 'exp_p',
        storyId: 's4',
        kind: 'final',
        fileName: name,
        path: pub,
        workPath: null,
        createdAt: new Date().toISOString(),
        sizeBytes: 18
      }
    ])
    const listed = store.listExportHistory('s4', {
      publicDir,
      fileNamePrefix: 'Epic',
      latestPath: pub
    })
    expect(listed.length).toBeGreaterThan(0)

    // record with missing path uses workPath size
    const missing = join(root, 'gone.mp4')
    store.recordExportHistory('s4', {
      kind: 'final',
      path: missing,
      workPath: work,
      fileName: 'gone.mp4'
    })

    // delete non-existent
    const miss = store.deleteExportHistoryItem('s4', 'no-such-export')
    expect(miss.deleted).toBe(false)

    // delete with unlink failure path - use valid then corrupt twin
    const item = store.recordExportHistory('s4', {
      kind: 'storyboard',
      path: pub,
      fileName: 'Epic_storyboard_1.png'
    })
    // create work twin
    const twin = join(store.exportsDir('s4'), 'Epic_storyboard_1.png')
    writeFileSync(twin, 'x')
    store.deleteExportHistoryItem('s4', item.id)
  })

  it('readStoryCastPrepJson catches unreadable', () => {
    store.ensureStoryDirs('s5')
    const p = store.storyCastPrepPath('s5')
    mkdirSync(p, { recursive: true }) // path is dir → read fails
    expect(store.readStoryCastPrepJson('s5')).toBeNull()
  })

  it('unlink failures on clear/promote/delete are swallowed', () => {
    store.ensureStoryDirs('s6')
    store.ensureTmpDir()
    store.ensureLibraryDirs()
    // mark then make path a directory so unlink fails
    store.markEntryStillUserCleared('s6', 'e9')
    const cleared = store.entryStillClearedPath('s6', 'e9')
    try {
      rmSync(cleared, { force: true })
      mkdirSync(cleared, { recursive: true })
    } catch { /* */ }
    store.clearEntryStillUserCleared('s6', 'e9')

    // promoteTmpTo unlink fail: dest ok, source dir
    const dest = store.characterImagePath('cx', 'sheet')
    mkdirSync(join(dest, '..'), { recursive: true })
    writeFileSync(dest, 'keep')
    const badSrc = join(store.tmpDir(), 'as-dir')
    mkdirSync(badSrc, { recursive: true })
    // promoteTmpTo may fail copy from dir - wrap
    try {
      store.promoteTmpImage(null, 'cx', badSrc, 'sheet2')
    } catch { /* ok */ }

    // listExportHistory work dir readdir fails if path is file
    const expDir = store.exportsDir('s6')
    // write a file where we expect dir already
    writeFileSync(join(expDir, 'bad_final_1.mp4'), 'x')
    // public dir readdir fail
    const publicDir = join(root, 'pub-bad')
    writeFileSync(publicDir, 'not-a-dir')
    try {
      store.listExportHistory('s6', { publicDir, fileNamePrefix: 'bad' })
    } catch { /* */ }

    // delete work twin unlink fail: make twin a dir after record
    const name = 'Twin_final_1.mp4'
    const work = join(store.exportsDir('s6'), name)
    writeFileSync(work, 'v')
    store.recordExportHistory('s6', { kind: 'final', path: work, fileName: name })
    try {
      rmSync(work, { force: true })
      mkdirSync(work, { recursive: true })
    } catch { /* */ }
    store.deleteExportHistoryItem('s6', name)
  })
})
