import { describe, expect, it } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { DialogProvider, useDialog } from './DialogContext'
import { ensureTestI18n } from '../../test/renderWithProviders'
import { I18nextProvider } from 'react-i18next'
import i18n from 'i18next'

function Probe() {
  const d = useDialog()
  return (
    <button
      type="button"
      onClick={() => {
        void d.confirm('Delete?').then((v) => {
          document.body.dataset.confirmed = String(v)
        })
      }}
    >
      ask
    </button>
  )
}

describe('DialogContext', () => {
  it('shows confirm UI', async () => {
    await ensureTestI18n()
    render(
      <I18nextProvider i18n={i18n}>
        <DialogProvider>
          <Probe />
        </DialogProvider>
      </I18nextProvider>
    )
    await act(async () => {
      screen.getByText('ask').click()
    })
    expect(screen.getByText('Delete?')).toBeTruthy()
  })
})
