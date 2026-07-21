import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { createMockApi } from '../../test/mockApi'

const api = createMockApi()
vi.mock('../../lib/api', () => ({
  getApi: () => api
}))

import { useCharacters } from './useCharacters'

describe('useCharacters', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.characters.list = vi.fn().mockResolvedValue([
      { id: 'c1', name: 'A', description: 'd', updatedAt: '2026-01-02T00:00:00Z' },
      { id: 'c0', name: 'B', description: 'e', updatedAt: '2026-01-01T00:00:00Z' }
    ])
    api.characters.create = vi.fn().mockResolvedValue({ id: 'c2' })
    api.characters.update = vi.fn().mockResolvedValue({})
    api.characters.delete = vi.fn().mockResolvedValue({ ok: true })
    api.stories.linkCharacter = vi.fn().mockResolvedValue({})
    api.stories.unlinkCharacter = vi.fn().mockResolvedValue({})
  })

  it('loads list on mount and sorts by updatedAt', async () => {
    const { result } = renderHook(() => useCharacters(null))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.items.map((i) => i.id)).toEqual(['c1', 'c0'])
    expect(result.current.error).toBeNull()
    expect(result.current.linkedIds.size).toBe(0)
  })

  it('loads cast when activeStoryId set', async () => {
    api.characters.list = vi
      .fn()
      .mockResolvedValueOnce([
        { id: 'c1', name: 'A', description: 'd' },
        { id: 'c2', name: 'B', description: 'e' }
      ])
      .mockResolvedValueOnce([{ id: 'c1', name: 'A', description: 'd' }])
    const { result } = renderHook(() => useCharacters('s1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.linkedIds.has('c1')).toBe(true)
    expect(result.current.linkedIds.has('c2')).toBe(false)
    expect(api.characters.list).toHaveBeenCalledWith({
      storyId: 's1',
      forStory: true
    })
  })

  it('sets error on failure', async () => {
    api.characters.list = vi.fn().mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useCharacters(null))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBeTruthy()
  })

  it('create calls api and reloads', async () => {
    const { result } = renderHook(() => useCharacters(null))
    await waitFor(() => expect(result.current.loading).toBe(false))
    let ok = false
    await act(async () => {
      ok = await result.current.create({
        name: 'B',
        description: 'x'
      } as never)
    })
    expect(ok).toBe(true)
    expect(api.characters.create).toHaveBeenCalled()
  })

  it('create uses activeStoryId as linkStoryId by default', async () => {
    api.characters.list = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValue([])
    const { result } = renderHook(() => useCharacters('story-9'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => {
      await result.current.create({ name: 'N', description: 'd' } as never)
    })
    expect(api.characters.create).toHaveBeenCalledWith(
      expect.objectContaining({ linkStoryId: 'story-9' })
    )
  })

  it('create returns false on error', async () => {
    const { result } = renderHook(() => useCharacters(null))
    await waitFor(() => expect(result.current.loading).toBe(false))
    api.characters.create = vi.fn().mockRejectedValue(new Error('nope'))
    let ok = true
    await act(async () => {
      ok = await result.current.create({ name: 'X', description: 'y' } as never)
    })
    expect(ok).toBe(false)
    expect(result.current.error).toBeTruthy()
  })

  it('update success and failure', async () => {
    const { result } = renderHook(() => useCharacters(null))
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => {
      expect(await result.current.update('c1', { name: 'Z' } as never)).toBe(
        true
      )
    })
    expect(api.characters.update).toHaveBeenCalledWith('c1', { name: 'Z' })

    api.characters.update = vi.fn().mockRejectedValue(new Error('fail'))
    await act(async () => {
      expect(await result.current.update('c1', { name: 'Z' } as never)).toBe(
        false
      )
    })
  })

  it('remove success and failure', async () => {
    const { result } = renderHook(() => useCharacters(null))
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => {
      expect(await result.current.remove('c1')).toBe(true)
    })
    api.characters.delete = vi.fn().mockRejectedValue(new Error('fail'))
    await act(async () => {
      expect(await result.current.remove('c1')).toBe(false)
    })
  })

  it('link/unlink require activeStoryId', async () => {
    const { result } = renderHook(() => useCharacters(null))
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => {
      expect(await result.current.link('c1')).toBe(false)
      expect(await result.current.unlink('c1')).toBe(false)
    })
    expect(api.stories.linkCharacter).not.toHaveBeenCalled()
  })

  it('link/unlink success and failure with story', async () => {
    api.characters.list = vi.fn().mockResolvedValue([])
    const { result } = renderHook(() => useCharacters('s1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => {
      expect(await result.current.link('c1')).toBe(true)
      expect(await result.current.unlink('c1')).toBe(true)
    })
    expect(api.stories.linkCharacter).toHaveBeenCalledWith({
      storyId: 's1',
      characterId: 'c1'
    })
    expect(api.stories.unlinkCharacter).toHaveBeenCalledWith({
      storyId: 's1',
      characterId: 'c1'
    })

    api.stories.linkCharacter = vi.fn().mockRejectedValue(new Error('x'))
    api.stories.unlinkCharacter = vi.fn().mockRejectedValue(new Error('y'))
    await act(async () => {
      expect(await result.current.link('c1')).toBe(false)
      expect(await result.current.unlink('c1')).toBe(false)
    })
  })

  it('reload can be called manually', async () => {
    const { result } = renderHook(() => useCharacters(null))
    await waitFor(() => expect(result.current.loading).toBe(false))
    const calls = (api.characters.list as ReturnType<typeof vi.fn>).mock.calls
      .length
    await act(async () => {
      await result.current.reload()
    })
    expect(
      (api.characters.list as ReturnType<typeof vi.fn>).mock.calls.length
    ).toBeGreaterThan(calls)
  })
})
