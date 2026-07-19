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
})
