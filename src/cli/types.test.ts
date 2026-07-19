import { describe, expect, it } from 'vitest'
import { EXIT } from './types'

describe('EXIT codes', () => {
  it('has stable codes', () => {
    expect(EXIT.OK).toBe(0)
    expect(EXIT.ERROR).toBe(1)
    expect(EXIT.USAGE).toBe(2)
    expect(EXIT.UNAUTH).toBe(3)
    expect(EXIT.CONNECT).toBe(4)
  })
})
