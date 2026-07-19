import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('TimelinePage', () => {
  it('exports timeline page module', () => {
    const src = readFileSync(join(__dirname, 'TimelinePage.tsx'), 'utf8')
    expect(src).toMatch(/export\s+function\s+TimelinePage|export\s+default/)
  })
})
