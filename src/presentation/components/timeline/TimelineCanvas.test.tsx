import { describe, expect, it, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { TimelineCanvas, makeAssetDragData } from './TimelineCanvas'

const entries = [
  {
    id: 't1',
    storyId: 's1',
    startTime: 0,
    endTime: 4,
    order: 0,
    characterId: 'c1',
    sceneId: null,
    propId: null,
    actionId: null,
    dialogue: 'Hi',
    beatContentJson: null,
    characterIds: null,
    sceneIds: null,
    propIds: null
  },
  {
    id: 't2',
    storyId: 's1',
    startTime: 5,
    endTime: 8,
    order: 1,
    characterId: null,
    sceneId: 'sc1',
    propId: null,
    actionId: null,
    dialogue: null,
    beatContentJson: null,
    characterIds: null,
    sceneIds: null,
    propIds: null
  },
  {
    id: 't3',
    storyId: 's1',
    startTime: 9,
    endTime: 11,
    order: 2,
    characterId: null,
    sceneId: null,
    propId: 'p1',
    actionId: null,
    dialogue: null,
    beatContentJson: null,
    characterIds: null,
    sceneIds: null,
    propIds: null
  },
  {
    id: 't4',
    storyId: 's1',
    startTime: 12,
    endTime: 14,
    order: 3,
    characterId: null,
    sceneId: null,
    propId: null,
    actionId: 'a1',
    dialogue: null,
    beatContentJson: null,
    characterIds: null,
    sceneIds: null,
    propIds: null
  },
  {
    id: 't5',
    storyId: 's1',
    startTime: 15,
    endTime: 16,
    order: 4,
    characterId: null,
    sceneId: null,
    propId: null,
    actionId: null,
    dialogue: null,
    beatContentJson: null,
    characterIds: null,
    sceneIds: null,
    propIds: null
  }
] as never[]

describe('TimelineCanvas', () => {
  afterEach(() => cleanup())

  it('makeAssetDragData serializes', () => {
    expect(JSON.parse(makeAssetDragData({ kind: 'prop', id: 'p', label: 'P' }))).toEqual(
      { kind: 'prop', id: 'p', label: 'P' }
    )
  })

  it('renders clips, selects, moves, resizes, drops', () => {
    const onMove = vi.fn()
    const onResize = vi.fn()
    const onDrop = vi.fn()
    const onSelect = vi.fn()
    render(
      <TimelineCanvas
        entries={entries}
        labels={{ t1: 'Hero' }}
        onMove={onMove}
        onResize={onResize}
        onDropAsset={onDrop}
        onSelect={onSelect}
        selectedId="t1"
      />
    )
    expect(screen.getByText('Hero')).toBeTruthy()
    fireEvent.click(screen.getByText('Hero'))
    expect(onSelect).toHaveBeenCalledWith('t1')

    // click track deselects
    const track = document.querySelector('.select-none') as HTMLElement
    fireEvent.click(track)
    expect(onSelect).toHaveBeenCalledWith(null)

    // resize first (before move mutates draft)
    const clip = screen.getByText('Hero')
    const handle = clip.parentElement?.querySelector(
      '.cursor-ew-resize'
    ) as HTMLElement | null
    if (handle) {
      fireEvent.pointerDown(handle, { clientX: 100, pointerId: 2 })
      fireEvent.pointerMove(track, { clientX: 120, pointerId: 2 })
      fireEvent.pointerUp(track, { pointerId: 2 })
      expect(onResize).toHaveBeenCalled()
    }

    // move drag
    fireEvent.pointerDown(screen.getByText('Hero'), {
      clientX: 100,
      pointerId: 1
    })
    fireEvent.pointerMove(track, { clientX: 148, pointerId: 1 })
    fireEvent.pointerUp(track, { pointerId: 1 })
    expect(onMove).toHaveBeenCalled()

    // drop asset
    const root = document.querySelector('.overflow-x-auto') as HTMLElement
    fireEvent.dragOver(root, {
      dataTransfer: { dropEffect: 'copy' },
      preventDefault: () => undefined
    })
    fireEvent.drop(root, {
      clientX: 50,
      dataTransfer: {
        getData: (type: string) =>
          type === 'application/x-idm-asset'
            ? makeAssetDragData({ kind: 'character', id: 'c9', label: 'X' })
            : ''
      },
      preventDefault: () => undefined
    })
    expect(onDrop).toHaveBeenCalled()

    // malformed drop ignored
    fireEvent.drop(root, {
      clientX: 50,
      dataTransfer: {
        getData: () => 'not-json'
      },
      preventDefault: () => undefined
    })
  })
})
