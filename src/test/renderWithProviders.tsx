/**
 * Minimal React test harness (jsdom).
 */
import React, { type ReactElement, type ReactNode } from 'react'
import { render, type RenderOptions } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

let ready: Promise<unknown> | null = null

export async function ensureTestI18n(): Promise<typeof i18n> {
  if (!ready) {
    ready = i18n.use(initReactI18next).init({
      lng: 'en',
      fallbackLng: 'en',
      resources: {
        en: {
          translation: {
            common: { save: 'Save', cancel: 'Cancel', ok: 'OK', error: 'Error' },
            nav: {
              stories: 'Stories',
              characters: 'Characters',
              settings: 'Settings'
            },
            legal: {
              acceptContinue: 'Accept',
              acceptCheckbox: 'I agree',
              decline: 'Decline'
            },
            stories: { title: 'Stories', empty: 'No stories' },
            settings: { title: 'Settings' }
          }
        }
      },
      interpolation: { escapeValue: false }
    })
  }
  await ready
  return i18n
}

export function TestProviders({
  children,
  route = '/'
}: {
  children: ReactNode
  route?: string
}): ReactElement {
  return (
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
    </I18nextProvider>
  )
}

export async function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'> & { route?: string }
) {
  await ensureTestI18n()
  const route = options?.route ?? '/'
  return render(ui, {
    ...options,
    wrapper: ({ children }) => (
      <TestProviders route={route}>{children}</TestProviders>
    )
  })
}
