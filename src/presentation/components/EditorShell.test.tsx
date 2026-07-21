import { describe, expect, it, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import {
  EditorField,
  EditorSelect,
  EditorShell,
  EDITOR_SHELL_WIDTH,
  editorFormClass
} from './EditorShell'

describe('EditorShell', () => {
  afterEach(() => cleanup())

  it('exports layout constants', () => {
    expect(EDITOR_SHELL_WIDTH).toBeTruthy()
    expect(editorFormClass).toContain('max-w-2xl')
  })

  it('null when closed', () => {
    const { container } = render(
      <EditorShell
        open={false}
        title="T"
        onClose={() => undefined}
        onSave={() => undefined}
        saveLabel="Save"
        cancelLabel="Cancel"
      >
        body
      </EditorShell>
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders tabs, preview, save/close', () => {
    const onClose = vi.fn()
    const onSave = vi.fn()
    const onTab = vi.fn()
    render(
      <EditorShell
        open
        title="Edit"
        subtitle="sub"
        onClose={onClose}
        onSave={onSave}
        saveLabel="Save"
        cancelLabel="Cancel"
        tabs={[
          { id: 'a', label: 'TabA' },
          { id: 'b', label: 'TabB' }
        ]}
        activeTab="a"
        onTabChange={onTab}
        preview={<div>preview</div>}
      >
        form-body
      </EditorShell>
    )
    expect(screen.getByText('Edit')).toBeTruthy()
    expect(screen.getByText('sub')).toBeTruthy()
    expect(screen.getByText('preview')).toBeTruthy()
    expect(screen.getByText('form-body')).toBeTruthy()
    fireEvent.click(screen.getByText('TabB'))
    expect(onTab).toHaveBeenCalledWith('b')
    fireEvent.click(screen.getByText('Save'))
    expect(onSave).toHaveBeenCalled()
    // backdrop close
    const backdrop = document.querySelector(
      'button.absolute.inset-0'
    ) as HTMLButtonElement
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalled()
  })

  it('disables save when busy and closes via header X', () => {
    const onClose = vi.fn()
    const onSave = vi.fn()
    render(
      <EditorShell
        open
        title="BusyEdit"
        onClose={onClose}
        onSave={onSave}
        saveLabel="Save"
        cancelLabel="Cancel"
        busy
        saveDisabled
      >
        busy-body
      </EditorShell>
    )
    const save = screen.getByText('Save').closest('button')
    expect(save?.disabled).toBe(true)
    fireEvent.click(screen.getAllByLabelText('Cancel')[1]!)
    expect(onClose).toHaveBeenCalled()
  })

  it('EditorField and EditorSelect', () => {
    render(
      <>
        <EditorField label="Name" hint="h">
          <input />
        </EditorField>
        <EditorField label="Bare">
          <input />
        </EditorField>
        <EditorSelect value="a" onChange={() => undefined}>
          <option value="a">A</option>
        </EditorSelect>
      </>
    )
    expect(screen.getByText('Name')).toBeTruthy()
    expect(screen.getByText('h')).toBeTruthy()
    expect(screen.getByText('Bare')).toBeTruthy()
  })
})

