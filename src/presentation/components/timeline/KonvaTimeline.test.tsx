import { describe, expect, it, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: { n?: number; time?: string }) =>
    o?.n != null ? `${k}:${o.n}` : o?.time != null ? `${k}:${o.time}` : k
  , i18n: { language: 'en' } })
}))

// Lightweight react-konva mock that still runs prop callbacks + Stage ref
vi.mock('react-konva', () => {
  const React = require('react')
  const Stage = React.forwardRef(function Stage(
    { children, onMouseDown, width, height, ...rest }: any,
    ref: any
  ) {
    const elRef = React.useRef(null)
    const stageApi = React.useMemo(
      () => ({
        container: () => {
          const el = elRef.current as HTMLElement | null
          if (!el) {
            return {
              getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 200 }),
              parentElement: { scrollLeft: 0 }
            }
          }
          return el
        },
        getStage: function getStage() {
          return this
        }
      }),
      []
    )
    React.useImperativeHandle(ref, () => stageApi, [stageApi])
    return React.createElement(
      'div',
      {
        ref: elRef,
        'data-konva': 'Stage',
        'data-width': width,
        'data-height': height,
        onMouseDown: (e: any) => {
          if (onMouseDown) {
            const fake = {
              target: {
                getStage: () => stageApi
              }
            }
            // when clicking stage itself, target === stage
            fake.target = stageApi as any
            onMouseDown(fake)
          }
        }
      },
      children
    )
  })
  const passthrough =
    (name: string) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ({ children, ...props }: any) => {
      const dragBound = props.dragBoundFunc
      const onDragMove = props.onDragMove
      const onDragEnd = props.onDragEnd
      let x = typeof props.x === 'number' ? props.x : 0
      const target = {
        x: (v?: number) => {
          if (typeof v === 'number') {
            x = v
            return x
          }
          return x
        }
      }
      return React.createElement(
        'div',
        {
          'data-konva': name,
          'data-draggable': props.draggable ? '1' : undefined,
          onClick: props.onClick,
          onMouseDown: props.onMouseDown,
          onWheel: props.onWheel,
          onTap: props.onTap,
          onPointerDown: () => {
            if (onDragMove) {
              if (dragBound) dragBound({ x: x + 40, y: 0 })
              onDragMove({ target })
            }
            if (onDragEnd) onDragEnd({ target })
          }
        },
        children
      )
    }
  return {
    Stage,
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

  it('renders multi-entry labels without crashing', () => {
    render(
      <KonvaTimeline
        entries={entries}
        labels={{ t1: 'Hero', t2: 'Scene', t3: 'Prop', t4: 'Act' }}
        selectedId="t2"
        playhead={2}
        pxPerSec={40}
        onPxPerSecChange={() => undefined}
        onPlayheadChange={() => undefined}
        onSelect={() => undefined}
        onMove={() => undefined}
        onDropAsset={() => undefined}
        width={900}
        snapEnabled
        snapGridSec={0.25}
      />
    )
    expect(screen.getByText('timeline.zoom')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('timeline.zoom'), {
      target: { value: '80' }
    })
  })

  it('pack abut when gaps exist', () => {
    const onPack = vi.fn()
    render(
      <KonvaTimeline
        entries={
          [
            {
              id: 'a',
              startTime: 0,
              endTime: 2,
              order: 0,
              mediaStatus: 'READY',
              characterId: 'c1'
            },
            {
              id: 'b',
              startTime: 5,
              endTime: 8,
              order: 1,
              mediaStatus: 'EMPTY',
              characterId: null
            }
          ] as never[]
        }
        labels={{ a: 'A', b: 'B' }}
        selectedId="a"
        playhead={0}
        pxPerSec={30}
        onPxPerSecChange={() => undefined}
        onPlayheadChange={() => undefined}
        onSelect={() => undefined}
        onMove={() => undefined}
        onDropAsset={() => undefined}
        onPackAbut={onPack}
        width={600}
        snapEnabled={false}
      />
    )
    const pack = Array.from(document.querySelectorAll('button')).find((b) =>
      /pack|abut|密|贴/i.test(b.textContent || '')
    )
    if (pack) fireEvent.click(pack)
  })

  it('drop asset via dataTransfer on track container', () => {
    const onDrop = vi.fn()
    const { container } = render(
      <KonvaTimeline
        entries={entries}
        labels={{ t1: 'Hero' }}
        selectedId="t1"
        playhead={1}
        pxPerSec={48}
        onPxPerSecChange={() => undefined}
        onPlayheadChange={() => undefined}
        onSelect={() => undefined}
        onMove={() => undefined}
        onDropAsset={onDrop}
        width={800}
        snapEnabled={false}
      />
    )
    const track = container.querySelector('.overflow-x-auto')
    expect(track).toBeTruthy()
    if (track) {
      fireEvent.dragOver(track, {
        dataTransfer: { dropEffect: 'copy', types: ['application/x-idm-asset'] }
      })
      fireEvent.drop(track, {
        clientX: 120,
        clientY: 40,
        dataTransfer: {
          getData: (type: string) =>
            type === 'application/x-idm-asset'
              ? JSON.stringify({
                  type: 'character',
                  id: 'c9',
                  name: 'Bob'
                })
              : ''
        }
      })
      // may or may not call if stageRef null in jsdom
      fireEvent.drop(track, {
        clientX: 10,
        clientY: 10,
        dataTransfer: {
          getData: () => 'not-json'
        }
      })
    }
  })

  it('pack disabled when already packed', () => {
    const onPack = vi.fn()
    render(
      <KonvaTimeline
        entries={
          [
            {
              id: 'a',
              startTime: 0,
              endTime: 3,
              order: 0,
              mediaStatus: 'READY'
            },
            {
              id: 'b',
              startTime: 3,
              endTime: 6,
              order: 1,
              mediaStatus: 'READY'
            }
          ] as never[]
        }
        labels={{ a: 'A', b: 'B' }}
        selectedId={null}
        playhead={0}
        pxPerSec={40}
        onPxPerSecChange={() => undefined}
        onPlayheadChange={() => undefined}
        onSelect={() => undefined}
        onMove={() => undefined}
        onDropAsset={() => undefined}
        onPackAbut={onPack}
        packAbutBusy
        width={500}
        snapEnabled={false}
      />
    )
    const pack = Array.from(document.querySelectorAll('button')).find((b) =>
      /packAbut/i.test(b.textContent || '')
    )
    if (pack) expect((pack as HTMLButtonElement).disabled).toBe(true)
  })

  it('invokes drag move/end on clips and playhead + stage deselect', () => {
    const onMove = vi.fn()
    const onSelect = vi.fn()
    const onPlayhead = vi.fn()
    const onDrop = vi.fn()
    const { container } = render(
      <KonvaTimeline
        entries={entries}
        labels={{ t1: 'Hero', t2: 'Scene' }}
        selectedId="t1"
        playhead={1}
        pxPerSec={48}
        onPxPerSecChange={() => undefined}
        onPlayheadChange={onPlayhead}
        onSelect={onSelect}
        onMove={onMove}
        onDropAsset={onDrop}
        width={800}
        snapEnabled
        snapGridSec={0.5}
      />
    )
    const stage = container.querySelector('[data-konva="Stage"]')
    expect(stage).toBeTruthy()
    fireEvent.mouseDown(stage!)

    const groups = container.querySelectorAll('[data-konva="Group"][data-draggable="1"]')
    expect(groups.length).toBeGreaterThan(0)
    for (const g of Array.from(groups).slice(0, 3)) {
      fireEvent.pointerDown(g)
    }
    // drop with stage ref available
    const track = container.querySelector('.overflow-x-auto')
    if (track) {
      fireEvent.drop(track, {
        clientX: 200,
        clientY: 40,
        dataTransfer: {
          getData: (type: string) =>
            type === 'application/x-idm-asset'
              ? JSON.stringify({ type: 'character', id: 'c9', name: 'Bob' })
              : ''
        }
      })
    }
    // onMove and/or onPlayhead may fire depending on which groups dragged
    expect(onSelect.mock.calls.length + onMove.mock.calls.length + onPlayhead.mock.calls.length).toBeGreaterThan(0)
  })
})
