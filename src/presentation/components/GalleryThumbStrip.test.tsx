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

import { GalleryThumbStrip } from './GalleryThumbStrip'

const items = [
  { id: '1', path: '/a.png', label: 'A' },
  { id: '2', path: '/b.png', label: 'B' },
  { id: '3', path: '/c.png', label: 'C' }
]

describe('GalleryThumbStrip', () => {
  afterEach(() => cleanup())

  it('null when empty', () => {
    const { container } = render(
      <GalleryThumbStrip
        items={[]}
        selectedId={null}
        onSelect={() => undefined}
        onReorder={() => undefined}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('thumb click previews only; checkbox toggles multi without fighting preview', () => {
    const onSelect = vi.fn()
    const onToggle = vi.fn()
    const onReorder = vi.fn()
    render(
      <GalleryThumbStrip
        items={items}
        selectedId="2"
        selectedIds={['2']}
        coverPath="/a.png"
        onSelect={onSelect}
        onToggleSelect={onToggle}
        multiSelect
        onReorder={onReorder}
        labelOf={(i) => `L:${i.label}`}
      />
    )
    expect(screen.getByText('common.coverBadge')).toBeTruthy()

    // Preview click (thumb body) — first draggable cell is item 1
    const cells = document.querySelectorAll('[draggable="true"]')
    fireEvent.click(cells[0]!)
    expect(onSelect).toHaveBeenCalledWith('1')
    expect(onToggle).not.toHaveBeenCalled()

    // Checkbox only (selectedIds has '2' checked)
    const check = screen.getAllByLabelText('common.galleryUncheckForGen')[0]
    fireEvent.click(check)
    expect(onToggle).toHaveBeenCalledWith('2')

    fireEvent.click(screen.getByLabelText('common.galleryMoveLeft'))
    expect(onReorder).toHaveBeenCalledWith('2', '1')
    fireEvent.click(screen.getByLabelText('common.galleryMoveRight'))
    expect(onReorder).toHaveBeenCalledWith('2', '3')
  })

  it('keyboard and drag-drop reorder', () => {
    const onSelect = vi.fn()
    const onToggle = vi.fn()
    const onReorder = vi.fn()
    render(
      <GalleryThumbStrip
        items={items}
        selectedId="1"
        onSelect={onSelect}
        onToggleSelect={onToggle}
        multiSelect
        onReorder={onReorder}
        fallbackCoverPath="/b.png"
      />
    )
    const cells = screen.getAllByRole('button').filter((el) =>
      el.getAttribute('draggable') === 'true'
    )
    const cellB = cells.find((c) => c.querySelector('[data-testid="thumb"]')?.textContent === '/b.png')
    expect(cellB).toBeTruthy()
    fireEvent.keyDown(cellB!, { key: 'Enter' })
    expect(onSelect).toHaveBeenCalledWith('2')
    // Space also previews only
    fireEvent.keyDown(cellB!, { key: ' ' })
    expect(onToggle).not.toHaveBeenCalled()

    const cellA = cells.find((c) => c.querySelector('[data-testid="thumb"]')?.textContent === '/a.png')
    fireEvent.dragStart(cellA!, {
      dataTransfer: {
        setData: vi.fn(),
        setDragImage: vi.fn(),
        effectAllowed: 'move'
      }
    })
    fireEvent.dragEnter(cellB!)
    fireEvent.dragOver(cellB!, {
      dataTransfer: { dropEffect: 'move' },
      preventDefault: vi.fn()
    })
    fireEvent.drop(cellB!, {
      dataTransfer: { getData: () => '1' },
      preventDefault: vi.fn(),
      stopPropagation: vi.fn()
    })
    expect(onReorder).toHaveBeenCalledWith('1', '2')
    fireEvent.dragLeave(cellB!)
    fireEvent.dragEnd(cellA!)
  })

  it('single select without multi has no checkboxes', () => {
    const onSelect = vi.fn()
    render(
      <GalleryThumbStrip
        items={items.slice(0, 1)}
        selectedId="1"
        onSelect={onSelect}
        onReorder={() => undefined}
      />
    )
    expect(screen.queryByLabelText('common.galleryCheckForGen')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: undefined }))
    // click the thumb cell
    const cell = document.querySelector('[draggable="true"]')
    if (cell) fireEvent.click(cell)
    expect(onSelect).toHaveBeenCalledWith('1')
  })

  it('shows viewing badge on primary and checked state on multi', () => {
    render(
      <GalleryThumbStrip
        items={items}
        selectedId="1"
        selectedIds={['1', '2']}
        multiSelect
        coverPath="/c.png"
        onSelect={vi.fn()}
        onToggleSelect={vi.fn()}
        onReorder={() => undefined}
      />
    )
    expect(screen.getByText('common.galleryViewing')).toBeTruthy()
    expect(screen.getAllByLabelText('common.galleryUncheckForGen').length).toBe(
      2
    )
    expect(screen.getAllByLabelText('common.galleryCheckForGen').length).toBe(1)
  })
})
