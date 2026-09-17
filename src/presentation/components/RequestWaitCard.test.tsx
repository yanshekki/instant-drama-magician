import { beforeAll, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import type { ReactElement } from 'react'
import { ensureTestI18n } from '../../test/renderWithProviders'
import { RequestWaitCard } from './RequestWaitCard'
import { REQUEST_WAIT_PRESETS } from '../../domain/requestWait'

let i18n: Awaited<ReturnType<typeof ensureTestI18n>>

beforeAll(async () => {
  i18n = await ensureTestI18n()
})

function wrap(ui: ReactElement): ReactElement {
  return <I18nextProvider i18n={i18n}>{ui}</I18nextProvider>
}

describe('RequestWaitCard', () => {
  it('Patient chip writes all three waits', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      wrap(
        <RequestWaitCard
          value={{
            ...REQUEST_WAIT_PRESETS.standard,
            requestWaitPreset: 'standard'
          }}
          onChange={onChange}
        />
      )
    )
    await user.click(screen.getByRole('button', { name: /patient|從容|从容/i }))
    expect(onChange).toHaveBeenCalledWith({
      ...REQUEST_WAIT_PRESETS.patient,
      requestWaitPreset: 'patient'
    })
  })

  it('Custom chip reveals sliders', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { rerender } = render(
      wrap(
        <RequestWaitCard
          value={{
            ...REQUEST_WAIT_PRESETS.standard,
            requestWaitPreset: 'standard'
          }}
          onChange={onChange}
        />
      )
    )
    await user.click(screen.getByRole('button', { name: /custom|自訂|自定义/i }))
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ requestWaitPreset: 'custom' })
    )
    rerender(
      wrap(
        <RequestWaitCard
          value={{
            ...REQUEST_WAIT_PRESETS.standard,
            requestWaitPreset: 'custom'
          }}
          onChange={onChange}
        />
      )
    )
    expect(screen.getAllByRole('slider').length).toBe(3)
  })
})
