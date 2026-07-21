import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('open command module', () => {
  it('loads module', async () => {
    const mod = await import('./open')
    expect(Object.keys(mod).length).toBeGreaterThan(0)
  })

  it('references launch targets', () => {
    const src = readFileSync(join(__dirname, 'open.ts'), 'utf8')
    expect(src).toMatch(/resolveLaunchTarget|dev|packaged/)
  })
})
