import { describe, expect, it, vi } from 'vitest'
import { printHelp } from './help'

describe('printHelp', () => {
  it('writes usage to stdout', () => {
    let out = ''
    vi.spyOn(process.stdout, 'write').mockImplementation((c) => {
      out += String(c)
      return true
    })
    printHelp()
    expect(out).toContain('instant-drama')
    expect(out).toMatch(/doctor|invoke|channels/i)
  })
})
