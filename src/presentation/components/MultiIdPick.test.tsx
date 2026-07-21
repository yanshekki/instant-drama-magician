import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MultiIdPick } from './MultiIdPick'

describe('MultiIdPick', () => {
  afterEach(() => cleanup())

  it('empty options shows emptyLabel', () => {
    render(
      <MultiIdPick
        options={[]}
        value={[]}
        emptyLabel="none"
        onChange={() => undefined}
      />
    )
    expect(screen.getByText('none')).toBeTruthy()
  })

  it('toggles selection and respects max', () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <MultiIdPick
        label="Cast"
        options={[
          { id: 'a', label: 'Alice' },
          { id: 'b', label: 'Bob' },
          { id: 'c', label: 'Cara' }
        ]}
        value={[]}
        max={2}
        onChange={onChange}
      />
    )
    fireEvent.click(screen.getByText('Alice'))
    expect(onChange).toHaveBeenCalledWith(['a'])

    rerender(
      <MultiIdPick
        label="Cast"
        options={[
          { id: 'a', label: 'Alice' },
          { id: 'b', label: 'Bob' },
          { id: 'c', label: 'Cara' }
        ]}
        value={['a']}
        max={2}
        onChange={onChange}
      />
    )
    fireEvent.click(screen.getByText(/Alice/))
    expect(onChange).toHaveBeenCalledWith([])

    rerender(
      <MultiIdPick
        options={[
          { id: 'a', label: 'Alice' },
          { id: 'b', label: 'Bob' },
          { id: 'c', label: 'Cara' }
        ]}
        value={['a', 'b']}
        max={2}
        onChange={onChange}
      />
    )
    const cara = screen.getByText('Cara')
    expect((cara as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(cara)
    // no additional call for max
  })
})
