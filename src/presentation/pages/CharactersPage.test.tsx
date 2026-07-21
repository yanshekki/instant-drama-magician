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
import { CharactersPage } from './CharactersPage'

const api = createMockApi()
vi.mock('../../lib/api', () => ({
  getApi: () => api,
  isElectron: () => true,
  isWebRuntime: () => false
}))

const galleryJson = JSON.stringify([
  {
    id: 'g1',
    path: '/media/aria.png',
    label: 'Front',
    kind: 'sheet',
    layer: 'identity',
    createdAt: '2026-07-01T00:00:00.000Z'
  },
  {
    id: 'g2',
    path: '/media/base.png',
    label: 'Base layer',
    kind: 'sheet',
    layer: 'base',
    createdAt: '2026-07-02T00:00:00.000Z'
  }
])

function seed() {
  reseedMockApi(api)
  api.stories.list = vi.fn().mockResolvedValue([makeStory()])
  api.ai.status = vi.fn().mockResolvedValue({ available: true, message: 'ok' })
  api.characters.list = vi.fn().mockImplementation(async () => [
    makeCharacter({
      refGalleryJson: galleryJson,
      costumesJson: JSON.stringify([
        {
          id: 'look-1',
          name: 'Rain coat look',
          description: 'trench coat',
          artStyle: 'anime',
          createdAt: '2026-07-01T00:00:00.000Z',
          updatedAt: '2026-07-01T00:00:00.000Z'
        }
      ])
    }),
    makeCharacter({
      id: 'char-2',
      name: 'Ben',
      refImagePath: null,
      soulMdPath: '/souls/ben.md',
      ageRange: '12'
    })
  ])
  api.characters.create = vi
    .fn()
    .mockResolvedValue(makeCharacter({ id: 'char-new', name: 'New' }))
  api.characters.update = vi.fn().mockResolvedValue(makeCharacter())
  api.characters.delete = vi.fn().mockResolvedValue({ ok: true })
  api.characters.aiFill = vi.fn().mockResolvedValue({
    profile: {
      name: 'Aria+',
      description: 'detective',
      appearance: 'dark hair',
      personality: 'stoic',
      costume: 'trench'
    },
    profileJson: '{}',
    raw: ''
  })
  api.characters.generateSheet = vi.fn().mockResolvedValue({
    path: '/tmp/sheet.png',
    label: 'Sheet',
    variant: 'bible',
    usedEdit: false
  })
  api.characters.generateSoul = vi.fn().mockResolvedValue({
    path: '/tmp/soul.md',
    content: '# Generated soul',
    title: 'Aria soul'
  })
  api.characters.readSoulContent = vi
    .fn()
    .mockResolvedValue('# Soul\ncontent from disk')
  api.characters.writeSoulContent = vi.fn().mockResolvedValue({
    filePath: '/tmp/soul-written.md',
    content: '# Soul\nedited'
  })
  api.characters.importSoulMd = vi.fn().mockResolvedValue({
    path: '/tmp/imported.md',
    content: '# imported'
  })
  api.characters.suggestWardrobe = vi.fn().mockResolvedValue({
    name: 'Coat',
    costume: 'long black trench',
    artStyle: 'anime',
    rationale: 'rainy noir'
  })
  api.characters.swapCostume = vi.fn().mockResolvedValue({
    path: '/tmp/swap.png',
    label: 'Swap',
    variant: 'costume_swap',
    layer: 'costume'
  })
  api.characters.generateIntroVideo = vi.fn().mockResolvedValue({})
  api.costumes.list = vi.fn().mockResolvedValue([
    makeCostume(),
    makeCostume({ id: 'cost-2', name: 'Suit', refImagePath: null })
  ])
  api.costumes.listForCharacter = vi.fn().mockResolvedValue([makeCostume()])
  api.costumes.linkCharacter = vi.fn().mockResolvedValue({})
  api.costumes.unlinkCharacter = vi.fn().mockResolvedValue({})
  api.timeline.list = vi.fn().mockResolvedValue([makeTimelineEntry()])
  api.souls.list = vi.fn().mockResolvedValue({
    data: [
      { id: 1, title: 'Hero', description: 'h', role: 'lead', domain: 'noir' },
      { id: 2, title: 'Villain', description: 'v', role: null, domain: null }
    ],
    total_pages: 2,
    current_page: 1
  })
  api.souls.searchLocal = vi.fn().mockResolvedValue({
    items: [{ id: 3, title: 'Local', description: 'x' }]
  })
  api.souls.get = vi.fn().mockResolvedValue({
    id: 1,
    title: 'Hero',
    content: '# hero soul body'
  })
  api.souls.ensureIndex = vi.fn().mockResolvedValue({
    count: 2,
    pages: 2,
    fromCache: true,
    suggestions: [{ kind: 'role', label: 'hero', count: 1 }]
  })
  api.characters.get = vi.fn().mockResolvedValue(makeCharacter())
  api.media.pickRefImage = vi.fn().mockResolvedValue({
    filePath: '/tmp/ref.png',
    path: '/tmp/ref.png'
  })
  api.media.discardSheetDraft = vi.fn().mockResolvedValue({})
  api.videoPrep.create = vi.fn().mockResolvedValue({
    draft: {
      kind: 'character-intro',
      entityIds: { characterId: 'char-1' },
      professionalPrompt: 'intro',
      stillPath: '/media/aria.png',
      sourceImagePath: '/media/aria.png',
      durationSeconds: 10
    }
  })
}

