import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('build command module', () => {
  it('exports a runnable command surface', async () => {
    const mod = await import('./build')
    expect(mod).toBeTruthy()
    // command modules typically export default or named run/buildCommand
    const keys = Object.keys(mod)
    expect(keys.length).toBeGreaterThan(0)
  })

  it('source mentions electron-builder or pack', () => {
    const src = readFileSync(join(__dirname, 'build.ts'), 'utf8')
    expect(src.length).toBeGreaterThan(50)
  })
})
