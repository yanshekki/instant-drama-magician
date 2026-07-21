import { describe, expect, it, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } })
}))

import { LanguageMultiPick } from './LanguageMultiPick'

describe('LanguageMultiPick', () => {
  afterEach(() => cleanup())

  it('selects and removes languages; search filters', () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <LanguageMultiPick value={[]} onChange={onChange} />
    )
    const search = screen.getByPlaceholderText(
      'characters.spokenLanguagesSearch'
    )
    fireEvent.change(search, { target: { value: 'English' } })
    const btns = screen.getAllByRole('button')
    expect(btns.length).toBeGreaterThan(0)
    fireEvent.click(btns[0])
    expect(onChange).toHaveBeenCalled()

    rerender(
      <LanguageMultiPick value={['en']} onChange={onChange} />
    )
    // chip remove
    const chips = screen.getAllByRole('button')
    fireEvent.click(chips[0])
    expect(onChange).toHaveBeenCalledWith([])
  })

  it('disabled skips toggle/remove', () => {
    const onChange = vi.fn()
    render(
      <LanguageMultiPick value={['en']} onChange={onChange} disabled />
    )
    fireEvent.click(screen.getAllByRole('button')[0])
    expect(onChange).not.toHaveBeenCalled()
  })

  it('empty search results message', () => {
    render(
      <LanguageMultiPick value={[]} onChange={() => undefined} />
    )
    fireEvent.change(
      screen.getByPlaceholderText('characters.spokenLanguagesSearch'),
      { target: { value: 'zzzznotalang999' } }
    )
    expect(
      screen.getByText('characters.spokenLanguagesEmpty')
    ).toBeTruthy()
  })
})
