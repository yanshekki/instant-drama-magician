import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { IntroTemplatePicker } from './IntroTemplatePicker'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string) => k
  })
}))

describe('IntroTemplatePicker', () => {
  it('selects a template from the grouped list', () => {
    const onChange = vi.fn()
    render(<IntroTemplatePicker value="hero-walkin" onChange={onChange} />)
    const select = screen.getByLabelText('introTemplates.label') as HTMLSelectElement
    expect(select.value).toBe('hero-walkin')
    fireEvent.change(select, { target: { value: 'close-up' } })
    expect(onChange).toHaveBeenCalledWith('close-up')
    fireEvent.change(select, { target: { value: 'low-angle-hero' } })
    expect(onChange).toHaveBeenCalledWith('low-angle-hero')
  })
})
