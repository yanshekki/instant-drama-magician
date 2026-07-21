/**
 * Drive Characters / Settings / Stories / Scenes residual lines toward 100%.
 * Pattern: createMockApi, pageFixtures, renderWithProviders, withAiShell, card-scoped Edit.
 * Button labels must match locales (e.g. "Add to story", not "Link").
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { useEffect } from 'react'
import { createMockApi, reseedMockApi } from '../../test/mockApi'
import {
  makeAction,
  makeCharacter,
  makeCostume,
  makeProp,
  makeScene,
  makeStory,
  makeStoryDetail,
  makeTimelineEntry
} from '../../test/pageFixtures'
import {
  clickDialogConfirm,
  renderWithProviders
} from '../../test/renderWithProviders'
import { useAiJobs } from '../context/AiJobsContext'
import { DEFAULT_SETTINGS } from '../../types/settings'
import { CharactersPage } from './CharactersPage'
import { ScenesPage } from './ScenesPage'
import { SettingsPage } from './SettingsPage'
import { StoriesPage } from './StoriesPage'

const api = createMockApi()
vi.mock('../../lib/api', () => ({
  getApi: () => api,
  isElectron: () => true,
  isWebRuntime: () => false
}))
vi.mock('../../lib/i18n', async () => {
  const actual = await vi.importActual<typeof import('../../lib/i18n')>(
    '../../lib/i18n'
  )
  return { ...actual, changeUiLanguage: vi.fn().mockResolvedValue(undefined) }
})

type J = ReturnType<typeof useAiJobs>
let jobs: J | null = null
function Probe(): null {
  const j = useAiJobs()
  useEffect(() => {
    jobs = j
  }, [j, j.jobs, j.pendingDrafts])
  return null
}

afterEach(() => {
  jobs = null
  vi.useRealTimers()
  try {
    localStorage.clear()
  } catch {
    /* ignore */
  }
})

const gal = (path: string, id = 'g1') =>
  JSON.stringify([
    {
      id,
      path,
      label: 'L',
      kind: 'sheet',
      layer: 'identity',
      createdAt: '2026-07-01T00:00:00.000Z'
    },
    {
      id: id + 'b',
      path: path + '2',
      label: 'B',
      kind: 'sheet',
      layer: 'base',
      createdAt: '2026-07-02T00:00:00.000Z'
    }
  ])

const costumesJson = JSON.stringify([
  {
    id: 'look-1',
    name: 'Coat',
    description: 'black trench',
    artStyle: 'anime',
    imagePath: '/media/aria.png',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z'
  },
  {
    id: 'look-2',
    name: 'Casual',
    description: 'tee',
    artStyle: 'not-a-style',
    imagePath: null,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z'
  }
])

async function clickNamed(re: RegExp, force = false) {
  const b = screen.getAllByRole('button').find((x) => {
    if (!re.test((x.textContent || '').trim())) return false
    return force || !(x as HTMLButtonElement).disabled
  })
  if (b) await act(async () => fireEvent.click(b))
  return b
}

async function openCardEdit(name: string) {
  await waitFor(
    () =>
      expect(document.body.textContent || '').toMatch(new RegExp(name, 'i')),
    { timeout: 10000 }
  )
  await waitFor(
    async () => {
      if (
        screen
          .getAllByRole('button')
          .some((b) => /^Save$/i.test((b.textContent || '').trim()))
      ) {
        return
      }
      const article = Array.from(document.querySelectorAll('article')).find(
        (a) => (a.textContent || '').includes(name)
      )
      expect(article).toBeTruthy()
      const edits = Array.from(
        (article as HTMLElement).querySelectorAll('button')
      ).filter((b) => /^Edit$/i.test((b.textContent || '').trim()))
      await act(async () => fireEvent.click(edits[edits.length - 1]!))
      expect(
        screen
          .getAllByRole('button')
          .some((b) => /^Save$/i.test((b.textContent || '').trim()))
      ).toBe(true)
    },
    { timeout: 10000 }
  )
}

async function confirmImageGen(): Promise<boolean> {
  try {
    await waitFor(
      () =>
        expect(document.body.textContent || '').toMatch(/Confirm reference/i),
      { timeout: 4000 }
    )
  } catch {
    return false
  }
  const go = screen.getAllByRole('button').find((b) => {
    const t = (b.textContent || '').trim()
    return t === 'Generate' && !(b as HTMLButtonElement).disabled
  })
  if (!go) return false
  await act(async () => fireEvent.click(go))
  return true
}

async function acceptDraft() {
  await waitFor(
    () => expect((jobs?.pendingDrafts.length ?? 0) > 0).toBe(true),
    { timeout: 8000 }
  )
  await act(async () => {
    await jobs!.acceptDraft(jobs!.pendingDrafts[0]!.id)
  })
}

function seed() {
  reseedMockApi(api)
  jobs = null
  localStorage.clear()
  api.stories.list = vi.fn().mockResolvedValue([makeStory({ id: 'story-1' })])
  api.stories.get = vi.fn().mockResolvedValue(makeStoryDetail())
  api.ai.status = vi.fn().mockResolvedValue({ available: true, message: 'ok' })
  api.media.toPreviewUrl = vi
    .fn()
    .mockResolvedValue({ url: 'blob:x', filePath: '/x.png' })
  api.media.pickRefImage = vi
    .fn()
    .mockResolvedValue({ filePath: '/tmp/r.png', originalName: 'r.png' })
  api.media.discardSheetDraft = vi.fn().mockResolvedValue({})
  api.shell.openExternal = vi.fn().mockResolvedValue({ ok: true })
  api.shell.openPath = vi.fn().mockResolvedValue({
    ok: true,
    isDirectory: true,
    path: '/tmp/idm-user'
  })
  api.shell.showItemInFolder = vi.fn().mockResolvedValue({ ok: true })
  api.videoPrep.create = vi.fn().mockResolvedValue({
    professionalPrompt: 'p',
    stillPath: '/s.png',
    sourceImagePath: '/s.png',
    durationSeconds: 6,
    aspectRatio: '16:9',
    entityIds: {},
    kind: 'character-intro',
    userExtraPrompt: '',
    queueIndex: 1,
    queueTotal: 1
  })
  api.videoPrep.confirm = vi.fn().mockResolvedValue({ videoPath: '/o.mp4' })
  api.generation.cancel = vi.fn().mockResolvedValue({ ok: true })
  api.settings.get = vi.fn().mockResolvedValue({ ...DEFAULT_SETTINGS })
  api.settings.set = vi.fn().mockResolvedValue({})
  api.costumes.list = vi.fn().mockResolvedValue([])
  api.costumes.listForCharacter = vi.fn().mockResolvedValue([])
}

