import { describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } })
}))

import {
  LibraryBrowseBar,
  LibraryPageBody,
  LibraryPagination
} from './LibraryBrowseBar'

describe('LibraryBrowseBar', () => {
  afterEach(() => cleanup())

  it('search and clear', () => {
    const onQueryChange = vi.fn()
    const onClear = vi.fn()
    render(
      <LibraryBrowseBar
        q="hello"
        onQueryChange={onQueryChange}
        onClearFilters={onClear}
        hasActiveFilters
        filters={<span>filters</span>}
        activeChips={[
          { id: 'c1', label: 'chip', onRemove: vi.fn() }
        ]}
      />
    )
    fireEvent.change(screen.getByLabelText('library.search'), {
      target: { value: 'x' }
    })
    expect(onQueryChange).toHaveBeenCalledWith('x')
    fireEvent.click(screen.getByText('library.clearFilters'))
    expect(onClear).toHaveBeenCalled()
    fireEvent.click(screen.getByText('chip'))
  })

  it('hides clear when no handler', () => {
    render(<LibraryBrowseBar q="" onQueryChange={() => undefined} />)
    expect(screen.queryByText('library.clearFilters')).toBeNull()
  })

  it('disables clear when inactive', () => {
    render(
      <LibraryBrowseBar
        q=""
        onQueryChange={() => undefined}
        onClearFilters={() => undefined}
        hasActiveFilters={false}
      />
    )
    const btn = screen.getByText('library.clearFilters') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })
})

describe('LibraryPageBody', () => {
  it('renders children and optional footer', () => {
    const { rerender } = render(
      <LibraryPageBody footer={<div>foot</div>}>body</LibraryPageBody>
    )
    expect(screen.getByText('body')).toBeTruthy()
    expect(screen.getByText('foot')).toBeTruthy()
    rerender(<LibraryPageBody>only</LibraryPageBody>)
    expect(screen.getByText('only')).toBeTruthy()
  })
})

describe('LibraryPagination', () => {
  afterEach(() => cleanup())

  it('shows filtered count and navigates pages', () => {
    const onPageChange = vi.fn()
    render(
      <LibraryPagination
        page={2}
        totalPages={3}
        onPageChange={onPageChange}
        filteredCount={5}
        totalCount={20}
      />
    )
    fireEvent.click(screen.getByText(/library.prevPage/))
    expect(onPageChange).toHaveBeenCalledWith(1)
    fireEvent.click(screen.getByText(/library.nextPage/))
    expect(onPageChange).toHaveBeenCalledWith(3)
  })

  it('showingTotal when equal counts; can hide controls', () => {
    render(
      <LibraryPagination
        page={1}
        totalPages={1}
        onPageChange={() => undefined}
        filteredCount={3}
        totalCount={3}
        alwaysShowControls={false}
      />
    )
    expect(screen.queryByText(/library.prevPage/)).toBeNull()
  })
})
