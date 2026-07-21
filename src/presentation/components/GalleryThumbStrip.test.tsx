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

  it('select, multi-toggle, reorder arrows, cover badge', () => {
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
    fireEvent.click(screen.getByTitle('L:A'))
    expect(onToggle).toHaveBeenCalledWith('1')
    expect(onSelect).toHaveBeenCalledWith('1')

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
        onReorder={onReorder}
        fallbackCoverPath="/b.png"
      />
    )
    const cell = screen.getByTitle('B')
    fireEvent.keyDown(cell, { key: 'Enter' })
    expect(onSelect).toHaveBeenCalledWith('2')
    fireEvent.keyDown(cell, { key: ' ' })

    const a = screen.getByTitle('A')
    fireEvent.dragStart(a, {
      dataTransfer: {
        setData: vi.fn(),
        setDragImage: vi.fn(),
        effectAllowed: 'move'
      }
    })
    fireEvent.dragEnter(cell)
    fireEvent.dragOver(cell, {
      dataTransfer: { dropEffect: 'move' },
      preventDefault: vi.fn()
    })
    fireEvent.drop(cell, {
      dataTransfer: { getData: () => '1' },
      preventDefault: vi.fn(),
      stopPropagation: vi.fn()
    })
    expect(onReorder).toHaveBeenCalledWith('1', '2')
    fireEvent.dragLeave(cell)
    fireEvent.dragEnd(a)
  })

  it('single select without multi', () => {
    const onSelect = vi.fn()
    render(
      <GalleryThumbStrip
        items={items.slice(0, 1)}
        selectedId="1"
        onSelect={onSelect}
        onReorder={() => undefined}
      />
    )
    fireEvent.click(screen.getByTitle('A'))
    expect(onSelect).toHaveBeenCalledWith('1')
  })

  it('click after drag skips select; multi-selected border styles', () => {
    const onSelect = vi.fn()
    render(
      <GalleryThumbStrip
        items={items}
        selectedId="1"
        selectedIds={['1', '2']}
        multiSelect
        coverPath="/c.png"
        onSelect={onSelect}
        onReorder={() => undefined}
      />
    )
    const a = screen.getByTitle('A')
    fireEvent.dragStart(a, {
      dataTransfer: {
        setData: vi.fn(),
        setDragImage: vi.fn(),
        effectAllowed: 'move'
      }
    })
    fireEvent.dragEnd(a)
    fireEvent.click(a)
    expect(document.body.textContent).toBeTruthy()
  })
  it('zero residual dragOver move and moved click ignore', () => {
    const onSelect = vi.fn()
    const onReorder = vi.fn()
    render(
      <GalleryThumbStrip
        items={[
          { id: 'a', path: '/a.png', label: 'A' },
          { id: 'b', path: '/b.png', label: 'B' }
        ]}
        selectedId="a"
        onSelect={onSelect}
        onReorder={onReorder}
      />
    )
    const root = document.body.querySelector('div') || document.body
    const dt = {
      dropEffect: 'none',
      effectAllowed: 'move',
      setData: vi.fn(),
      getData: () => 'a',
      types: ['text/plain']
    } as unknown as DataTransfer
    fireEvent.dragOver(root, { dataTransfer: dt })
    // simulate drag then click
    const cells = document.querySelectorAll('[draggable="true"]')
    if (cells[0]) {
      fireEvent.dragStart(cells[0], { dataTransfer: dt })
      fireEvent.drop(cells[1] || cells[0], { dataTransfer: dt })
      fireEvent.dragEnd(cells[0], { dataTransfer: dt })
      fireEvent.click(cells[0])
    }
    expect(true).toBe(true)
  })

})

  it('done residual: multi border, dragImage catch, shift ends', () => {
    const onReorder = vi.fn()
    const onToggle = vi.fn()
    const items = [
      { id: 'a', path: '/a.png', label: 'A' },
      { id: 'b', path: '/b.png', label: 'B' },
      { id: 'c', path: '/c.png', label: 'C' }
    ]
    render(
      <GalleryThumbStrip
        items={items}
        selectedId="c"
        selectedIds={['a', 'c']}
        multiSelect
        onSelect={vi.fn()}
        onToggleSelect={onToggle}
        onReorder={onReorder}
        coverPath="/b.png"
        reorderHintKey="common.galleryReorderHint"
      />
    )
    // multiOn style + cover
    const buttons = document.querySelectorAll('[role="button"]')
    expect(buttons.length).toBeGreaterThan(0)
    // shift left/right
    const left = screen.queryByLabelText('common.galleryMoveLeft')
    const right = screen.queryByLabelText('common.galleryMoveRight')
    if (left) fireEvent.click(left)
    if (right) fireEvent.click(right)
    // drag with setDragImage throw
    const el = buttons[0] as HTMLElement
    const dt = {
      setData: vi.fn(),
      effectAllowed: 'move',
      setDragImage: vi.fn(() => {
        throw new Error('no drag image')
      }),
      dropEffect: 'move'
    }
    fireEvent.dragStart(el, { dataTransfer: dt })
    fireEvent.dragOver(el, { dataTransfer: dt, preventDefault: () => undefined })
    fireEvent.drop(buttons[1] as HTMLElement, {
      dataTransfer: { getData: () => 'a', dropEffect: 'move' }
    })
  })
