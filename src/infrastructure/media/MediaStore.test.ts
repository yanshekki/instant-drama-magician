import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readFileSync
} from 'fs'
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
})
