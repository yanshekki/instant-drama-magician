import { describe, expect, it } from 'vitest'
import { tMediaStatus, tSceneStatus } from './statusLabels'

const t = ((key: string) => `L:${key}`) as never

describe('statusLabels', () => {
  it('translates known media status', () => {
    expect(tMediaStatus(t, 'READY')).toBe('L:media.status.READY')
  })

  it('passes through unknown media status', () => {
    expect(tMediaStatus(t, 'CUSTOM')).toBe('CUSTOM')
  })

  it('translates scene status', () => {
    expect(tSceneStatus(t, 'PENDING')).toBe('L:scenes.status.PENDING')
  })

  it('empty for null', () => {
    expect(tMediaStatus(t, null)).toBe('')
    expect(tSceneStatus(t, undefined)).toBe('')
  })
})
