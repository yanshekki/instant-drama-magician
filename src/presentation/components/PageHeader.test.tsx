import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } })
}))

import { PageHeader, pageHeaderActionsClass, pageHeaderClass } from './PageHeader'

describe('PageHeader', () => {
  it('renders title only', () => {
    render(<PageHeader title="Stories" />)
    expect(screen.getByText('Stories')).toBeTruthy()
    expect(screen.queryByText('sub')).toBeNull()
  })

  it('renders subtitle and actions', () => {
    render(
      <PageHeader
        title="T"
        subtitle="sub"
        actions={<button type="button">Act</button>}
      />
    )
    expect(screen.getByText('sub')).toBeTruthy()
    expect(screen.getByText('Act')).toBeTruthy()
  })

  it('exports pageHeaderActionsClass', () => {
    expect(pageHeaderActionsClass).toContain('ml-auto')
  })

  it('sits title and actions on one row from sm', () => {
    expect(pageHeaderClass).toContain('sm:flex-row')
    expect(pageHeaderClass).toContain('sm:justify-between')
    const { container } = render(
      <PageHeader title="Characters" actions={<button type="button">New</button>} />
    )
    expect(container.querySelector('header')?.className).toContain('sm:flex-row')
  })
})
