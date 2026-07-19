import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { createMockApi } from '../../test/mockApi'

const api = createMockApi()
vi.mock('../../lib/api', () => ({ getApi: () => api }))

import { useProps } from './useProps'

describe('useProps', () => {
  beforeEach(() => {
    api.props.list = vi.fn().mockResolvedValue([{ id: 'p1', name: 'Cup' }])
  })

  it('loads props', async () => {
    const { result } = renderHook(() => useProps(null))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(Array.isArray(result.current.items)).toBe(true)
  })
})
