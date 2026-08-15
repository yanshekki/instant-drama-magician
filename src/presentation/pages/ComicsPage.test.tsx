import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { createMockApi, reseedMockApi } from '../../test/mockApi'
import { makeStory } from '../../test/pageFixtures'
import {
  clickDialogConfirm,
  renderWithProviders
} from '../../test/renderWithProviders'
import { ComicsPage } from './ComicsPage'
import { buildIntroMediaGenRequest } from '../lib/startIntroMediaGen'
import { COMIC_VIDEO_SCHEME_KEY } from '../lib/comicVideoSchemePref'

const api = createMockApi()
vi.mock('../../lib/api', () => ({
  getApi: () => api,
  isElectron: () => true,
  isWebRuntime: () => false
}))
vi.mock('../lib/startIntroMediaGen', async () => {
  const actual = await vi.importActual<
    typeof import('../lib/startIntroMediaGen')
  >('../lib/startIntroMediaGen')
  return {
    ...actual,
    buildIntroMediaGenRequest: vi.fn(actual.buildIntroMediaGenRequest)
  }
})

const pageRow = {
  id: 'page-1',
  comicId: 'comic-1',
  order: 0,
  panelLayout: 'grid-2x2',
  artStyle: null,
  panelScriptJson: JSON.stringify([
    { caption: 'Open door', timelineEntryId: 'e1' },
    { caption: '', timelineEntryId: null },
    { caption: '', timelineEntryId: null },
    { caption: '', timelineEntryId: null }
  ]),
  imagePath: '/tmp/page.png',
  mediaStatus: 'READY'
}

