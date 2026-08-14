import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  act
} from '@testing-library/react'
import { createMockApi } from '../../test/mockApi'

const api = createMockApi()
vi.mock('../../lib/api', () => ({ getApi: () => api }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } })
}))

import { clampLightboxOffset, MediaZoomLightbox } from './MediaZoomLightbox'

describe('clampLightboxOffset', () => {
  it('keeps the window inside the viewport', () => {
    expect(clampLightboxOffset(0, 0, 800, 600)).toEqual({ x: 0, y: 0 })
    expect(clampLightboxOffset(4000, -4000, 800, 600)).toEqual({
      x: 400 - 56,
      y: -(300 - 56)
    })
  })
})

describe('MediaZoomLightbox', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.media.toPreviewUrl = vi.fn().mockResolvedValue({ url: 'blob:img' })
  })

  afterEach(() => cleanup())

  it('null when closed', () => {
    const { container } = render(
      <MediaZoomLightbox filePath="/a.png" open={false} onClose={() => undefined} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('loads preview and supports zoom controls + close', async () => {
    const onClose = vi.fn()
    render(
      <MediaZoomLightbox
        filePath="/a.png"
        alt="pic"
        open
        onClose={onClose}
      />
    )
    await waitFor(() => expect(screen.getByAltText('pic')).toBeTruthy())

    fireEvent.click(screen.getByLabelText('media.zoomIn'))
    fireEvent.click(screen.getByLabelText('media.zoomOut'))
    fireEvent.click(screen.getByLabelText('media.zoomReset'))
    fireEvent.click(screen.getByLabelText('200%'))
    fireEvent.click(screen.getByLabelText('400%'))
    fireEvent.click(screen.getAllByLabelText('common.close')[0]!)
    expect(onClose).toHaveBeenCalled()
    expect(screen.getByTestId('media-zoom-dialog')).toBeTruthy()
  })

  it('keyboard shortcuts and backdrop close', async () => {
    const onClose = vi.fn()
    render(
      <MediaZoomLightbox filePath="/a.png" open onClose={onClose} />
    )
    await waitFor(() => expect(api.media.toPreviewUrl).toHaveBeenCalled())

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '+' }))
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '=' }))
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '-' }))
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '_' }))
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '0' }))
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })
    expect(onClose).toHaveBeenCalled()
  })

  it('handles preview failure', async () => {
    api.media.toPreviewUrl = vi.fn().mockRejectedValue(new Error('nope'))
    render(
      <MediaZoomLightbox filePath="/missing.png" open onClose={() => undefined} />
    )
    await waitFor(() =>
      expect(screen.getByText('common.loading')).toBeTruthy()
    )
  })

  it('drag to pan', async () => {
    render(
      <MediaZoomLightbox filePath="/a.png" alt="x" open onClose={() => undefined} />
    )
    await waitFor(() => screen.getByAltText('x'))
    const stage = document.querySelector(
      '[data-testid="media-zoom-dialog"] .cursor-grab.overflow-hidden'
    ) as HTMLElement
    fireEvent.pointerDown(stage, { button: 0, clientX: 10, clientY: 10 })
    await act(async () => {
      window.dispatchEvent(
        new MouseEvent('mousemove', { clientX: 40, clientY: 50 })
      )
      window.dispatchEvent(new MouseEvent('mouseup'))
    })
    fireEvent.pointerDown(stage, { button: 2, clientX: 10, clientY: 10 })
  })

  it('drags the window from the title bar and clamps on resize', async () => {
    render(
      <MediaZoomLightbox filePath="/a.png" alt="x" open onClose={() => undefined} />
    )
    await waitFor(() => screen.getByAltText('x'))
    const bar = screen.getByAltText('x').closest('[role="dialog"]')
      ?.querySelector('.cursor-grab.items-center') as HTMLElement
    fireEvent.pointerDown(bar, { button: 0, clientX: 20, clientY: 20 })
    await act(async () => {
      window.dispatchEvent(
        new MouseEvent('mousemove', { clientX: 80, clientY: 40 })
      )
      window.dispatchEvent(new MouseEvent('mouseup'))
      window.dispatchEvent(new Event('resize'))
    })
  })
})
