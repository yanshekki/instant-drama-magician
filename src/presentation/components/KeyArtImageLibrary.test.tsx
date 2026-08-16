import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { KeyArtImageLibrary } from './KeyArtImageLibrary'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: { n?: number }) =>
      opts?.n != null ? `${k}:${opts.n}` : k,
    i18n: { language: 'en' }
  })
}))
vi.mock('../../lib/api', () => ({
  getApi: () => ({
    media: { toPreviewUrl: vi.fn().mockRejectedValue(new Error('no')) }
  })
}))
vi.mock('./LocalMediaImage', () => ({
  LocalMediaImage: () => <div>still</div>
}))

describe('KeyArtImageLibrary', () => {
  it('shows empty generate and version grid', () => {
    const onGenerate = vi.fn()
    const { rerender } = render(
      <KeyArtImageLibrary
        images={[]}
        canGenerate
        onGenerate={onGenerate}
        onSetPrimary={vi.fn()}
        onDelete={vi.fn()}
      />
    )
    expect(screen.getByText('keyArt.imageLibrary')).toBeTruthy()
    screen.getAllByRole('button', { name: 'keyArt.generate' })[0]!.click()
    expect(onGenerate).toHaveBeenCalled()
    rerender(
      <KeyArtImageLibrary
        images={[
          {
            id: 'v2',
            path: '/b.png',
            method: 'edit',
            createdAt: '2026-01-02T00:00:00.000Z'
          },
          {
            id: 'v1',
            path: '/a.png',
            method: 'fresh',
            createdAt: '2026-01-01T00:00:00.000Z'
          }
        ]}
        primaryPath="/b.png"
        canGenerate
        onGenerate={onGenerate}
        onSetPrimary={vi.fn()}
        onDelete={vi.fn()}
      />
    )
    expect(screen.getByText('keyArt.imageCount:2')).toBeTruthy()
    expect(screen.getByText('keyArt.methodEditTitle')).toBeTruthy()
  })
})
