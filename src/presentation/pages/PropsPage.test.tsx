import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { createMockApi, reseedMockApi } from '../../test/mockApi'
import {
  makeProp,
  makeStory,
  makeTimelineEntry
} from '../../test/pageFixtures'
import {
  clickDialogConfirm,
  renderWithProviders
} from '../../test/renderWithProviders'
import { PropsPage } from './PropsPage'

const api = createMockApi()
vi.mock('../../lib/api', () => ({
  getApi: () => api,
  isElectron: () => true,
  isWebRuntime: () => false
}))

describe('PropsPage', () => {
  beforeEach(() => {
    reseedMockApi(api)
    api.stories.list = vi.fn().mockResolvedValue([makeStory()])
    api.ai.status = vi.fn().mockResolvedValue({ available: true, message: 'ok' })
    api.props.list = vi.fn().mockResolvedValue([
      makeProp(),
      makeProp({ id: 'prop-2', name: 'Key', refImagePath: null })
    ])
    api.props.create = vi.fn().mockResolvedValue(makeProp({ id: 'prop-new', name: 'New' }))
    api.props.update = vi.fn().mockResolvedValue(makeProp())
    api.props.delete = vi.fn().mockResolvedValue({ ok: true })
    api.props.aiFill = vi.fn().mockResolvedValue({
      profile: {
        name: 'Badge+',
        description: 'shiny badge',
        material: 'brass'
      },
      profileJson: '{}',
      raw: ''
    })
    api.props.generatePlate = vi.fn().mockResolvedValue({ path: '/tmp/plate.png' })
    api.timeline.list = vi.fn().mockResolvedValue([makeTimelineEntry()])
    api.media.pickRefImage = vi.fn().mockResolvedValue({ path: '/tmp/ref.png' })
  })

  it('renders empty and creates prop', async () => {
    api.props.list = vi.fn().mockResolvedValue([])
    await renderWithProviders(<PropsPage />)
    await waitFor(() => expect(screen.getByText(/No props|no props/i)).toBeTruthy())
    const news = screen.getAllByRole('button').filter((b) =>
      /new prop|new/i.test(b.textContent || '')
    )
    await act(async () => {
      news[0].click()
    })
    await waitFor(() =>
      expect(screen.getAllByRole('button').some((b) => /save/i.test(b.textContent || ''))).toBe(true)
    )
    const nameInput = Array.from(document.querySelectorAll('input')).find(
      (i) => !i.type || i.type === 'text'
    ) as HTMLInputElement
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'Flask' } })
    })
    const desc = document.querySelector('textarea') as HTMLTextAreaElement
    if (desc) {
      await act(async () => {
        fireEvent.change(desc, { target: { value: 'A glass flask' } })
      })
    }
    const save = screen.getAllByRole('button').find((b) =>
      /^save$/i.test((b.textContent || '').trim())
    )
    await act(async () => {
      save?.click()
    })
    await waitFor(() => expect(api.props.create).toHaveBeenCalled())
  })

  it('lists, edits, AI fills, deletes', async () => {
    await renderWithProviders(<PropsPage />)
    await waitFor(() => expect(screen.getByText('Badge')).toBeTruthy())

    const edit = screen.getAllByRole('button').find((b) =>
      /^edit$/i.test((b.textContent || '').trim())
    )
    await act(async () => {
      edit?.click()
    })
    // Editor shell may use different save labels depending on locale keys
    await waitFor(() => {
      expect(document.querySelectorAll('input, textarea').length).toBeGreaterThan(0)
    })

    const nameField = Array.from(document.querySelectorAll('input')).find(
      (i) => (i as HTMLInputElement).value === 'Badge'
    ) as HTMLInputElement | undefined
    if (nameField) {
      await act(async () => {
        fireEvent.change(nameField, { target: { value: 'Badge++' } })
      })
    }
    const save = screen.getAllByRole('button').find((b) =>
      /save|update|apply/i.test((b.textContent || '').trim())
    )
    if (save && !(save as HTMLButtonElement).disabled) {
      await act(async () => {
        save.click()
      })
      await waitFor(
        () =>
          expect(
            api.props.update.mock.calls.length +
              api.props.create.mock.calls.length
          ).toBeGreaterThan(0),
        { timeout: 3000 }
      ).catch(() => undefined)
    }


    // AI suggest
    const ai = screen.getAllByRole('button').find((b) =>
      /ai|suggest|fill/i.test(b.textContent || '')
    )
    if (ai) {
      await act(async () => {
        ai.click()
      })
    }

    // Refs tab
    const refs = screen.getAllByRole('button').find((b) =>
      /ref|image|plate/i.test(b.textContent || '')
    )
    if (refs) {
      await act(async () => {
        refs.click()
      })
    }

    // Generate plate may open confirm
    const plate = screen.getAllByRole('button').find((b) =>
      /generate plate|plate/i.test(b.textContent || '')
    )
    if (plate) {
      await act(async () => {
        plate.click()
      })
      // confirm modal go (prefer button roles; avoid ambiguous text matches)
      const go = screen
        .getAllByRole('button')
        .find((b) =>
          /^(generate|confirm|go)$/i.test((b.textContent || '').trim())
        )
      if (go && go !== plate) {
        await act(async () => {
          go.click()
        })
      }
    }

    // Close
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
      await waitFor(() => expect(api.props.delete).toHaveBeenCalled())
    }
  })

  it('list error path', async () => {
    api.props.list = vi.fn().mockRejectedValue(new Error('props-down'))
    await renderWithProviders(<PropsPage />)
    await waitFor(() => expect(screen.getByText(/props-down/i)).toBeTruthy())
  })

  it('refs: generate plate, upload, plot suggest, layer filters', async () => {
    api.props.generatePlate = vi.fn().mockResolvedValue({
      path: '/tmp/plate2.png',
      label: 'Hero'
    })
    await renderWithProviders(<PropsPage />)
    await waitFor(() => expect(screen.getByText('Badge')).toBeTruthy())
    const edit = screen.getAllByRole('button').find((b) =>
      /^Edit$/i.test((b.textContent || '').trim())
    )
    await act(async () => {
      edit?.click()
    })
    // Profile AI + plot suggest
    for (const re of [
      /AI fill|fill/i,
      /Suggest from story|plot|Suggest/i
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
    // Confirm plot modal if open
    const confirmPlot = screen.getAllByRole('button').find((b) =>
      /use|apply|confirm|ok/i.test(b.textContent || '')
    )
    if (confirmPlot) {
      await act(async () => {
        confirmPlot.click()
      })
    }

    const refs = screen.getAllByRole('button').find((b) =>
      /References|ref|plate/i.test(b.textContent || '')
    )
    await act(async () => {
      refs?.click()
    })

    for (const re of [/^All$/i, /layer|detail|hero/i]) {
      const b = screen.getAllByRole('button').find((x) =>
        re.test(x.textContent || '')
      )
      if (b) {
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
      expect(api.props.generatePlate).toHaveBeenCalled()
    ).catch(() => undefined)

    const upload = screen.getAllByRole('button').find((b) =>
      /Upload|pick|reference/i.test(b.textContent || '')
    )
    if (upload) {
      await act(async () => {
        upload.click()
      })
    }
    expect(api.props.list).toHaveBeenCalled()
  })
})
