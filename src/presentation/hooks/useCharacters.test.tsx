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
      { id: 'c1', name: 'A', description: 'd' }
    ])
  })

  it('loads list on mount', async () => {
    const { result } = renderHook(() => useCharacters(null))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.items).toHaveLength(1)
    expect(result.current.error).toBeNull()
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
})
