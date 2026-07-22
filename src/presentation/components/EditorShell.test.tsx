import { describe, expect, it, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { EditorShell } from './EditorShell'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: { defaultValue?: string }) => o?.defaultValue ?? k,
    i18n: { language: 'en' }
  })
}))

describe('EditorShell', () => {
  afterEach(() => cleanup())

  it('returns null when closed', () => {
    const { container } = render(
      <EditorShell
        open={false}
        title="Edit"
        onClose={vi.fn()}
        onSave={vi.fn()}
        saveLabel="Save"
        cancelLabel="Cancel"
      >
        <p>form</p>
      </EditorShell>
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders form and sticky save; gallery collapsed by default on mobile path', () => {
    const onSave = vi.fn()
    const onClose = vi.fn()
    render(
      <EditorShell
        open
        title="New character"
        subtitle="Draft"
        onClose={onClose}
        onSave={onSave}
        saveLabel="Save"
        cancelLabel="Cancel"
        tabs={[
          { id: 'profile', label: 'Profile' },
          { id: 'refs', label: 'Refs' }
        ]}
        activeTab="profile"
        onTabChange={vi.fn()}
        preview={<div data-testid="gallery-preview">gallery</div>}
      >
        <div>
          <p>Field A</p>
          <p>Field B long form content</p>
        </div>
      </EditorShell>
    )
    expect(screen.getByText('New character')).toBeTruthy()
    expect(screen.getByText('Field A')).toBeTruthy()
    // Mobile strip toggle + sticky Save
    expect(
      screen.getByText(/Gallery \/ references|editor.galleryToggle/i)
    ).toBeTruthy()
    // Form body is a single scroll region (class contract)
    const formScroll = document.querySelector(
      '.overflow-y-auto.overscroll-y-contain'
    )
    expect(formScroll).toBeTruthy()
    expect(formScroll?.textContent || '').toMatch(/Field A/)
    const saveBtn = screen
      .getAllByRole('button')
      .find((b) => /^Save$/i.test((b.textContent || '').trim()))
    expect(saveBtn).toBeTruthy()
    fireEvent.click(saveBtn!)
    expect(onSave).toHaveBeenCalled()
  })

  it('close button calls onClose', () => {
    const onClose = vi.fn()
    render(
      <EditorShell
        open
        title="Edit"
        onClose={onClose}
        onSave={vi.fn()}
        saveLabel="Save"
        cancelLabel="Cancel"
      >
        <p>x</p>
      </EditorShell>
    )
    const cancelBtn = screen
      .getAllByRole('button')
      .find((b) => /^Cancel$/i.test((b.textContent || '').trim()))
    expect(cancelBtn).toBeTruthy()
    fireEvent.click(cancelBtn!)
    expect(onClose).toHaveBeenCalled()
  })
})
