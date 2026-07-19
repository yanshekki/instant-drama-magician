import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('useMenuActions', () => {
  it('is defined as exported hook', () => {
    const src = readFileSync(join(__dirname, 'useMenuActions.ts'), 'utf8')
    expect(src).toContain('export function useMenuActions')
  })
})
