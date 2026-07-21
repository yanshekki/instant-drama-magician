/**
 * 100% lines for electron/main/pureHelpers.ts
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { join } from 'path'
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, existsSync } from 'fs'
import { tmpdir } from 'os'

const mkdirThrow = vi.hoisted(() => ({ v: false }))
const execThrow = vi.hoisted(() => ({ gtk: true, desktop: true }))

vi.mock('child_process', () => ({
  execFileSync: vi.fn((cmd: string) => {
    if (cmd === 'gtk-update-icon-cache' && execThrow.gtk) {
      throw new Error('no gtk')
    }
    if (cmd === 'update-desktop-database' && execThrow.desktop) {
      throw new Error('no desktop db')
    }
    return Buffer.alloc(0)
  })
}))

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>()
  return {
    ...actual,
    mkdirSync: (p: string, o?: object) => {
      if (mkdirThrow.v) throw new Error('mkdir deny')
      return actual.mkdirSync(p, o as never)
    }
  }
})

import {
  ensureDirsNonFatal,
  resolveAppIconPathFrom,
  collectAllowedMediaRoots,
  installLinuxDesktopIconPure,
  applyWindowIconPure
} from './pureHelpers'

describe('pureHelpers', () => {
  let dir: string
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'idm-ph-'))
    mkdirThrow.v = false
    execThrow.gtk = true
    execThrow.desktop = true
  })
  afterEach(() => {
    mkdirThrow.v = false
    rmSync(dir, { recursive: true, force: true })
  })

  it('ensureDirsNonFatal success and catch', () => {
    mkdirThrow.v = true
    expect(() => ensureDirsNonFatal([join(dir, 'a')])).not.toThrow()
    mkdirThrow.v = false
    ensureDirsNonFatal([join(dir, 'ok')])
    expect(existsSync(join(dir, 'ok'))).toBe(true)
  })

  it('resolveAppIconPathFrom hit and miss', () => {
    expect(resolveAppIconPathFrom(['', join(dir, 'nope.png')])).toBeUndefined()
    const icon = join(dir, 'icon.png')
    writeFileSync(icon, 'x')
    expect(resolveAppIconPathFrom([join(dir, 'miss.png'), icon])).toBe(icon)
  })

  it('collectAllowedMediaRoots all branches', () => {
    const full = collectAllowedMediaRoots({
      mediaRoot: join(dir, 'media'),
      userData: join(dir, 'ud'),
      configHome: join(dir, 'cfg'),
      cwd: dir
    })
    expect(full.length).toBeGreaterThanOrEqual(7)
    const bare = collectAllowedMediaRoots({
      mediaRoot: '/m',
      userData: '/u',
      configHome: null,
      cwd: null
    })
    expect(bare).toHaveLength(2)
  })

  it('installLinuxDesktopIconPure happy + optional catches + outer catch', () => {
    const icon = join(dir, 'icon.png')
    writeFileSync(icon, Buffer.alloc(32))
    const home = join(dir, 'home')
    mkdirSync(home, { recursive: true })
    const iconsRoot = join(dir, 'icons')
    mkdirSync(iconsRoot, { recursive: true })
    writeFileSync(join(iconsRoot, '256x256.png'), Buffer.alloc(16))

    installLinuxDesktopIconPure({
      iconPath: icon,
      home,
      appIconName: 'idm-test',
      displayNameEn: 'EN',
      displayNameZh: 'ZH',
      execPath: '/bin/true',
      extraArgs: ['--class=idm-test', 'main'],
      iconsRootCandidates: [iconsRoot],
      cwd: dir,
      resourcesPath: ''
    })
    expect(
      existsSync(
        join(home, '.local', 'share', 'applications', 'idm-test.desktop')
      )
    ).toBe(true)

    // without 256 and without class arg; gtk ok
    execThrow.gtk = false
    execThrow.desktop = false
    installLinuxDesktopIconPure({
      iconPath: icon,
      home: join(dir, 'home2'),
      appIconName: 'idm2',
      displayNameEn: 'E',
      displayNameZh: 'Z',
      execPath: '/bin/true',
      extraArgs: [],
      iconsRootCandidates: [join(dir, 'missing-icons')],
      cwd: dir,
      resourcesPath: ''
    })

    // outer catch via mkdir throw
    mkdirThrow.v = true
    installLinuxDesktopIconPure({
      iconPath: icon,
      home: join(dir, 'home3'),
      appIconName: 'idm3',
      displayNameEn: 'E',
      displayNameZh: 'Z',
      execPath: '/bin/true',
      extraArgs: [],
      iconsRootCandidates: [iconsRoot],
      cwd: dir,
      resourcesPath: ''
    })
    mkdirThrow.v = false
  })

  it('applyWindowIconPure empty, linux, and throw', () => {
    const win = { setIcon: vi.fn() }
    applyWindowIconPure(
      win,
      '/x.png',
      () => ({ isEmpty: () => true }),
      'linux'
    )
    expect(win.setIcon).not.toHaveBeenCalled()

    applyWindowIconPure(
      win,
      '/x.png',
      () => ({ isEmpty: () => false }),
      'linux'
    )
    expect(win.setIcon).toHaveBeenCalledTimes(2)

    win.setIcon.mockImplementation(() => {
      throw new Error('fail')
    })
    expect(() =>
      applyWindowIconPure(
        win,
        '/x.png',
        () => ({ isEmpty: () => false }),
        'darwin'
      )
    ).not.toThrow()
  })
})