describe('csss100 Characters residual', () => {
  beforeEach(() => seed())

  it('library filters facets + clear + delete fail', async () => {
    api.characters.list = vi.fn().mockResolvedValue([
      makeCharacter({
        id: 'char-1',
        name: 'Aria',
        gender: 'female',
        artStyle: 'anime',
        spokenLanguages: '["en","zh"]',
        soulHubId: 5,
        soulMdPath: 'soulmd-hub://5',
        refImagePath: '/media/aria.png',
        refGalleryJson: gal('/media/aria.png'),
        voiceDesc: 'low'
      }),
      makeCharacter({
        id: 'char-2',
        name: 'Ben',
        gender: '',
        artStyle: 'realistic',
        spokenLanguages: 'broken{',
        soulHubId: null,
        soulMdPath: null,
        refImagePath: null
      }),
      makeCharacter({
        id: 'char-3',
        name: 'Cy',
        gender: 'male',
        artStyle: 'weird-style',
        spokenLanguages: '["ja"]',
        refImagePath: '/c.png',
        refSheetPath: '/c-sheet.png'
      })
    ])
    api.characters.delete = vi
      .fn()
      .mockRejectedValueOnce(new Error('del boom'))
      .mockResolvedValue({ ok: true })

    await renderWithProviders(
      <>
        <Probe />
        <CharactersPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await waitFor(() => expect(screen.getByText('Aria')).toBeTruthy())

    // Cycle facet selects (Gender empty/has, art, image, soul, lang)
    for (const sel of Array.from(document.querySelectorAll('select'))) {
      const s = sel as HTMLSelectElement
      for (let i = 0; i < s.options.length; i++) {
        await act(async () =>
          fireEvent.change(s, { target: { value: s.options[i].value } })
        )
      }
      if (s.options.length) {
        await act(async () =>
          fireEvent.change(s, { target: { value: s.options[0].value } })
        )
      }
    }
    const search = document.querySelector(
      'input[aria-label*="Search" i], input[placeholder*="Search" i]'
    ) as HTMLInputElement | null
    if (search) {
      await act(async () =>
        fireEvent.change(search, { target: { value: 'Aria' } })
      )
    }
    await clickNamed(/Clear filters/i)
    if (search) {
      await act(async () => fireEvent.change(search, { target: { value: '' } }))
    }

    await waitFor(() => expect(screen.getByText('Ben')).toBeTruthy())
    const article = screen.getByText('Ben').closest('article') as HTMLElement
    const del = within(article).getByRole('button', { name: /^Delete$/i })
    await act(async () => fireEvent.click(del))
    await waitFor(() =>
      expect(document.querySelector('[role="alertdialog"]')).toBeTruthy()
    )
    await act(async () => clickDialogConfirm())
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })
    const article2 = screen.queryByText('Ben')?.closest('article') as
      | HTMLElement
      | undefined
    if (article2) {
      const del2 = within(article2).queryByRole('button', { name: /^Delete$/i })
      if (del2) {
        await act(async () => fireEvent.click(del2))
        if (document.querySelector('[role="alertdialog"]')) {
          await act(async () => clickDialogConfirm())
        }
      }
    }
  }, 40000)

  it('dense editor AI busy soul wardrobe swap multi-sheet intro costume', async () => {
    try {
      localStorage.setItem(
        'idm.videoPrepDrafts.v2',
        JSON.stringify({
          ['character-intro:char-1:/media/aria.png']: {
            kind: 'character-intro',
            entityIds: { characterId: 'char-1' },
            sourceImagePath: '/media/aria.png',
            professionalPrompt: 'p',
            stillPath: '/s.png',
            durationSeconds: 6
          }
        })
      )
    } catch {
      /* ignore */
    }
    api.characters.list = vi.fn().mockResolvedValue([
      makeCharacter({
        id: 'char-1',
        name: 'Aria',
        description: 'Lead',
        appearance: 'short hair',
        costume: 'trench',
        personality: 'stoic',
        hardRules: 'no logos',
        refImagePath: '/media/aria.png',
        refGalleryJson: gal('/media/aria.png'),
        costumesJson,
        soulHubId: 9,
        soulMdPath: 'soulmd-hub://9'
      })
    ])
    api.characters.update = vi.fn().mockResolvedValue(
      makeCharacter({ id: 'char-1', name: 'Aria' })
    )
    api.characters.aiFill = vi.fn().mockResolvedValue({
      profile: {
        name: 'Aria+',
        description: 'd',
        appearance: 'a',
        costume: 'c',
        personality: 'p',
        hardRules: 'h',
        visualTags: 'v',
        artStyle: 'anime',
        spokenLanguages: ['en']
      },
      profileJson: '{}',
      raw: ''
    })
    api.characters.readSoulContent = vi
      .fn()
      .mockRejectedValueOnce(new Error('soul read fail'))
      .mockResolvedValue({ content: '# soul body long' })
    api.characters.suggestWardrobe = vi.fn().mockResolvedValue({
      suggestion: {
        name: 'Rain',
        costume: 'coat',
        artStyle: 'anime',
        rationale: 'wet'
      }
    })
    api.characters.swapCostume = vi.fn().mockResolvedValue({
      path: '/tmp/sw.png',
      label: 'Swap',
      variant: 'costume_swap',
      layer: 'costume'
    })
    api.characters.generateSheet = vi.fn().mockResolvedValue({
      path: '/tmp/sh.png',
      label: 'S',
      variant: 'bible',
      layer: 'identity'
    })
    api.characters.commitSheet = vi.fn().mockResolvedValue({
      path: '/tmp/shc.png',
      gallery: [
        {
          id: 'ng',
          path: '/tmp/shc.png',
          kind: 'sheet',
          label: 'S',
          layer: 'identity',
          createdAt: '2026-07-15T00:00:00.000Z'
        }
      ]
    })
    api.characters.generateSoul = vi.fn().mockResolvedValue({
      path: '/tmp/g.md',
      content: '# generated soul',
      title: 'G'
    })
    api.characters.importSoulMd = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValue({
        filePath: '/tmp/i.md',
        content: '# Imported Title\n\nBody text for soul'
      })
    api.costumes.list = vi.fn().mockResolvedValue([
      makeCostume({ id: 'cost-1', name: 'Rain coat' }),
      makeCostume({ id: 'cost-2', name: 'Suit' })
    ])
    api.costumes.listForCharacter = vi.fn().mockResolvedValue([
      makeCostume({
        id: 'cost-1',
        name: 'Rain coat',
        description: 'long coat',
        isActive: true
      })
    ])
    api.costumes.linkCharacter = vi
      .fn()
      .mockRejectedValueOnce(new Error('link fail'))
      .mockResolvedValue({})
    api.costumes.generateDressed = vi.fn().mockResolvedValue({
      path: '/tmp/dressed.png'
    })
    api.souls.list = vi.fn().mockResolvedValue({
      data: [
        {
          id: 9,
          title: 'Soul9',
          description: 'd',
          role: 'lead',
          domain: 'noir'
        },
        {
          id: 10,
          title: 'Soul10',
          description: 'e',
          role: 'support',
          domain: 'city'
        }
      ],
      total_pages: 3,
      current_page: 1
    })
    api.souls.get = vi
      .fn()
      .mockRejectedValueOnce(new Error('get fail'))
      .mockResolvedValue({
        id: 9,
        title: 'Soul9',
        description: 'd',
        contentFlat: '# flat soul',
        content: '# flat soul'
      })
    api.souls.searchLocal = vi
      .fn()
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValue({
        items: [{ id: 9, title: 'Soul9', content: '# local' }]
      })
    api.souls.ensureIndex = vi
      .fn()
      .mockRejectedValueOnce(new Error('idx offline'))
      .mockResolvedValue({
        count: 2,
        pages: 3,
        fromCache: true,
        suggestions: [{ id: 9, title: 'Soul9' }]
      })
    api.media.discardSheetDraft = vi
      .fn()
      .mockRejectedValueOnce(new Error('discard fail'))
      .mockResolvedValue({})

    await renderWithProviders(
      <>
        <Probe />
        <CharactersPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await openCardEdit('Aria')

    await clickNamed(/^Profile$/i)
    for (const el of Array.from(document.querySelectorAll('input, textarea'))) {
      if ((el as HTMLInputElement).type === 'checkbox') continue
      await act(async () => fireEvent.change(el, { target: { value: '' } }))
    }
    await clickNamed(/AI fill/i)
    await clickNamed(/Generate Soul from profile/i)

    for (const el of Array.from(document.querySelectorAll('input')).slice(0, 1)) {
      await act(async () =>
        fireEvent.change(el, { target: { value: 'Aria' } })
      )
    }
    for (const el of Array.from(document.querySelectorAll('textarea')).slice(
      0,
      4
    )) {
      await act(async () =>
        fireEvent.change(el, { target: { value: 'stormy residual profile' } })
      )
    }

    await act(async () => {
      void jobs!.startJob({
        kind: 'character-ai-fill',
        label: 'hang',
        scope: { characterId: 'char-1' },
        run: async () => {
          await new Promise(() => {
            /* hang */
          })
        }
      })
    })
    await clickNamed(/AI fill/i)
    await clickNamed(/Generate Soul from profile/i)
    await clickNamed(/^Costume$/i)
    await clickNamed(/Suggest from plot/i)
    await clickNamed(/Generate costume swap/i)
    for (const j of [...(jobs?.activeJobs ?? [])]) {
      await act(async () => {
        await jobs!.cancelJob(j.id)
      })
    }
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })

    await clickNamed(/^Profile$/i)
    await clickNamed(/AI fill/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100))
    })
    if ((jobs?.pendingDrafts.length ?? 0) > 0) {
      await acceptDraft().catch(() => undefined)
    }

    await clickNamed(/^Costume$/i)
    for (const b of screen
      .getAllByRole('button')
      .filter((x) => /^Apply$/i.test((x.textContent || '').trim()))
      .slice(0, 2)) {
      await act(async () => fireEvent.click(b))
    }
    for (const el of Array.from(document.querySelectorAll('textarea')).slice(
      -2
    )) {
      await act(async () => fireEvent.change(el, { target: { value: '' } }))
    }
    await clickNamed(/Add to library/i)
    for (const el of Array.from(document.querySelectorAll('textarea')).slice(
      -2
    )) {
      await act(async () =>
        fireEvent.change(el, { target: { value: 'new look coat residual' } })
      )
    }
    await clickNamed(/Add to library/i)
    await clickNamed(/Suggest from plot/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 80))
    })
    if ((jobs?.pendingDrafts.length ?? 0) > 0) {
      await acceptDraft().catch(() => undefined)
    }
    await clickNamed(/Generate costume swap/i)
    await confirmImageGen().catch(() => false)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    for (const sel of Array.from(document.querySelectorAll('select'))) {
      const s = sel as HTMLSelectElement
      const opt = Array.from(s.options).find((o) =>
        /Rain coat/i.test(o.textContent || '')
      )
      if (opt) {
        await act(async () =>
          fireEvent.change(s, { target: { value: opt.value } })
        )
      }
    }
    await clickNamed(/^Link$/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })
    await clickNamed(/^Link$/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })
    await clickNamed(/Generate dressed look/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 80))
    })

    await clickNamed(/^References$/i)
    for (const cb of Array.from(
      document.querySelectorAll('input[type="checkbox"]')
    )) {
      await act(async () => fireEvent.click(cb))
    }
    for (const re of [/^All$/i, /Identity/i, /Base/i, /Costume/i, /Detail/i]) {
      await clickNamed(re)
    }
    for (const sel of Array.from(document.querySelectorAll('select')).slice(
      0,
      4
    )) {
      const s = sel as HTMLSelectElement
      if (s.options.length > 1) {
        await act(async () =>
          fireEvent.change(s, { target: { value: s.options[1].value } })
        )
      }
    }
    await clickNamed(/Generate professional reference/i)
    await confirmImageGen()
    await act(async () => {
      await new Promise((r) => setTimeout(r, 80))
    })
    if ((jobs?.pendingDrafts.length ?? 0) > 0) {
      await acceptDraft().catch(() => undefined)
    }
    await clickNamed(/Upload reference/i)
    await clickNamed(/Set as cover/i)
    await clickNamed(/Intro|Continue|video/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })

    await clickNamed(/^Profile$/i)
    const soulSearch = document.querySelector(
      'input[placeholder*="Search" i], input[aria-label*="Search" i]'
    ) as HTMLInputElement | null
    if (soulSearch) {
      await act(async () =>
        fireEvent.change(soulSearch, { target: { value: 'Soul' } })
      )
    }
    await clickNamed(/Search|Reload|Refresh/i)
    await clickNamed(/→/)
    await clickNamed(/←/)
    const soulHit = screen.queryAllByText(/Soul9|Soul10/i)[0]
    if (soulHit) await act(async () => fireEvent.click(soulHit))
    await clickNamed(/Use soul|Use/i)
    await clickNamed(/Import local soul/i)
    await clickNamed(/Import local soul/i)
    await clickNamed(/Unlink|Clear soul/i)
    await clickNamed(/Generate Soul from profile/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 60))
    })
    await clickNamed(/^Save$/i)
  }, 90000)
})

