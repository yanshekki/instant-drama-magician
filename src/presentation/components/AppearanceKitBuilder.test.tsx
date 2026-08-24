import { describe, expect, it, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, vars?: { n?: number }) =>
      vars?.n !== undefined ? `${k}:${vars.n}` : k,
    i18n: { language: 'zh-HK' }
  })
}))

import { AppearanceKitBuilder } from './AppearanceKitBuilder'

describe('AppearanceKitBuilder', () => {
  afterEach(() => cleanup())

  it('expands, picks a card, applies assembled text, and clears', () => {
    const onChange = vi.fn()
    const onApply = vi.fn()
    const { rerender } = render(
      <AppearanceKitBuilder kit={{}} onChange={onChange} onApply={onApply} />
    )

    fireEvent.click(screen.getByText('characters.appearanceKitToggle'))
    expect(screen.getByText('characters.appearanceKitHint')).toBeTruthy()

    fireEvent.click(screen.getByText('眼型'))
    const phoenix = screen
      .getAllByRole('button')
      .find((b) => /^01\s*·\s*丹鳳眼/.test((b.textContent || '').trim()))
    expect(phoenix).toBeTruthy()
    fireEvent.click(phoenix as HTMLElement)
    expect(onChange).toHaveBeenCalled()
    const next = onChange.mock.calls.at(-1)?.[0] as { eyes?: string }
    expect(next.eyes).toBe('phoenix')

    rerender(
      <AppearanceKitBuilder
        kit={{ eyes: 'phoenix' }}
        onChange={onChange}
        onApply={onApply}
      />
    )
    fireEvent.click(screen.getByText('characters.appearanceKitApply'))
    expect(onApply).toHaveBeenCalled()
    expect(String(onApply.mock.calls[0][0])).toMatch(/丹鳳眼/)
    expect(screen.queryByText('characters.appearanceKitHint')).toBeNull()

    fireEvent.click(screen.getByText('characters.appearanceKitToggle'))
    fireEvent.click(screen.getByText('common.fieldKitClear'))
    expect(onChange).toHaveBeenCalledWith({})
  })

  it('paginates templates and keeps phoenix on eyes page 1', () => {
    render(
      <AppearanceKitBuilder kit={{}} onChange={() => undefined} onApply={() => undefined} />
    )
    fireEvent.click(screen.getByText('characters.appearanceKitToggle'))
    fireEvent.click(screen.getByText('眼型'))
    const phoenix = screen
      .getAllByRole('button')
      .find((b) => /^01\s*·\s*丹鳳眼/.test((b.textContent || '').trim()))
    expect(phoenix).toBeTruthy()
    fireEvent.click(screen.getByText(/library.nextPage/))
    expect(
      screen
        .getAllByRole('button')
        .find((b) => /^01\s*·\s*丹鳳眼/.test((b.textContent || '').trim()))
    ).toBeUndefined()
  })

  it('search filters cards and skip clears the active part', () => {
    const onChange = vi.fn()
    render(
      <AppearanceKitBuilder
        kit={{ eyes: 'phoenix' }}
        onChange={onChange}
        onApply={() => undefined}
      />
    )
    fireEvent.click(screen.getByText('characters.appearanceKitToggle'))
    fireEvent.click(screen.getByText('眼型'))
    fireEvent.change(screen.getByPlaceholderText('common.fieldKitSearch'), {
      target: { value: 'zzzznohit999' }
    })
    expect(screen.getByText('common.fieldKitEmpty')).toBeTruthy()

    fireEvent.change(screen.getByPlaceholderText('common.fieldKitSearch'), {
      target: { value: '' }
    })
    fireEvent.click(screen.getByText('common.fieldKitSkip'))
    expect(onChange).toHaveBeenCalledWith({})
  })

  it('disabled blocks pick and apply', () => {
    const onChange = vi.fn()
    const onApply = vi.fn()
    render(
      <AppearanceKitBuilder
        kit={{ eyes: 'phoenix' }}
        onChange={onChange}
        onApply={onApply}
        disabled
      />
    )
    fireEvent.click(screen.getByText('characters.appearanceKitToggle'))
    expect(onChange).not.toHaveBeenCalled()
  })
})
