import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { createMockApi, reseedMockApi } from '../../test/mockApi'
import {
  makeAction,
  makeCharacter,
  makeScene,
  makeStory
} from '../../test/pageFixtures'
import {
  clickDialogConfirm,
  renderWithProviders
} from '../../test/renderWithProviders'
import { ActionsPage } from './ActionsPage'

const api = createMockApi()
vi.mock('../../lib/api', () => ({
  getApi: () => api,
  isElectron: () => true,
  isWebRuntime: () => false
}))

describe('ActionsPage', () => {
  beforeEach(() => {
    reseedMockApi(api)
    api.stories.list = vi.fn().mockResolvedValue([makeStory()])
    api.ai.status = vi.fn().mockResolvedValue({ available: true, message: 'ok' })
    api.actions.list = vi.fn().mockResolvedValue([
      makeAction(),
      makeAction({ id: 'action-2', name: 'Jump' })
    ])
    api.actions.create = vi
      .fn()
      .mockResolvedValue(makeAction({ id: 'a-new', name: 'New' }))
    api.actions.update = vi.fn().mockResolvedValue(makeAction())
    api.actions.delete = vi.fn().mockResolvedValue({ ok: true })
    api.actions.aiFill = vi.fn().mockResolvedValue({
      profile: { name: 'Draw', description: 'quick draw' },
      profileJson: '{}',
      raw: ''
    })
    api.actions.generatePlate = vi
      .fn()
      .mockResolvedValue({ path: '/tmp/a.png' })
    api.characters.list = vi.fn().mockResolvedValue([makeCharacter()])
    api.scenes.list = vi.fn().mockResolvedValue([makeScene()])
  })

  it('empty create and list edit delete', async () => {
    api.actions.list = vi.fn().mockResolvedValue([])
    await renderWithProviders(<ActionsPage />)
    await waitFor(() =>
      expect(screen.getByText(/No action guides yet/i)).toBeTruthy()
    )
    const news = screen.getAllByRole('button').filter((b) =>
      /new/i.test(b.textContent || '')
    )
    await act(async () => {
      news[0].click()
    })
    const nameInput = document.querySelector('input') as HTMLInputElement
    if (nameInput) {
      await act(async () => {
        fireEvent.change(nameInput, { target: { value: 'Kick' } })
      })
    }
    const save = screen.getAllByRole('button').find((b) =>
      /^save$/i.test((b.textContent || '').trim())
    )
    await act(async () => {
      save?.click()
    })
    await waitFor(() => expect(api.actions.create).toHaveBeenCalled())
  })

  it('edit existing, AI, delete', async () => {
    await renderWithProviders(<ActionsPage />)
    await waitFor(() => expect(screen.getByText('Draw gun')).toBeTruthy())
    const edit = screen.getAllByRole('button').find((b) =>
      /^edit$/i.test((b.textContent || '').trim())
    )
    await act(async () => {
      edit?.click()
    })
    const save = screen.getAllByRole('button').find((b) =>
      /^save$/i.test((b.textContent || '').trim())
    )
    await act(async () => {
      save?.click()
    })
    await waitFor(() => expect(api.actions.update).toHaveBeenCalled())

    const ai = screen.getAllByRole('button').find((b) =>
      /ai|suggest|fill/i.test(b.textContent || '')
    )
    if (ai) {
      await act(async () => {
        ai.click()
      })
    }

    const cancel = screen.getAllByRole('button').find((b) =>
      /^cancel$/i.test((b.textContent || '').trim())
    )
    await act(async () => {
      cancel?.click()
    })

    const del = screen.getAllByRole('button').find((b) =>
      /^delete$/i.test((b.textContent || '').trim())
    )
    await act(async () => {
      del?.click()
    })
    if (document.querySelector('[role="alertdialog"]')) {
      await act(async () => {
        clickDialogConfirm()
      })
      await waitFor(() => expect(api.actions.delete).toHaveBeenCalled())
    }
  })
})
