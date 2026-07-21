import { describe, expect, it, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } })
}))

import { LlmProviderPicker } from './LlmProviderPicker'
import { LLM_PRESET_CATALOG } from '../../domain/openaiCompatible'

describe('LlmProviderPicker', () => {
  afterEach(() => cleanup())

  it('renders groups and selects preset', () => {
    const onChange = vi.fn()
    const first = LLM_PRESET_CATALOG[0]
    const second = LLM_PRESET_CATALOG[1] ?? first
    render(
      <LlmProviderPicker value={first.id} onChange={onChange} />
    )
    expect(screen.getAllByText(/settings.llmGroup/).length).toBeGreaterThan(0)
    // click another preset if available
    const buttons = screen.getAllByRole('button')
    const other = buttons.find((b) => !b.textContent?.includes('✓'))
    if (other) {
      fireEvent.click(other)
      expect(onChange).toHaveBeenCalled()
    }
    // disabled
    cleanup()
    render(
      <LlmProviderPicker
        value={second.id}
        onChange={onChange}
        disabled
      />
    )
    expect(
      (screen.getAllByRole('button')[0] as HTMLButtonElement).disabled
    ).toBe(true)
  })
})