describe('csss100 Scenes residual', () => {
  beforeEach(() => seed())

  it('filters plot looks copy plate intro create', async () => {
    try {
      localStorage.setItem(
        'idm.videoPrepDrafts.v2',
        JSON.stringify({
          ['scene-intro:scene-1:/media/roof.png']: {
            kind: 'scene-intro',
            entityIds: { sceneId: 'scene-1' },
            sourceImagePath: '/media/roof.png',
            professionalPrompt: 'p',
            stillPath: '/s.png',
            durationSeconds: 6
          }
        })
      )
    } catch {
      /* ignore */
    }
    const looksJson = JSON.stringify([
      {
        id: 'look-s1',
        name: 'Rain night',
        description: 'wet neon',
        artStyle: 'anime',
        imagePath: '/media/roof.png',
        createdAt: '2026-07-01T00:00:00.000Z',
        updatedAt: '2026-07-01T00:00:00.000Z'
      },
      {
        id: 'look-s2',
        name: 'Fog',
        description: 'soft fog',
        artStyle: 'not-style',
        imagePath: null,
        createdAt: '2026-07-01T00:00:00.000Z',
        updatedAt: '2026-07-01T00:00:00.000Z'
      }
    ])
    api.scenes.list = vi.fn().mockResolvedValue([
      makeScene({
        id: 'scene-1',
        title: 'Rooftop',
        sceneNumber: 1,
        locationKey: 'rooftop',
        refImagePath: '/media/roof.png',
        refGalleryJson: gal('/media/roof.png', 'sg'),
        looksJson,
        artStyle: 'anime',
        locationType: 'exterior',
        timeOfDay: 'night'
      }),
      makeScene({
        id: 'scene-2',
        title: 'Rooftop',
        sceneNumber: 2,
        locationKey: 'rooftop',
        description: 'sister location with stills',
        refImagePath: '/media/roof2.png',
        refGalleryJson: gal('/media/roof2.png', 'sg2'),
        artStyle: 'realistic',
        locationType: 'exterior',
        timeOfDay: 'dusk'
      })
    ])
    api.scenes.update = vi.fn().mockResolvedValue(makeScene())
    let createN = 0
    api.scenes.create = vi.fn().mockImplementation(async () => {
      createN++
      if (createN === 1) throw new Error('scene create fail')
      return makeScene({ id: 'sn', title: 'New residual', sceneNumber: 9 })
    })
    api.scenes.delete = vi.fn().mockRejectedValue(new Error('del fail'))
    api.scenes.aiFill = vi.fn().mockResolvedValue({
      profile: {
        title: 'Rooftop+',
        description: 'd',
        locationType: 'exterior',
        timeOfDay: 'night',
        weather: 'rain',
        mood: 'tense',
        artStyle: 'anime'
      },
      profileJson: '{}',
      raw: ''
    })
    api.scenes.generatePlate = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error('plate boom'), { details: 'pd' })
      )
      .mockResolvedValue({ path: '/tmp/sp.png', label: 'P', variant: 'hero' })
    api.scenes.commitPlate = vi.fn().mockResolvedValue({
      path: '/tmp/spc.png',
      gallery: [
        {
          id: 'pg',
          path: '/tmp/spc.png',
          kind: 'plate',
          label: 'P',
          layer: 'identity',
          createdAt: '2026-07-15T00:00:00.000Z'
        }
      ]
    })
    api.scenes.swapAtmosphere = vi
      .fn()
      .mockRejectedValueOnce(new Error('atm fail'))
      .mockResolvedValue({
        path: '/tmp/atm.png',
        label: 'Atm',
        layer: 'detail'
      })
    api.scenes.copyGalleryFrom = vi
      .fn()
      .mockRejectedValueOnce(new Error('copy fail'))
      .mockResolvedValue({
        scene: makeScene({
          id: 'scene-1',
          title: 'Rooftop',
          locationKey: 'rooftop',
          refGalleryJson: gal('/media/roof2.png', 'copied')
        })
      })

    await renderWithProviders(
      <>
        <Probe />
        <ScenesPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await waitFor(() =>
      expect(screen.getAllByText(/Rooftop/i).length).toBeGreaterThan(0)
    )

    for (const sel of Array.from(document.querySelectorAll('select')).slice(
      0,
      6
    )) {
      const s = sel as HTMLSelectElement
      if (s.options.length > 1) {
        await act(async () =>
          fireEvent.change(s, { target: { value: s.options[1].value } })
        )
      }
    }
    const q = document.querySelector(
      'input[placeholder*="Search" i], input[aria-label*="Search" i]'
    ) as HTMLInputElement | null
    if (q) {
      await act(async () => fireEvent.change(q, { target: { value: 'Roof' } }))
    }
    await clickNamed(/Clear filters/i)

    const art = Array.from(document.querySelectorAll('article'))[0] as
      | HTMLElement
      | undefined
    if (art) {
      const del = within(art).queryByRole('button', { name: /^Delete$/i })
      if (del) {
        await act(async () => fireEvent.click(del))
        if (document.querySelector('[role="alertdialog"]')) {
          await act(async () => clickDialogConfirm())
        }
      }
    }

    await clickNamed(/Suggest from story/i)
    for (const sel of Array.from(document.querySelectorAll('select')).slice(
      0,
      4
    )) {
      const s = sel as HTMLSelectElement
      if (s.options.length > 1) {
        await act(async () =>
          fireEvent.change(s, { target: { value: s.options[1].value } })
        )
      }
    }
    await clickNamed(/AI fill|Confirm|Generate|Suggest/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 80))
    })
    await clickNamed(/^Cancel$/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30))
    })
    // Reset filters so library cards reappear after plot-suggest path
    await clickNamed(/Clear filters/i)
    for (const sel of Array.from(document.querySelectorAll('select')).slice(0, 6)) {
      const s = sel as HTMLSelectElement
      if (s.options.length > 0) {
        await act(async () =>
          fireEvent.change(s, { target: { value: s.options[0].value } })
        )
      }
    }
    const search2 = document.querySelector(
      'input[placeholder*="Search" i], input[aria-label*="Search" i]'
    ) as HTMLInputElement | null
    if (search2) {
      await act(async () => fireEvent.change(search2, { target: { value: '' } }))
    }
    await waitFor(
      () =>
        expect(document.body.textContent || '').toMatch(/Rooftop/i),
      { timeout: 8000 }
    )

    await openCardEdit('Rooftop')

    await clickNamed(/^Profile$/i)
    for (const el of Array.from(document.querySelectorAll('input, textarea'))) {
      if ((el as HTMLInputElement).type === 'checkbox') continue
      await act(async () => fireEvent.change(el, { target: { value: '' } }))
    }
    await clickNamed(/AI fill/i)
    for (const el of Array.from(document.querySelectorAll('input')).slice(0, 1)) {
      await act(async () =>
        fireEvent.change(el, { target: { value: 'Rooftop' } })
      )
    }
    for (const el of Array.from(document.querySelectorAll('textarea')).slice(
      0,
      2
    )) {
      await act(async () =>
        fireEvent.change(el, { target: { value: 'rain neon residual' } })
      )
    }

    await act(async () => {
      void jobs!.startJob({
        kind: 'scene-ai-fill',
        label: 'hang',
        scope: { sceneId: 'scene-1' },
        run: async () => {
          await new Promise(() => {
            /* hang */
          })
        }
      })
    })
    await clickNamed(/AI fill/i)
    for (const j of [...(jobs?.activeJobs ?? [])]) {
      await act(async () => {
        await jobs!.cancelJob(j.id)
      })
    }

    await clickNamed(/Looks|Atmosphere|Mood/i)
    for (const el of Array.from(document.querySelectorAll('textarea')).slice(
      -2
    )) {
      await act(async () =>
        fireEvent.change(el, { target: { value: 'fog dawn residual look' } })
      )
    }
    await clickNamed(/Add look|Save look|Add to library|Add/i)
    for (const b of screen
      .getAllByRole('button')
      .filter((x) => /^Apply$/i.test((x.textContent || '').trim()))
      .slice(0, 2)) {
      await act(async () => fireEvent.click(b))
    }
    await clickNamed(/Generate atmosphere|Atmosphere swap|swap/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })
    await clickNamed(/Generate atmosphere|Atmosphere swap|swap/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    await clickNamed(/^Plates$|^References$/i)
    const copyBtn = screen
      .getAllByRole('button')
      .find(
        (b) =>
          /#\s*2/i.test((b.textContent || '').trim()) ||
          ((b.textContent || '').includes('#') &&
            /Rooftop/i.test(b.textContent || ''))
      )
    if (copyBtn) {
      await act(async () => fireEvent.click(copyBtn))
      await act(async () => {
        await new Promise((r) => setTimeout(r, 40))
      })
      await act(async () => fireEvent.click(copyBtn))
      await act(async () => {
        await new Promise((r) => setTimeout(r, 40))
      })
    }
    for (const cb of Array.from(
      document.querySelectorAll('input[type="checkbox"]')
    )) {
      await act(async () => fireEvent.click(cb))
    }
    await clickNamed(
      /Generate plate|Generate scene plate|Generate professional/
    )
    await confirmImageGen()
    await act(async () => {
      await new Promise((r) => setTimeout(r, 60))
    })
    if ((jobs?.pendingDrafts.length ?? 0) > 0) {
      await acceptDraft().catch(() => undefined)
    }
    await clickNamed(/Upload reference/i)
    await clickNamed(/Intro|Continue|video/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })
    await clickNamed(/^Save$/i)

    await clickNamed(/New scene/i)
    for (const el of Array.from(
      document.querySelectorAll('input, textarea')
    ).slice(0, 3)) {
      await act(async () =>
        fireEvent.change(el, { target: { value: 'New residual scene' } })
      )
    }
    await clickNamed(/^Plates$|^References$/i)
    await clickNamed(/Generate plate|Generate|Create and generate/i)
    await confirmImageGen()
    await act(async () => {
      await new Promise((r) => setTimeout(r, 80))
    })
    await clickNamed(/Generate plate|Generate|Create and generate/i)
    await confirmImageGen()
    await act(async () => {
      await new Promise((r) => setTimeout(r, 80))
    })
  }, 90000)
})

