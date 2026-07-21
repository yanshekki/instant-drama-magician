import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from 'i18next'
import { ensureTestI18n } from '../../test/renderWithProviders'
import { ToastHost, ToastProvider, useToast } from './ToastContext'

function Probe() {
  const t = useToast()
  return (
    <div>
      <button type="button" onClick={() => t.success('Saved')}>
        success
      </button>
      <button type="button" onClick={() => t.error('Boom')}>
        error
      </button>
      <button type="button" onClick={() => t.info('Note')}>
        info
      </button>
      <button type="button" onClick={() => t.show('success', '   ')}>
        blank
      </button>
      <button type="button" onClick={() => t.show('info', 'Sticky', 0)}>
        sticky
      </button>
      <button
        type="button"
        onClick={() => {
          t.success('A')
          t.success('B')
          t.success('C')
          t.success('D')
          t.success('E')
          t.success('F')
        }}
      >
        flood
      </button>
      <button
        type="button"
        onClick={() => {
          if (t.toasts[0]) t.dismiss(t.toasts[0].id)
        }}
      >
        dismiss-first
      </button>
      <ul>
        {t.toasts.map((x) => (
          <li key={x.id} data-kind={x.kind}>
            {x.message}
          </li>
        ))}
      </ul>
    </div>
  )
}

describe('ToastContext', () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('shows toast kinds and ignores blank', async () => {
    await ensureTestI18n()
    render(
      <I18nextProvider i18n={i18n}>
        <ToastProvider>
          <Probe />
        </ToastProvider>
      </I18nextProvider>
    )
    await act(async () => {
      screen.getByText('success').click()
      screen.getByText('error').click()
      screen.getByText('info').click()
      screen.getByText('blank').click()
    })
    expect(screen.getByText('Saved')).toBeTruthy()
    expect(screen.getByText('Boom')).toBeTruthy()
    expect(screen.getByText('Note')).toBeTruthy()
    expect(screen.queryAllByRole('listitem')).toHaveLength(3)
  })

  it('auto-dismisses after timeout and caps stack at 5', async () => {
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
      screen.getByText('flood').click()
    })
    expect(screen.getAllByRole('listitem').length).toBeLessThanOrEqual(5)
    await act(async () => {
      vi.advanceTimersByTime(6000)
    })
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
  })

  it('sticky toast needs manual dismiss; ToastHost renders dismiss', async () => {
    await ensureTestI18n()
    render(
      <I18nextProvider i18n={i18n}>
        <ToastProvider>
          <ToastHost />
          <Probe />
        </ToastProvider>
      </I18nextProvider>
    )
    await act(async () => {
      screen.getByText('sticky').click()
    })
    expect(screen.getAllByText('Sticky').length).toBeGreaterThan(0)
    const dismissBtns = screen
      .getAllByRole('button')
      .filter((b) => b.textContent === '✕')
    expect(dismissBtns.length).toBeGreaterThan(0)
    await act(async () => {
      dismissBtns[0].click()
    })
    expect(screen.queryAllByText('Sticky')).toHaveLength(0)
  })
})

