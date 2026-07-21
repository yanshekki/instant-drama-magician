import { describe, expect, it, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } })
}))

vi.mock('./LocalMediaImage', () => ({
  LocalMediaImage: ({ filePath }: { filePath: string }) => (
    <div data-testid="thumb">{filePath}</div>
  )
}))

import { ExternalRefSection } from './ExternalRefSection'

describe('ExternalRefSection', () => {
  afterEach(() => cleanup())

  it('empty state and add', () => {
    const onAdd = vi.fn()
    render(
      <ExternalRefSection
        items={[]}
        useExternalRef={false}
        onUseExternalChange={() => undefined}
        onAdd={onAdd}
      />
    )
    expect(screen.getByText('characters.externalRefEmpty')).toBeTruthy()
    fireEvent.click(screen.getAllByText('characters.externalRefTitle')[1])
    expect(onAdd).toHaveBeenCalled()
    const cb = document.querySelector(
      'input[type="checkbox"]'
    ) as HTMLInputElement
    expect(cb.disabled).toBe(true)
  })

  it('shows items, remove, toggle use', () => {
    const onRemove = vi.fn()
    const onUse = vi.fn()
    render(
      <ExternalRefSection
        items={[{ id: '1', path: '/a.png', label: 'A' }]}
        useExternalRef
        onUseExternalChange={onUse}
        onAdd={() => undefined}
        onRemove={onRemove}
      />
    )
    expect(screen.getByTestId('thumb').textContent).toBe('/a.png')
    fireEvent.click(screen.getByText('×'))
    expect(onRemove).toHaveBeenCalledWith('1')
    fireEvent.click(document.querySelector('input[type="checkbox"]')!)
    expect(onUse).toHaveBeenCalled()
  })
})
