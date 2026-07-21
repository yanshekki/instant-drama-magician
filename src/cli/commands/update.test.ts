import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('update command module', () => {
  it('loads module', async () => {
    const mod = await import('./update')
    expect(Object.keys(mod).length).toBeGreaterThan(0)
  })

  it('mentions npm or version check', () => {
    const src = readFileSync(join(__dirname, 'update.ts'), 'utf8')
    expect(src.toLowerCase()).toMatch(/npm|version|update/)
  })
})
