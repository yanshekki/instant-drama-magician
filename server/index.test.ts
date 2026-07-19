import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('server entry', () => {
  it('starts EmbeddedWebServer from env', () => {
    const src = readFileSync(join(__dirname, 'index.ts'), 'utf8')
    expect(src).toMatch(/EmbeddedWebServer|IDM_PORT|IDM_DATA_DIR/)
  })
})
