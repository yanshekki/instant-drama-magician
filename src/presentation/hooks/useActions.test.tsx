import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { createMockApi } from '../../test/mockApi'

const api = createMockApi()
vi.mock('../../lib/api', () => ({ getApi: () => api }))

import { useActions } from './useActions'

describe('useActions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.actions.list = vi.fn().mockResolvedValue([
      { id: 'a1', name: 'Run', updatedAt: '2026-03-01T00:00:00Z' },
      { id: 'a0', name: 'Walk', updatedAt: '2026-01-01T00:00:00Z' }
    ])
    api.actions.create = vi.fn().mockResolvedValue({ id: 'a2' })
    api.actions.update = vi.fn().mockResolvedValue({})
    api.actions.delete = vi.fn().mockResolvedValue({ ok: true })
  })

  it('loads and sorts items', async () => {
    const { result } = renderHook(() => useActions(null))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.items.map((i) => i.id)).toEqual(['a1', 'a0'])
  })

  it('error on list failure', async () => {
    api.actions.list = vi.fn().mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useActions(null))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBeTruthy()
  })

  it('create uses activeStoryId as linkStoryId', async () => {
    const { result } = renderHook(() => useActions('s1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => {
      expect(
        await result.current.create({ name: 'Jump', description: 'd' } as never)
      ).toBe(true)
    })
    expect(api.actions.create).toHaveBeenCalledWith(
      expect.objectContaining({ linkStoryId: 's1' })
    )
  })

  it('create/update/remove errors', async () => {
    const { result } = renderHook(() => useActions(null))
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => {
      expect(await result.current.update('a1', { name: 'X' } as never)).toBe(
        true
      )
      expect(await result.current.remove('a1')).toBe(true)
    })

    api.actions.create = vi.fn().mockRejectedValue(new Error('c'))
    api.actions.update = vi.fn().mockRejectedValue(new Error('u'))
    api.actions.delete = vi.fn().mockRejectedValue(new Error('d'))
    await act(async () => {
      expect(
        await result.current.create({ name: 'N', description: 'd' } as never)
      ).toBe(false)
      expect(await result.current.update('a1', {} as never)).toBe(false)
      expect(await result.current.remove('a1')).toBe(false)
    })
    expect(result.current.error).toBeTruthy()
  })

  it('reload', async () => {
    const { result } = renderHook(() => useActions(null))
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => {
      await result.current.reload()
    })
  })
})
