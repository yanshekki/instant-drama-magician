import { describe, expect, it } from 'vitest'
import {
  sceneCastLabel,
  timelineArtStyleLabel,
  timelineTrackLabel
} from './timelineLabels'

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

  it('localizes known art style ids and keeps custom text', () => {
    const t = (k: string) =>
      k === 'characters.artPhotoCinematic' ? '電影寫實（預設）' : k
    expect(timelineArtStyleLabel('photo_cinematic', t)).toBe('電影寫實（預設）')
    expect(timelineArtStyleLabel('  photo_cinematic  ', t)).toBe(
      '電影寫實（預設）'
    )
    expect(timelineArtStyleLabel('亞青手持', t)).toBe('亞青手持')
  })

  it('dedupes repeated speaker prefixes on the track', () => {
    expect(
      timelineTrackLabel(
        '沈執一：先淨手，再立壇。\n沈執一：見邪不退，退則破戒。'
      )
    ).toBe('沈執一：先淨手，再立壇。  見邪不退，退則破戒。')
  })

  it('truncates very long track labels', () => {
    const long = `A：${'字'.repeat(80)}\nA：${'詞'.repeat(80)}`
    const out = timelineTrackLabel(long, 40)
    expect(out.endsWith('…')).toBe(true)
    expect(out.length).toBeLessThanOrEqual(40)
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
