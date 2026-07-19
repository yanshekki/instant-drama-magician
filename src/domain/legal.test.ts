import { describe, expect, it } from 'vitest'
import { LEGAL_VERSION, needsLegalAccept } from './legal'

describe('needsLegalAccept', () => {
  it('requires accept when never accepted', () => {
    expect(needsLegalAccept(null)).toBe(true)
    expect(needsLegalAccept({ legalAcceptedVersion: null })).toBe(true)
  })

  it('requires accept when version mismatches', () => {
    expect(
      needsLegalAccept({ legalAcceptedVersion: '0.0.1' })
    ).toBe(true)
  })

  it('skips when current version accepted', () => {
    expect(
      needsLegalAccept({ legalAcceptedVersion: LEGAL_VERSION })
    ).toBe(false)
  })
})
