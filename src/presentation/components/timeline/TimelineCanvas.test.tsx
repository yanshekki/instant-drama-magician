import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('timeline/TimelineCanvas', () => {
  it('source module exists and exports', () => {
    const src = readFileSync(join(__dirname, 'TimelineCanvas.tsx'), 'utf8')
    expect(src).toMatch(/export /)
  })
})