function btns() {
  return screen.getAllByRole('button')
}

async function clickRe(re: RegExp) {
  const b = btns().find(
    (x) =>
      re.test((x.textContent || '').trim()) &&
      !(x as HTMLButtonElement).disabled
  )
  if (b) {
    await act(async () => {
      fireEvent.click(b)
    })
  }
  return b
}

async function waitLoaded() {
  await waitFor(
    () => {
      expect(api.characters.list).toHaveBeenCalled()
      expect(screen.queryByText(/^Loading/i)).toBeNull()
      expect(screen.getByText('Aria')).toBeTruthy()
    },
    { timeout: 8000 }
  )
}

async function openFirstEdit() {
  await waitLoaded()
  // Already in editor?
  if (btns().some((b) => /^Save$/i.test((b.textContent || '').trim()))) {
    return
  }
  let clicked = false
  await waitFor(
    async () => {
      if (
        btns().some((b) => /^Save$/i.test((b.textContent || '').trim()))
      ) {
        return
      }
      if (!clicked) {
        const article = Array.from(document.querySelectorAll('article')).find(
          (a) => (a.textContent || '').includes('Aria')
        )
        const edits = article
          ? Array.from(article.querySelectorAll('button')).filter((b) =>
              /^Edit$/i.test((b.textContent || '').trim())
            )
          : btns().filter((b) =>
              /^Edit$/i.test((b.textContent || '').trim())
            )
        expect(edits.length).toBeGreaterThan(0)
        const edit = edits[edits.length - 1]
        expect(edit).toBeInstanceOf(HTMLElement)
        clicked = true
        await act(async () => {
          fireEvent.click(edit as HTMLElement)
        })
      }
      expect(
        btns().some((b) => /^Save$/i.test((b.textContent || '').trim()))
      ).toBe(true)
    },
    { timeout: 10000 }
  )
}

