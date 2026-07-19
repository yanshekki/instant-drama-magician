import { describe, expect, it } from 'vitest'
import { kebabToCamel, resolveDomainChannel, DOMAIN_NAMESPACES } from './domain'

describe('domain sugar helpers', () => {
  it('kebabToCamel', () => {
    expect(kebabToCamel('generate-sheet')).toBe('generateSheet')
    expect(kebabToCamel('list')).toBe('list')
  })

  it('resolveDomainChannel maps known channels', () => {
    expect(resolveDomainChannel('characters', 'list')).toBe('characters:list')
    expect(resolveDomainChannel('media', 'check-ffmpeg')).toBe(
      'media:checkFfmpeg'
    )
    expect(resolveDomainChannel('stories', 'generate-cover')).toBe(
      'stories:generateCover'
    )
  })

  it('includes major namespaces', () => {
    for (const ns of [
      'stories',
      'characters',
      'generation',
      'media',
      'settings'
    ]) {
      expect(DOMAIN_NAMESPACES).toContain(ns)
    }
  })
})
