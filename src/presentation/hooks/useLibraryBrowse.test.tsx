import { describe, expect, it } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useLibraryBrowse, LIBRARY_PAGE_SIZE } from './useLibraryBrowse'

describe('useLibraryBrowse', () => {
  const items = [
    { id: '1', name: 'Alpha' },
    { id: '2', name: 'Beta' },
    { id: '3', name: 'Alpine' }
  ]

  it('exports default page size', () => {
    expect(LIBRARY_PAGE_SIZE).toBe(12)
  })

  it('filters by search query', () => {
    const { result } = renderHook(() =>
      useLibraryBrowse(items, (i) => i.name, { pageSize: 10 })
    )
    act(() => result.current.setQ('alp'))
    expect(result.current.filteredCount).toBe(2)
    expect(result.current.hasSearch).toBe(true)
    expect(result.current.pageItems.map((i) => i.name)).toEqual(
      expect.arrayContaining(['Alpha', 'Alpine'])
    )
  })

  it('empty query matches all and hasSearch false', () => {
    const { result } = renderHook(() =>
      useLibraryBrowse(items, (i) => i.name)
    )
    expect(result.current.filteredCount).toBe(3)
    expect(result.current.hasSearch).toBe(false)
    expect(result.current.totalCount).toBe(3)
  })

  it('paginates and clamps page', () => {
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
    expect(result.current.page).toBe(2)
    expect(result.current.pageItems).toHaveLength(12)
    act(() => result.current.setPage(99))
    expect(result.current.page).toBe(3)
  })

  it('applies matchesExtra and sort and extraKey', () => {
    const { result, rerender } = renderHook(
      ({ key }) =>
        useLibraryBrowse(items, (i) => i.name, {
          pageSize: 10,
          extraKey: key,
          matchesExtra: (i) => i.name.startsWith('A'),
          sort: (a, b) => b.name.localeCompare(a.name)
        }),
      { initialProps: { key: 'k1' } }
    )
    expect(result.current.filteredCount).toBe(2)
    expect(result.current.pageItems.map((i) => i.name)).toEqual([
      'Alpine',
      'Alpha'
    ])
    act(() => result.current.setPage(2))
    rerender({ key: 'k2' })
    expect(result.current.page).toBe(1)
  })

  it('resets page when query changes', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      id: String(i),
      name: `Item ${i}`
    }))
    const { result } = renderHook(() =>
      useLibraryBrowse(many, (i) => i.name, { pageSize: 5 })
    )
    act(() => result.current.setPage(3))
    expect(result.current.page).toBe(3)
    act(() => result.current.setQ('Item 1'))
    expect(result.current.page).toBe(1)
  })

  it('handles empty filtered list totalPages min 1', () => {
    const { result } = renderHook(() =>
      useLibraryBrowse(items, (i) => i.name, {
        pageSize: 12,
        matchesExtra: () => false
      })
    )
    expect(result.current.filteredCount).toBe(0)
    expect(result.current.totalPages).toBe(1)
    expect(result.current.pageItems).toEqual([])
  })
})
