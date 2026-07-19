import { describe, expect, it } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useLibraryBrowse } from './useLibraryBrowse'

describe('useLibraryBrowse', () => {
  const items = [
    { id: '1', name: 'Alpha' },
    { id: '2', name: 'Beta' },
    { id: '3', name: 'Alpine' }
  ]

  it('filters by search query', () => {
    const { result } = renderHook(() =>
      useLibraryBrowse(items, (i) => i.name, { pageSize: 10 })
    )
    act(() => result.current.setQ('alp'))
    expect(result.current.filteredCount).toBe(2)
    expect(result.current.pageItems.map((i) => i.name)).toEqual(
      expect.arrayContaining(['Alpha', 'Alpine'])
    )
  })

  it('paginates', () => {
    const many = Array.from({ length: 25 }, (_, i) => ({
      id: String(i),
      name: `Item ${i}`
    }))
    const { result } = renderHook(() =>
      useLibraryBrowse(many, (i) => i.name, { pageSize: 12 })
    )
    expect(result.current.totalPages).toBe(3)
    expect(result.current.pageItems).toHaveLength(12)
    act(() => result.current.setPage(2))
    expect(result.current.pageItems).toHaveLength(12)
  })
})
