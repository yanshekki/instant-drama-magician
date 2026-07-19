import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { PageHeader } from './PageHeader'
import { renderWithProviders } from '../../test/renderWithProviders'

describe('PageHeader', () => {
  it('renders title', async () => {
    await renderWithProviders(<PageHeader title="Stories" />)
    expect(screen.getByText('Stories')).toBeTruthy()
  })
})
