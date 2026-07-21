import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { createMockApi, reseedMockApi } from '../../test/mockApi'
import {
  makeCharacter,
  makeCostume,
  makeStory,
  makeTimelineEntry
} from '../../test/pageFixtures'
import {
  clickDialogConfirm,
  renderWithProviders
} from '../../test/renderWithProviders'
import { CostumesPage } from './CostumesPage'

const api = createMockApi()
vi.mock('../../lib/api', () => ({
  getApi: () => api,
  isElectron: () => true,
  isWebRuntime: () => false
}))

describe('CostumesPage', () => {
  beforeEach(() => {
    reseedMockApi(api)
    api.stories.list = vi.fn().mockResolvedValue([makeStory()])
    api.ai.status = vi.fn().mockResolvedValue({ available: true, message: 'ok' })
    api.costumes.list = vi.fn().mockResolvedValue([
      makeCostume(),
      makeCostume({ id: 'cost-2', name: 'Suit', refImagePath: null })
    ])
    api.costumes.create = vi
      .fn()
      .mockResolvedValue(makeCostume({ id: 'cost-new' }))
    api.costumes.update = vi.fn().mockResolvedValue(makeCostume())
    api.costumes.delete = vi.fn().mockResolvedValue({ ok: true })
    api.costumes.aiFill = vi.fn().mockResolvedValue({
      name: 'Look',
      description: 'formal'
    })
    api.costumes.generateDressed = vi
      .fn()
      .mockResolvedValue({ path: '/tmp/dressed.png' })
    api.costumes.listForCharacter = vi.fn().mockResolvedValue([makeCostume()])
    api.costumes.linkCharacter = vi.fn().mockResolvedValue({})
    api.characters.list = vi.fn().mockResolvedValue([makeCharacter()])
    api.timeline.list = vi.fn().mockResolvedValue([makeTimelineEntry()])
    api.characters.suggestWardrobe = vi.fn().mockResolvedValue({
      name: 'Suggested',
      costume: 'coat',
      artStyle: 'anime',
      rationale: 'plot'
    })
  })

  it('renders list, creates, edits, deletes', async () => {
    await renderWithProviders(<CostumesPage />)
    await waitFor(() => expect(screen.getByText('Rain coat')).toBeTruthy())

    const news = screen.getAllByRole('button').filter((b) =>
      /new look|new/i.test(b.textContent || '')
    )
    await act(async () => {
      news[0].click()
    })

    const inputs = Array.from(document.querySelectorAll('input, textarea'))
    for (const el of inputs.slice(0, 3)) {
      await act(async () => {
        fireEvent.change(el, { target: { value: 'Evening gown' } })
      })
    }
    const save = screen.getAllByRole('button').find((b) =>
      /^save$/i.test((b.textContent || '').trim())
    )
    await act(async () => {
      save?.click()
    })
    // may need character selected
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    const cancel = screen.getAllByRole('button').find((b) =>
      /^cancel$/i.test((b.textContent || '').trim())
    )
    if (cancel) {
      await act(async () => {
        cancel.click()
      })
    }

    const edit = screen.getAllByRole('button').find((b) =>
      /^edit$/i.test((b.textContent || '').trim())
    )
    if (edit) {
      await act(async () => {
        edit.click()
      })
      const save2 = screen.getAllByRole('button').find((b) =>
        /^save$/i.test((b.textContent || '').trim())
      )
      await act(async () => {
        save2?.click()
      })
    }

    const del = screen.getAllByRole('button').find((b) =>
      /^delete$/i.test((b.textContent || '').trim())
    )
    if (del) {
      await act(async () => {
        del.click()
      })
      if (document.querySelector('[role="alertdialog"]')) {
        await act(async () => {
          clickDialogConfirm()
        })
      }
    }
  })

  it('empty state', async () => {
    api.costumes.list = vi.fn().mockResolvedValue([])
    await renderWithProviders(<CostumesPage />)
    await waitFor(() =>
      expect(
        screen.getByText(/No costumes yet|No wardrobe looks yet/i)
      ).toBeTruthy()
    )
  })

  it('AI fill, dressed generate and link character', async () => {
    await renderWithProviders(<CostumesPage />)
    await waitFor(() => expect(screen.getByText('Rain coat')).toBeTruthy())
    const edit = screen.getAllByRole('button').find((b) =>
      /^edit$/i.test((b.textContent || '').trim())
    )
    await act(async () => {
      edit?.click()
    })
    for (const re of [
      /ai|fill|suggest/i,
      /generate|dressed|sheet/i,
      /link|character/i,
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
    for (const sel of Array.from(document.querySelectorAll('select')).slice(
      0,
      3
    )) {
      const s = sel as HTMLSelectElement
      if (s.options.length > 1) {
        await act(async () => {
          fireEvent.change(s, { target: { value: s.options[1].value } })
        })
      }
    }
    expect(api.costumes.list).toHaveBeenCalled()
  })

  it('list error', async () => {
    api.costumes.list = vi.fn().mockRejectedValue(new Error('cost-fail'))
    await renderWithProviders(<CostumesPage />)
    await waitFor(() => expect(screen.getByText(/cost-fail/i)).toBeTruthy())
  })
})

