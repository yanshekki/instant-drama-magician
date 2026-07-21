import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createMockApi } from '../../test/mockApi'

const api = createMockApi()
vi.mock('../../lib/api', () => ({ getApi: () => api }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k })
}))
vi.mock('./LocalMediaImage', () => ({
  LocalMediaImage: () => <div data-testid="thumb" />
}))

import { ActionCastRefPicker } from './ActionCastRefPicker'

describe('ActionCastRefPicker', () => {
  it('renders picker chrome', () => {
    api.characters = { list: vi.fn().mockResolvedValue([]) } as never
    render(
      <ActionCastRefPicker value={[]} onChange={vi.fn()} />
    )
    // Should render some control surface without crashing
    expect(document.body.textContent?.length).toBeGreaterThan(0)
  })
})
