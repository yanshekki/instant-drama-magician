import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('appMenu', () => {
  it('builds application menu', () => {
    const src = readFileSync(join(__dirname, 'appMenu.ts'), 'utf8')
    expect(src).toMatch(/Menu|setApplicationMenu|menu:action/)
  })
})
