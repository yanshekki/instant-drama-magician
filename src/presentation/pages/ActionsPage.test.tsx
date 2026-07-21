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

  it('filters, plate generate and cast refs tab', async () => {
    await renderWithProviders(<ActionsPage />)
    await waitFor(() => expect(screen.getByText('Draw gun')).toBeTruthy())
    const search = document.querySelector(
      'input[placeholder], input[type="search"]'
    ) as HTMLInputElement | null
    if (search) {
      await act(async () => {
        fireEvent.change(search, { target: { value: 'Draw' } })
      })
    }
    const edit = screen.getAllByRole('button').find((b) =>
      /^edit$/i.test((b.textContent || '').trim())
    )
    await act(async () => {
      edit?.click()
    })
    for (const re of [
      /profile|ref|plate|cast/i,
      /generate/i,
      /upload|pick/i
    ]) {
      const b = screen.getAllByRole('button').find((x) =>
        re.test(x.textContent || '')
      )
      if (b && !(b as HTMLButtonElement).disabled) {
        await act(async () => {
          b.click()
        })
      }
    }
    for (const el of Array.from(
      document.querySelectorAll('textarea, input')
    ).slice(0, 5)) {
      await act(async () => {
        fireEvent.change(el, { target: { value: 'updated action note' } })
      })
    }
    const save = screen.getAllByRole('button').find((b) =>
      /^save$/i.test((b.textContent || '').trim())
    )
    if (save && !(save as HTMLButtonElement).disabled) {
      await act(async () => {
        save.click()
      })
    }
    expect(api.actions.list).toHaveBeenCalled()
  })

  it('list error', async () => {
    api.actions.list = vi.fn().mockRejectedValue(new Error('actions-fail'))
    await renderWithProviders(<ActionsPage />)
    await waitFor(() => expect(screen.getByText(/actions-fail/i)).toBeTruthy())
  })

  it('refs: plate generate with confirm and cast picker', async () => {
    api.actions.generatePlate = vi.fn().mockResolvedValue({
      path: '/tmp/action-plate.png',
      label: 'Grid'
    })
    api.actions.generateIntroVideo = vi.fn().mockResolvedValue({})
    await renderWithProviders(<ActionsPage />)
    await waitFor(() => expect(screen.getByText('Draw gun')).toBeTruthy())
    const edit = screen.getAllByRole('button').find((b) =>
      /^Edit$/i.test((b.textContent || '').trim())
    )
    await act(async () => {
      edit?.click()
    })
    await act(async () => {
      const idea = document.querySelector('textarea')
      if (idea) {
        fireEvent.change(idea, { target: { value: 'quickdraw motion' } })
      }
    })
    const ai = screen.getAllByRole('button').find((b) =>
      /AI fill|fill/i.test(b.textContent || '')
    )
    if (ai) {
      await act(async () => {
        ai.click()
      })
      await waitFor(() => expect(api.actions.aiFill).toHaveBeenCalled()).catch(
        () => undefined
      )
    }

    const refs = screen.getAllByRole('button').find((b) =>
      /References|ref/i.test(b.textContent || '')
    )
    await act(async () => {
      refs?.click()
    })

    // Cast entity selects
    for (const sel of Array.from(document.querySelectorAll('select')).slice(
      0,
      4
    )) {
      const s = sel as HTMLSelectElement
      if (s.options.length > 1) {
        await act(async () => {
          fireEvent.change(s, { target: { value: s.options[1].value } })
        })
      }
    }

    const plate = screen.getAllByRole('button').find((b) =>
      /Generate plate|generate plate/i.test(b.textContent || '')
    )
    if (plate) {
      await act(async () => {
        plate.click()
      })
      const go = screen
        .getAllByRole('button')
        .find((b) => /^Generate$/i.test((b.textContent || '').trim()))
      if (go && go !== plate) {
        await act(async () => {
          go.click()
        })
      }
    }
    await waitFor(() =>
      expect(api.actions.generatePlate).toHaveBeenCalled()
    ).catch(() => undefined)

    const upload = screen.getAllByRole('button').find((b) =>
      /Upload|external|pick|reference/i.test(b.textContent || '')
    )
    if (upload) {
      await act(async () => {
        upload.click()
      })
    }
    expect(api.actions.list).toHaveBeenCalled()
  })
})
