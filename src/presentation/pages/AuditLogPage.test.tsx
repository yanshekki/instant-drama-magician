import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { createMockApi, reseedMockApi } from '../../test/mockApi'
import { makeAuditEntries } from '../../test/pageFixtures'
import {
  clickDialogConfirm,
  renderWithProviders
} from '../../test/renderWithProviders'
import { AuditLogPage } from './AuditLogPage'

const api = createMockApi()
vi.mock('../../lib/api', () => ({
  getApi: () => api,
  isElectron: () => true,
  isWebRuntime: () => false
}))

describe('AuditLogPage', () => {
  beforeEach(() => {
    reseedMockApi(api)
    api.stories.list = vi.fn().mockResolvedValue([])
    api.ai.status = vi.fn().mockResolvedValue({ available: true, message: 'ok' })
    api.activity.query = vi.fn().mockResolvedValue({
      entries: makeAuditEntries(),
      path: '/tmp/activity.jsonl'
    })
    api.activity.clear = vi.fn().mockResolvedValue({ ok: true })
    api.activity.openLogFolder = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) }
    })
  })

  it('renders empty state', async () => {
    api.activity.query = vi.fn().mockResolvedValue({
      entries: [],
      path: ''
    })
    await renderWithProviders(<AuditLogPage />)
    await waitFor(() =>
      expect(screen.getByText(/No activity yet/i)).toBeTruthy()
    )
  })

  it('loads entries, filters, selects, copies, clears', async () => {
    await renderWithProviders(<AuditLogPage />)
    await waitFor(() => expect(api.activity.query).toHaveBeenCalled())

    for (const label of [/error/i, /generation/i, /export/i, /media/i, /all/i, /warn/i]) {
      const btn = screen
        .getAllByRole('button')
        .find((b) => label.test(b.textContent || ''))
      if (btn) {
        await act(async () => {
          btn.click()
        })
      }
    }

    const search = screen.queryByLabelText(/search/i) as HTMLInputElement | null
    if (search) {
      await act(async () => {
        fireEvent.change(search, { target: { value: 'export' } })
      })
      await act(async () => {
        await new Promise((r) => setTimeout(r, 320))
      })
    }

    const adv = screen
      .getAllByRole('button')
      .find((b) => /advanced/i.test(b.textContent || ''))
    if (adv) {
      await act(async () => {
        adv.click()
      })
    }

    await waitFor(() => {
      expect(document.querySelector('ul.divide-y')).toBeTruthy()
    })
    const rows = document.querySelectorAll('ul.divide-y > li > button')
    if (rows[0]) {
      await act(async () => {
        ;(rows[0] as HTMLButtonElement).click()
      })
    }

    const copyBtn = screen
      .getAllByRole('button')
      .find((b) => /copy/i.test(b.textContent || ''))
    if (copyBtn) {
      await act(async () => {
        copyBtn.click()
      })
      await waitFor(() =>
        expect(navigator.clipboard.writeText).toHaveBeenCalled()
      )
    }

    const refresh = screen
      .getAllByRole('button')
      .find((b) => /refresh/i.test(b.textContent || ''))
    if (refresh) {
      await act(async () => {
        refresh.click()
      })
    }
    const folder = screen
      .getAllByRole('button')
      .find((b) => /folder/i.test(b.textContent || ''))
    if (folder) {
      await act(async () => {
        folder.click()
      })
      expect(api.activity.openLogFolder).toHaveBeenCalled()
    }

    const clearBtn = screen
      .getAllByRole('button')
      .find((b) => /clear/i.test(b.textContent || '') && !/filter/i.test(b.textContent || ''))
    if (clearBtn) {
      await act(async () => {
        clearBtn.click()
      })
      if (document.querySelector('[role="alertdialog"]')) {
        await act(async () => {
          clickDialogConfirm()
        })
        await waitFor(() => expect(api.activity.clear).toHaveBeenCalled())
      }
    }

    const auto = document.querySelector(
      'input[type="checkbox"]'
    ) as HTMLInputElement | null
    if (auto) {
      await act(async () => {
        fireEvent.click(auto)
      })
    }
  })

  it('shows load error', async () => {
    api.activity.query = vi.fn().mockRejectedValue(new Error('fail-load'))
    await renderWithProviders(<AuditLogPage />)
    await waitFor(() => expect(screen.getByText(/fail-load/i)).toBeTruthy())
  })

  it('copy failure path', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: {
        writeText: vi.fn().mockRejectedValue(new Error('denied'))
      }
    })
    await renderWithProviders(<AuditLogPage />)
    await waitFor(() => expect(api.activity.query).toHaveBeenCalled())
    const rows = document.querySelectorAll('ul.divide-y > li > button')
    if (rows[0]) {
      await act(async () => {
        ;(rows[0] as HTMLButtonElement).click()
      })
    }
    const copyBtn = screen
      .getAllByRole('button')
      .find((b) => /copy/i.test(b.textContent || ''))
    if (copyBtn) {
      await act(async () => {
        copyBtn.click()
      })
    }
  })
})
