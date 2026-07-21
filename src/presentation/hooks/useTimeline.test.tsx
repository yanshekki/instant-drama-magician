import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { createMockApi } from '../../test/mockApi'

const api = createMockApi()
vi.mock('../../lib/api', () => ({ getApi: () => api }))

import { useTimeline } from './useTimeline'

const entry = {
  id: 't1',
  storyId: 's1',
  startTime: 0,
  endTime: 5,
  order: 0,
  characterId: null,
  sceneId: null,
  propId: null,
  dialogue: null,
  beatContentJson: null,
  characterIds: null,
  sceneIds: null,
  propIds: null
}

describe('useTimeline', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.timeline.list = vi.fn().mockResolvedValue([entry])
    api.timeline.create = vi.fn().mockResolvedValue({ id: 't2' })
    api.timeline.update = vi.fn().mockResolvedValue({})
    api.timeline.delete = vi.fn().mockResolvedValue({ ok: true })
    api.timeline.reorder = vi.fn().mockResolvedValue([entry])
  })

  it('clears entries when storyId is null', async () => {
    const { result } = renderHook(() => useTimeline(null))
    await waitFor(() => {
      expect(result.current.entries).toEqual([])
    })
    expect(api.timeline.list).not.toHaveBeenCalled()
  })

  it('loads timeline for story and computes totalDuration', async () => {
    const { result } = renderHook(() => useTimeline('s1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.entries).toHaveLength(1)
    expect(result.current.totalDuration).toBe(5)
    expect(result.current.error).toBeNull()
  })

  it('sets error on list failure', async () => {
    api.timeline.list = vi.fn().mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useTimeline('s1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBeTruthy()
  })

  it('create requires storyId', async () => {
    const { result } = renderHook(() => useTimeline(null))
    await act(async () => {
      expect(
        await result.current.create({ startTime: 0, endTime: 1 } as never)
      ).toBe(false)
    })
  })

  it('create/update/remove/reorder success and failure', async () => {
    const { result } = renderHook(() => useTimeline('s1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      expect(
        await result.current.create({ startTime: 0, endTime: 2 } as never)
      ).toBe(true)
      expect(await result.current.update('t1', { dialogue: 'hi' } as never)).toBe(
        true
      )
      expect(await result.current.remove('t1')).toBe(true)
      expect(await result.current.reorder(['t1'])).toBe(true)
    })
    expect(api.timeline.create).toHaveBeenCalledWith(
      expect.objectContaining({ storyId: 's1' })
    )
    expect(api.timeline.reorder).toHaveBeenCalledWith('s1', ['t1'])

    api.timeline.create = vi.fn().mockRejectedValue(new Error('c'))
    api.timeline.update = vi.fn().mockRejectedValue(new Error('u'))
    api.timeline.delete = vi.fn().mockRejectedValue(new Error('d'))
    api.timeline.reorder = vi.fn().mockRejectedValue(new Error('r'))
    await act(async () => {
      expect(
        await result.current.create({ startTime: 0, endTime: 1 } as never)
      ).toBe(false)
      expect(await result.current.update('t1', {} as never)).toBe(false)
      expect(await result.current.remove('t1')).toBe(false)
      expect(await result.current.reorder(['t1'])).toBe(false)
    })
  })

  it('reorder requires storyId', async () => {
    const { result } = renderHook(() => useTimeline(null))
    await act(async () => {
      expect(await result.current.reorder(['t1'])).toBe(false)
    })
  })

  it('reload', async () => {
    const { result } = renderHook(() => useTimeline('s1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => {
      await result.current.reload()
    })
  })
})
