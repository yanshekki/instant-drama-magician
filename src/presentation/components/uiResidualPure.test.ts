import { describe, expect, it, vi } from 'vitest'
import {
  dragOverMove,
  consumeMovedClick,
  toggleLanguageCode,
  shouldCancelModal,
  shouldCancelOnBackdropClick,
  canSubmitRegenNotes,
  attachPlayStart,
  emptyStringBranch,
  noIntroVideoToast,
  showMetaDims,
  wheelZoomDelta,
  preventWheel
} from './uiResidualPure'

describe('uiResidualPure', () => {
  it('covers all UI residual pure branches', () => {
    const e = {
      preventDefault: vi.fn(),
      dataTransfer: { dropEffect: 'none' }
    }
    dragOverMove(e)
    expect(e.preventDefault).toHaveBeenCalled()
    expect(e.dataTransfer.dropEffect).toBe('move')

    expect(consumeMovedClick(true)).toBe(true)
    expect(consumeMovedClick(false)).toBe(false)

    expect(toggleLanguageCode(['en', 'zh'], 'en')).toEqual(['zh'])
    expect(toggleLanguageCode(['en'], 'zh')).toEqual(['en', 'zh'])

    expect(shouldCancelModal('Escape', false)).toBe(true)
    expect(shouldCancelModal('Escape', true)).toBe(false)
    expect(shouldCancelModal('Enter', false)).toBe(false)
    expect(shouldCancelOnBackdropClick(false)).toBe(true)
    expect(shouldCancelOnBackdropClick(true)).toBe(false)

    expect(canSubmitRegenNotes('', true)).toBe(false)
    expect(canSubmitRegenNotes('  ', true)).toBe(false)
    expect(canSubmitRegenNotes('notes', false)).toBe(false)
    expect(canSubmitRegenNotes('notes', true)).toBe(true)

    const start = vi.fn()
    const add = vi.fn()
    const rem = vi.fn()
    const load = vi.fn()
    // ready path
    expect(
      attachPlayStart({
        readyState: 2,
        start,
        addEventListener: add,
        removeEventListener: rem,
        load
      })
    ).toBeUndefined()
    expect(start).toHaveBeenCalled()

    // canplay path
    start.mockClear()
    let canplayCb: (() => void) | null = null
    const cleanup = attachPlayStart({
      readyState: 0,
      start,
      addEventListener: (ev, cb) => {
        if (ev === 'canplay') canplayCb = cb
      },
      removeEventListener: rem,
      load
    })
    expect(load).toHaveBeenCalled()
    expect(canplayCb).toBeTruthy()
    canplayCb!()
    expect(start).toHaveBeenCalled()
    expect(rem).toHaveBeenCalled()
    cleanup?.()

    expect(emptyStringBranch(false)).toBe('')
    expect(emptyStringBranch(true)).toBe('yes')
    expect(noIntroVideoToast()).toBe('noIntro')
    expect(showMetaDims(true, '100×50')).toBe('100×50')
    expect(showMetaDims(true, null)).toBeNull()
    expect(showMetaDims(false, '100×50')).toBeNull()
    expect(wheelZoomDelta(10)).toBeLessThan(0)
    expect(wheelZoomDelta(-10)).toBeGreaterThan(0)
    const we = { preventDefault: vi.fn(), stopPropagation: vi.fn() }
    preventWheel(we)
    expect(we.preventDefault).toHaveBeenCalled()
  })
})
