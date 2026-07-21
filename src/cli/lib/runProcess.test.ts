import { describe, expect, it, vi } from 'vitest'
import { resolveNpm } from './runProcess'

describe('runProcess', () => {
  it('resolveNpm returns npm or npm.cmd', () => {
    const n = resolveNpm()
    expect(n === 'npm' || n === 'npm.cmd').toBe(true)
  })
})
