import { describe, expect, it } from 'vitest'
import {
  coerceLookPackId,
  getLookPack,
  lookPackSettingsPatch,
  resolveContinuityMode,
  resolveMediaTemplateForPack,
  resolveMotionPriority
} from './lookPacks'

describe('lookPacks', () => {
  it('defaults to follow-asset with no behaviour change', () => {
    const p = getLookPack(null)
    expect(p.id).toBe('follow-asset')
    expect(p.continuityMode).toBe('storyboard')
    expect(p.advancedIdentity).toBe(false)
    expect(p.mediaTemplateId).toBe('follow-asset')
  })

  it('continuous-clip enables chain-end', () => {
    expect(getLookPack('continuous-clip').continuityMode).toBe('chain-end')
    expect(lookPackSettingsPatch('continuous-clip').continuityMode).toBe(
      'chain-end'
    )
  })

  it('payload flags override pack', () => {
    expect(resolveContinuityMode('continuous-clip', 'storyboard')).toBe(
      'storyboard'
    )
    expect(resolveMotionPriority('follow-asset', 'action')).toBe('action')
    expect(resolveMediaTemplateForPack('identity-lock', 'restyle')).toBe(
      'restyle'
    )
    expect(resolveMediaTemplateForPack('identity-lock', 'not-a-template')).toBe(
      'identity-lock'
    )
    expect(resolveMediaTemplateForPack('identity-lock', null)).toBe(
      'identity-lock'
    )
  })

  it('coerce unknown pack id', () => {
    expect(coerceLookPackId('nope')).toBe('follow-asset')
  })
})
