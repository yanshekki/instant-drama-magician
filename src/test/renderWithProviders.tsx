/**
 * Full React test harness for presentation pages / contexts (happy-dom).
 */
import React, { type ReactElement, type ReactNode } from 'react'
import { render, type RenderOptions } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from '../locales/en.json'
import { AppProvider } from '../presentation/context/AppContext'
import { ToastProvider, ToastHost } from '../presentation/context/ToastContext'
import { DialogProvider } from '../presentation/context/DialogContext'
import { AiJobsProvider } from '../presentation/context/AiJobsContext'
import { AiJobHud } from '../presentation/components/AiJobHud'
import { AiDraftModal } from '../presentation/components/AiDraftModal'
import { VideoPrepHost } from '../presentation/components/VideoPrepHost'

let ready: Promise<unknown> | null = null

export async function ensureTestI18n(): Promise<typeof i18n> {
  if (!ready) {
    ready = i18n.use(initReactI18next).init({
      lng: 'en',
      fallbackLng: 'en',
      resources: {
        en: { translation: en as Record<string, unknown> }
      },
      interpolation: { escapeValue: false },
      returnNull: false
    })
  }
  await ready
  return i18n
}

export type ProviderOptions = {
  route?: string
  /** Skip AppProvider (for pure context unit tests). Default true. */
  withApp?: boolean
  withToast?: boolean
  withDialog?: boolean
  withAiJobs?: boolean
  withToastHost?: boolean
  /**
   * Mount AiJobHud + AiDraftModal + VideoPrepHost (as Layout does).
   * Required for startJob draft accept and startVideoPrep registration.
   */
  withAiShell?: boolean
}

export function TestProviders({
  children,
  route = '/',
  withApp = true,
  withToast = true,
  withDialog = true,
  withAiJobs = true,
  withToastHost = false,
  withAiShell = false
}: {
  children: ReactNode
} & ProviderOptions): ReactElement {
  let tree: ReactNode = children

  if (withAiShell) {
    tree = (
      <>
        {tree}
        <AiJobHud />
        <AiDraftModal />
        <VideoPrepHost />
      </>
    )
  }

  if (withAiJobs) {
    tree = <AiJobsProvider>{tree}</AiJobsProvider>
  }
  if (withDialog) {
    tree = <DialogProvider>{tree}</DialogProvider>
  }
  if (withToast) {
    tree = (
      <ToastProvider>
        {withToastHost ? <ToastHost /> : null}
        {tree}
      </ToastProvider>
    )
  }
  if (withApp) {
    tree = <AppProvider>{tree}</AppProvider>
  }

  return (
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={[route]}>{tree}</MemoryRouter>
    </I18nextProvider>
  )
}

export async function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'> & ProviderOptions
) {
  await ensureTestI18n()
  const {
    route = '/',
    withApp = true,
    withToast = true,
    withDialog = true,
    withAiJobs = true,
    withToastHost = false,
    withAiShell = false,
    ...renderOptions
  } = options ?? {}
  return render(ui, {
    ...renderOptions,
    wrapper: ({ children }) => (
      <TestProviders
        route={route}
        withApp={withApp}
        withToast={withToast}
        withDialog={withDialog}
        withAiJobs={withAiJobs}
        withToastHost={withToastHost}
        withAiShell={withAiShell}
      >
        {children}
      </TestProviders>
    )
  })
}

/** Wait for AiDraftModal and click Apply/Save/Add-to-gallery primary button. */
export async function acceptOpenAiDraft(): Promise<boolean> {
  const { waitFor, screen, fireEvent, act } = await import(
    '@testing-library/react'
  )
  try {
    await waitFor(
      () => {
        const text = document.body.textContent || ''
        // Auto-opened reviewing modal (en locale title)
        const hasTitle =
          /AI result draft/i.test(text) || text.includes('aiJobs.draftTitle')
        const hasReview = screen
          .queryAllByRole('button')
          .some((b) => /^Review$/i.test((b.textContent || '').trim()))
        expect(hasTitle || hasReview).toBe(true)
      },
      { timeout: 10000 }
    )
  } catch {
    return false
  }
  // If only HUD Review is visible, open the modal first
  const review = screen
    .queryAllByRole('button')
    .find((b) => /^Review$/i.test((b.textContent || '').trim()))
  if (review && !(document.body.textContent || '').match(/AI result draft/i)) {
    await act(async () => {
      fireEvent.click(review)
    })
  }
  await waitFor(
    () => {
      expect(
        screen
          .queryAllByRole('button')
          .some((b) =>
            /Apply and save|Add to gallery and save|Apply wardrobe|OK|Acknowledge/i.test(
              b.textContent || ''
            )
          )
      ).toBe(true)
    },
    { timeout: 5000 }
  ).catch(() => undefined)

  const apply = screen
    .getAllByRole('button')
    .find((b) =>
      /Apply and save|Add to gallery and save|Apply wardrobe|^OK$|Acknowledge/i.test(
        (b.textContent || '').trim()
      )
    )
  if (!apply) return false
  await act(async () => {
    fireEvent.click(apply)
  })
  await act(async () => {
    await new Promise((r) => setTimeout(r, 30))
  })
  return true
}

/** Click the primary confirm button in DialogProvider alertdialog. */
export function clickDialogConfirm(): void {
  const dialog = document.querySelector('[role="alertdialog"]')
  if (!dialog) throw new Error('no alertdialog')
  const buttons = Array.from(dialog.querySelectorAll('button'))
  // Confirm is last button in footer (Cancel first)
  const confirm = buttons[buttons.length - 1]
  if (!confirm) throw new Error('no confirm button')
  confirm.click()
}

export function clickDialogCancel(): void {
  const dialog = document.querySelector('[role="alertdialog"]')
  if (!dialog) throw new Error('no alertdialog')
  const buttons = Array.from(dialog.querySelectorAll('button'))
  const cancel = buttons[0]
  if (!cancel) throw new Error('no cancel button')
  cancel.click()
}
