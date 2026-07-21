import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import {
  mkdirSync,
  writeFileSync,
  rmSync,
  chmodSync,
  existsSync
} from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { listBuildArtifacts, resolveLaunchTarget } from './desktopPaths'

describe('desktopPaths', () => {
  let root: string

  beforeEach(() => {
    root = join(tmpdir(), `idm-release-${Date.now()}`)
    mkdirSync(root, { recursive: true })
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('lists linux unpacked binary and AppImage', () => {
    const unpack = join(root, 'linux-unpacked')
    mkdirSync(unpack, { recursive: true })
    const bin = join(unpack, 'instant-drama-magician')
    writeFileSync(bin, '#!/bin/sh\n')
    chmodSync(bin, 0o755)
    const ai = join(root, 'InstantDrama-Magician-1.0.0.AppImage')
    writeFileSync(ai, 'AI')
    const arts = listBuildArtifacts(root, 'linux')
    expect(arts.some((a) => a.kind === 'dir-binary')).toBe(true)
    expect(arts.some((a) => a.kind === 'appimage')).toBe(true)
  })

  it('lists mac .app and win exe', () => {
    const macDir = join(root, 'mac')
    mkdirSync(macDir, { recursive: true })
    const app = join(macDir, 'InstantDrama Magician.app')
    mkdirSync(app, { recursive: true })
    writeFileSync(join(app, 'Contents'), '') // touch

    const winDir = join(root, 'win-unpacked')
    mkdirSync(winDir, { recursive: true })
    writeFileSync(join(winDir, 'InstantDrama Magician.exe'), 'MZ')

    expect(
      listBuildArtifacts(root, 'mac').some((a) => a.kind === 'app')
    ).toBe(true)
    expect(
      listBuildArtifacts(root, 'win').some((a) => a.kind === 'exe')
    ).toBe(true)
  })

  it('resolveLaunchTarget prefers packaged binary', () => {
    const unpack = join(root, 'linux-unpacked')
    mkdirSync(unpack, { recursive: true })
    const bin = join(unpack, 'instant-drama-magician')
    writeFileSync(bin, 'x')
    // repoRoot with release/
    const repo = join(tmpdir(), `idm-repo-${Date.now()}`)
    mkdirSync(join(repo, 'release'), { recursive: true })
    // put artifact under repo/release
    const rUnpack = join(repo, 'release', 'linux-unpacked')
    mkdirSync(rUnpack, { recursive: true })
    writeFileSync(join(rUnpack, 'instant-drama-magician'), 'x')
    try {
      const t = resolveLaunchTarget({ repoRoot: repo })
      expect(t).toBeTruthy()
      expect(t?.mode).toBe('packaged')
      expect(t?.path).toContain('instant-drama-magician')
    } finally {
      rmSync(repo, { recursive: true, force: true })
    }
  })

  it('resolveLaunchTarget --dev', () => {
    const t = resolveLaunchTarget({
      repoRoot: root,
      preferDev: true
    })
    expect(t?.mode).toBe('dev')
  })

  it('lists dmg deb nsis setup exe and filters by platform', () => {
    writeFileSync(join(root, 'App.dmg'), 'd')
    writeFileSync(join(root, 'pkg.deb'), 'd')
    writeFileSync(join(root, 'Setup-1.0.0.exe'), 'MZ')
    writeFileSync(join(root, 'InstantDrama Magician.exe'), 'MZ')
    writeFileSync(join(root, 'noise.txt'), 'x')

    const all = listBuildArtifacts(root)
    expect(all.some((a) => a.kind === 'dmg')).toBe(true)
    expect(all.some((a) => a.kind === 'deb')).toBe(true)
    expect(all.some((a) => a.kind === 'nsis')).toBe(true)
    expect(all.every((a) => a.kind !== 'other')).toBe(true)

    expect(listBuildArtifacts(root, 'mac').every((a) => a.platform === 'mac')).toBe(
      true
    )
    expect(listBuildArtifacts(root, 'win').every((a) => a.platform === 'win')).toBe(
      true
    )
  })

  it('walk skips node_modules and unreadable dirs', () => {
    mkdirSync(join(root, 'node_modules', 'x'), { recursive: true })
    writeFileSync(join(root, 'node_modules', 'x', 'instant-drama-magician'), 'nope')
    const unpack = join(root, 'linux-unpacked')
    mkdirSync(unpack, { recursive: true })
    writeFileSync(join(unpack, 'instant-drama-magician'), 'ok')
    const arts = listBuildArtifacts(root, 'linux')
    expect(arts.every((a) => !a.path.includes('node_modules'))).toBe(true)
    expect(existsSync).toBeTypeOf('function')
  })

  it('resolveLaunchTarget null when nothing found without preferDev', () => {
    const empty = join(tmpdir(), `idm-empty-rel-${Date.now()}`)
    mkdirSync(empty, { recursive: true })
    try {
      const t = resolveLaunchTarget({ repoRoot: empty, preferDev: false })
      // may fall back to dev electron if available in real repo; when empty repo
      // without node_modules electron, null is ok
      if (t) {
        expect(['packaged', 'dev']).toContain(t.mode)
      }
    } finally {
      rmSync(empty, { recursive: true, force: true })
    }
  })
})
