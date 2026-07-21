import { describe, expect, it } from 'vitest'
import { sceneCastLabel } from './timelineLabels'

describe('sceneCastLabel', () => {
  it('uses sceneNumber and title', () => {
    expect(
      sceneCastLabel({
        id: 'sc1',
        title: 'Rainy street',
        description: 'd',
        sceneNumber: 3
      } as never)
    ).toBe('#3 Rainy street')
  })

  it('falls back to description and truncates', () => {
    const long = 'x'.repeat(50)
    expect(
      sceneCastLabel({
        id: 'sc1',
        title: '',
        description: long,
        sceneNumber: 1
      } as never)
    ).toBe(`#1 ${'x'.repeat(36)}`)
  })

  it('without sceneNumber uses short title', () => {
    expect(
      sceneCastLabel({
        id: 'sc99abcdef',
        title: 'Hall',
        description: ''
      } as never)
    ).toBe('Hall')
  })

  it('falls back to id slice when no title/description', () => {
    expect(
      sceneCastLabel({
        id: 'abcdefghij',
        title: '',
        description: null
      } as never)
    ).toBe('abcdefgh')
  })

  it('ignores non-finite sceneNumber', () => {
    expect(
      sceneCastLabel({
        id: 'id1',
        title: 'T',
        description: '',
        sceneNumber: Number.NaN
      } as never)
    ).toBe('T')
  })
})
