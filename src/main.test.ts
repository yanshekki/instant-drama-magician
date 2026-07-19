import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('main.tsx entry', () => {
  it('exists and mounts React root', () => {
    const src = readFileSync(join(__dirname, 'main.tsx'), 'utf8')
    expect(src).toMatch(/createRoot|ReactDOM/)
    expect(src).toMatch(/App/)
  })
})
