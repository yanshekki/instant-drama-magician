import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('electron main index', () => {
  it('registers app lifecycle', () => {
    const src = readFileSync(join(__dirname, 'index.ts'), 'utf8')
    expect(src).toMatch(/app\.whenReady|BrowserWindow|registerIpcHandlers/)
  })
})
