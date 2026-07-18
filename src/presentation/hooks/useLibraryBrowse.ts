import { useEffect, useMemo, useState } from 'react'
import { matchesSearchQuery } from '../lib/searchQuery'

/** Cards per page on Stories / Characters / Costumes / Scenes / Props libraries. */
export const LIBRARY_PAGE_SIZE = 12

/**
 * Client-side search + pagination for library grids.
 * Search supports multi-keyword (space / | / comma) — see matchesSearchQuery.
 * Resets to page 1 when the query, list size, or extraKey changes.
 */
export function useLibraryBrowse<T>(
  items: readonly T[],
  searchText: (item: T) => string,
  opts?: {
    pageSize?: number
    /** Extra filter (e.g. facets). */
    matchesExtra?: (item: T) => boolean
    /** Change when extra filter values change (resets page). */
    extraKey?: string | number | boolean | null
    /** Optional sort after filter (stable for equal items). */
    sort?: (a: T, b: T) => number
  }
): {
  q: string
  setQ: (v: string) => void
  page: number
  setPage: (n: number | ((p: number) => number)) => void
  totalPages: number
  pageItems: T[]
  filteredCount: number
  totalCount: number
  /** True when search query is non-empty. */
  hasSearch: boolean
} {
  const pageSize = opts?.pageSize ?? LIBRARY_PAGE_SIZE
  const extraKey = opts?.extraKey
  const matchesExtra = opts?.matchesExtra
  const sort = opts?.sort
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    let list = items.filter((it) => {
      if (matchesExtra && !matchesExtra(it)) return false
      return matchesSearchQuery(searchText(it), q)
    })
    if (sort) {
      list = [...list].sort(sort)
    }
    return list
    // searchText / matchesExtra / sort expected stable or driven by extraKey
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: extraKey drives re-filter
  }, [items, q, extraKey, matchesExtra, searchText, sort])

  useEffect(() => {
    setPage(1)
  }, [q, items.length, extraKey])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize) || 1)
  const safePage = Math.min(Math.max(1, page), totalPages)
  const pageItems = filtered.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  )

  return {
    q,
    setQ,
    page: safePage,
    setPage,
    totalPages,
    pageItems,
    filteredCount: filtered.length,
    totalCount: items.length,
    hasSearch: Boolean(q.trim())
  }
}