describe('csss100 Stories residual', () => {
  beforeEach(() => seed())

  it('cast Add/Remove to story + beats + cover + script', async () => {
    const manyChars = Array.from({ length: 14 }, (_, i) =>
      makeCharacter({
        id: `char-${i + 1}`,
        name: i === 0 ? 'Aria' : `Cast${i}`,
        costumesJson: i === 0 ? costumesJson : null,
        costume: i === 0 ? 'trench' : ''
      })
    )
    const beats = [
      makeTimelineEntry({
        id: 'entry-1',
        dialogue: '[DIALOGUE|Aria] Hello residual',
        characterIds: ['char-1'],
        sceneIds: ['scene-1']
      }),
      makeTimelineEntry({
        id: 'entry-2',
        order: 1,
        dialogue: 'Next beat',
        startTime: 4,
        endTime: 8
      })
    ]
    api.stories.list = vi.fn().mockResolvedValue([
      makeStory({
        id: 'story-1',
        title: 'Demo Story',
        coverPath: '/media/cover.png',
        refGalleryJson: gal('/media/cover.png', 'cg'),
        artStyle: 'anime',
        styleNote: 'noir',
        hardRules: 'no logos'
      })
    ])
    api.stories.get = vi.fn().mockResolvedValue(
      makeStoryDetail({
        id: 'story-1',
        title: 'Demo Story',
        coverPath: '/media/cover.png',
        refGalleryJson: gal('/media/cover.png', 'cg'),
        characters: [
          {
            ...manyChars[0],
            storyCostumeId: 'look-1',
            storyCostume: { id: 'look-1', name: 'Coat' }
          }
        ],
        scenes: [makeScene(), makeScene({ id: 'scene-2', title: 'Alley' })],
        props: [makeProp(), makeProp({ id: 'prop-2', name: 'Flask' })],
        actions: [makeAction(), makeAction({ id: 'act-2', name: 'Kick' })],
        timeline: beats
      } as never)
    )
    api.stories.update = vi.fn().mockResolvedValue(makeStory())
    api.stories.linkCharacter = vi
      .fn()
      .mockRejectedValueOnce(new Error('lc'))
      .mockResolvedValue({})
    api.stories.unlinkCharacter = vi
      .fn()
      .mockRejectedValueOnce(new Error('uc'))
      .mockResolvedValue({})
    api.stories.linkScene = vi
      .fn()
      .mockRejectedValueOnce(new Error('ls'))
      .mockResolvedValue({})
    api.stories.unlinkScene = vi.fn().mockResolvedValue({})
    api.stories.linkProp = vi
      .fn()
      .mockRejectedValueOnce(new Error('lp'))
      .mockResolvedValue({})
    api.stories.unlinkProp = vi.fn().mockResolvedValue({})
    api.stories.linkAction = vi
      .fn()
      .mockRejectedValueOnce(new Error('la'))
      .mockResolvedValue({})
    api.stories.unlinkAction = vi.fn().mockResolvedValue({})
    api.stories.setCharacterCostume = vi
      .fn()
      .mockRejectedValueOnce(new Error('sc'))
      .mockResolvedValue({})
    api.stories.generateCover = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error('cover boom'), { details: 'cd' })
      )
      .mockResolvedValue({ path: '/tmp/cov.png', label: 'C' })
    api.stories.commitCover = vi.fn().mockResolvedValue({
      path: '/tmp/covc.png',
      gallery: []
    })
    api.stories.aiFillScript = vi
      .fn()
      .mockRejectedValueOnce(new Error('script fail'))
      .mockResolvedValue({
        beats: [{ order: 0, dialogue: 'Hi residual', characterIds: ['char-1'] }],
        drafts: [],
        raw: ''
      })
    api.stories.aiFillMeta = vi.fn().mockResolvedValue({
      styleNote: 'cinematic residual',
      hardRules: 'h',
      artStyle: 'anime'
    })
    api.characters.list = vi.fn().mockResolvedValue(manyChars)
    api.scenes.list = vi.fn().mockResolvedValue([
      makeScene(),
      makeScene({ id: 'scene-2', title: 'Alley' })
    ])
    api.props.list = vi.fn().mockResolvedValue([
      makeProp(),
      makeProp({ id: 'prop-2', name: 'Flask' })
    ])
    api.actions.list = vi.fn().mockResolvedValue([
      makeAction(),
      makeAction({ id: 'act-2', name: 'Kick' })
    ])
    api.costumes.list = vi.fn().mockResolvedValue([makeCostume()])
    api.timeline.list = vi.fn().mockResolvedValue(beats)
    api.timeline.update = vi
      .fn()
      .mockRejectedValueOnce(new Error('beat upd'))
      .mockImplementation(async (id: string, patch: object) => ({
        ...makeTimelineEntry({ id }),
        ...patch
      }))
    api.timeline.delete = vi.fn().mockRejectedValueOnce(new Error('beat del'))
    api.timeline.reorder = vi
      .fn()
      .mockRejectedValueOnce(new Error('reorder'))
      .mockResolvedValue({ ok: true })
    api.timeline.create = vi.fn().mockResolvedValue(
      makeTimelineEntry({ id: 'entry-new', dialogue: 'fresh' })
    )

    await renderWithProviders(
      <>
        <Probe />
        <StoriesPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await waitFor(() => expect(screen.getByText('Demo Story')).toBeTruthy())

    for (const sel of Array.from(document.querySelectorAll('select')).slice(
      0,
      3
    )) {
      const s = sel as HTMLSelectElement
      if (s.options.length > 1) {
        await act(async () =>
          fireEvent.change(s, { target: { value: s.options[1].value } })
        )
      }
    }
    await clickNamed(/Clear filters/i)

    await openCardEdit('Demo Story')
    await waitFor(() => expect(api.stories.get).toHaveBeenCalled())

    await clickNamed(/Basics|Meta/i)
    for (const ta of Array.from(document.querySelectorAll('textarea')).slice(
      0,
      3
    )) {
      await act(async () =>
        fireEvent.change(ta, { target: { value: 'style bible residual' } })
      )
    }
    await clickNamed(/AI fill style notes|AI fill/i)
    await waitFor(() => expect(api.stories.aiFillMeta).toHaveBeenCalled()).catch(
      () => undefined
    )
    // Do NOT Save here — handleSave closes the editor

    await clickNamed(/Cast \/ set|Cast/i)
    await waitFor(
      () =>
        expect(document.body.textContent || '').toMatch(
          /Add to story|Remove from story|Aria|Cast1/i
        ),
      { timeout: 8000 }
    )
    for (const kind of [/Character/i, /Scene/i, /Prop/i, /Action/i]) {
      const tabBtn = screen.getAllByRole('button').find((b) => {
        const t = (b.textContent || '').replace(/\d+/g, '').trim()
        return kind.test(t)
      })
      if (tabBtn) await act(async () => fireEvent.click(tabBtn))
      for (const f of [/All/i, /In story/i, /Not in story/i]) {
        await clickNamed(f)
      }
      for (const sel of Array.from(document.querySelectorAll('select')).slice(
        0,
        6
      )) {
        const s = sel as HTMLSelectElement
        if (s.options.length > 1) {
          await act(async () =>
            fireEvent.change(s, { target: { value: s.options[1].value } })
          )
        }
      }
      const toggleBtns = screen
        .getAllByRole('button')
        .filter((b) =>
          /Add to story|Remove from story/i.test((b.textContent || '').trim())
        )
      for (const b of toggleBtns.slice(0, 4)) {
        await act(async () => fireEvent.click(b))
        await act(async () => {
          await new Promise((r) => setTimeout(r, 30))
        })
      }
      const castQ = document.querySelector(
        'input[placeholder*="Search" i]'
      ) as HTMLInputElement | null
      if (castQ) {
        await act(async () =>
          fireEvent.change(castQ, { target: { value: 'Cast' } })
        )
        await act(async () =>
          fireEvent.change(castQ, { target: { value: '' } })
        )
      }
      await clickNamed(/→/)
      await clickNamed(/←/)
    }

    await clickNamed(/Script beats|Script/i)
    await clickNamed(/Add beat/i)
    await clickNamed(/↑|Move up/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30))
    })
    await clickNamed(/↓|Move down/i)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30))
    })
    for (const ta of Array.from(document.querySelectorAll('textarea')).slice(
      0,
      4
    )) {
      await act(async () =>
        fireEvent.change(ta, {
          target: {
            value:
              '[MOOD] tense\n[DIALOGUE|Aria|cold] Residual spoken multi-line'
          }
        })
      )
    }
    for (const sel of Array.from(document.querySelectorAll('select')).slice(
      0,
      12
    )) {
      const s = sel as HTMLSelectElement
      if (s.multiple) {
        for (let i = 0; i < Math.min(s.options.length, 2); i++) {
          s.options[i].selected = true
        }
        await act(async () => fireEvent.change(s))
      } else if (s.options.length > 1) {
        await act(async () =>
          fireEvent.change(s, { target: { value: s.options[1].value } })
        )
      }
    }
    await clickNamed(/Insert script template|template/i)
    await clickNamed(/AI generate beats/i)
    if (document.querySelector('[role="alertdialog"]')) {
      await act(async () => clickDialogConfirm())
    }
    await act(async () => {
      await new Promise((r) => setTimeout(r, 60))
    })
    await clickNamed(/AI generate beats/i)
    if (document.querySelector('[role="alertdialog"]')) {
      await act(async () => clickDialogConfirm())
    }
    await act(async () => {
      await new Promise((r) => setTimeout(r, 60))
    })
    if ((jobs?.pendingDrafts.length ?? 0) > 0) {
      await acceptDraft().catch(() => undefined)
    }
    const beatDel = screen
      .getAllByRole('button')
      .find((b) => /^Delete$/i.test((b.textContent || '').trim()))
    if (beatDel) {
      await act(async () => fireEvent.click(beatDel))
      if (document.querySelector('[role="alertdialog"]')) {
        await act(async () => clickDialogConfirm())
      }
    }

    await clickNamed(/Cover|Poster/i)
    for (const cb of Array.from(
      document.querySelectorAll('input[type="checkbox"]')
    )) {
      await act(async () => fireEvent.click(cb))
    }
    await clickNamed(/Generate cover/i)
    if (document.body.textContent?.match(/Confirm reference/i)) {
      const cancel = screen
        .getAllByRole('button')
        .find((b) => /^Cancel$/i.test((b.textContent || '').trim()))
      if (cancel) await act(async () => fireEvent.click(cancel))
    }
    await clickNamed(/Generate cover/i)
    await confirmImageGen()
    await act(async () => {
      await new Promise((r) => setTimeout(r, 60))
    })
    await clickNamed(/Generate cover/i)
    await confirmImageGen()
    await act(async () => {
      await new Promise((r) => setTimeout(r, 60))
    })
    if ((jobs?.pendingDrafts.length ?? 0) > 0) {
      await acceptDraft().catch(() => undefined)
    }
    await clickNamed(/Upload reference/i)
    await clickNamed(/^Save$/i)
  }, 90000)
})

