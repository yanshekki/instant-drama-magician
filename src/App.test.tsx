import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('App', () => {
  it('entry routes application shell', () => {
    const src = readFileSync(join(__dirname, 'App.tsx'), 'utf8')
    expect(src).toMatch(/export\s+(default\s+)?function\s+App|export\s+default/)
    expect(src).toMatch(/Route|Router|Stories|Settings/)
  })
})
