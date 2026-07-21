import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { createMockApi } from '../../test/mockApi'

const api = createMockApi()
vi.mock('../../lib/api', () => ({ getApi: () => api }))

import { useScenes } from './useScenes'

describe('useScenes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.scenes.list = vi.fn().mockResolvedValue([
      { id: 'sc1', title: 'A', updatedAt: '2026-02-01T00:00:00Z' }
    ])
    api.scenes.create = vi.fn().mockResolvedValue({ id: 'sc2' })
    api.scenes.update = vi.fn().mockResolvedValue({})
    api.scenes.delete = vi.fn().mockResolvedValue({ ok: true })
    api.stories.linkScene = vi.fn().mockResolvedValue({})
    api.stories.unlinkScene = vi.fn().mockResolvedValue({})
  })

  it('loads list and clears linked without story', async () => {
    const { result } = renderHook(() => useScenes(null))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.items).toHaveLength(1)
    expect(result.current.linkedIds.size).toBe(0)
  })

  it('loads linked cast for story', async () => {
    api.scenes.list = vi
      .fn()
      .mockResolvedValueOnce([{ id: 'sc1' }, { id: 'sc2' }])
      .mockResolvedValueOnce([{ id: 'sc2' }])
    const { result } = renderHook(() => useScenes('s1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.linkedIds.has('sc2')).toBe(true)
  })

  it('sets error on list failure', async () => {
    api.scenes.list = vi.fn().mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useScenes(null))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBeTruthy()
  })

  it('create/update/remove happy and error paths', async () => {
    const { result } = renderHook(() => useScenes('s1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      expect(
        await result.current.create({ title: 'T', description: 'd' } as never)
      ).toBe(true)
    })
    expect(api.scenes.create).toHaveBeenCalledWith(
      expect.objectContaining({ linkStoryId: 's1' })
    )

    await act(async () => {
      expect(await result.current.update('sc1', { title: 'X' } as never)).toBe(
        true
      )
      expect(await result.current.remove('sc1')).toBe(true)
    })

    api.scenes.create = vi.fn().mockRejectedValue(new Error('c'))
    api.scenes.update = vi.fn().mockRejectedValue(new Error('u'))
    api.scenes.delete = vi.fn().mockRejectedValue(new Error('d'))
    await act(async () => {
      expect(
        await result.current.create({ title: 'T', description: 'd' } as never)
      ).toBe(false)
      expect(await result.current.update('sc1', {} as never)).toBe(false)
      expect(await result.current.remove('sc1')).toBe(false)
    })
  })

  it('link/unlink require story and handle errors', async () => {
    const { result: noStory } = renderHook(() => useScenes(null))
    await waitFor(() => expect(noStory.current.loading).toBe(false))
    await act(async () => {
      expect(await noStory.current.link('sc1')).toBe(false)
      expect(await noStory.current.unlink('sc1')).toBe(false)
    })

    api.scenes.list = vi.fn().mockResolvedValue([])
    const { result } = renderHook(() => useScenes('s1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => {
      expect(await result.current.link('sc1', 3)).toBe(true)
      expect(await result.current.unlink('sc1')).toBe(true)
    })
    expect(api.stories.linkScene).toHaveBeenCalledWith({
      storyId: 's1',
      sceneId: 'sc1',
      sceneNumber: 3
    })

    api.stories.linkScene = vi.fn().mockRejectedValue(new Error('x'))
    api.stories.unlinkScene = vi.fn().mockRejectedValue(new Error('y'))
    await act(async () => {
      expect(await result.current.link('sc1')).toBe(false)
      expect(await result.current.unlink('sc1')).toBe(false)
    })
  })

  it('reload works', async () => {
    const { result } = renderHook(() => useScenes(null))
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => {
      await result.current.reload()
    })
    expect(api.scenes.list).toHaveBeenCalled()
  })
})
