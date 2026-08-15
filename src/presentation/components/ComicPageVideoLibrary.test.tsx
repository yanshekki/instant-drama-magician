import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ComicPageVideoLibrary } from './ComicPageVideoLibrary'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: { n?: number }) =>
      opts?.n != null ? `${k}:${opts.n}` : k,
    i18n: { language: 'en' }
  })
}))
vi.mock('../../lib/api', () => ({
  getApi: () => ({
    media: {
      toPreviewUrl: vi.fn().mockRejectedValue(new Error('no preview'))
    }
  })
}))
vi.mock('../context/ToastContext', () => ({
  useToast: () => ({
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn()
  })
}))
vi.mock('./LocalMediaImage', () => ({
  LocalMediaImage: () => <div>still</div>
}))

describe('ComicPageVideoLibrary', () => {
  it('shows empty generate card and version grid', () => {
    const onGenerate = vi.fn()
    const { rerender } = render(
      <ComicPageVideoLibrary
        videos={[]}
        canGenerate
        onGenerate={onGenerate}
        onPlay={vi.fn()}
        onSetPrimary={vi.fn()}
        onDelete={vi.fn()}
      />
    )
    expect(screen.getByText('comics.videoLibrary')).toBeTruthy()
    expect(screen.getByText('comics.emptyVideos')).toBeTruthy()
    screen.getAllByRole('button', { name: 'comics.pageVideo' })[0]!.click()
    expect(onGenerate).toHaveBeenCalled()

    rerender(
      <ComicPageVideoLibrary
        videos={[
          {
            id: 'v2',
            path: '/b.mp4',
            scheme: 'drama',
            createdAt: '2026-01-02T00:00:00.000Z'
          },
          {
            id: 'v1',
            path: '/a.mp4',
            scheme: 'page',
            createdAt: '2026-01-01T00:00:00.000Z'
          }
        ]}
        primaryPath="/b.mp4"
        stillPath="/p.png"
        canGenerate
        onGenerate={onGenerate}
        onPlay={vi.fn()}
        onSetPrimary={vi.fn()}
        onDelete={vi.fn()}
      />
    )
    expect(screen.getByText('comics.videoCount:2')).toBeTruthy()
    expect(screen.getByText('comics.versionN:2')).toBeTruthy()
    expect(screen.getByText('comics.schemeDramaTitle')).toBeTruthy()
    expect(screen.getAllByText('comics.isPrimary').length).toBeGreaterThan(0)
    expect(screen.getByText('comics.newVersion')).toBeTruthy()
  })
})
