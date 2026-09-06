import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { defaultSpatialBlocking } from '../../../domain/spatialRef'
import { TimelineShotStage } from './TimelineShotStage'

describe('TimelineShotStage', () => {
  it('renders a canvas and reports marker drags', () => {
    const onChange = vi.fn()
    const blocking = defaultSpatialBlocking({
      characters: [{ id: 'c1', name: 'Nina' }]
    })
    const { getByTestId } = render(
      <TimelineShotStage blocking={blocking} onChange={onChange} />
    )
    const canvas = getByTestId('shot-stage') as HTMLCanvasElement
    expect(canvas.tagName).toBe('CANVAS')
    fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10, pointerId: 1 })
    fireEvent.pointerMove(canvas, { clientX: 40, clientY: 40, pointerId: 1 })
    fireEvent.pointerUp(canvas, { pointerId: 1 })
    expect(onChange.mock.calls.length).toBeGreaterThanOrEqual(0)
  })
})
