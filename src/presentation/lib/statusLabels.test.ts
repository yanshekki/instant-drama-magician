import { describe, expect, it } from 'vitest'
import {
  tMediaStatus,
  tSceneLocationType,
  tSceneStatus
} from './statusLabels'

const t = ((key: string, opts?: { defaultValue?: string }) => {
  if (opts && 'defaultValue' in opts && opts.defaultValue === '') {
    // Simulate missing key for locationType defaultValue branch
    if (key.includes('unknown_xyz') || key.includes('weird')) {
      return opts.defaultValue as string
    }
  }
  // identity-style missing: return key unchanged for locationType miss tests
  if (key === 'scenes.locationTypeValue.interior') return 'Interior'
  if (key === 'scenes.locationTypeValue.exterior') return 'Exterior'
  if (key === 'scenes.locationTypeValue.mixed') return 'Mixed'
  if (key === 'scenes.locationTypeValue.vehicle') return 'Vehicle'
  if (key === 'scenes.locationTypeValue.virtual') return 'Virtual'
  return `L:${key}`
}) as never

describe('statusLabels', () => {
  it('translates all known media statuses', () => {
    for (const s of ['EMPTY', 'QUEUED', 'GENERATING', 'READY', 'FAILED']) {
      expect(tMediaStatus(t, s)).toBe(`L:media.status.${s}`)
    }
  })

  it('passes through unknown media status', () => {
    expect(tMediaStatus(t, 'CUSTOM')).toBe('CUSTOM')
  })

  it('empty for null/undefined media status', () => {
    expect(tMediaStatus(t, null)).toBe('')
    expect(tMediaStatus(t, undefined)).toBe('')
    expect(tMediaStatus(t, '')).toBe('')
  })

  it('translates all known scene statuses', () => {
    for (const s of ['PENDING', 'GENERATING', 'COMPLETED', 'FAILED']) {
      expect(tSceneStatus(t, s)).toBe(`L:scenes.status.${s}`)
    }
  })

  it('passes through unknown scene status', () => {
    expect(tSceneStatus(t, 'OTHER')).toBe('OTHER')
  })

  it('empty for null/undefined scene status', () => {
    expect(tSceneStatus(t, null)).toBe('')
    expect(tSceneStatus(t, undefined)).toBe('')
  })

  it('translates known location types case-insensitively', () => {
    expect(tSceneLocationType(t, 'interior')).toBe('Interior')
    expect(tSceneLocationType(t, 'EXTERIOR')).toBe('Exterior')
    expect(tSceneLocationType(t, ' Mixed ')).toBe('Mixed')
    expect(tSceneLocationType(t, 'vehicle')).toBe('Vehicle')
    expect(tSceneLocationType(t, 'virtual')).toBe('Virtual')
  })

  it('normalizes spaces to underscores for location type', () => {
    // not in LOCATION_TYPES but t returns a non-key string for the slug path
    expect(tSceneLocationType(t, 'Free text place')).toBe(
      'L:scenes.locationTypeValue.free_text_place'
    )
  })

  it('returns empty for blank location type', () => {
    expect(tSceneLocationType(t, null)).toBe('')
    expect(tSceneLocationType(t, undefined)).toBe('')
    expect(tSceneLocationType(t, '   ')).toBe('')
  })

  it('hyphen slug path for unknown location types', () => {
    // not in LOCATION_TYPES; tries slug with defaultValue ''
    const tMiss = ((key: string, opts?: { defaultValue?: string }) => {
      if (opts?.defaultValue === '') return ''
      return key
    }) as never
    expect(tSceneLocationType(tMiss, 'custom-place')).toBe('custom-place')
  })

  it('returns translation from slug path when available', () => {
    const tSlug = ((key: string, opts?: { defaultValue?: string }) => {
      if (key === 'scenes.locationTypeValue.my_place') return 'My Place'
      if (opts?.defaultValue === '') return ''
      return key
    }) as never
    expect(tSceneLocationType(tSlug, 'my-place')).toBe('My Place')
  })
})
