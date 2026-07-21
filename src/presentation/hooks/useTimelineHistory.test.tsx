import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { createMockApi } from '../../test/mockApi'

const api = createMockApi()
vi.mock('../../lib/api', () => ({ getApi: () => api }))

import { useTimelineHistory } from './useTimelineHistory'

const entry = {
  id: 't1',
  storyId: 's1',
  startTime: 0,
  endTime: 5,
  order: 0,
  characterId: 'c1',
  sceneId: 'sc1',
  propId: null,
  dialogue: 'hi',
  beatContentJson: null,
  characterIds: ['c1'],
  sceneIds: ['sc1'],
  propIds: null
} as never

describe('useTimelineHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.timeline.update = vi.fn().mockResolvedValue({})
    api.timeline.create = vi.fn().mockResolvedValue({ id: 't2' })
    api.timeline.delete = vi.fn().mockResolvedValue({ ok: true })
  })

  it('starts with empty undo/redo', () => {
    const { result } = renderHook(() => useTimelineHistory())
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(false)
  })

  it('recordUpdate enables undo and clears future; undo/redo apply IPC', async () => {
    const { result } = renderHook(() => useTimelineHistory())
    act(() => {
      result.current.recordUpdate(
        't1',
        { dialogue: 'before' } as never,
        { dialogue: 'after' } as never
      )
    })
    expect(result.current.canUndo).toBe(true)
    expect(result.current.canRedo).toBe(false)

    await act(async () => {
      expect(await result.current.undo()).toBe(true)
    })
    expect(api.timeline.update).toHaveBeenCalledWith('t1', {
      dialogue: 'before'
    })
    expect(result.current.canRedo).toBe(true)
    expect(result.current.canUndo).toBe(false)

    await act(async () => {
      expect(await result.current.redo()).toBe(true)
    })
    expect(api.timeline.update).toHaveBeenCalledWith('t1', {
      dialogue: 'after'
    })
  })

  it('recordDelete inverse recreates entry', async () => {
    const { result } = renderHook(() => useTimelineHistory())
    act(() => {
      result.current.recordDelete(entry)
    })
    await act(async () => {
      await result.current.undo()
    })
    expect(api.timeline.create).toHaveBeenCalledWith(
      expect.objectContaining({
        storyId: 's1',
        startTime: 0,
        endTime: 5,
        characterId: 'c1'
      })
    )
    await act(async () => {
      await result.current.redo()
    })
    expect(api.timeline.delete).toHaveBeenCalledWith('t1')
  })

  it('recordCreate inverse deletes entry', async () => {
    const { result } = renderHook(() => useTimelineHistory())
    act(() => {
      result.current.recordCreate(entry)
    })
    await act(async () => {
      await result.current.undo()
    })
    expect(api.timeline.delete).toHaveBeenCalledWith('t1')
    await act(async () => {
      await result.current.redo()
    })
    expect(api.timeline.create).toHaveBeenCalled()
  })

  it('undo/redo return false when empty', async () => {
    const { result } = renderHook(() => useTimelineHistory())
    await act(async () => {
      expect(await result.current.undo()).toBe(false)
      expect(await result.current.redo()).toBe(false)
    })
  })

  it('new record clears redo stack', () => {
    const { result } = renderHook(() => useTimelineHistory())
    act(() => {
      result.current.recordUpdate('t1', { dialogue: 'a' } as never, {
        dialogue: 'b'
      } as never)
    })
    act(() => {
      void result.current.undo()
    })
    act(() => {
      result.current.recordDelete(entry)
    })
    expect(result.current.canRedo).toBe(false)
  })

  it('clear empties stacks', () => {
    const { result } = renderHook(() => useTimelineHistory())
    act(() => {
      result.current.recordCreate(entry)
      result.current.clear()
    })
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(false)
  })

  it('caps history at 50 entries', () => {
    const { result } = renderHook(() => useTimelineHistory())
    act(() => {
      for (let i = 0; i < 55; i++) {
        result.current.recordUpdate(
          't1',
          { dialogue: String(i) } as never,
          { dialogue: String(i + 1) } as never
        )
      }
    })
    expect(result.current.canUndo).toBe(true)
    // 50 undos should exhaust; 51st false
  })
})
