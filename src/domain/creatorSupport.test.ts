import { describe, expect, it } from 'vitest'
import {
  CREATOR_EMAIL,
  CREATOR_HANDLE,
  CREATOR_LINKTREE,
  DONATE_ADDRESSES,
  YSK_HOME_URL
} from './creatorSupport'

describe('creatorSupport', () => {
  it('exposes stable public creator links', () => {
    expect(CREATOR_HANDLE).toContain('yanshekki')
    expect(CREATOR_LINKTREE).toMatch(/^https:\/\/linktr\.ee\//)
    expect(YSK_HOME_URL).toMatch(/^https:\/\/ysk\.hk/)
    expect(CREATOR_EMAIL).toBe('email@ysk.hk')
  })

  it('lists donate addresses for EVM, NEAR, ADA', () => {
    const ids = DONATE_ADDRESSES.map((d) => d.id)
    expect(ids).toEqual(['evm', 'near', 'ada'])
    expect(DONATE_ADDRESSES.find((d) => d.id === 'evm')?.address).toBe(
      'yanshekki.eth'
    )
    expect(DONATE_ADDRESSES.find((d) => d.id === 'near')?.address).toBe(
      'yanshekki.near'
    )
    expect(DONATE_ADDRESSES.find((d) => d.id === 'ada')?.address).toBe(
      '$yanshekki'
    )
  })
})
