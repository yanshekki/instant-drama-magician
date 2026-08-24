import { describe, expect, it, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { COSTUME_KIT } from '../../domain/kits'
import { FieldKitBuilder } from './FieldKitBuilder'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, vars?: { n?: number; field?: string }) => {
      if (vars?.n !== undefined) return `${k}:${vars.n}`
      if (vars?.field) return `${k}:${vars.field}`
      return k
    },
    i18n: { language: 'zh-HK' }
  })
}))

describe('FieldKitBuilder', () => {
  afterEach(() => cleanup())

  it('applies costume kit and collapses', () => {
    const onChange = vi.fn()
    const onApply = vi.fn()
    const { rerender } = render(
      <FieldKitBuilder
        spec={COSTUME_KIT}
        kit={{}}
        onChange={onChange}
        onApply={onApply}
      />
    )
    fireEvent.click(screen.getByText('common.fieldKitToggle'))
    expect(screen.getByText('common.fieldKitHint')).toBeTruthy()
    fireEvent.click(screen.getByText('輪廓'))
    const first = screen
      .getAllByRole('button')
      .find((b) => /^01\s*·/.test((b.textContent || '').trim()))
    expect(first).toBeTruthy()
    fireEvent.click(first as HTMLElement)
    const next = onChange.mock.calls.at(-1)?.[0] as { silhouette?: string }
    expect(next.silhouette).toBeTruthy()
    rerender(
      <FieldKitBuilder
        spec={COSTUME_KIT}
        kit={next}
        onChange={onChange}
        onApply={onApply}
      />
    )
    fireEvent.click(screen.getByText('common.fieldKitApply'))
    expect(onApply).toHaveBeenCalled()
    expect(screen.queryByText('common.fieldKitHint')).toBeNull()
  })

  it('filters templates and paginates 12 per page', () => {
    render(
      <FieldKitBuilder
        spec={COSTUME_KIT}
        kit={{}}
        onChange={vi.fn()}
        onApply={vi.fn()}
      />
    )
    fireEvent.click(screen.getByText('common.fieldKitToggle'))
    const cards = () =>
      screen
        .getAllByRole('button')
        .filter((b) => /^\d{2}\s*·/.test((b.textContent || '').trim()))
    expect(cards()).toHaveLength(12)
    fireEvent.click(screen.getByText(/library.nextPage/))
    expect(cards().some((b) => /^13\s*·/.test((b.textContent || '').trim()))).toBe(
      true
    )
    const search = screen.getByPlaceholderText('common.fieldKitSearch')
    fireEvent.change(search, { target: { value: 'zzz-no-such-template' } })
    expect(screen.getByText('common.fieldKitEmpty')).toBeTruthy()
  })
})
