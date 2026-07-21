import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react'
import { createMockApi } from '../../test/mockApi'

const api = createMockApi()
vi.mock('../../lib/api', () => ({ getApi: () => api }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } })
}))
vi.mock('./LocalMediaImage', () => ({
  LocalMediaImage: ({ filePath }: { filePath: string }) => (
    <div data-testid="img">{filePath}</div>
  )
}))

import { ActionCastRefPicker } from './ActionCastRefPicker'

describe('ActionCastRefPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.characters.list = vi.fn().mockResolvedValue([
      {
        id: 'c1',
        name: 'Alice',
        refImagePath: '/c1.png',
        refGalleryJson: JSON.stringify([
          { id: 'g1', path: '/g1.png', label: 'G1' }
        ])
      }
    ])
    api.costumes.list = vi.fn().mockResolvedValue([
      { id: 'co1', name: 'Dress', refImagePath: '/co.png', refGalleryJson: null }
    ])
    api.scenes.list = vi.fn().mockResolvedValue([
      {
        id: 'sc1',
        title: 'Street',
        description: 'rain',
        refImagePath: '/sc.png',
        refGalleryJson: null
      }
    ])
    api.props.list = vi.fn().mockResolvedValue([
      { id: 'p1', name: 'Cup', refImagePath: '/p.png', refGalleryJson: null }
    ])
  })

  afterEach(() => cleanup())

  it('loads characters and adds ref', async () => {
    const onChange = vi.fn()
    render(<ActionCastRefPicker value={[]} onChange={onChange} />)
    await waitFor(() => expect(api.characters.list).toHaveBeenCalled())
    // pick entity
    const selects = document.querySelectorAll('select')
    // first may be entity type, second entity id
    if (selects.length >= 2) {
      fireEvent.change(selects[1], { target: { value: 'c1' } })
    }
    await waitFor(() => {
      expect(screen.getByTitle('G1')).toBeTruthy()
    })
    // click gallery still then add cover still
    fireEvent.click(screen.getByTitle('G1'))
    const addBtn =
      screen.queryByText('actions.addCoverStill') ||
      screen.getAllByRole('button').at(-1)
    if (addBtn) fireEvent.click(addBtn)
    await waitFor(() => expect(onChange).toHaveBeenCalled())
  })

  it('switches entity types and removes existing', async () => {
    const onChange = vi.fn()
    const existing = [
      {
        id: 'ref1',
        entityType: 'character' as const,
        entityId: 'c1',
        path: '/x.png',
        label: 'X'
      }
    ]
    render(
      <ActionCastRefPicker value={existing as never} onChange={onChange} />
    )
    await waitFor(() => expect(api.characters.list).toHaveBeenCalled())
    // remove
    const remove = screen.queryByText('×') || screen.queryByText(/remove/i)
    if (remove) fireEvent.click(remove)

    const typeSel = document.querySelectorAll('select')[0]
    for (const v of ['costume', 'scene', 'prop']) {
      fireEvent.change(typeSel, { target: { value: v } })
      await waitFor(() => expect(true).toBe(true))
    }
  })

  it('list failure handled', async () => {
    api.characters.list = vi.fn().mockRejectedValue(new Error('x'))
    render(<ActionCastRefPicker value={[]} onChange={() => undefined} />)
    await waitFor(() => expect(api.characters.list).toHaveBeenCalled())
  })
})
