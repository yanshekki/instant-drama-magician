import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { PhotoBookAlbumBar } from './PhotoBookAlbumBar'
import type { PhotoBookAlbum } from '../../domain/characterPhotoBook'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: { n?: number }) =>
      opts?.n != null ? `${k}:${opts.n}` : k
  })
}))

const albums: PhotoBookAlbum[] = [
  { id: 'album_default', name: '', shots: [] },
  { id: 'pba_night', name: 'Night', shots: [] }
]

describe('PhotoBookAlbumBar', () => {
  it('selects, adds, renames, and deletes albums', () => {
    const onSelect = vi.fn()
    const onAdd = vi.fn()
    const onRename = vi.fn()
    const onDelete = vi.fn()
    render(
      <PhotoBookAlbumBar
        albums={albums}
        selectedId="pba_night"
        canDelete
        onSelect={onSelect}
        onAdd={onAdd}
        onRename={onRename}
        onDelete={onDelete}
      />
    )
    expect(screen.getByText('characters.photoBookDefaultAlbum')).toBeTruthy()
    fireEvent.click(screen.getByText('Night'))
    expect(onSelect).toHaveBeenCalledWith('pba_night')
    fireEvent.click(screen.getByLabelText('characters.photoBookAddAlbum'))
    expect(onAdd).toHaveBeenCalled()
    fireEvent.click(screen.getByLabelText('characters.photoBookRenameAlbum'))
    const input = screen.getByLabelText(
      'characters.photoBookRenameAlbum'
    ) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Dawn' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onRename).toHaveBeenCalledWith('pba_night', 'Dawn')
    fireEvent.click(screen.getByLabelText('characters.photoBookDeleteAlbum'))
    expect(onDelete).toHaveBeenCalledWith('pba_night')
  })
})
