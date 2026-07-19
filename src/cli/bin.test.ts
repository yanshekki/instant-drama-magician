import { describe, expect, it } from 'vitest'
import { spawnSync } from 'child_process'
import { join } from 'path'

describe('instant-drama bin', () => {
  it('prints help', () => {
    const r = spawnSync(
      process.execPath,
      [
        join(__dirname, '../../node_modules/tsx/dist/cli.mjs'),
        join(__dirname, 'bin.ts'),
        '--help'
      ],
      { encoding: 'utf8', cwd: join(__dirname, '../..') }
    )
    const out = (r.stdout || '') + (r.stderr || '')
    expect(out).toMatch(/instant-drama|USAGE|doctor/i)
  })

  it('prints version', () => {
    const r = spawnSync(
      process.execPath,
      [
        join(__dirname, '../../node_modules/tsx/dist/cli.mjs'),
        join(__dirname, 'bin.ts'),
        'version'
      ],
      { encoding: 'utf8', cwd: join(__dirname, '../..') }
    )
    expect((r.stdout || '').trim().length).toBeGreaterThan(0)
  })
})
