import { describe, expect, it, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createMockApi } from '../../test/mockApi'

const api = createMockApi()
api.media.toPreviewUrl = vi.fn().mockResolvedValue({
  url: 'blob:test',
  filePath: '/a.png'
})

vi.mock('../../lib/api', () => ({
  getApi: () => api
}))

import { ImageOptionPicker } from './ImageOptionPicker'

const options = [
  { id: 'a', filePath: '/a.png', label: 'Ref 1 · Xiaoyu' },
  { id: 'b', filePath: '/b.png', label: 'Ref 2 · Xiaoyu' }
]

describe('ImageOptionPicker', () => {
  afterEach(() => cleanup())

  it('opens a listbox, selects an option, and closes on Escape', () => {
    const onChange = vi.fn()
    render(
      <ImageOptionPicker
        value="a"
        options={options}
        onChange={onChange}
        ariaLabel="Choose edit base"
      />
    )
    const trigger = screen.getByRole('button', { name: 'Choose edit base' })
    expect(trigger.textContent).toMatch(/Ref 1/)
    expect(screen.queryByRole('listbox')).toBeNull()

    fireEvent.click(trigger)
    expect(screen.getByRole('listbox')).toBeTruthy()
    const opts = screen.getAllByRole('option')
    expect(opts.map((el) => el.getAttribute('data-option-id'))).toEqual([
      'a',
      'b'
    ])
    expect(opts[0]?.textContent).not.toBe(opts[1]?.textContent)

    fireEvent.mouseDown(opts[1]!)
    expect(onChange).toHaveBeenCalledWith('b')
    expect(screen.queryByRole('listbox')).toBeNull()

    fireEvent.click(trigger)
    expect(screen.getByRole('listbox')).toBeTruthy()
    fireEvent.keyDown(trigger, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('closes on outside mousedown', () => {
    render(
      <div>
        <button type="button">outside</button>
        <ImageOptionPicker
          value="a"
          options={options}
          onChange={vi.fn()}
          ariaLabel="Choose edit base"
        />
      </div>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Choose edit base' }))
    expect(screen.getByRole('listbox')).toBeTruthy()
    fireEvent.mouseDown(screen.getByText('outside'))
    expect(screen.queryByRole('listbox')).toBeNull()
  })
})
