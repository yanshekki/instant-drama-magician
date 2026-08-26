import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, act } from '@testing-library/react'
import { createMockApi } from '../../test/mockApi'

const api = createMockApi()
const toast = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  show: vi.fn(),
  dismiss: vi.fn(),
  toasts: []
}

vi.mock('../../lib/api', () => ({
  getApi: () => api,
  isWebRuntime: () => false
}))
vi.mock('../context/ToastContext', () => ({
  useToast: () => toast
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } })
}))

import { LocalMediaVideo } from './LocalMediaVideo'

describe('LocalMediaVideo', () => {
  beforeEach(() => {
    toast.success.mockClear()
    api.media.toPreviewUrl = vi.fn().mockResolvedValue({
      url: 'blob:film',
      filePath: '/f.mp4'
    })
    api.media.saveAs = vi.fn().mockResolvedValue({ filePath: '/saved.mp4' })
  })

  afterEach(() => cleanup())

  it('renders a video element and can save', async () => {
    render(<LocalMediaVideo filePath="/film.mp4" />)
    await waitFor(() =>
      expect(api.media.toPreviewUrl).toHaveBeenCalledWith('/film.mp4')
    )
    const video = document.querySelector('video')
    expect(video).toBeTruthy()
    expect(video?.getAttribute('src')).toBe('blob:film')
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'characters.photoBookSaveFilm' })
      )
    })
    await waitFor(() =>
      expect(api.media.saveAs).toHaveBeenCalledWith('/film.mp4')
    )
  })

  it('returns null without a path', () => {
    const { container } = render(<LocalMediaVideo filePath="  " />)
    expect(container.firstChild).toBeNull()
  })
})
