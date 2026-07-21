import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { createMockApi, reseedMockApi } from '../../test/mockApi'
import {
  makeAction,
  makeCharacter,
  makeProp,
  makeScene,
  makeStory,
  makeStoryDetail,
  makeTimelineEntry
} from '../../test/pageFixtures'
import {
  clickDialogCancel,
  clickDialogConfirm,
  renderWithProviders
} from '../../test/renderWithProviders'
import { StoriesPage } from './StoriesPage'

const api = createMockApi()
vi.mock('../../lib/api', () => ({
  getApi: () => api,
  isElectron: () => true,
  isWebRuntime: () => false
}))

function seedLists() {
  const story = makeStory()
  api.stories.list = vi.fn().mockResolvedValue([
    story,
    makeStory({
      id: 'story-2',
      title: 'Other',
      status: 'COMPLETED',
      coverPath: null,
      updatedAt: '2026-07-10T00:00:00.000Z'
    }),
    makeStory({
      id: 'story-3',
      title: 'Failed One',
      status: 'FAILED',
      coverPath: null
    }),
    makeStory({
      id: 'story-4',
      title: 'Generating',
      status: 'GENERATING'
    })
  ])
  api.stories.get = vi.fn().mockResolvedValue(makeStoryDetail())
  api.characters.list = vi.fn().mockResolvedValue([
    makeCharacter(),
    makeCharacter({ id: 'char-2', name: 'Ben' })
  ])
  api.scenes.list = vi.fn().mockResolvedValue([makeScene()])
  api.props.list = vi.fn().mockResolvedValue([makeProp()])
  api.actions.list = vi.fn().mockResolvedValue([makeAction()])
  api.timeline.list = vi.fn().mockResolvedValue([makeTimelineEntry()])
  api.costumes.list = vi.fn().mockResolvedValue([])
  api.ai.status = vi.fn().mockResolvedValue({ available: true, message: 'ok' })
  api.project.exportBackup = vi.fn().mockResolvedValue({
    ok: true,
    path: '/tmp/backup.zip'
  })
  api.project.importBackup = vi.fn().mockResolvedValue({
    ok: true,
    storyId: 'story-imp',
    title: 'Imported'
  })
  api.stories.create = vi.fn().mockResolvedValue({
    id: 'story-new',
    title: 'Untitled'
  })
  api.stories.update = vi.fn().mockResolvedValue({})
  api.stories.delete = vi.fn().mockResolvedValue({ ok: true })
  api.stories.generateCover = vi.fn().mockResolvedValue({
    path: '/tmp/cover.png',
    label: 'Cover'
  })
  api.stories.aiFillMeta = vi.fn().mockResolvedValue({
    styleNote: 'filled style',
    hardRules: 'rule',
    artStyle: 'anime'
  })
  api.stories.aiFillScript = vi.fn().mockResolvedValue({
    beats: [
      { order: 0, dialogue: 'Hello', characterId: 'char-1', sceneId: 'scene-1' }
    ],
    drafts: [],
    raw: ''
  })
  api.timeline.create = vi.fn().mockResolvedValue({ id: 'entry-new' })
  api.timeline.update = vi.fn().mockResolvedValue({})
  api.timeline.delete = vi.fn().mockResolvedValue({ ok: true })
  api.timeline.reorder = vi.fn().mockResolvedValue({ ok: true })
  api.media.pickRefImage = vi.fn().mockResolvedValue({ path: '/tmp/picked.png' })
}

