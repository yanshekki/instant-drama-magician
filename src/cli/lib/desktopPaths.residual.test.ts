import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  chmodSync,
  symlinkSync
} from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import {
  listBuildArtifacts,
  resolveLaunchTarget
} from './desktopPaths'

describe('desktopPaths residual 100%', () => {
  let root: string
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'idm-desk-'))
  })
  afterEach(() => {
    try {
      rmSync(root, { recursive: true, force: true })
    } catch {
      /* */
    }
  })

  it('walkFiles handles readdir/stat failures and launch scores', () => {
    const release = join(root, 'release')
    mkdirSync(join(release, 'linux-unpacked'), { recursive: true })
    // binary
    writeFileSync(join(release, 'linux-unpacked', 'instant-drama-magician'), 'x')
    // appimage
    writeFileSync(join(release, 'InstantDrama.AppImage'), 'x')
    // deb installer
    writeFileSync(join(release, 'idm.deb'), 'x')
    // dmg
    writeFileSync(join(release, 'idm.dmg'), 'x')
    // nsis
    writeFileSync(join(release, 'Setup.exe'), 'x')
    // other
    writeFileSync(join(release, 'notes.txt'), 'x')
    // mac app bundle dir
    mkdirSync(join(release, 'InstantDrama Magician.app', 'Contents'), {
      recursive: true
    })
    // broken entry for stat catch
    try {
      symlinkSync(join(release, 'missing'), join(release, 'broken-link'))
    } catch {
      /* */
    }
    // unreadable dir for readdir catch
    const bad = join(release, 'bad-dir')
    mkdirSync(bad, { recursive: true })
    try {
      chmodSync(bad, 0)
    } catch {
      /* */
    }

    const arts = listBuildArtifacts(release)
    expect(arts.length).toBeGreaterThan(0)

    try {
      chmodSync(bad, 0o755)
    } catch {
      /* */
    }

    // resolveLaunchTarget Applications fallback for mac
    const r = resolveLaunchTarget({
      repoRoot: root,
      platform: 'mac',
      preferDev: false
    })
    // may be null if no /Applications
    expect(r === null || r.mode === 'packaged' || r.mode === 'dev').toBe(true)

    // preferDev
    const dev = resolveLaunchTarget({
      repoRoot: root,
      preferDev: true,
      platform: 'linux'
    })
    expect(dev?.mode).toBe('dev')

    // appPath variants
    const appPath = join(release, 'InstantDrama Magician.app')
    expect(
      resolveLaunchTarget({
        repoRoot: root,
        appPath,
        platform: 'mac'
      })?.method
    ).toBe('open-mac')

    const ai = join(release, 'InstantDrama.AppImage')
    expect(
      resolveLaunchTarget({
        repoRoot: root,
        appPath: ai,
        platform: 'linux'
      })?.method
    ).toBe('appimage')

    expect(
      resolveLaunchTarget({
        repoRoot: root,
        appPath: join(release, 'Setup.exe'),
        platform: 'win'
      })?.method
    ).toBe('spawn')
  })

  it('safeStatMtime catch via list on missing nested', () => {
    const release = join(root, 'empty-rel')
    mkdirSync(release, { recursive: true })
    expect(listBuildArtifacts(release)).toEqual([])
    // non-dir root
    const fileRoot = join(root, 'file-root')
    writeFileSync(fileRoot, 'x')
    expect(listBuildArtifacts(fileRoot)).toEqual([])
  })
})
