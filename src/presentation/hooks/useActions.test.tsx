import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { createMockApi } from '../../test/mockApi'

const api = createMockApi()
vi.mock('../../lib/api', () => ({ getApi: () => api }))

import { useActions } from './useActions'

describe('useActions', () => {
  beforeEach(() => {
    api.actions = api.actions || ({} as never)
    api.actions.list = vi.fn().mockResolvedValue([
      { id: 'a1', name: 'Punch', updatedAt: '2026-01-02T00:00:00.000Z' },
      { id: 'a0', name: 'Old', updatedAt: '2026-01-01T00:00:00.000Z' }
    ])
  })

  it('loads actions sorted by updatedAt desc', async () => {
    const { result } = renderHook(() => useActions(null))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.items[0]?.id).toBe('a1')
  })
})