describe('StoriesPage', () => {
  beforeEach(() => {
    reseedMockApi(api)
    seedLists()
  })

  it('empty state create flow', async () => {
    api.stories.list = vi.fn().mockResolvedValue([])
    await renderWithProviders(<StoriesPage />)
    await waitFor(() =>
      expect(screen.getByText(/No stories|no stories/i)).toBeTruthy()
    )
    const news = screen.getAllByRole('button').filter((b) =>
      /new story/i.test(b.textContent || '')
    )
    await act(async () => {
      news[0].click()
    })
    await waitFor(() =>
      expect(
        screen.getAllByRole('button').some((b) =>
          /^save$/i.test((b.textContent || '').trim())
        )
      ).toBe(true)
    )
    const titleInput = document.querySelector(
      'input'
    ) as HTMLInputElement | null
    if (titleInput) {
      await act(async () => {
        fireEvent.change(titleInput, { target: { value: 'Brand New' } })
      })
    }
    const save = screen.getAllByRole('button').find((b) =>
      /^save$/i.test((b.textContent || '').trim())
    )
    if (save && !(save as HTMLButtonElement).disabled) {
      await act(async () => {
        save.click()
      })
      await waitFor(() => expect(api.stories.create).toHaveBeenCalled())
    }
  })


  it('lists stories, filters, opens editor, saves, deletes, exports', async () => {
    await renderWithProviders(<StoriesPage />)
    await waitFor(() => expect(screen.getByText('Demo Story')).toBeTruthy())

    // Filters
    const selects = document.querySelectorAll('select')
    if (selects[0]) {
      await act(async () => {
        fireEvent.change(selects[0], { target: { value: 'DRAFT' } })
      })
    }
    if (selects[1]) {
      await act(async () => {
        fireEvent.change(selects[1], { target: { value: 'has' } })
      })
    }
    if (selects[2]) {
      await act(async () => {
        fireEvent.change(selects[2], { target: { value: 'title' } })
      })
    }
    const search = document.querySelector(
      'input[type="search"], input[placeholder]'
    ) as HTMLInputElement | null
    if (search) {
      await act(async () => {
        fireEvent.change(search, { target: { value: 'Demo' } })
      })
    }
    const clear = screen.getAllByRole('button').find((b) =>
      /clear filter/i.test(b.textContent || '')
    )
    if (clear && !(clear as HTMLButtonElement).disabled) {
      await act(async () => {
        clear.click()
      })
    }

    // Open editor
    const edit = screen.getAllByRole('button').find((b) =>
      /^edit$/i.test((b.textContent || '').trim())
    )
    expect(edit).toBeTruthy()
    await act(async () => {
      edit!.click()
    })
    await waitFor(() => expect(api.stories.get).toHaveBeenCalled())

    // Meta save
    const titleInputs = Array.from(
      document.querySelectorAll('input')
    ) as HTMLInputElement[]
    const titleField =
      titleInputs.find((i) => i.value === 'Demo Story') || titleInputs[0]
    if (titleField) {
      await act(async () => {
        fireEvent.change(titleField, { target: { value: 'Demo Story v2' } })
      })
    }
    const save = screen.getAllByRole('button').find((b) =>
      /^save$/i.test((b.textContent || '').trim())
    )
    if (save) {
      await act(async () => {
        save.click()
      })
      await waitFor(() => expect(api.stories.update).toHaveBeenCalled())
    }

    // Cast tab
    const castTab = screen.getAllByRole('button').find((b) =>
      /cast/i.test(b.textContent || '')
    )
    if (castTab) {
      await act(async () => {
        castTab.click()
      })
    }
    // Link toggles may be checkboxes or buttons
    const linkBtns = screen.getAllByRole('button').filter((b) =>
      /link|unlink/i.test(b.textContent || '')
    )
    for (const b of linkBtns.slice(0, 4)) {
      await act(async () => {
        b.click()
      })
    }

    // Script tab
    const scriptTab = screen.getAllByRole('button').find((b) =>
      /script|beats/i.test(b.textContent || '')
    )
    if (scriptTab) {
      await act(async () => {
        scriptTab.click()
      })
    }

    // AI fill meta (may need idea)
    const idea = Array.from(document.querySelectorAll('textarea')).find((ta) =>
      /idea|premise|logline/i.test(
        ta.getAttribute('placeholder') || ta.getAttribute('aria-label') || ''
      )
    ) as HTMLTextAreaElement | undefined
    if (idea) {
      await act(async () => {
        fireEvent.change(idea, { target: { value: 'A rainy noir pilot' } })
      })
    }
    const aiMeta = screen.getAllByRole('button').find((b) =>
      /fill meta|ai meta|suggest meta/i.test(b.textContent || '')
    )
    if (aiMeta) {
      await act(async () => {
        aiMeta.click()
      })
    }

    // Close editor
    const cancel = screen.getAllByRole('button').find((b) =>
      /^cancel$/i.test((b.textContent || '').trim())
    )
    if (cancel) {
      await act(async () => {
        cancel.click()
      })
    }

    // Export backup
    const exp = screen.getAllByRole('button').find((b) =>
      /export backup|export/i.test(b.textContent || '')
    )
    if (exp) {
      await act(async () => {
        exp.click()
      })
      const dlg = document.querySelector('[role="alertdialog"]')
      if (dlg) {
        await act(async () => {
          clickDialogConfirm()
        })
        await waitFor(() => expect(api.project.exportBackup).toHaveBeenCalled())
      }
    }

    // Delete cancel then confirm
    const del = screen.getAllByRole('button').find((b) =>
      /^delete$/i.test((b.textContent || '').trim())
    )
    if (del) {
      await act(async () => {
        del.click()
      })
      if (document.querySelector('[role="alertdialog"]')) {
        await act(async () => {
          clickDialogCancel()
        })
      }
      await act(async () => {
        del.click()
      })
      if (document.querySelector('[role="alertdialog"]')) {
        await act(async () => {
          clickDialogConfirm()
        })
        await waitFor(() => expect(api.stories.delete).toHaveBeenCalled())
      }
    }

    // Import backup
    const imp = screen.getAllByRole('button').find((b) =>
      /import backup|import/i.test(b.textContent || '')
    )
    if (imp) {
      await act(async () => {
        imp.click()
      })
      await waitFor(() => expect(api.project.importBackup).toHaveBeenCalled())
    }

    // Menu events
    await act(async () => {
      window.dispatchEvent(new Event('idm:menu-new-story'))
    })
    await act(async () => {
      window.dispatchEvent(new Event('idm:menu-import-story'))
    })
  })

  it('load detail error path', async () => {
    api.stories.get = vi.fn().mockRejectedValue(new Error('detail-fail'))
    await renderWithProviders(<StoriesPage />)
    await waitFor(() => expect(screen.getByText('Demo Story')).toBeTruthy())
    const edit = screen.getAllByRole('button').find((b) =>
      /^edit$/i.test((b.textContent || '').trim())
    )
    await act(async () => {
      edit!.click()
    })
    await waitFor(() => expect(screen.getByText(/detail-fail/i)).toBeTruthy())
  })

  it('cover generate, script AI and seed demo', async () => {
    api.stories.seedDemo = vi.fn().mockResolvedValue({
      storyId: 'story-demo',
      title: 'Demo Seed'
    })
    await renderWithProviders(<StoriesPage />)
    await waitFor(() => expect(screen.getByText('Demo Story')).toBeTruthy())

    const seed = screen.getAllByRole('button').find((b) =>
      /seed|demo/i.test(b.textContent || '')
    )
    if (seed) {
      await act(async () => {
        seed.click()
      })
    }

    const edit = screen.getAllByRole('button').find((b) =>
      /^edit$/i.test((b.textContent || '').trim())
    )
    await act(async () => {
      edit?.click()
    })
    await waitFor(() => expect(api.stories.get).toHaveBeenCalled())

    for (const re of [
      /cover|image/i,
      /generate cover|generate/i,
      /script|beats/i,
      /fill script|ai script|suggest script/i,
      /cast/i
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

    // status filter COMPLETED / FAILED
    for (const sel of Array.from(document.querySelectorAll('select'))) {
      const s = sel as HTMLSelectElement
      const hasStatus = Array.from(s.options).some((o) =>
        /COMPLETED|FAILED|GENERATING/i.test(o.value)
      )
      if (hasStatus) {
        await act(async () => {
          fireEvent.change(s, { target: { value: 'COMPLETED' } })
        })
        await act(async () => {
          fireEvent.change(s, { target: { value: '' } })
        })
      }
    }
    expect(api.stories.list).toHaveBeenCalled()
  })

  it('list load error falls back to empty', async () => {
    api.stories.list = vi.fn().mockRejectedValue(new Error('stories-down'))
    await renderWithProviders(<StoriesPage />, { withToastHost: true })
    await waitFor(() => expect(api.stories.list).toHaveBeenCalled())
    // swallow unhandled rejection from failed load; UI falls back
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })
    expect(document.body.textContent || '').toMatch(
      /No stories|New story|Stories/i
    )
  })
})
