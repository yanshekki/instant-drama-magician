import { describe, expect, it } from 'vitest'
import { LEGAL_VERSION, needsLegalAccept } from '../domain/legal'

describe('legal contract', () => {
  it('LEGAL_VERSION is 1.0.0', () => {
    expect(LEGAL_VERSION).toBe('1.0.0')
  })

  it('needs re-accept when version missing or stale', () => {
    expect(needsLegalAccept({})).toBe(true)
    expect(needsLegalAccept({ legalAcceptedVersion: '0.9.0' })).toBe(true)
    expect(needsLegalAccept({ legalAcceptedVersion: LEGAL_VERSION })).toBe(
      false
    )
  })
})
