import { describe, expect, it } from 'vitest'
import { formatUserError } from './formatUserError'

const t = (key: string) => `T:${key}`

describe('formatUserError', () => {
  it('translates stable errors.* keys', () => {
    expect(formatUserError('errors.costumeNoBaseImage', t)).toBe(
      'T:errors.costumeNoBaseImage'
    )
  })

  it('maps legacy English costume dress error', () => {
    expect(
      formatUserError(
        'No base image for costume dress. Generate a character reference sheet first.',
        t
      )
    ).toBe('T:errors.costumeNoBaseImage')
  })

  it('uses fallback when empty', () => {
    expect(formatUserError('', t)).toBe('T:aiJobs.failed')
  })

  it('maps legacy English timeline unlink errors', () => {
    expect(
      formatUserError('Cannot remove scene: still used on the timeline', t)
    ).toBe('T:errors.cannotRemoveSceneOnTimeline')
    expect(
      formatUserError('Cannot remove character: still used on the timeline', t)
    ).toBe('T:errors.cannotRemoveCharacterOnTimeline')
    expect(
      formatUserError('Cannot remove prop: still used on the timeline', t)
    ).toBe('T:errors.cannotRemovePropOnTimeline')
  })

  it('translates cannot-remove keys', () => {
    expect(formatUserError('errors.cannotRemoveSceneOnTimeline', t)).toBe(
      'T:errors.cannotRemoveSceneOnTimeline'
    )
  })

  it('maps Failed to fetch network errors', () => {
    expect(formatUserError('Failed to fetch', t)).toBe('T:errors.networkFailed')
    expect(formatUserError('TypeError: Failed to fetch', t)).toBe(
      'T:errors.networkFailed'
    )
    expect(formatUserError('fetch failed: ECONNREFUSED', t)).toBe(
      'T:errors.networkFailed'
    )
  })

  it('translates both message and details when combined errors.* keys', () => {
    expect(
      formatUserError('errors.networkFailed — errors.aiUnavailable', t)
    ).toBe('T:errors.networkFailed — T:errors.aiUnavailable')
  })

  it('translates vision and grok CLI error keys', () => {
    expect(formatUserError('errors.visionImageUnreadable', t)).toBe(
      'T:errors.visionImageUnreadable'
    )
    expect(
      formatUserError(
        'errors.visionImageUnreadable — errors.visionImageUnreadableDetail',
        t
      )
    ).toBe(
      'T:errors.visionImageUnreadable — T:errors.visionImageUnreadableDetail'
    )
    expect(formatUserError('errors.grokCliFailed — errors.grokCliFailedHint', t)).toBe(
      'T:errors.grokCliFailed — T:errors.grokCliFailedHint'
    )
  })

  it('maps legacy grok CLI exit text', () => {
    expect(formatUserError('Grok CLI exited with code 1', t)).toBe(
      'T:errors.grokCliFailed'
    )
  })
})
