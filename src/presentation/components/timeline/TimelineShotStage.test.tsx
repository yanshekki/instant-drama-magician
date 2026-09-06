import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { defaultSpatialBlocking } from '../../../domain/spatialRef'
import { TimelineShotStage, shotStageToPngDataUrl } from './TimelineShotStage'

describe('TimelineShotStage', () => {
  it('renders a canvas and reports marker drags', () => {
    const onChange = vi.fn()
    const blocking = defaultSpatialBlocking({
      characters: [{ id: 'c1', name: 'Nina' }],
      scenes: [{ id: 'sc1', name: 'Court' }],
      props: [{ id: 'p1', name: 'Bag' }],
      actions: [{ id: 'a1', name: 'Turn' }]
    })
    const { getByTestId, rerender } = render(
      <TimelineShotStage blocking={blocking} onChange={onChange} />
    )
    const canvas = getByTestId('shot-stage') as HTMLCanvasElement
    expect(canvas.tagName).toBe('CANVAS')
    Object.defineProperty(canvas, 'getBoundingClientRect', {
      value: () => ({
        left: 0,
        top: 0,
        width: 640,
        height: 360,
        right: 640,
        bottom: 360,
        x: 0,
        y: 0,
        toJSON: () => ({})
      })
    })
    const marker = blocking.markers[0]!
    const floorY = 360 * 0.62
    const py = floorY - marker.z * (floorY - 360 * 0.12)
    const px = marker.x * 640
    fireEvent.pointerDown(canvas, { clientX: px, clientY: py, pointerId: 1 })
    fireEvent.pointerMove(canvas, { clientX: 400, clientY: 80, pointerId: 1 })
    fireEvent.pointerUp(canvas, { pointerId: 1 })
    expect(onChange).toHaveBeenCalled()
    rerender(
      <TimelineShotStage
        blocking={{ ...blocking, aspect: '9:16' }}
        onChange={onChange}
        disabled
      />
    )
    fireEvent.pointerDown(canvas, { clientX: px, clientY: py, pointerId: 1 })
    expect(shotStageToPngDataUrl(null)).toBeNull()
  })
})
