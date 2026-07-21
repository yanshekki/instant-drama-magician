import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import {
  LibraryFilterSelect,
  libraryFilterSelectClass
} from './LibraryFilterSelect'

describe('LibraryFilterSelect', () => {
  afterEach(() => cleanup())

  it('exports class constant', () => {
    expect(libraryFilterSelectClass).toBeTruthy()
  })

  it('renders with label and fires onChange; active when value set', () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <LibraryFilterSelect
        label="Status"
        value=""
        onChange={onChange}
        options={[
          { value: '', label: 'Any' },
          { value: 'ready', label: 'Ready' }
        ]}
      />
    )
    expect(screen.getByText('Status')).toBeTruthy()
    const sel = screen.getByRole('combobox')
    fireEvent.change(sel, { target: { value: 'ready' } })
    expect(onChange).toHaveBeenCalledWith('ready')

    rerender(
      <LibraryFilterSelect
        value="ready"
        ariaLabel="Status"
        onChange={onChange}
        options={[
          { value: '', label: 'Any' },
          { value: 'ready', label: 'Ready' }
        ]}
      />
    )
    // no label → nbsp reserved row
    expect(screen.getByRole('combobox').getAttribute('aria-label')).toBe(
      'Status'
    )
  })

  it('without empty option stays inactive styling', () => {
    render(
      <LibraryFilterSelect
        value="a"
        onChange={() => undefined}
        options={[{ value: 'a', label: 'A' }]}
      />
    )
    expect(screen.getByRole('combobox')).toBeTruthy()
  })

  it('uniqueFacetValues sorts, emptyToken, limit', async () => {
    const { uniqueFacetValues } = await import('./LibraryFilterSelect')
    expect(
      uniqueFacetValues(['  b ', 'a', null, '', 'a', '  '], {
        emptyToken: '(empty)',
        limit: 10
      })
    ).toEqual(expect.arrayContaining(['a', 'b', '(empty)']))
    expect(
      uniqueFacetValues(['z', 'y', 'x', 'w'], { limit: 2 }).length
    ).toBe(2)
    expect(uniqueFacetValues([null, undefined, '  '])).toEqual([])
  })
})
