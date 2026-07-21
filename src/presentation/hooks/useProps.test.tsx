import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { createMockApi } from '../../test/mockApi'

const api = createMockApi()
vi.mock('../../lib/api', () => ({ getApi: () => api }))

import { useProps } from './useProps'

describe('useProps', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.props.list = vi
      .fn()
      .mockResolvedValue([{ id: 'p1', name: 'Cup', updatedAt: '2026-01-01' }])
    api.props.create = vi.fn().mockResolvedValue({ id: 'p2' })
    api.props.update = vi.fn().mockResolvedValue({})
    api.props.delete = vi.fn().mockResolvedValue({ ok: true })
    api.stories.linkProp = vi.fn().mockResolvedValue({})
    api.stories.unlinkProp = vi.fn().mockResolvedValue({})
  })

  it('loads list without story', async () => {
    const { result } = renderHook(() => useProps(null))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.items).toHaveLength(1)
    expect(result.current.linkedIds.size).toBe(0)
  })

  it('loads linked for story', async () => {
    api.props.list = vi
      .fn()
      .mockResolvedValueOnce([{ id: 'p1' }, { id: 'p2' }])
      .mockResolvedValueOnce([{ id: 'p1' }])
    const { result } = renderHook(() => useProps('s1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.linkedIds.has('p1')).toBe(true)
  })

  it('error on list failure', async () => {
    api.props.list = vi.fn().mockRejectedValue(new Error('x'))
    const { result } = renderHook(() => useProps(null))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBeTruthy()
  })

  it('create/update/remove paths', async () => {
    const { result } = renderHook(() => useProps('s1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => {
      expect(
        await result.current.create({ name: 'N', description: 'd' } as never)
      ).toBe(true)
      expect(await result.current.update('p1', { name: 'Z' } as never)).toBe(
        true
      )
      expect(await result.current.remove('p1')).toBe(true)
    })
    expect(api.props.create).toHaveBeenCalledWith(
      expect.objectContaining({ linkStoryId: 's1' })
    )

    api.props.create = vi.fn().mockRejectedValue(new Error('c'))
    api.props.update = vi.fn().mockRejectedValue(new Error('u'))
    api.props.delete = vi.fn().mockRejectedValue(new Error('d'))
    await act(async () => {
      expect(
        await result.current.create({ name: 'N', description: 'd' } as never)
      ).toBe(false)
      expect(await result.current.update('p1', {} as never)).toBe(false)
      expect(await result.current.remove('p1')).toBe(false)
    })
  })

  it('link/unlink', async () => {
    const { result: bare } = renderHook(() => useProps(null))
    await waitFor(() => expect(bare.current.loading).toBe(false))
    await act(async () => {
      expect(await bare.current.link('p1')).toBe(false)
      expect(await bare.current.unlink('p1')).toBe(false)
    })

    api.props.list = vi.fn().mockResolvedValue([])
    const { result } = renderHook(() => useProps('s1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => {
      expect(await result.current.link('p1')).toBe(true)
      expect(await result.current.unlink('p1')).toBe(true)
    })
    api.stories.linkProp = vi.fn().mockRejectedValue(new Error('x'))
    api.stories.unlinkProp = vi.fn().mockRejectedValue(new Error('y'))
    await act(async () => {
      expect(await result.current.link('p1')).toBe(false)
      expect(await result.current.unlink('p1')).toBe(false)
    })
  })

  it('reload', async () => {
    const { result } = renderHook(() => useProps(null))
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => {
      await result.current.reload()
    })
  })
})
