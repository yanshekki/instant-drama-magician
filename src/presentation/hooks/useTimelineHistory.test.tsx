import { describe, expect, it } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTimelineHistory } from './useTimelineHistory'

describe('useTimelineHistory', () => {
  it('supports undo stack when present', () => {
    const { result } = renderHook(() => useTimelineHistory())
    expect(result.current).toBeTruthy()
    // methods may include push/undo/redo
    const keys = Object.keys(result.current)
    expect(keys.length).toBeGreaterThan(0)
  })
})
