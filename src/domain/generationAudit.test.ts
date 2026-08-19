import { describe, expect, it } from 'vitest'
import {
  auditChainEndWait,
  auditContinuityWriteFailed,
  auditGrokVoicesDropped,
  auditIdentityEditFallback,
  auditMissingEndFrame
} from './generationAudit'

describe('generationAudit', () => {
  it('builds warn entries for missing / failed end-frame', () => {
    expect(auditMissingEndFrame({ entryId: 'e1', previousBeatIndex: 2 }).level).toBe(
      'warn'
    )
    expect(auditContinuityWriteFailed({ entryId: 'e1' }).meta.reason).toBe(
      'end-frame-write-failed'
    )
    expect(auditIdentityEditFallback({ kind: 'character-sheet', reason: 'no-edit-base' }).message).toMatch(
      /identity/
    )
    expect(auditChainEndWait({ entryId: 'e2' }).meta.continuityMode).toBe(
      'chain-end'
    )
    expect(auditGrokVoicesDropped({ entryId: 'e3' }).meta.reason).toBe(
      'grok-voices-dropped'
    )
  })
})
