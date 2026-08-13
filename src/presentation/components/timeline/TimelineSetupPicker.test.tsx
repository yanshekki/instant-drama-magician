import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from 'i18next'
import { ensureTestI18n } from '../../../test/renderWithProviders'
import { TimelineSetupPicker } from './TimelineSetupPicker'

vi.mock('../ProviderChannelPicker', () => ({
  ProviderChannelPicker: (props: {
    channel: string
    onChange: (v: string) => void
  }) => (
    <button
      type="button"
      data-testid={`pick-${props.channel}`}
      onClick={() => props.onChange('stub')}
    >
      pick-{props.channel}
    </button>
  )
}))

describe('TimelineSetupPicker', () => {
  it('does not render when closed', async () => {
    await ensureTestI18n()
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <TimelineSetupPicker
          open={false}
          clipSeconds={6}
          settings={null}
          onClose={vi.fn()}
          onApply={vi.fn()}
        />
      </I18nextProvider>
    )
    expect(container.textContent).toBe('')
  })

  it('applies duration and channels', async () => {
    await ensureTestI18n()
    const onApply = vi.fn()
    const onClose = vi.fn()
    render(
      <I18nextProvider i18n={i18n}>
        <TimelineSetupPicker
          open
          clipSeconds={6}
          settings={{ imageProvider: 'same-as-llm', videoProvider: 'same-as-llm' }}
          onClose={onClose}
          onApply={onApply}
        />
      </I18nextProvider>
    )
    fireEvent.click(screen.getByRole('button', { name: '10s' }))
    fireEvent.click(screen.getByTestId('pick-video'))
    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }))
    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({ clipSeconds: 10, videoProvider: 'stub' })
    )
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }))
    expect(onClose).toHaveBeenCalled()
  })
})
