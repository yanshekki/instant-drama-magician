import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EntityGalleryPanel, EntityGalleryLayerChip } from './EntityGalleryPanel'

vi.mock('./LocalMediaImage', () => ({
  LocalMediaImage: ({
    filePath,
    onSetAsCover,
    onRemove
  }: {
    filePath?: string | null
    onSetAsCover?: () => void
    onRemove?: () => void
  }) => (
    <div data-testid="preview">
      <span>{filePath}</span>
      {onSetAsCover ? (
        <button type="button" onClick={onSetAsCover}>
          cover
        </button>
      ) : null}
      {onRemove ? (
        <button type="button" onClick={onRemove}>
          remove
        </button>
      ) : null}
    </div>
  )
}))

vi.mock('./GalleryThumbStrip', () => ({
  GalleryThumbStrip: ({
    items,
    onSelect
  }: {
    items: Array<{ id: string }>
    onSelect: (id: string) => void
  }) =>
    items.length === 0 ? null : (
      <div data-testid="strip">
        {items.map((i) => (
          <button key={i.id} type="button" onClick={() => onSelect(i.id)}>
            {i.id}
          </button>
        ))}
      </div>
    )
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string) => k
  })
}))

const items = [
  { id: 'a', path: '/a.png', label: 'A' },
  { id: 'b', path: '/b.png', label: 'B' }
]

describe('EntityGalleryPanel', () => {
  it('renders empty state with actions when no preview', () => {
    const onUpload = vi.fn()
    render(
      <EntityGalleryPanel
        title="Gallery"
        emptyMessage="No photos"
        emptyActions={[
          { label: 'Upload', onClick: onUpload, variant: 'secondary' }
        ]}
        items={[]}
        selectedId={null}
        onSelect={() => undefined}
        onReorder={() => undefined}
      />
    )
    expect(screen.getByText('No photos')).toBeTruthy()
    fireEvent.click(screen.getByText('Upload'))
    expect(onUpload).toHaveBeenCalled()
    expect(screen.queryByTestId('preview')).toBeNull()
  })

  it('renders preview, strip, cover/remove, identity and footer', () => {
    const onSelect = vi.fn()
    const onCover = vi.fn()
    const onRemove = vi.fn()
    const onIdentity = vi.fn()
    const onFooter = vi.fn()
    render(
      <EntityGalleryPanel
        title="Looks"
        countLabel="2"
        previewPath="/a.png"
        previewAlt="A"
        onSetAsCover={onCover}
        onRemove={onRemove}
        isCover
        emptyMessage="empty"
        items={items}
        selectedId="a"
        selectedIds={['a']}
        multiSelect
        coverPath="/a.png"
        onSelect={onSelect}
        onToggleSelect={() => undefined}
        onReorder={() => undefined}
        identityRef={{
          checked: true,
          onChange: onIdentity
        }}
        footerActions={[
          { label: 'Gen cover', onClick: onFooter, variant: 'primary' }
        ]}
        layerFilter={
          <EntityGalleryLayerChip
            active
            label="all"
            onClick={() => undefined}
          />
        }
      />
    )
    expect(screen.getByText('Looks')).toBeTruthy()
    expect(screen.getByText('2')).toBeTruthy()
    expect(screen.getByTestId('preview')).toBeTruthy()
    expect(screen.getByTestId('strip')).toBeTruthy()
    fireEvent.click(screen.getByText('cover'))
    fireEvent.click(screen.getByText('remove'))
    fireEvent.click(screen.getByText('b'))
    expect(onCover).toHaveBeenCalled()
    expect(onRemove).toHaveBeenCalled()
    expect(onSelect).toHaveBeenCalledWith('b')
    fireEvent.click(screen.getByRole('checkbox'))
    expect(onIdentity).toHaveBeenCalledWith(false)
    fireEvent.click(screen.getByText('Gen cover'))
    expect(onFooter).toHaveBeenCalled()
  })
})
