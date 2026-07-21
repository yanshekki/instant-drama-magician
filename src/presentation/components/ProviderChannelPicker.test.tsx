import { describe, expect, it, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } })
}))

import { ProviderChannelPicker } from './ProviderChannelPicker'

describe('ProviderChannelPicker', () => {
  afterEach(() => cleanup())

  it('image channel shows same-as-llm and selects', () => {
    const onChange = vi.fn()
    render(
      <ProviderChannelPicker
        channel="image"
        value="same-as-llm"
        onChange={onChange}
      />
    )
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThan(1)
    fireEvent.click(buttons[1])
    expect(onChange).toHaveBeenCalled()
  })

  it('video channel shows stub option', () => {
    const onChange = vi.fn()
    render(
      <ProviderChannelPicker channel="video" value="stub" onChange={onChange} />
    )
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0)
  })

  it('disabled prevents changes', () => {
    render(
      <ProviderChannelPicker
        channel="image"
        value="same-as-llm"
        onChange={() => undefined}
        disabled
      />
    )
    expect(
      (screen.getAllByRole('button')[0] as HTMLButtonElement).disabled
    ).toBe(true)
  })
})
