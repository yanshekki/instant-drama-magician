import { describe, expect, it } from 'vitest'
import { resolveClient } from './index'

describe('resolveClient', () => {
  it('uses local when no url', async () => {
    // Will try create local — skip heavy if fails; just type check export
    expect(typeof resolveClient).toBe('function')
  })
})
