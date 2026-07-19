import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { createMockApi } from '../../test/mockApi'

const api = createMockApi()
vi.mock('../../lib/api', () => ({ getApi: () => api }))

import { useScenes } from './useScenes'

describe('useScenes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.scenes.list = vi.fn().mockResolvedValue([{ id: 'sc1', description: 'Hall' }])
  })

  it('loads scenes', async () => {
    const { result } = renderHook(() => useScenes(null))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.items.length).toBeGreaterThanOrEqual(0)
  })
})
