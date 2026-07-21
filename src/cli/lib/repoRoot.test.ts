import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { findRepoRoot } from './repoRoot'

describe('findRepoRoot', () => {
  const prev = process.env.IDM_REPO_ROOT
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'idm-root-'))
    delete process.env.IDM_REPO_ROOT
  })

  afterEach(() => {
    if (prev === undefined) delete process.env.IDM_REPO_ROOT
    else process.env.IDM_REPO_ROOT = prev
    rmSync(dir, { recursive: true, force: true })
  })

  it('uses IDM_REPO_ROOT when set', () => {
    process.env.IDM_REPO_ROOT = dir
    writeFileSync(join(dir, 'package.json'), '{}')
    expect(findRepoRoot('/tmp')).toBe(dir)
  })

  it('walks up to package with app name', () => {
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'instant-drama-magician' })
    )
    const nested = join(dir, 'a', 'b')
    mkdirSync(nested, { recursive: true })
    expect(findRepoRoot(nested)).toBe(dir)
  })

  it('matches appId includes, skips corrupt json, falls back to start', () => {
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({
        name: 'other',
        build: { appId: 'hk.ysk.instant-drama-other' }
      })
    )
    expect(findRepoRoot(dir)).toBe(dir)

    const dir2 = mkdtempSync(join(tmpdir(), 'idm-root2-'))
    writeFileSync(join(dir2, 'package.json'), '{not-json')
    // corrupt → continue; still returns start (fallback package.json exists)
    expect(findRepoRoot(dir2)).toBe(dir2)
    rmSync(dir2, { recursive: true, force: true })

    const empty = mkdtempSync(join(tmpdir(), 'idm-root3-'))
    // no package.json → still returns start
    expect(findRepoRoot(empty)).toBe(empty)
    rmSync(empty, { recursive: true, force: true })
  })
})
