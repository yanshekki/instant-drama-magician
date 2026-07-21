import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from 'i18next'
import { ensureTestI18n } from '../../test/renderWithProviders'
import { DialogProvider, useDialog } from './DialogContext'

function Probe() {
  const d = useDialog()
  return (
    <div>
      <button
        type="button"
        onClick={() => {
          void d.confirm('Delete?').then((v) => {
            document.body.dataset.confirmed = String(v)
          })
        }}
      >
        ask-string
      </button>
      <button
        type="button"
        onClick={() => {
          void d
            .confirm({
              title: 'Danger',
              message: 'Really?',
              variant: 'danger',
              confirmLabel: 'Wipe',
              cancelLabel: 'Nope'
            })
            .then((v) => {
              document.body.dataset.confirmed = String(v)
            })
        }}
      >
        ask-opts
      </button>
      <button
        type="button"
        onClick={() => {
          void d.alert('Heads up').then(() => {
            document.body.dataset.alerted = '1'
          })
        }}
      >
        alert-string
      </button>
      <button
        type="button"
        onClick={() => {
          void d
            .alert({ title: 'Notice', message: 'Done', okLabel: 'Cool' })
            .then(() => {
              document.body.dataset.alerted = '1'
            })
        }}
      >
        alert-opts
      </button>
      <button
        type="button"
        onClick={() => {
          void d.confirm('First')
          void d.confirm('Second').then((v) => {
            document.body.dataset.second = String(v)
          })
        }}
      >
        queue
      </button>
    </div>
  )
}

async function mount() {
  await ensureTestI18n()
  return render(
    <I18nextProvider i18n={i18n}>
      <DialogProvider>
        <Probe />
      </DialogProvider>
    </I18nextProvider>
  )
}

describe('DialogContext', () => {
  afterEach(() => {
    cleanup()
    delete document.body.dataset.confirmed
    delete document.body.dataset.alerted
    delete document.body.dataset.second
  })

  it('confirm string — cancel via button', async () => {
    await mount()
    await act(async () => {
      screen.getByText('ask-string').click()
    })
    expect(screen.getByText('Delete?')).toBeTruthy()
    await act(async () => {
      screen.getByText('Cancel').click()
    })
    await waitFor(() => expect(document.body.dataset.confirmed).toBe('false'))
  })

  it('confirm opts — confirm danger', async () => {
    await mount()
    await act(async () => {
      screen.getByText('ask-opts').click()
    })
    expect(screen.getByText('Danger')).toBeTruthy()
    expect(screen.getByText('Really?')).toBeTruthy()
    await act(async () => {
      screen.getByText('Wipe').click()
    })
    await waitFor(() => expect(document.body.dataset.confirmed).toBe('true'))
  })

  it('alert string — ok and Escape', async () => {
    await mount()
    await act(async () => {
      screen.getByText('alert-string').click()
    })
    expect(screen.getByText('Heads up')).toBeTruthy()
    await act(async () => {
      fireEvent.keyDown(window, { key: 'Escape' })
    })
    await waitFor(() => expect(document.body.dataset.alerted).toBe('1'))
  })

  it('alert opts — Enter closes', async () => {
    await mount()
    await act(async () => {
      screen.getByText('alert-opts').click()
    })
    expect(screen.getByText('Notice')).toBeTruthy()
    await act(async () => {
      fireEvent.keyDown(window, { key: 'Enter' })
    })
    await waitFor(() => expect(document.body.dataset.alerted).toBe('1'))
  })

  it('queues second dialog after first closes', async () => {
    await mount()
    await act(async () => {
      screen.getByText('queue').click()
    })
    expect(screen.getByText('First')).toBeTruthy()
    await act(async () => {
      // backdrop click cancels confirm
      const backdrop = document.querySelector('.absolute.inset-0')
      backdrop?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await waitFor(() => expect(screen.getByText('Second')).toBeTruthy())
    await act(async () => {
      const dialog = document.querySelector('[role="alertdialog"]')!
      const btns = dialog.querySelectorAll('button')
      btns[btns.length - 1].click()
    })
    await waitFor(() => expect(document.body.dataset.second).toBe('true'))
  })

  it('Escape cancels confirm', async () => {
    await mount()
    await act(async () => {
      screen.getByText('ask-string').click()
    })
    await act(async () => {
      fireEvent.keyDown(window, { key: 'Escape' })
    })
    await waitFor(() => expect(document.body.dataset.confirmed).toBe('false'))
  })

})