describe('ComicsPage', () => {
  beforeEach(() => {
    localStorage.removeItem(COMIC_VIDEO_SCHEME_KEY)
    vi.mocked(buildIntroMediaGenRequest).mockClear()
    reseedMockApi(api)
    api.stories.list = vi.fn().mockResolvedValue([makeStory()])
    api.ai.status = vi.fn().mockResolvedValue({ available: true, message: 'ok' })
    api.comics.get = vi.fn().mockResolvedValue({
      comic: {
        id: 'comic-1',
        storyId: 's1',
        artStyle: 'comic_western',
        hardRules: 'no logo'
      },
      pages: [pageRow]
    })
    api.comics.addPage = vi.fn().mockResolvedValue({ id: 'page-new' })
    api.comics.update = vi.fn().mockResolvedValue({})
    api.comics.updatePage = vi.fn().mockResolvedValue({})
    api.comics.deletePage = vi.fn().mockResolvedValue({ ok: true })
    api.comics.autoPaginate = vi.fn().mockResolvedValue({
      created: 2,
      layout: 'grid-2x2',
      pages: []
    })
    api.comics.importToTimeline = vi.fn().mockResolvedValue({
      imported: 1,
      entryIds: ['e1'],
      path: '/tmp/page.png'
    })
    api.timeline.list = vi.fn().mockResolvedValue([
      { id: 'e1', order: 0, dialogue: 'Hello' },
      { id: 'e2', order: 1, dialogue: 'Bye' }
    ])
  })

  it('asks for a story when none is active', async () => {
    api.stories.list = vi.fn().mockResolvedValue([])
    await renderWithProviders(<ComicsPage />)
    await waitFor(() =>
      expect(screen.getByText(/Pick a story first/i)).toBeTruthy()
    )
    expect(screen.getByText(/Go to stories/i)).toBeTruthy()
  })

  it('loads pages, generates, imports, paginates, and deletes', async () => {
    await renderWithProviders(<ComicsPage />, { withToastHost: true })
    await waitFor(() =>
      expect(screen.getAllByText(/Page 1/i).length).toBeGreaterThan(0)
    )
    expect(api.comics.get).toHaveBeenCalled()
    expect(screen.getByRole('tab', { name: /Panels/i })).toBeTruthy()
    expect(screen.getByRole('tab', { name: /Artwork/i })).toBeTruthy()
    expect(
      screen.getByRole('button', { name: /Export film/i })
    ).toBeTruthy()
    expect(
      (screen.getByRole('button', { name: /Export film/i }) as HTMLButtonElement)
        .disabled
    ).toBe(true)
    expect(
      screen.getAllByRole('button', { name: /Generate this page video/i })
        .length
    ).toBeGreaterThan(0)
    await act(async () => {
      screen.getByRole('tab', { name: /Artwork/i }).click()
    })
    await waitFor(() =>
      expect(screen.getByText(/Page videos/i)).toBeTruthy()
    )
    expect(
      screen.getByRole('radio', { name: /Comic-page animation/i })
    ).toBeTruthy()
    expect(
      screen.getByRole('radio', { name: /Short-drama shot/i })
    ).toBeTruthy()
    expect(screen.getByText('Same as timeline')).toBeTruthy()
    expect(screen.queryByText(/介紹片|Intro video/i)).toBeNull()

    await act(async () => {
      screen.getByRole('tab', { name: /Panels/i }).click()
    })
    expect(screen.getByText(/Open door/i)).toBeTruthy()

    const layoutTab = screen.getByRole('tab', { name: /^Layout$/i })
    await act(async () => {
      layoutTab.click()
    })
    expect(screen.getByText(/Even grids/i)).toBeTruthy()
    expect(screen.getByRole('radio', { name: /Portrait 9:16/i })).toBeTruthy()
    expect(screen.getByRole('radio', { name: /Landscape 16:9/i })).toBeTruthy()
    expect(screen.getByText(/mid \/ small \/ large/i)).toBeTruthy()

    const gen = screen.getAllByRole('button').find((b) =>
      /Generate comic page/i.test(b.textContent || '')
    )
    await act(async () => {
      gen?.click()
    })
    await waitFor(() => expect(api.comics.updatePage).toHaveBeenCalled())

    const imp = screen.getAllByRole('button').find((b) =>
      /Import page into timeline/i.test(b.textContent || '')
    )
    await act(async () => {
      imp?.click()
    })
    await waitFor(() => expect(api.comics.importToTimeline).toHaveBeenCalled())

    const paginate = screen.getAllByRole('button').find((b) =>
      /Paginate from timeline/i.test(b.textContent || '')
    )
    await act(async () => {
      paginate?.click()
    })
    await waitFor(() => expect(api.comics.autoPaginate).toHaveBeenCalled())

    const add = screen.getAllByRole('button').find((b) =>
      /New page/i.test(b.textContent || '')
    )
    await act(async () => {
      add?.click()
    })
    await waitFor(() => expect(api.comics.addPage).toHaveBeenCalled())

    const book = screen.getByRole('button', { name: /Book settings/i })
    await act(async () => {
      book.click()
    })
    const save = screen.getAllByRole('button').find((b) =>
      /^Save$/i.test((b.textContent || '').trim())
    )
    await act(async () => {
      save?.click()
    })
    await waitFor(() => expect(api.comics.update).toHaveBeenCalled())

    const del = screen.getAllByRole('button').find((b) =>
      /Delete page/i.test(b.textContent || '')
    )
    await act(async () => {
      del?.click()
    })
    await clickDialogConfirm()
    await waitFor(() => expect(api.comics.deletePage).toHaveBeenCalled())
  })

  it('changes panel template', async () => {
    await renderWithProviders(<ComicsPage />)
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: /^Layout$/i })).toBeTruthy()
    )
    await act(async () => {
      screen.getByRole('tab', { name: /^Layout$/i }).click()
    })
    await waitFor(() => expect(screen.getByText(/4-koma/i)).toBeTruthy())
    const yonkoma = screen.getAllByRole('button').find((b) =>
      /4-koma/i.test(b.textContent || '')
    )
    await act(async () => {
      yonkoma?.click()
    })
    await waitFor(() =>
      expect(api.comics.updatePage).toHaveBeenCalledWith(
        'page-1',
        expect.objectContaining({ panelLayout: 'yonkoma' })
      )
    )
  })

  it('shows empty book and import without image', async () => {
    api.comics.get = vi.fn().mockResolvedValue({
      comic: { id: 'comic-1', storyId: 's1' },
      pages: []
    })
    await renderWithProviders(<ComicsPage />, { withToastHost: true })
    await waitFor(() =>
      expect(screen.getAllByText(/No comic pages yet/i).length).toBeGreaterThan(0)
    )

    api.comics.get = vi.fn().mockResolvedValue({
      comic: { id: 'comic-1', storyId: 's1' },
      pages: [{ ...pageRow, imagePath: null }]
    })
    await renderWithProviders(<ComicsPage />, { withToastHost: true })
    await waitFor(() => expect(screen.getAllByText(/Page 1/i).length).toBeGreaterThan(0))
    const imp = screen.getAllByRole('button').find((b) =>
      /Import page into timeline/i.test(b.textContent || '')
    )
    await act(async () => {
      imp?.click()
    })
    expect(api.comics.importToTimeline).not.toHaveBeenCalled()
  })

  it('shows video badge and enables export when a page has video', async () => {
    api.comics.get = vi.fn().mockResolvedValue({
      comic: { id: 'comic-1', storyId: 's1' },
      pages: [{ ...pageRow, videoPath: '/tmp/page.mp4' }]
    })
    api.media.exportPreflight = vi.fn().mockResolvedValue({
      canExport: true,
      warnings: [],
      ffmpegMessage: ''
    })
    api.media.exportFinal = vi.fn().mockResolvedValue({
      outputPath: '/tmp/comic-final.mp4'
    })
    await renderWithProviders(<ComicsPage />, { withToastHost: true })
    await waitFor(() =>
      expect(screen.getByText(/Has video|1 videos|1 versions/i)).toBeTruthy()
    )
    expect(screen.getByText(/Version 1/i)).toBeTruthy()
    expect(screen.getAllByText(/For export/i).length).toBeGreaterThan(0)
    expect(
      screen.getAllByRole('button', { name: /New version/i }).length
    ).toBeGreaterThan(0)
    expect(
      screen.queryByRole('button', { name: /Redo this page video/i })
    ).toBeNull()
    const exp = screen.getByRole('button', { name: /Export film/i })
    expect((exp as HTMLButtonElement).disabled).toBe(false)
    await act(async () => {
      exp.click()
    })
    await act(async () => {
      screen.getByRole('button', { name: /Export now/i }).click()
    })
    await waitFor(() =>
      expect(api.media.exportFinal).toHaveBeenCalledWith(
        'story-1',
        expect.objectContaining({ clipSource: 'comics' })
      )
    )
  })

  it('dispatches comic-page-done reload', async () => {
    await renderWithProviders(<ComicsPage />)
    await waitFor(() => expect(api.comics.get).toHaveBeenCalled())
    ;(api.comics.get as ReturnType<typeof vi.fn>).mockClear()
    await act(async () => {
      window.dispatchEvent(
        new CustomEvent('idm:comic-page-done', {
          detail: { pageId: 'page-1', path: '/tmp/x.png' }
        })
      )
    })
    await waitFor(() => expect(api.comics.get).toHaveBeenCalled())
    fireEvent.change(screen.getAllByRole('combobox')[0], {
      target: { value: 's1' }
    })
  })

  it('lists page video versions and deletes only after confirm', async () => {
    api.comics.get = vi.fn().mockResolvedValue({
      comic: { id: 'comic-1', storyId: 's1' },
      pages: [
        {
          ...pageRow,
          videoPath: '/tmp/b.mp4',
          videoGalleryJson: JSON.stringify([
            {
              id: 'v2',
              path: '/tmp/b.mp4',
              scheme: 'drama',
              createdAt: '2026-01-02T00:00:00.000Z'
            },
            {
              id: 'v1',
              path: '/tmp/a.mp4',
              scheme: 'page',
              createdAt: '2026-01-01T00:00:00.000Z'
            }
          ])
        }
      ]
    })
    api.comics.deletePageVideo = vi.fn().mockResolvedValue({
      ok: true,
      removedPath: '/tmp/b.mp4',
      videoPath: '/tmp/a.mp4'
    })
    api.comics.setPageVideoPrimary = vi.fn().mockResolvedValue({
      ok: true,
      videoPath: '/tmp/a.mp4'
    })
    await renderWithProviders(<ComicsPage />, { withToastHost: true })
    await waitFor(() => expect(screen.getByText(/2 versions/i)).toBeTruthy())
    expect(screen.getByText(/Version 2/i)).toBeTruthy()
    expect(screen.getAllByText(/Short-drama shot/i).length).toBeGreaterThan(0)
    const setPrimary = screen.getAllByRole('button', {
      name: /Use for export/i
    })[0]
    await act(async () => {
      setPrimary.click()
    })
    await waitFor(() =>
      expect(api.comics.setPageVideoPrimary).toHaveBeenCalledWith('page-1', 'v1')
    )
    const del = screen.getAllByRole('button', {
      name: /Delete this version/i
    })[0]
    await act(async () => {
      del.click()
    })
    expect(api.comics.deletePageVideo).not.toHaveBeenCalled()
    await clickDialogConfirm()
    await waitFor(() =>
      expect(api.comics.deletePageVideo).toHaveBeenCalledWith('page-1', 'v2')
    )
  })

  it('selects the drama scheme and passes it when generating page video', async () => {
    await renderWithProviders(<ComicsPage />)
    await waitFor(() =>
      expect(
        screen.getByRole('radio', { name: /Short-drama shot/i })
      ).toBeTruthy()
    )
    const drama = screen.getByRole('radio', { name: /Short-drama shot/i })
    expect(drama.getAttribute('aria-checked')).toBe('false')
    await act(async () => {
      drama.click()
    })
    expect(
      screen.getByRole('radio', { name: /Short-drama shot/i }).getAttribute(
        'aria-checked'
      )
    ).toBe('true')
    expect(localStorage.getItem(COMIC_VIDEO_SCHEME_KEY)).toBe('drama')
    const gen = screen.getAllByRole('button', {
      name: /Generate this page video/i
    })[0]
    await act(async () => {
      gen.click()
    })
    await waitFor(() =>
      expect(buildIntroMediaGenRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'comic-intro',
          comicVideoScheme: 'drama',
          pageId: 'page-1'
        })
      )
    )
  })
})
