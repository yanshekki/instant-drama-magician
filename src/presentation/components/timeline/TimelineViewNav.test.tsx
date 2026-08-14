import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { fireEvent, render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from 'i18next'
import { ensureTestI18n } from '../../../test/renderWithProviders'
import {
  isTimelinePath,
  TimelineViewNav,
  TimelineViewSwitch
} from './TimelineViewNav'

describe('TimelineViewNav', () => {
  it('treats both routes as timeline', () => {
    expect(isTimelinePath('/timeline')).toBe(true)
    expect(isTimelinePath('/timeline-v2')).toBe(true)
    expect(isTimelinePath('/stories')).toBe(false)
  })

  it('renders grouped view chips', async () => {
    await ensureTestI18n()
    render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={['/timeline']}>
          <TimelineViewNav />
          <TimelineViewSwitch />
        </MemoryRouter>
      </I18nextProvider>
    )
    expect(screen.getByTestId('nav-timeline-group')).toBeTruthy()
    expect(screen.getAllByText(/Track/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Board/i).length).toBeGreaterThan(0)
    fireEvent.click(screen.getAllByText(/Board/i)[0]!)
  })
})
