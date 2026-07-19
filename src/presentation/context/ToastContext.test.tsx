import { describe, expect, it, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { ToastProvider, useToast } from './ToastContext'
import { ensureTestI18n } from '../../test/renderWithProviders'
import { I18nextProvider } from 'react-i18next'
import i18n from 'i18next'

function Probe() {
  const t = useToast()
  return (
    <div>
      <button type="button" onClick={() => t.success('Saved')}>
        go
      </button>
      <ul>
        {t.toasts.map((x) => (
          <li key={x.id}>{x.message}</li>
        ))}
      </ul>
    </div>
  )
}

describe('ToastContext', () => {
  it('shows toast on success', async () => {
    await ensureTestI18n()
    vi.useFakeTimers()
    render(
      <I18nextProvider i18n={i18n}>
        <ToastProvider>
          <Probe />
        </ToastProvider>
      </I18nextProvider>
    )
    await act(async () => {
      screen.getByText('go').click()
    })
    expect(screen.getByText('Saved')).toBeTruthy()
    vi.useRealTimers()
  })
})
