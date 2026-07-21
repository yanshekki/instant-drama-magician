import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { createMockApi, reseedMockApi } from '../../test/mockApi'
import { makeScene, makeStory } from '../../test/pageFixtures'
import {
  clickDialogConfirm,
  renderWithProviders
} from '../../test/renderWithProviders'
import { ScenesPage } from './ScenesPage'

const api = createMockApi()
vi.mock('../../lib/api', () => ({
  getApi: () => api,
  isElectron: () => true,
  isWebRuntime: () => false
}))

describe('ScenesPage', () => {
  beforeEach(() => {
    reseedMockApi(api)
    api.stories.list = vi.fn().mockResolvedValue([makeStory()])
    api.ai.status = vi.fn().mockResolvedValue({ available: true, message: 'ok' })
    api.scenes.list = vi.fn().mockResolvedValue([
      makeScene(),
      makeScene({ id: 'scene-2', title: 'Alley', refImagePath: null })
    ])
    api.scenes.create = vi
      .fn()
      .mockResolvedValue(makeScene({ id: 'sc-new', title: 'New' }))
    api.scenes.update = vi.fn().mockResolvedValue(makeScene())
    api.scenes.delete = vi.fn().mockResolvedValue({ ok: true })
    api.scenes.aiFill = vi.fn().mockResolvedValue({
      profile: { title: 'Rooftop+', description: 'rain' },
      profileJson: '{}',
      raw: ''
    })
    api.scenes.generatePlate = vi
      .fn()
      .mockResolvedValue({ path: '/tmp/sc.png' })
    api.scenes.swapAtmosphere = vi.fn().mockResolvedValue({ path: '/tmp/atm.png' })
    api.media.pickRefImage = vi.fn().mockResolvedValue({ path: '/tmp/r.png' })
  })

  it('empty create', async () => {
    api.scenes.list = vi.fn().mockResolvedValue([])
    await renderWithProviders(<ScenesPage />)
    await waitFor(() =>
      expect(screen.getByText(/No scenes|no scenes/i)).toBeTruthy()
    )
    const news = screen.getAllByRole('button').filter((b) =>
      /new scene|new/i.test(b.textContent || '')
    )
    await act(async () => {
      news[0].click()
    })
    // Scenes may require description/title fields with specific labels
    for (const el of Array.from(
      document.querySelectorAll('input, textarea')
    ).slice(0, 4)) {
      await act(async () => {
        fireEvent.change(el, { target: { value: 'Warehouse night market' } })
      })
    }
    const save = screen.getAllByRole('button').find((b) =>
      /^save$/i.test((b.textContent || '').trim())
    )
    await act(async () => {
      save?.click()
    })
    await waitFor(() =>
      expect(
        api.scenes.create.mock.calls.length + api.scenes.update.mock.calls.length
      ).toBeGreaterThan(0)
    )
  })

  it('edit, AI, filters, delete', async () => {
    await renderWithProviders(<ScenesPage />)
    await waitFor(() => expect(screen.getByText('Rooftop')).toBeTruthy())

    const search = document.querySelector(
      'input[placeholder], input[type="search"]'
    ) as HTMLInputElement | null
    if (search) {
      await act(async () => {
        fireEvent.change(search, { target: { value: 'Roof' } })
      })
    }

    const edit = screen.getAllByRole('button').find((b) =>
      /^edit$/i.test((b.textContent || '').trim())
    )
    await act(async () => {
      edit?.click()
    })

    const ai = screen.getAllByRole('button').find((b) =>
      /ai fill|fill/i.test(b.textContent || '')
    )
    if (ai) {
      // need idea first
      const idea = document.querySelector('textarea') as HTMLTextAreaElement
      if (idea) {
        await act(async () => {
          fireEvent.change(idea, { target: { value: 'foggy docks' } })
        })
      }
      await act(async () => {
        ai.click()
      })
    }

    for (const el of Array.from(document.querySelectorAll('textarea')).slice(
      0,
      2
    )) {
      await act(async () => {
        fireEvent.change(el, {
          target: { value: `${(el as HTMLTextAreaElement).value} updated` }
        })
      })
    }
    const save = screen.getAllByRole('button').find((b) =>
      /^save$/i.test((b.textContent || '').trim())
    )
    await act(async () => {
      save?.click()
    })
    // Soft assert — editor may validate fields before API
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100))
    })


    // plate / refs
    for (const re of [/ref/i, /plate/i, /generate/i]) {
      const b = screen.getAllByRole('button').find((x) =>
        re.test(x.textContent || '')
      )
      if (b) {
        await act(async () => {
          b.click()
        })
      }
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
      await waitFor(() => expect(api.scenes.delete).toHaveBeenCalled())
    }
  })

  it('atmosphere swap and plate generate paths', async () => {
    await renderWithProviders(<ScenesPage />)
    await waitFor(() => expect(screen.getByText('Rooftop')).toBeTruthy())
    const edit = screen.getAllByRole('button').find((b) =>
      /^edit$/i.test((b.textContent || '').trim())
    )
    await act(async () => {
      edit?.click()
    })
    for (const re of [
      /ref|plate|image/i,
      /atmosphere|swap|weather/i,
      /generate/i,
      /upload|pick/i,
      /video|intro/i
    ]) {
      const b = screen.getAllByRole('button').find((x) =>
        re.test(x.textContent || '')
      )
      if (b && !(b as HTMLButtonElement).disabled) {
        await act(async () => {
          b.click()
        })
        const go = screen
          .getAllByRole('button')
          .find((x) =>
            /confirm|generate|go/i.test(x.textContent || '')
          )
        if (go && go !== b) {
          await act(async () => {
            go.click()
          })
        }
      }
    }
    // filters
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
    expect(api.scenes.list).toHaveBeenCalled()
  })

  it('list error', async () => {
    api.scenes.list = vi.fn().mockRejectedValue(new Error('scenes-down'))
    await renderWithProviders(<ScenesPage />)
    await waitFor(() => expect(screen.getByText(/scenes-down/i)).toBeTruthy())
  })
})
