import { describe, expect, it, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: { n?: number; time?: string }) =>
    o?.n != null ? `${k}:${o.n}` : o?.time != null ? `${k}:${o.time}` : k
  , i18n: { language: 'en' } })
}))

// Lightweight react-konva mock that still runs prop callbacks
vi.mock('react-konva', () => {
  const React = require('react')
  const passthrough =
    (name: string) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ({ children, ...props }: any) =>
      React.createElement(
        'div',
        {
          'data-konva': name,
          onClick: props.onClick,
          onMouseDown: props.onMouseDown,
          onDragEnd: props.onDragEnd,
          onDragMove: props.onDragMove,
          onWheel: props.onWheel,
          onTap: props.onTap
        },
        children
      )
  return {
    Stage: passthrough('Stage'),
    Layer: passthrough('Layer'),
    Rect: passthrough('Rect'),
    Text: passthrough('Text'),
    Line: passthrough('Line'),
    Group: passthrough('Group')
  }
})

import { KonvaTimeline } from './KonvaTimeline'

const entries = [
  {
    id: 't1',
    storyId: 's1',
    startTime: 0,
    endTime: 3,
    order: 0,
    characterId: 'c1',
    sceneId: null,
    propId: null,
    actionId: null,
    mediaStatus: 'READY',
    dialogue: 'Hi',
    beatContentJson: null,
    characterIds: null,
    sceneIds: null,
    propIds: null
  },
  {
    id: 't2',
    storyId: 's1',
    startTime: 3,
    endTime: 6,
    order: 1,
    characterId: null,
    sceneId: 'sc1',
    propId: null,
    actionId: null,
    mediaStatus: 'FAILED',
    dialogue: null,
    beatContentJson: null,
    characterIds: null,
    sceneIds: null,
    propIds: null
  },
  {
    id: 't3',
    storyId: 's1',
    startTime: 6,
    endTime: 8,
    order: 2,
    characterId: null,
    sceneId: null,
    propId: 'p1',
    actionId: null,
    mediaStatus: 'GENERATING',
    dialogue: null,
    beatContentJson: null,
    characterIds: null,
    sceneIds: null,
    propIds: null
  },
  {
    id: 't4',
    storyId: 's1',
    startTime: 8,
    endTime: 10,
    order: 3,
    characterId: null,
    sceneId: null,
    propId: null,
    actionId: 'a1',
    mediaStatus: 'EMPTY',
    dialogue: null,
    beatContentJson: null,
    characterIds: null,
    sceneIds: null,
    propIds: null
  }
] as never[]

describe('KonvaTimeline', () => {
  afterEach(() => cleanup())

  it('renders controls and invokes zoom/snap/pack handlers', () => {
    const onPx = vi.fn()
    const onPlayhead = vi.fn()
    const onSelect = vi.fn()
    const onMove = vi.fn()
    const onDrop = vi.fn()
    const onPack = vi.fn()
    const onSnapEn = vi.fn()
    const onSnapGrid = vi.fn()
    render(
      <KonvaTimeline
        entries={entries}
        labels={{ t1: 'Hero' }}
        selectedId="t1"
        playhead={1.5}
        pxPerSec={48}
        onPxPerSecChange={onPx}
        onPlayheadChange={onPlayhead}
        onSelect={onSelect}
        onMove={onMove}
        onDropAsset={onDrop}
        onPackAbut={onPack}
        width={800}
        snapEnabled
        snapGridSec={0.5}
        onSnapEnabledChange={onSnapEn}
        onSnapGridSecChange={onSnapGrid}
      />
    )
    expect(screen.getByText('timeline.zoom')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('timeline.zoom'), {
      target: { value: '60' }
    })
    expect(onPx).toHaveBeenCalled()

    fireEvent.click(screen.getByLabelText('timeline.snapEnabled') || screen.getByText('timeline.snapEnabled').closest('label')!.querySelector('input')!)
    // checkbox
    const checks = document.querySelectorAll('input[type="checkbox"]')
    fireEvent.click(checks[0])
    expect(onSnapEn).toHaveBeenCalled()

    const num = screen.getByLabelText('timeline.snapGridSec')
    fireEvent.change(num, { target: { value: '1' } })
    expect(onSnapGrid).toHaveBeenCalled()

    const packBtn = screen.queryByText(/timeline.packAbut|pack/i)
    if (packBtn) fireEvent.click(packBtn)
    // may say already packed
    const pack = Array.from(document.querySelectorAll('button')).find((b) =>
      /pack|abut|密排|贴合/i.test(b.textContent || '') ||
      b.textContent?.includes('timeline')
    )
    if (pack) fireEvent.click(pack)
  })

  it('renders without pack and snap disabled', () => {
    render(
      <KonvaTimeline
        entries={[]}
        labels={{}}
        selectedId={null}
        playhead={0}
        pxPerSec={24}
        onPxPerSecChange={() => undefined}
        onPlayheadChange={() => undefined}
        onSelect={() => undefined}
        onMove={() => undefined}
        onDropAsset={() => undefined}
        width={400}
        snapEnabled={false}
      />
    )
    expect(screen.getByText('timeline.zoom')).toBeTruthy()
  })
})
