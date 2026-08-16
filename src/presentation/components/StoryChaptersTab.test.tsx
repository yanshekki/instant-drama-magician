import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { createMockApi, reseedMockApi } from '../../test/mockApi'
import { renderWithProviders } from '../../test/renderWithProviders'
import {
  StoryChaptersTab,
  storiesGuardNeedChapters
} from './StoryChaptersTab'
import type { Chapter } from '../../types/domain'

const api = createMockApi()
vi.mock('../../lib/api', () => ({
  getApi: () => api,
  isElectron: () => true,
  isWebRuntime: () => false
}))

function chapter(partial: Partial<Chapter> = {}): Chapter {
  return {
    id: 'ch1',
    storyId: 's1',
    order: 0,
    title: 'Night',
    body: 'Rain on the roof.',
    ...partial
  }
}

describe('storiesGuardNeedChapters', () => {
  it('blocks unsaved stories and empty bodies', () => {
    const err: string[] = []
    expect(
      storiesGuardNeedChapters(null, [], (m) => err.push(m), 'save', 'chapters')
    ).toBe('needSave')
    expect(
      storiesGuardNeedChapters(
        's1',
        [{ body: '  ' }],
        (m) => err.push(m),
        'save',
        'chapters'
      )
    ).toBe('needChapters')
    expect(
      storiesGuardNeedChapters(
        's1',
        [{ body: 'Rain.' }],
        (m) => err.push(m),
        'save',
        'chapters'
      )
    ).toBe('ok')
  })
})

describe('StoryChaptersTab', () => {
  beforeEach(() => {
    reseedMockApi(api)
    api.chapters.generateCast = vi.fn()
    api.chapters.create = vi.fn().mockResolvedValue(
      chapter({ id: 'ch-new', title: '', body: '' })
    )
  })

  it('blocks generateCast when no chapter body', async () => {
    const setActionError = vi.fn()
    await renderWithProviders(
      <StoryChaptersTab
        editingId="s1"
        aiIdea=""
        onAiIdeaChange={vi.fn()}
        chapters={[chapter({ body: '' })]}
        onChaptersChange={vi.fn()}
        ensureStoryId={async () => 's1'}
        setActionError={setActionError}
        setPageBanner={vi.fn()}
        aiBusy={false}
      />
    )
    const cta = screen.getAllByRole('button').find((b) =>
      /Generate cast from chapters/i.test(b.textContent || '')
    )
    expect(cta).toBeTruthy()
    await act(async () => {
      cta!.click()
    })
    expect(setActionError).toHaveBeenCalled()
    expect(api.chapters.generateCast).not.toHaveBeenCalled()
  })

  it('renders chapter cards and can add a chapter', async () => {
    const onChaptersChange = vi.fn()
    await renderWithProviders(
      <StoryChaptersTab
        editingId="s1"
        aiIdea="apology"
        onAiIdeaChange={vi.fn()}
        chapters={[chapter()]}
        onChaptersChange={onChaptersChange}
        ensureStoryId={async () => 's1'}
        setActionError={vi.fn()}
        setPageBanner={vi.fn()}
        aiBusy={false}
      />
    )
    expect(screen.getByText(/Chapter 1/i)).toBeTruthy()
    const add = screen.getAllByRole('button').find((b) =>
      /Add chapter/i.test(b.textContent || '')
    )
    await act(async () => {
      add?.click()
    })
    await waitFor(() => expect(api.chapters.create).toHaveBeenCalled())
  })

  it('sends count, words, and append by default, then applies the full list', async () => {
    const onChaptersChange = vi.fn()
    const full = [
      chapter(),
      chapter({ id: 'ch2', order: 1, title: 'Dawn', body: 'Light.' })
    ]
    api.chapters.aiFill = vi.fn().mockResolvedValue({
      chapters: full,
      replaced: false,
      drafts: [{ title: 'Dawn', body: 'Light.' }],
      raw: ''
    })
    await renderWithProviders(
      <StoryChaptersTab
        editingId="s1"
        aiIdea="apology"
        onAiIdeaChange={vi.fn()}
        chapters={[chapter()]}
        onChaptersChange={onChaptersChange}
        ensureStoryId={async () => 's1'}
        setActionError={vi.fn()}
        setPageBanner={vi.fn()}
        aiBusy={false}
      />
    )
    fireEvent.change(screen.getByLabelText(/Chapter count/i), {
      target: { value: '6' }
    })
    fireEvent.change(screen.getByLabelText(/Words per chapter/i), {
      target: { value: '200' }
    })
    expect(screen.getByRole('button', { name: /Append at the end/i })).toBeTruthy()
    expect(
      screen.getByRole('button', { name: /Replace existing beats/i })
    ).toBeTruthy()
    const fill = screen.getAllByRole('button').find((b) =>
      /^AI generate chapters$/i.test(b.textContent || '')
    )
    await act(async () => {
      fill?.click()
    })
    await waitFor(() => expect(api.chapters.aiFill).toHaveBeenCalled())
    expect(api.chapters.aiFill).toHaveBeenCalledWith(
      expect.objectContaining({
        storyId: 's1',
        replace: false,
        chapterCount: 6,
        wordsPerChapter: 200
      })
    )
    await waitFor(() =>
      expect(onChaptersChange).toHaveBeenCalledWith(full)
    )
  })

  it('does not call generateCast when the button is disabled without a story', async () => {
    await renderWithProviders(
      <StoryChaptersTab
        editingId={null}
        aiIdea=""
        onAiIdeaChange={vi.fn()}
        chapters={[]}
        onChaptersChange={vi.fn()}
        ensureStoryId={async () => null}
        setActionError={vi.fn()}
        setPageBanner={vi.fn()}
        aiBusy={false}
      />
    )
    const cta = screen.getAllByRole('button').find((b) =>
      /Generate cast from chapters/i.test(b.textContent || '')
    ) as HTMLButtonElement
    expect(cta.disabled).toBe(true)
    fireEvent.click(cta)
    expect(api.chapters.generateCast).not.toHaveBeenCalled()
  })
})
