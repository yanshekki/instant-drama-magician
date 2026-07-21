import { describe, expect, it, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } })
}))

import { ExportFinalDialog } from './ExportFinalDialog'

describe('ExportFinalDialog', () => {
  afterEach(() => cleanup())

  it('returns null when closed', () => {
    const { container } = render(
      <ExportFinalDialog
        open={false}
        onCancel={() => undefined}
        onConfirm={() => undefined}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders fields and confirms options', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(
      <ExportFinalDialog
        open
        initial={{ exportProfile: 'fast', bgmVolume: 0.3 }}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    )
    expect(screen.getByText('export.dialogTitle')).toBeTruthy()

    const selects = document.querySelectorAll('select')
    fireEvent.change(selects[0], { target: { value: 'balanced' } })

    const checks = document.querySelectorAll('input[type="checkbox"]')
    checks.forEach((c) => fireEvent.click(c))

    const numbers = document.querySelectorAll('input[type="number"]')
    fireEvent.change(numbers[0], { target: { value: '0.5' } })
    fireEvent.change(numbers[1], { target: { value: '' } })

    fireEvent.click(screen.getByText('common.cancel'))
    expect(onCancel).toHaveBeenCalled()

    fireEvent.click(screen.getByText('export.confirmExport'))
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ bgmVolume: 0.5 })
    )
  })

  it('shows busy state', () => {
    render(
      <ExportFinalDialog
        open
        busy
        onCancel={() => undefined}
        onConfirm={() => undefined}
      />
    )
    expect(screen.getByText('common.exporting')).toBeTruthy()
  })
})
