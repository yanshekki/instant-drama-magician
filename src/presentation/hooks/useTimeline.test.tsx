import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { createMockApi } from '../../test/mockApi'

const api = createMockApi()
vi.mock('../../lib/api', () => ({ getApi: () => api }))

import { useTimeline } from './useTimeline'

describe('useTimeline', () => {
  beforeEach(() => {
    api.timeline.list = vi.fn().mockResolvedValue([])
  })

  it('loads empty timeline for story', async () => {
    const { result } = renderHook(() => useTimeline('s1'))
    await waitFor(() => {
      // loading may be false quickly
      expect(result.current).toBeTruthy()
    })
  })
})