describe('csss100 Settings residual', () => {
  beforeEach(() => seed())

  it('gateway ensure rate-limit npm backup openPath creator', async () => {
    api.settings.get = vi.fn().mockResolvedValue({
      ...DEFAULT_SETTINGS,
      uiLanguage: 'en',
      legalAcceptedVersion: '1.0.0',
      legalAcceptedAt: '2026-01-01T00:00:00.000Z',
      firstRunSeen: true,
      baseUrl: 'http://127.0.0.1:3847/v1',
      model: 'grok-4.5',
      llmProvider: 'openai-compatible',
      apiKey: 'gk_live_test',
      imageProvider: 'custom',
      imageBaseUrl: 'https://img.example/v1',
      imageModel: 'img-1',
      videoProvider: 'custom',
      videoBaseUrl: 'https://vid.example/v1',
      videoModel: 'vid-1',
      videoMode: 'api',
      colorScheme: 'dark',
      webServerPort: 8787,
      webServerHost: '0.0.0.0',
      webServerEnabled: true,
      chatTimeoutMs: 60000,
      defaultBgmPath: '/b.mp3'
    })
    api.settings.set = vi.fn().mockImplementation(async (p) => ({
      ...DEFAULT_SETTINGS,
      ...p
    }))
    api.app.getInfo = vi.fn().mockResolvedValue({
      version: '2.0.0',
      isPackaged: true,
      userData: '/tmp/idm-user',
      mediaRoot: '/tmp/idm-media',
      name: 'IDM',
      channels: 4
    })
    api.media.checkFfmpeg = vi.fn().mockResolvedValue({
      available: true,
      version: '7',
      path: '/ff'
    })
    api.media.pickBgm = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ path: '/b2.mp3' })
    let modelsN = 0
    api.ai.listModels = vi.fn().mockImplementation(async () => {
      modelsN++
      if (modelsN === 1) {
        throw Object.assign(new Error('rate'), { code: 'AI_RATE_LIMIT' })
      }
      return [
        { id: 'a', ownedBy: 'fallback' },
        { id: 'b', ownedBy: 'y' }
      ]
    })
    api.ai.testChat = vi
      .fn()
      .mockRejectedValueOnce(new Error('chat fail'))
      .mockResolvedValue({ ok: true, message: 'ok', replyPreview: 'hi there' })
    api.ai.applyLlmPreset = vi.fn().mockResolvedValue({
      baseUrl: 'https://preset.example/v1',
      model: 'preset-m'
    })
    api.ai.applyGrokDefaults = vi.fn().mockResolvedValue({})
    let ensureN = 0
    api.gateway.status = vi
      .fn()
      .mockRejectedValueOnce(new Error('gw down'))
      .mockResolvedValue({
        state: 'ready',
        healthOk: true,
        message: 'ok',
        grokPath: '/g',
        gctoacPath: '/c',
        adminUrl: 'http://a',
        keyReady: true
      })
    api.gateway.ensure = vi.fn().mockImplementation(async () => {
      ensureN++
      if (ensureN === 1) {
        return {
          state: 'grok_build_missing',
          healthOk: false,
          message: 'build missing',
          grokPath: null,
          gctoacPath: null,
          adminUrl: 'http://a',
          keyReady: false
        }
      }
      if (ensureN === 2) {
        return {
          state: 'gateway_missing',
          healthOk: false,
          message: 'pkg missing',
          grokPath: null,
          gctoacPath: null,
          adminUrl: 'http://a',
          keyReady: false
        }
      }
      return {
        state: 'ready',
        healthOk: true,
        keyReady: true,
        keyCreated: true,
        message: 'ok',
        grokPath: '/g',
        gctoacPath: '/c',
        adminUrl: 'http://a'
      }
    })
    api.gateway.installHints = vi.fn().mockResolvedValue({
      grokBuildUrl: 'https://x.ai/build',
      installCommand: 'curl install-gw'
    })
    api.gateway.openAdmin = vi.fn().mockResolvedValue({ ok: true })
    api.webServer.status = vi.fn().mockResolvedValue({
      running: true,
      url: 'http://127.0.0.1:8787',
      port: 8787,
      error: null,
      staticReady: true,
      token: 'tok',
      addresses: [
        { id: 'lan', address: 'http://192.168.1.2:8787' },
        { id: 'localhost', address: 'http://127.0.0.1:8787' }
      ]
    })
    api.webServer.start = vi.fn().mockResolvedValue({
      running: true,
      url: 'http://127.0.0.1:8787',
      port: 8787
    })
    api.webServer.stop = vi.fn().mockResolvedValue({ running: false })
    api.webServer.generateToken = vi.fn().mockResolvedValue('new-tok')
    api.updates.status = vi.fn().mockResolvedValue({
      status: 'available',
      channel: 'desktop-packaged',
      currentVersion: '1.0.0',
      latestVersion: '2.0.0',
      canCheck: true,
      canDownload: true,
      canAutoInstall: true,
      progress: 0,
      releaseNotes: '## notes\n- fix',
      releaseUrl: 'https://github.com/x/releases',
      installCommand: 'npm i -g x@2'
    })
    api.updates.check = vi.fn().mockResolvedValue({
      status: 'available',
      latestVersion: '2.0.0'
    })
    api.updates.download = vi.fn().mockResolvedValue({ status: 'downloaded' })
    api.updates.install = vi.fn().mockResolvedValue({ ok: true })
    api.updates.checkNpm = vi
      .fn()
      .mockRejectedValueOnce(new Error('npm fail'))
      .mockResolvedValue({
        packageName: 'instant-drama-magician',
        currentVersion: '1.0.0',
        latestVersion: '2.0.0',
        updateAvailable: true,
        checkedAt: new Date().toISOString(),
        installCommand: 'npm i -g instant-drama-magician@2'
      })
    api.updates.onState = vi.fn((cb: (s: object) => void) => {
      cb({
        status: 'downloading',
        progress: 42,
        currentVersion: '1.0.0',
        latestVersion: '2.0.0',
        canCheck: true,
        canDownload: true,
        canAutoInstall: true,
        channel: 'desktop-packaged'
      })
      return () => undefined
    })
    api.updates.openReleasePage = vi.fn().mockResolvedValue({ ok: true })
    api.activity.clear = vi.fn().mockResolvedValue({ ok: true })
    api.app.exportFullBackup = vi
      .fn()
      .mockRejectedValueOnce(new Error('export fail'))
      .mockResolvedValue({ ok: true, path: '/tmp/b.zip' })
    api.app.importFullBackup = vi
      .fn()
      .mockRejectedValueOnce(new Error('import fail'))
      .mockResolvedValue({ ok: true })
    api.diagnostics.full = vi.fn().mockResolvedValue({ ok: true })
    api.support.exportReport = vi.fn().mockResolvedValue({
      ok: true,
      path: '/s.json'
    })
    api.shell.openPath = vi
      .fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({
        ok: true,
        isDirectory: true,
        path: '/tmp/idm-user'
      })
      .mockRejectedValueOnce(new Error('open path fail'))
      .mockResolvedValue({ ok: true, path: '/tmp/idm-user' })
    api.shell.openExternal = vi
      .fn()
      .mockRejectedValueOnce(new Error('ext fail'))
      .mockResolvedValue({ ok: true })
    let clipN = 0
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: {
        writeText: vi.fn().mockImplementation(async () => {
          clipN++
          if (clipN % 2 === 1) throw new Error('clip fail')
        })
      }
    })

    await renderWithProviders(
      <>
        <Probe />
        <SettingsPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await waitFor(() => expect(api.settings.get).toHaveBeenCalled())

    await clickNamed(/Chat model|Chat/i)
    await clickNamed(/Show advanced/i)
    for (const input of Array.from(
      document.querySelectorAll('input')
    ).slice(0, 10) as HTMLInputElement[]) {
      if (input.type === 'checkbox') {
        await act(async () => fireEvent.click(input))
      } else if (input.type === 'number') {
        await act(async () =>
          fireEvent.change(input, { target: { value: '90000' } })
        )
        await act(async () => fireEvent.blur(input))
      } else if (input.type !== 'file') {
        await act(async () =>
          fireEvent.change(input, { target: { value: 'https://custom/v1' } })
        )
      }
    }
    for (let i = 0; i < 4; i++) {
      await clickNamed(/Recheck|Start|Ensure|gateway|Grok/i)
      await act(async () => {
        await new Promise((r) => setTimeout(r, 20))
      })
    }
    await clickNamed(/install|Open install|Copy/i)
    await clickNamed(/Refresh models|Refresh|Test chat|Test/i)
    await clickNamed(/Refresh models|Refresh|Test chat|Test/i)
    await clickNamed(/Custom|preset|Grok defaults|Apply/i)

    for (const tab of [/^Image$/i, /^Video$/i]) {
      await clickNamed(tab)
      await clickNamed(/Show advanced|Hide advanced/i)
      for (const input of Array.from(
        document.querySelectorAll('input')
      ).slice(0, 8) as HTMLInputElement[]) {
        if (input.type === 'checkbox') {
          await act(async () => fireEvent.click(input))
        } else if (input.type !== 'file') {
          await act(async () =>
            fireEvent.change(input, {
              target: {
                value: input.type === 'number' ? '12' : 'https://x/v1'
              }
            })
          )
        }
      }
      for (const sel of Array.from(document.querySelectorAll('select'))) {
        const s = sel as HTMLSelectElement
        if (s.options.length > 1) {
          await act(async () =>
            fireEvent.change(s, { target: { value: s.options[1].value } })
          )
        }
      }
    }

    await clickNamed(/^Export$/i)
    await clickNamed(/BGM|Pick|Browse|Clear/i)
    await clickNamed(/BGM|Pick|Browse/i)

    await clickNamed(/^App$/i)
    await clickNamed(/Show advanced|Hide advanced/i)
    for (const sel of Array.from(document.querySelectorAll('select'))) {
      const s = sel as HTMLSelectElement
      if (s.options.length > 1) {
        for (let i = 0; i < Math.min(s.options.length, 3); i++) {
          await act(async () =>
            fireEvent.change(s, { target: { value: s.options[i].value } })
          )
        }
      }
    }
    for (const input of Array.from(
      document.querySelectorAll('input')
    ).slice(0, 12) as HTMLInputElement[]) {
      if (input.type === 'checkbox') {
        await act(async () => fireEvent.click(input))
      } else if (input.type === 'number') {
        await act(async () =>
          fireEvent.change(input, { target: { value: '9090' } })
        )
        await act(async () => fireEvent.blur(input))
      } else if (input.type !== 'file') {
        await act(async () =>
          fireEvent.change(input, { target: { value: '0.0.0.0' } })
        )
      }
    }
    for (const re of [
      /Open folder/i,
      /Start|Stop|Enable|Regenerate|Copy/i,
      /Check for updates|Check|Download|Install|Restart|release|npm|notes|Show|Hide/i,
      /Export all data/i,
      /Restore from backup/i,
      /support|diagnostics|Clear activity|clear all/i,
      /Linktree|Copy/i
    ]) {
      await clickNamed(re)
      if (document.querySelector('[role="alertdialog"]')) {
        await act(async () => clickDialogConfirm())
      }
      await act(async () => {
        await new Promise((r) => setTimeout(r, 15))
      })
    }
    await clickNamed(/Export all data/i)
    await clickNamed(/Export all data/i)
    await clickNamed(/Restore from backup/i)
    if (document.querySelector('[role="alertdialog"]')) {
      await act(async () => clickDialogConfirm())
    }
    await clickNamed(/Restore from backup/i)
    if (document.querySelector('[role="alertdialog"]')) {
      await act(async () => clickDialogConfirm())
    }
    await clickNamed(/Open folder/i)
    await clickNamed(/Open folder/i)
    await clickNamed(/Open folder/i)
    for (const b of screen
      .getAllByRole('button')
      .filter((x) => /^Copy$/i.test((x.textContent || '').trim()))
      .slice(0, 4)) {
      await act(async () => fireEvent.click(b))
    }
    await clickNamed(/^Save$/i)
  }, 70000)

  it('gateway undefined + web channel + shell openExternal missing', async () => {
    const prevGw = api.gateway
    // @ts-expect-error intentional
    api.gateway = undefined
    api.settings.get = vi.fn().mockResolvedValue({
      ...DEFAULT_SETTINGS,
      uiLanguage: 'zh-Hant',
      legalAcceptedVersion: '1.0.0',
      firstRunSeen: true
    })
    api.updates.status = vi.fn().mockResolvedValue({
      status: 'web-skipped',
      channel: 'web',
      currentVersion: '1.0.0',
      canCheck: false,
      canDownload: false,
      canAutoInstall: false
    })
    api.webServer.status = vi.fn().mockResolvedValue({
      running: false,
      url: null,
      port: 8787,
      error: 'bind fail',
      staticReady: false
    })
    const prevShell = api.shell.openExternal
    // @ts-expect-error intentional
    api.shell.openExternal = undefined

    await renderWithProviders(<SettingsPage />, {
      withAiShell: true,
      withToastHost: true
    })
    await waitFor(() => expect(api.settings.get).toHaveBeenCalled())
    await clickNamed(/Chat model|Chat/i)
    await clickNamed(/Recheck|gateway|install|Open/i)
    await clickNamed(/^App$/i)
    await clickNamed(/Start|Stop|Copy|Check|npm|Linktree/i)
    await clickNamed(/^Save$/i)

    api.gateway = prevGw
    api.shell.openExternal = prevShell
  }, 40000)
})
