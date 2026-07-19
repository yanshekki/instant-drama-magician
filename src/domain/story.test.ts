import { describe, expect, it } from 'vitest'
import {
  canStartGeneration,
  isStoryStatus,
  normalizeStoryTitle,
  validateStoryTitle
} from './story'

describe('story domain', () => {
  it('validates title', () => {
    expect(validateStoryTitle('')).toBeTruthy()
    expect(validateStoryTitle('  ok  ')).toBeNull()
    expect(validateStoryTitle('x'.repeat(201))).toBeTruthy()
  })

  it('normalizes whitespace', () => {
    expect(normalizeStoryTitle('  a   b  ')).toBe('a b')
  })

  it('status helpers', () => {
    expect(isStoryStatus('DRAFT')).toBe(true)
    expect(isStoryStatus('NOPE')).toBe(false)
    expect(canStartGeneration('DRAFT')).toBe(true)
    expect(canStartGeneration('GENERATING')).toBe(false)
  })
})
