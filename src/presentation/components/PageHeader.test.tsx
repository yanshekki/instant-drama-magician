import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { PageHeader, pageHeaderActionsClass } from './PageHeader'
import { renderWithProviders } from '../../test/renderWithProviders'

describe('PageHeader', () => {
  it('renders title only', async () => {
    await renderWithProviders(<PageHeader title="Stories" />)
    expect(screen.getByText('Stories')).toBeTruthy()
    expect(screen.queryByText('sub')).toBeNull()
  })

  it('renders subtitle and actions', async () => {
    await renderWithProviders(
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
})