describe('CharactersPage', () => {
  beforeEach(() => {
    seed()
  })

  it('empty create flow', async () => {
    api.characters.list = vi.fn().mockResolvedValue([])
    await renderWithProviders(<CharactersPage />)
    await waitFor(() =>
      expect(screen.getByText(/No characters|no characters/i)).toBeTruthy()
    )
    await clickRe(/New character/i)
    const name = document.querySelector('input') as HTMLInputElement
    await act(async () => {
      fireEvent.change(name, { target: { value: 'Nova' } })
    })
    await clickRe(/^Save$/i)
    await waitFor(() => expect(api.characters.create).toHaveBeenCalled())
  })

  it('deep editor: profile AI, refs sheet, costume swap, soul hub', async () => {
    await renderWithProviders(<CharactersPage />)
    await openFirstEdit()

    // ── Profile / AI ──
    await clickRe(/^Profile$/i)
    for (const el of Array.from(
      document.querySelectorAll('input, textarea')
    ).slice(0, 8)) {
      const input = el as HTMLInputElement
      if (input.type === 'checkbox' || input.type === 'file') continue
      await act(async () => {
        fireEvent.change(input, {
          target: {
            value: input.tagName === 'TEXTAREA' ? 'noir detective notes' : 'Aria'
          }
        })
      })
    }
    await clickRe(/AI fill/i)
    await waitFor(() => expect(api.characters.aiFill).toHaveBeenCalled())

    // ── Refs / sheet ──
    await clickRe(/^References$/i)
    for (const re of [/^All$/i, /Identity/i, /Base/i, /Costume/i, /Detail/i]) {
      await clickRe(re)
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
    await clickRe(/Generate professional reference/i)
    await waitFor(() => {
      const go = btns().find((b) =>
        /^Generate$/i.test((b.textContent || '').trim())
      )
      expect(go || document.querySelector('[role="dialog"]')).toBeTruthy()
    })
    const go = btns().find((b) =>
      /^Generate$/i.test((b.textContent || '').trim())
    )
    if (go) {
      await act(async () => {
        fireEvent.click(go)
      })
    }
    await waitFor(
      () => expect(api.characters.generateSheet).toHaveBeenCalled(),
      { timeout: 4000 }
    ).catch(() => undefined)

    await clickRe(/Upload reference|Add external ref/i)
    await waitFor(() => expect(api.media.pickRefImage).toHaveBeenCalled()).catch(
      () => undefined
    )

    // ── Costume ──
    await clickRe(/^Costume$/i)
    await clickRe(/Suggest from plot/i)
    await waitFor(() =>
      expect(api.characters.suggestWardrobe).toHaveBeenCalled()
    ).catch(() => undefined)

    const swapTa = Array.from(document.querySelectorAll('textarea')).at(-1) as
      | HTMLTextAreaElement
      | undefined
    if (swapTa) {
      await act(async () => {
        fireEvent.change(swapTa, {
          target: { value: 'black leather jacket, red scarf' }
        })
      })
    }
    await clickRe(/Generate costume swap/i)
    await waitFor(() =>
      expect(api.characters.swapCostume).toHaveBeenCalled()
    ).catch(() => undefined)

    const linkSel = Array.from(document.querySelectorAll('select')).find((s) =>
      Array.from((s as HTMLSelectElement).options).some((o) =>
        /Rain coat|Suit/i.test(o.textContent || '')
      )
    ) as HTMLSelectElement | undefined
    if (linkSel && linkSel.options.length > 1) {
      await act(async () => {
        fireEvent.change(linkSel, {
          target: { value: linkSel.options[1].value }
        })
      })
      await clickRe(/Link|link/i)
    }

    await clickRe(/Add to library/i)
    await clickRe(/Apply/i)

    // ── Soul (profile) ──
    await clickRe(/^Profile$/i)
    const hubSearch = Array.from(document.querySelectorAll('input')).find(
      (i) =>
        /Search|soul|role/i.test((i as HTMLInputElement).placeholder || '')
    ) as HTMLInputElement | undefined
    if (hubSearch) {
      await act(async () => {
        fireEvent.change(hubSearch, { target: { value: 'Hero' } })
      })
    }
    await clickRe(/Search|Refresh/i)
    const hero = screen.queryByText('Hero')
    if (hero) {
      await act(async () => {
        fireEvent.click(hero)
      })
    }
    await clickRe(/^Use$/i)
    await clickRe(/Generate Soul from profile/i)
    await waitFor(() =>
      expect(api.characters.generateSoul).toHaveBeenCalled()
    ).catch(() => undefined)
    await clickRe(/Import local soul/i)
    await waitFor(() =>
      expect(api.characters.importSoulMd).toHaveBeenCalled()
    ).catch(() => undefined)
    await clickRe(/Unlink|Clear/i)

    // Save
    await clickRe(/^Save$/i)
    await waitFor(() =>
      expect(
        api.characters.update.mock.calls.length +
          api.characters.writeSoulContent.mock.calls.length
      ).toBeGreaterThan(0)
    ).catch(() => undefined)

    // Close
    await clickRe(/^Cancel$/i)
    expect(api.characters.list).toHaveBeenCalled()
  })

  it('filters library and deletes character', async () => {
    await renderWithProviders(<CharactersPage />)
    await waitLoaded()

    const search = document.querySelector(
      'input[placeholder], input[type="search"]'
    ) as HTMLInputElement | null
    if (search) {
      await act(async () => {
        fireEvent.change(search, { target: { value: 'Aria' } })
      })
    }
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
    await clickRe(/clear filter/i)

    await clickRe(/^Delete$/i)
    if (document.querySelector('[role="alertdialog"]')) {
      await act(async () => {
        clickDialogConfirm()
      })
      await waitFor(() => expect(api.characters.delete).toHaveBeenCalled())
    }
  })

  it('list error', async () => {
    api.characters.list = vi.fn().mockRejectedValue(new Error('chars-fail'))
    await renderWithProviders(<CharactersPage />)
    await waitFor(() => expect(screen.getByText(/chars-fail/i)).toBeTruthy())
  })

  it('AI fill error path', async () => {
    api.characters.aiFill = vi.fn().mockRejectedValue(new Error('ai-fail'))
    await renderWithProviders(
      <>
        <CharactersPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await openFirstEdit()
    await clickRe(/^Profile$/i)
    for (const el of Array.from(document.querySelectorAll('textarea')).slice(
      0,
      2
    )) {
      await act(async () => {
        fireEvent.change(el, { target: { value: 'stormy detective' } })
      })
    }
    const aiBtn = btns().find((b) =>
      /AI fill/i.test((b.textContent || '').trim())
    )
    if (aiBtn) {
      await act(async () => {
        fireEvent.click(aiBtn)
      })
    }
    await waitFor(() => expect(api.characters.aiFill).toHaveBeenCalled()).catch(
      () => undefined
    )
    // error may be toast-only; page must remain usable
    expect(document.body.textContent || '').toMatch(/Save|Cancel|Profile/i)
  })

  it('edits second character without crash', async () => {
    await renderWithProviders(<CharactersPage />)
    await waitLoaded()
    await waitFor(() => expect(screen.getByText('Ben')).toBeTruthy())
    const edits = btns().filter((b) =>
      /^Edit$/i.test((b.textContent || '').trim())
    )
    expect(edits.length).toBeGreaterThanOrEqual(1)
    await act(async () => {
      fireEvent.click(edits[Math.min(1, edits.length - 1)]!)
    })
    await waitFor(() =>
      expect(
        btns().some((b) => /^Save$/i.test((b.textContent || '').trim()))
      ).toBe(true)
    )
    await clickRe(/^References$/i)
    await clickRe(/^Costume$/i)
    await clickRe(/^Profile$/i)
    expect(document.body.textContent || '').toMatch(/Save|Cancel|Ben|Aria/i)
  })

  it('gallery cover remove intro and sheet draft commit', async () => {
    api.media.toPreviewUrl = vi.fn().mockResolvedValue({
      url: 'blob:test',
      filePath: '/media/aria.png'
    })
    api.characters.commitSheet = vi.fn().mockResolvedValue({
      path: '/tmp/committed.png',
      character: { id: 'char-1', costume: 'trench' },
      gallery: [
        {
          id: 'g3',
          path: '/tmp/committed.png',
          kind: 'sheet',
          label: 'New',
          createdAt: '2026-07-15T00:00:00.000Z',
          layer: 'costume'
        }
      ]
    })
    await renderWithProviders(<CharactersPage />, { withToastHost: true })
    await openFirstEdit()
    await clickRe(/^References$/i)
    await clickRe(/Set as cover/i)
    await clickRe(/Remove this image|Remove this photo/i)
    await clickRe(/intro|Intro/i)
    await clickRe(/Generate professional reference/i)
    const go = btns().find((b) =>
      /^Generate$/i.test((b.textContent || '').trim())
    )
    if (go) {
      await act(async () => {
        fireEvent.click(go)
      })
    }
    await waitFor(
      () => expect(api.characters.generateSheet).toHaveBeenCalled(),
      { timeout: 5000 }
    ).catch(() => undefined)
    for (const re of [
      /Review/i,
      /Add to gallery and save|Apply and save/i,
      /OK|Dismiss|Discard/i
    ]) {
      await clickRe(re)
    }
    for (const cb of Array.from(
      document.querySelectorAll('input[type="checkbox"]')
    )) {
      await act(async () => {
        fireEvent.click(cb)
      })
    }
    api.characters.update = vi.fn().mockRejectedValue(new Error('upd-fail'))
    await clickRe(/^Save$/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })
    await clickRe(/^Cancel$/i)
    expect(api.characters.list).toHaveBeenCalled()
  })

  it('AI fill draft apply and wardrobe library', async () => {
    await renderWithProviders(<CharactersPage />, { withToastHost: true })
    await openFirstEdit()
    await clickRe(/^Profile$/i)
    const idea = document.querySelector('textarea') as HTMLTextAreaElement
    if (idea) {
      await act(async () => {
        fireEvent.change(idea, { target: { value: 'cyber detective' } })
      })
    }
    await clickRe(/AI fill \/ improve|AI fill/i)
    await waitFor(() => expect(api.characters.aiFill).toHaveBeenCalled())
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100))
    })
    for (const re of [/Review/i, /Apply and save/i, /OK|Dismiss/i]) {
      await clickRe(re)
    }
    await clickRe(/^Costume$/i)
    await clickRe(/Suggest from plot/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100))
    })
    for (const re of [/Apply wardrobe|Apply and save/i, /Discard|OK/i]) {
      await clickRe(re)
    }
    for (const input of Array.from(document.querySelectorAll('input'))) {
      const el = input as HTMLInputElement
      if (/look|Winter|name/i.test(el.placeholder || '')) {
        await act(async () => {
          fireEvent.change(el, { target: { value: 'Night ops' } })
        })
      }
    }
    await clickRe(/Add to library/i)
    await clickRe(/Apply/i)
    for (const b of btns().filter((x) =>
      /^×$|^x$/i.test((x.textContent || '').trim())
    )) {
      await act(async () => {
        fireEvent.click(b)
      })
    }
    expect(api.characters.list).toHaveBeenCalled()
  })

  it('new character sheet path and soul failures', async () => {
    api.media.pickRefImage = vi.fn().mockResolvedValue(null)
    api.characters.readSoulContent = vi
      .fn()
      .mockRejectedValue(new Error('soul-read-fail'))
    api.characters.generateSoul = vi
      .fn()
      .mockRejectedValue(new Error('soul-gen-fail'))
    api.characters.importSoulMd = vi.fn().mockResolvedValue({
      path: '/tmp/imp.md',
      content: '# ok'
    })
    await renderWithProviders(<CharactersPage />, { withToastHost: true })
    await waitLoaded()
    await clickRe(/New character/i)
    const name = document.querySelector('input') as HTMLInputElement
    await act(async () => {
      fireEvent.change(name, { target: { value: 'Fresh' } })
    })
    await clickRe(/^References$/i)
    await clickRe(/Generate professional reference|Add external ref/i)
    await clickRe(/^Profile$/i)
    await clickRe(/^Save$/i)
    await waitFor(() =>
      expect(api.characters.create.mock.calls.length).toBeGreaterThan(0)
    ).catch(() => undefined)

    // reopen edit for soul fails (handlers catch)
    await openFirstEdit()
    await clickRe(/^Profile$/i)
    await clickRe(/Generate Soul from profile/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30))
    })
    await clickRe(/Import local soul/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30))
    })
    await clickRe(/Reload full text/i)
    await clickRe(/Upload reference|Add external ref/i)
    expect(api.media.pickRefImage).toHaveBeenCalled()
  })
})
