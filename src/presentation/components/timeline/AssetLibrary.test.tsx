import { describe, expect, it, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } })
}))

import { AssetLibrary } from './AssetLibrary'

const characters = [
  { id: 'c1', name: 'Alice', description: 'hero' }
] as never[]
const scenes = [
  {
    id: 'sc1',
    title: 'Street',
    description: 'rain',
    sceneNumber: 1
  }
] as never[]
const props = [{ id: 'p1', name: 'Cup', description: 'ceramic' }] as never[]
const actions = [{ id: 'a1', name: 'Run', description: 'fast' }] as never[]

describe('AssetLibrary', () => {
  afterEach(() => cleanup())

  it('lists characters and adds on click; switches tabs', () => {
    const onAdd = vi.fn()
    const onOpen = vi.fn()
    render(
      <AssetLibrary
        characters={characters}
        scenes={scenes}
        props={props}
        actions={actions}
        onAdd={onAdd}
        onOpenStoryEditor={onOpen}
      />
    )
    fireEvent.click(screen.getByText('Alice'))
    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'character', id: 'c1' })
    )

    fireEvent.click(screen.getByText(/timeline.scene/))
    expect(screen.getByText(/#1 Street/)).toBeTruthy()
    fireEvent.click(screen.getByText(/#1 Street/))
    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'scene' })
    )

    fireEvent.click(screen.getByText(/timeline.prop/))
    fireEvent.click(screen.getByText('Cup'))
    fireEvent.click(screen.getByText(/timeline.action/))
    fireEvent.click(screen.getByText('Run'))

    // search filter
    fireEvent.change(screen.getByPlaceholderText('timeline.searchCast'), {
      target: { value: 'zzzz' }
    })
    expect(screen.getByText('timeline.searchNoResults')).toBeTruthy()
  })

  it('empty cast shows open editor', () => {
    const onOpen = vi.fn()
    render(
      <AssetLibrary
        characters={[]}
        scenes={[]}
        props={[]}
        actions={[]}
        onAdd={() => undefined}
        onOpenStoryEditor={onOpen}
      />
    )
    fireEvent.click(screen.getByText('timeline.openStoryEditor'))
    expect(onOpen).toHaveBeenCalled()
  })

  it('drag start sets data', () => {
    const setData = vi.fn()
    render(
      <AssetLibrary
        characters={characters}
        scenes={[]}
        props={[]}
        onAdd={() => undefined}
      />
    )
    fireEvent.dragStart(screen.getByText('Alice'), {
      dataTransfer: { setData, effectAllowed: 'copy' }
    })
    expect(setData).toHaveBeenCalled()
  })
})
