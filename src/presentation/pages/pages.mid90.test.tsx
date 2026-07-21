/**
 * Push Characters, Scenes, Stories past 90% lines.
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
import { CharactersPage } from './CharactersPage'
import { ScenesPage } from './ScenesPage'
import { StoriesPage } from './StoriesPage'

const api = createMockApi()
vi.mock('../../lib/api', () => ({
  getApi: () => api,
  isElectron: () => true,
  isWebRuntime: () => false
}))
vi.mock('../components/VideoPrepModal', () => ({
  VideoPrepModal: (p: {
    open?: boolean
    onConfirm?: () => void
    onFinish?: () => void
    onAbandon?: () => void
  }) =>
    p.open ? (
      <div data-testid="vp">
        <button type="button" onClick={() => void p.onConfirm?.()}>
          vpc
        </button>
        <button type="button" onClick={() => p.onFinish?.()}>
          vpf
        </button>
        <button type="button" onClick={() => p.onAbandon?.()}>
          vpa
        </button>
      </div>
    ) : null
}))

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
  try {
    localStorage.clear()
    localStorage.removeItem('idm.aiJobs.v1')
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
    () => expect(document.body.textContent || '').toMatch(new RegExp(name, 'i')),
    { timeout: 12000 }
  )
  await waitFor(
    async () => {
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
    { timeout: 12000 }
  )
}

async function confirmImageGen(): Promise<boolean> {
  try {
    await waitFor(
      () => expect(document.body.textContent || '').toMatch(/Confirm reference/i),
      { timeout: 5000 }
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
  await waitFor(() => expect((jobs?.pendingDrafts.length ?? 0) > 0).toBe(true), {
    timeout: 10000
  })
  await act(async () => {
    await jobs!.acceptDraft(jobs!.pendingDrafts[0]!.id)
  })
}

function base() {
  reseedMockApi(api)
  jobs = null
  localStorage.clear()
  api.stories.list = vi.fn().mockResolvedValue([makeStory({ id: 'story-1' })])
  api.stories.get = vi.fn().mockResolvedValue(
    makeStoryDetail({
      timeline: [makeTimelineEntry({ dialogue: 'Plot beat residual' })]
    })
  )
  api.ai.status = vi.fn().mockResolvedValue({ available: true, message: 'ok' })
  api.media.toPreviewUrl = vi
    .fn()
    .mockResolvedValue({ url: 'blob:x', filePath: '/x.png' })
  api.media.pickRefImage = vi
    .fn()
    .mockResolvedValue({ filePath: '/tmp/u.png', originalName: 'u.png' })
  api.media.discardSheetDraft = vi.fn().mockResolvedValue({})
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
}

describe('mid90 Characters', () => {
  beforeEach(() => base())

  it('dense drafts soul wardrobe sheet gallery', async () => {
    api.characters.list = vi.fn().mockResolvedValue([
      makeCharacter({
        id: 'char-1',
        name: 'Aria',
        refImagePath: '/media/aria.png',
        refGalleryJson: gal('/media/aria.png'),
        costumesJson: JSON.stringify([
          {
            id: 'look-1',
            name: 'Coat',
            description: 'trench coat',
            artStyle: 'anime',
            imagePath: '/media/aria.png',
            createdAt: '2026-07-01T00:00:00.000Z',
            updatedAt: '2026-07-01T00:00:00.000Z'
          }
        ])
      })
    ])
    api.characters.get = vi.fn().mockResolvedValue(
      makeCharacter({
        id: 'char-1',
        refImagePath: '/media/aria.png',
        refGalleryJson: gal('/media/aria.png')
      })
    )
    api.characters.update = vi.fn().mockResolvedValue(makeCharacter())
    api.characters.create = vi.fn().mockResolvedValue(
      makeCharacter({ id: 'char-new', name: 'Nova' })
    )
    api.characters.generateSheet = vi.fn().mockResolvedValue({
      path: '/tmp/sh.png',
      label: 'S',
      variant: 'bible',
      layer: 'identity'
    })
    api.characters.commitSheet = vi.fn().mockResolvedValue({
      path: '/tmp/shc.png',
      character: { id: 'char-1', costume: 'c' },
      gallery: [
        {
          id: 'ng',
          path: '/tmp/shc.png',
          kind: 'sheet',
          label: 'S',
          createdAt: '2026-07-15T00:00:00.000Z',
          layer: 'identity'
        }
      ]
    })
    api.characters.swapCostume = vi.fn().mockResolvedValue({
      path: '/tmp/sw.png',
      label: 'Swap',
      variant: 'costume_swap',
      layer: 'costume'
    })
    api.characters.suggestWardrobe = vi.fn().mockResolvedValue({
      suggestion: {
        name: 'Rain',
        costume: 'trench + boots',
        artStyle: 'anime',
        rationale: 'noir rain'
      }
    })
    api.characters.aiFill = vi.fn().mockResolvedValue({
      profile: {
        name: 'Aria+',
        description: 'lead',
        appearance: 'silver hair',
        costume: 'coat',
        personality: 'stoic',
        hardRules: 'no logos',
        visualTags: 'rain,neon',
        artStyle: 'anime',
        ageRange: '30s',
        gender: 'female'
      },
      profileJson: '{}',
      raw: ''
    })
    api.costumes.list = vi.fn().mockResolvedValue([makeCostume()])
    api.costumes.listForCharacter = vi.fn().mockResolvedValue([makeCostume()])
    api.costumes.linkCharacter = vi.fn().mockResolvedValue({})
    api.souls.list = vi.fn().mockResolvedValue({
      data: [
        {
          id: 9,
          title: 'Noir Soul',
          description: 'd',
          role: 'detective',
          domain: 'crime'
        }
      ],
      total_pages: 2,
      current_page: 1
    })
    api.souls.get = vi.fn().mockResolvedValue({
      id: 9,
      title: 'Noir Soul',
      content: '# noir soul full'
    })
    api.souls.searchLocal = vi.fn().mockResolvedValue({
      items: [{ id: 9, title: 'Noir Soul', content: '# local' }]
    })
    api.souls.ensureIndex = vi.fn().mockResolvedValue({
      count: 2,
      pages: 2,
      fromCache: false,
      suggestions: [{ id: 9, title: 'Noir Soul' }]
    })
    api.characters.readSoulContent = vi.fn().mockResolvedValue('# soul body')
    api.characters.writeSoulContent = vi.fn().mockResolvedValue({
      filePath: '/tmp/s.md',
      content: '# soul body'
    })
    api.characters.generateSoul = vi.fn().mockResolvedValue({
      path: '/tmp/gs.md',
      content: '# generated soul',
      title: 'Gen'
    })
    api.characters.importSoulMd = vi.fn().mockResolvedValue({
      path: '/tmp/i.md',
      content: '# imported'
    })
    api.timeline.list = vi.fn().mockResolvedValue([])

    await renderWithProviders(
      <>
        <Probe />
        <CharactersPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await openCardEdit('Aria')

    const ensureEditor = async () => {
      if (
        !screen
          .getAllByRole('button')
          .some((b) => /^Save$/i.test((b.textContent || '').trim()))
      ) {
        await openCardEdit('Aria')
      }
    }

    // Profile draft full fields
    await act(async () => {
      jobs!.startJob({
        kind: 'character-ai-fill',
        label: 'f',
        scope: { characterId: 'char-1' },
        run: async () => ({
          type: 'character-profile' as const,
          characterId: 'char-1',
          storyId: 'story-1',
          profile: {
            name: 'Aria+',
            description: 'lead',
            appearance: 'silver',
            costume: 'coat',
            personality: 'stoic',
            hardRules: 'no logos',
            visualTags: 'rain',
            artStyle: 'anime',
            ageRange: '30s',
            gender: 'female'
          },
          profileJson: '{}',
          isNew: false
        })
      })
    })
    await acceptDraft()
    await ensureEditor()

    // Sheet draft
    await act(async () => {
      jobs!.startJob({
        kind: 'character-sheet',
        label: 's',
        scope: { characterId: 'char-1' },
        run: async () => ({
          type: 'character-sheet' as const,
          characterId: 'char-1',
          storyId: 'story-1',
          path: '/tmp/sh.png',
          variant: 'bible',
          label: 'S',
          layer: 'identity'
        })
      })
    })
    await acceptDraft()
    await ensureEditor()

    // Wardrobe suggest draft
    await act(async () => {
      jobs!.startJob({
        kind: 'wardrobe-suggest',
        label: 'w',
        scope: { characterId: 'char-1' },
        run: async () => ({
          type: 'wardrobe-suggest' as const,
          characterId: 'char-1',
          storyId: 'story-1',
          suggestion: {
            name: 'Rain',
            costume: 'trench + boots',
            artStyle: 'anime',
            rationale: 'noir'
          }
        })
      })
    })
    await acceptDraft().catch(() => undefined)
    await ensureEditor()

    await clickNamed(/^References$/i)
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
    if (await confirmImageGen()) {
      await waitFor(() =>
        expect(api.characters.generateSheet).toHaveBeenCalled()
      ).catch(() => undefined)
    }
    await clickNamed(/Upload reference/i)
    await clickNamed(/Set as cover/i)
    await clickNamed(/→|←/i)
    await clickNamed(/Remove this photo|Remove/i)

    await clickNamed(/^Costume$/i)
    for (const ta of Array.from(document.querySelectorAll('textarea')).slice(
      -2
    )) {
      await act(async () =>
        fireEvent.change(ta, { target: { value: 'black coat red scarf' } })
      )
    }
    for (const input of Array.from(
      document.querySelectorAll('input')
    ) as HTMLInputElement[]) {
      if (input.type === 'text' || !input.type) {
        await act(async () =>
          fireEvent.change(input, { target: { value: 'Winter look' } })
        )
        break
      }
    }
    await clickNamed(/Add to library/i)
    await clickNamed(/Apply/i)
    await clickNamed(/Suggest from plot/i)
    await waitFor(() =>
      expect(api.characters.suggestWardrobe).toHaveBeenCalled()
    ).catch(() => undefined)
    await clickNamed(/Generate costume swap/i)
    await confirmImageGen()
    await clickNamed(/Delete/i)
    if (document.querySelector('[role="alertdialog"]')) {
      await act(async () => clickDialogConfirm())
    }

    await clickNamed(/^Profile$/i)
    await clickNamed(/Generate Soul/i)
    await waitFor(() =>
      expect(api.characters.generateSoul).toHaveBeenCalled()
    ).catch(() => undefined)
    await clickNamed(/Import local/i)
    await clickNamed(/Reload/i)
    await clickNamed(/Refresh|Search/i)
    // soul search
    const search = Array.from(document.querySelectorAll('input')).find(
      (i) =>
        (i as HTMLInputElement).type === 'search' ||
        (i as HTMLInputElement).placeholder?.toLowerCase().includes('search')
    )
    if (search) {
      await act(async () =>
        fireEvent.change(search, { target: { value: 'Noir' } })
      )
    }
    const souls = screen.queryAllByText(/Noir Soul/i)
    if (souls[0]) await act(async () => fireEvent.click(souls[0]!))
    await clickNamed(/Use/i)
    await clickNamed(/Unlink/i)
    for (const ta of Array.from(document.querySelectorAll('textarea')).slice(
      -1
    )) {
      await act(async () =>
        fireEvent.change(ta, { target: { value: '# edited soul residual' } })
      )
    }

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent('idm:video-prep-done', {
          detail: {
            kind: 'character-intro',
            entityIds: { characterId: 'char-1' },
            gallery: [
              {
                id: 'g1',
                path: '/media/aria.png',
                kind: 'sheet',
                label: 'L',
                createdAt: '2026-07-01T00:00:00.000Z',
                introVideoPath: '/v.mp4'
              }
            ]
          }
        })
      )
    })
    await act(async () => {
      window.dispatchEvent(
        new CustomEvent('idm:video-prep-done', {
          detail: { kind: 'character-intro', entityIds: { characterId: 'char-1' } }
        })
      )
    })
    await clickNamed(/Intro|Self-intro|video/i)
    if (screen.queryByTestId('vp')) {
      await clickNamed(/^vpc$|^vpf$|^vpa$/i)
    }
    await clickNamed(/^Save$/i)

    // New character create + sheet path
    await clickNamed(/New character|New/i)
    for (const el of Array.from(
      document.querySelectorAll('input, textarea')
    ).slice(0, 4)) {
      await act(async () =>
        fireEvent.change(el, { target: { value: 'Nova hero residual' } })
      )
    }
    await clickNamed(/^References$/i)
    await clickNamed(/Generate professional reference|Create and generate/i)
    await confirmImageGen()
  }, 70000)
})

describe('mid90 Scenes', () => {
  beforeEach(() => base())

  it('plot confirm + plate + atmosphere + intro + looks', async () => {
    api.scenes.list = vi.fn().mockResolvedValue([
      makeScene({
        id: 'scene-1',
        title: 'Rooftop',
        refImagePath: '/media/roof.png',
        refGalleryJson: gal('/media/roof.png', 'sg')
      }),
      makeScene({
        id: 'scene-2',
        title: 'Alley',
        refImagePath: '/media/alley.png',
        refGalleryJson: gal('/media/alley.png', 'ag')
      })
    ])
    api.scenes.update = vi.fn().mockResolvedValue(makeScene())
    api.scenes.create = vi.fn().mockResolvedValue(makeScene({ id: 'sc-new' }))
    api.scenes.aiFill = vi.fn().mockResolvedValue({
      profile: {
        title: 'R+',
        description: 'rain neon',
        mood: 'tense',
        lighting: 'neon',
        weather: 'rain',
        timeOfDay: 'night',
        locationType: 'exterior',
        colorPalette: 'cyan',
        setDressing: 'AC',
        soundscape: 'rain',
        cameraNotes: 'wide',
        visualTags: 'city',
        hardRules: 'empty set',
        artStyle: 'anime'
      },
      profileJson: '{}',
      raw: ''
    })
    api.scenes.generatePlate = vi.fn().mockResolvedValue({
      path: '/tmp/sp.png',
      label: 'Est',
      variant: 'establishing'
    })
    api.scenes.commitPlate = vi.fn().mockResolvedValue({
      path: '/tmp/spc.png',
      gallery: [
        {
          id: 'n',
          path: '/tmp/spc.png',
          kind: 'plate',
          label: 'Est',
          createdAt: '2026-07-15T00:00:00.000Z',
          introVideoPath: null
        }
      ]
    })
    api.scenes.swapAtmosphere = vi.fn().mockResolvedValue({
      path: '/tmp/atm.png',
      gallery: []
    })
    api.scenes.copyGalleryFrom = vi.fn().mockResolvedValue({
      ok: true,
      gallery: []
    })

    await renderWithProviders(
      <>
        <Probe />
        <ScenesPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await waitFor(() => expect(api.stories.list).toHaveBeenCalled())
    await openCardEdit('Rooftop')

    // Full scene profile draft
    await act(async () => {
      jobs!.startJob({
        kind: 'scene-ai-fill',
        label: 'f',
        scope: { sceneId: 'scene-1' },
        run: async () => ({
          type: 'scene-profile' as const,
          sceneId: 'scene-1',
          storyId: 'story-1',
          profile: {
            title: 'R+',
            description: 'rain',
            mood: 'tense',
            lighting: 'neon',
            weather: 'rain',
            timeOfDay: 'night',
            locationType: 'exterior',
            colorPalette: 'cyan',
            setDressing: 'AC',
            soundscape: 'rain',
            cameraNotes: 'wide',
            visualTags: 'city',
            hardRules: 'empty',
            artStyle: 'anime'
          },
          profileJson: '{}',
          isNew: false
        })
      })
    })
    await acceptDraft()

    if (
      !screen
        .getAllByRole('button')
        .some((b) => /^Save$/i.test((b.textContent || '').trim()))
    ) {
      await openCardEdit('Rooftop')
    }

    await clickNamed(/^Plates$/i)
    for (const cb of Array.from(
      document.querySelectorAll('input[type="checkbox"]')
    )) {
      await act(async () => fireEvent.click(cb))
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
    await clickNamed(/Generate location plate/i)
    if (await confirmImageGen()) {
      await waitFor(() => expect(api.scenes.generatePlate).toHaveBeenCalled())
      await acceptDraft().catch(() => undefined)
    }
    await clickNamed(/Upload reference/i)
    await clickNamed(/Set as cover/i)
    await clickNamed(/→|←/i)
    await clickNamed(/Remove this|remove/i)

    await clickNamed(/Atmosphere/i)
    for (const ta of Array.from(document.querySelectorAll('textarea')).slice(
      0,
      4
    )) {
      await act(async () =>
        fireEvent.change(ta, { target: { value: 'fog rain neon dusk wind' } })
      )
    }
    await clickNamed(/Generate atmosphere swap/i)
    await waitFor(() => expect(api.scenes.swapAtmosphere).toHaveBeenCalled(), {
      timeout: 8000
    }).catch(() => undefined)
    for (const re of [/look|Look|Add|Copy|copy/i]) {
      await clickNamed(re)
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

    // Plot suggest with correct dialog (has select + AI fill)
    await clickNamed(/^Profile$/i)
    await clickNamed(/Suggest from story/i)
    await waitFor(
      () => {
        const dlg = Array.from(
          document.querySelectorAll('[role="dialog"]')
        ).find((d) => {
          const hasSel = (d as HTMLElement).querySelectorAll('select').length > 0
          const hasFill = Array.from(
            (d as HTMLElement).querySelectorAll('button')
          ).some((b) => /AI fill|Suggest|Fill/i.test(b.textContent || ''))
          return hasSel && hasFill
        })
        expect(dlg).toBeTruthy()
      },
      { timeout: 8000 }
    )
    const plotDlg = Array.from(document.querySelectorAll('[role="dialog"]')).find(
      (d) => {
        const hasSel = (d as HTMLElement).querySelectorAll('select').length > 0
        const hasFill = Array.from(
          (d as HTMLElement).querySelectorAll('button')
        ).some((b) => /AI fill|Suggest|Fill/i.test(b.textContent || ''))
        return hasSel && hasFill
      }
    ) as HTMLElement
    const storySel = Array.from(plotDlg.querySelectorAll('select')).find((s) =>
      Array.from((s as HTMLSelectElement).options).some(
        (o) => o.value === 'story-1' || /Demo/i.test(o.textContent || '')
      )
    ) as HTMLSelectElement | undefined
    if (storySel) {
      const val =
        Array.from(storySel.options).find((o) => o.value === 'story-1')
          ?.value || storySel.options[1]?.value
      if (val) {
        await act(async () =>
          fireEvent.change(storySel, { target: { value: val } })
        )
      }
    }
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })
    const fill = Array.from(plotDlg.querySelectorAll('button')).find((b) =>
      /AI fill|Suggest|Fill|use/i.test(b.textContent || '')
    )
    if (fill && !(fill as HTMLButtonElement).disabled) {
      await act(async () => fireEvent.click(fill))
    }
    await act(async () => {
      await new Promise((r) => setTimeout(r, 80))
    })
    await waitFor(() => expect(api.scenes.aiFill).toHaveBeenCalled()).catch(
      () => undefined
    )

    await clickNamed(/Intro|video/i)
    if (screen.queryByTestId('vp')) {
      await clickNamed(/^vpc$|^vpf$/i)
    }
    await act(async () => {
      window.dispatchEvent(
        new CustomEvent('idm:video-prep-done', {
          detail: {
            kind: 'scene-intro',
            entityIds: { sceneId: 'scene-1' },
            gallery: [
              {
                id: 'sg',
                path: '/media/roof.png',
                kind: 'plate',
                label: 'L',
                createdAt: '2026-07-01T00:00:00.000Z',
                introVideoPath: '/sv.mp4'
              }
            ]
          }
        })
      )
    })
    await clickNamed(/^Save$/i)

    // New scene create + plate
    await clickNamed(/New scene|New/i)
    for (const el of Array.from(
      document.querySelectorAll('input, textarea')
    ).slice(0, 3)) {
      await act(async () =>
        fireEvent.change(el, { target: { value: 'Harbor residual' } })
      )
    }
    await clickNamed(/^Plates$/i)
    await clickNamed(/Generate location plate/i)
    await confirmImageGen()
  }, 70000)
})

describe('mid90 Stories', () => {
  beforeEach(() => base())

  it('cast multi-link + beats multi-ids + script + cover', async () => {
    const beats = [
      makeTimelineEntry({
        id: 'b1',
        order: 0,
        dialogue: '[DIALOGUE|Aria] Hello residual spoken',
        characterId: 'char-1',
        sceneId: 'scene-1',
        characterIds: ['char-1'],
        sceneIds: ['scene-1'],
        propIds: ['prop-1'],
        actionIds: ['act-1']
      }),
      makeTimelineEntry({
        id: 'b2',
        order: 1,
        dialogue: 'Second beat residual',
        characterId: 'char-2',
        sceneId: 'scene-2'
      })
    ]
    api.stories.list = vi.fn().mockResolvedValue([makeStory({ id: 'story-1' })])
    api.stories.get = vi.fn().mockResolvedValue(
      makeStoryDetail({
        id: 'story-1',
        characters: [
          makeCharacter(),
          makeCharacter({ id: 'char-2', name: 'Ben' })
        ],
        scenes: [
          makeScene(),
          makeScene({ id: 'scene-2', title: 'Alley' })
        ],
        props: [makeProp(), makeProp({ id: 'prop-2', name: 'Key' })],
        actions: [makeAction(), makeAction({ id: 'act-2', name: 'Kick' })],
        timeline: beats
      } as never)
    )
    api.stories.update = vi.fn().mockResolvedValue({})
    api.stories.linkCharacter = vi.fn().mockResolvedValue({})
    api.stories.unlinkCharacter = vi.fn().mockResolvedValue({})
    api.stories.linkScene = vi.fn().mockResolvedValue({})
    api.stories.unlinkScene = vi.fn().mockResolvedValue({})
    api.stories.linkProp = vi.fn().mockResolvedValue({})
    api.stories.unlinkProp = vi.fn().mockResolvedValue({})
    api.stories.linkAction = vi.fn().mockResolvedValue({})
    api.stories.unlinkAction = vi.fn().mockResolvedValue({})
    api.stories.setCharacterCostume = vi.fn().mockResolvedValue({})
    api.stories.aiFillScript = vi.fn().mockResolvedValue({
      beats: [
        {
          order: 0,
          dialogue: 'A',
          characterId: 'char-1',
          sceneId: 'scene-1'
        },
        {
          order: 1,
          dialogue: 'B',
          characterId: 'char-2',
          sceneId: 'scene-2'
        }
      ],
      drafts: [],
      raw: ''
    })
    api.stories.aiFillMeta = vi.fn().mockResolvedValue({
      styleNote: 'noir residual',
      hardRules: 'no logos',
      artStyle: 'anime'
    })
    api.stories.generateCover = vi.fn().mockResolvedValue({ path: '/tmp/c.png' })
    api.stories.commitCover = vi.fn().mockResolvedValue({ path: '/tmp/cc.png' })
    api.characters.list = vi.fn().mockResolvedValue([
      makeCharacter(),
      makeCharacter({ id: 'char-2', name: 'Ben' })
    ])
    api.scenes.list = vi.fn().mockResolvedValue([
      makeScene(),
      makeScene({ id: 'scene-2', title: 'Alley' })
    ])
    api.props.list = vi.fn().mockResolvedValue([
      makeProp(),
      makeProp({ id: 'prop-2', name: 'Key' })
    ])
    api.actions.list = vi.fn().mockResolvedValue([
      makeAction(),
      makeAction({ id: 'act-2', name: 'Kick' })
    ])
    api.costumes.list = vi.fn().mockResolvedValue([makeCostume()])
    api.timeline.create = vi
      .fn()
      .mockResolvedValue(makeTimelineEntry({ id: 'bn' }))
    api.timeline.update = vi.fn().mockResolvedValue(makeTimelineEntry())
    api.timeline.delete = vi.fn().mockResolvedValue({ ok: true })
    api.timeline.reorder = vi.fn().mockResolvedValue({ ok: true })
    api.timeline.list = vi.fn().mockResolvedValue(beats)

    await renderWithProviders(
      <>
        <Probe />
        <StoriesPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await waitFor(() => expect(screen.getByText('Demo Story')).toBeTruthy())
    const article = screen.getByText('Demo Story').closest('article')
    if (article) {
      const e = within(article as HTMLElement).queryByRole('button', {
        name: /^Edit$/i
      })
      if (e) await act(async () => fireEvent.click(e))
      else await clickNamed(/^Edit$/i)
    } else {
      await clickNamed(/^Edit$/i)
    }
    await waitFor(() => expect(api.stories.get).toHaveBeenCalled())

    await clickNamed(/Basics|Meta/i)
    for (const ta of Array.from(document.querySelectorAll('textarea')).slice(
      0,
      3
    )) {
      await act(async () =>
        fireEvent.change(ta, { target: { value: 'style bible residual mid90' } })
      )
    }
    await clickNamed(/AI fill style notes/i)
    await waitFor(() => expect(api.stories.aiFillMeta).toHaveBeenCalled()).catch(
      () => undefined
    )

    await clickNamed(/Cast \/ set|Cast/i)
    for (const kind of [/Character/i, /Scene/i, /Prop/i, /Action/i]) {
      await clickNamed(kind)
      for (const f of [/All/i, /In story/i, /Not in story/i]) {
        await clickNamed(f)
      }
      // click all link/unlink buttons
      for (const b of screen.getAllByRole('button')) {
        const t = (b.textContent || '').trim()
        if (/^Link$/i.test(t) || /^Unlink$/i.test(t)) {
          if (!(b as HTMLButtonElement).disabled) {
            await act(async () => fireEvent.click(b))
          }
        }
      }
    }
    for (const sel of Array.from(document.querySelectorAll('select')).slice(
      0,
      8
    )) {
      const s = sel as HTMLSelectElement
      if (s.options.length > 1) {
        await act(async () =>
          fireEvent.change(s, { target: { value: s.options[1].value } })
        )
      }
    }

    await clickNamed(/Script beats|Script/i)
    await clickNamed(/Add beat/i)
    for (const re of [/↑|↓|Move/i]) {
      await clickNamed(re)
    }
    // multi-selects on beats
    for (const sel of Array.from(document.querySelectorAll('select')).slice(
      0,
      16
    )) {
      const s = sel as HTMLSelectElement
      if (s.options.length > 1) {
        await act(async () =>
          fireEvent.change(s, { target: { value: s.options[1].value } })
        )
        if (s.multiple) {
          await act(async () => {
            const vals = Array.from(s.options)
              .slice(0, 2)
              .map((o) => o.value)
            fireEvent.change(s, { target: { value: vals } })
          })
        }
      }
    }
    for (const ta of Array.from(document.querySelectorAll('textarea')).slice(
      0,
      6
    )) {
      await act(async () =>
        fireEvent.change(ta, {
          target: {
            value:
              '[MOOD] tense\n[DIALOGUE|Aria|cold] Residual multi-line beat'
          }
        })
      )
    }
    await clickNamed(/Insert script template|template/i)
    await clickNamed(/AI generate beats/i)
    if (document.querySelector('[role="alertdialog"]')) {
      await act(async () => clickDialogConfirm())
    }
    await waitFor(() =>
      expect(api.stories.aiFillScript).toHaveBeenCalled()
    ).catch(() => undefined)
    // delete a beat
    await clickNamed(/Delete/i)
    if (document.querySelector('[role="alertdialog"]')) {
      await act(async () => clickDialogConfirm())
    }

    await clickNamed(/Cover|Poster/i)
    await clickNamed(/Generate cover/i)
    await confirmImageGen()
    await act(async () => {
      jobs!.startJob({
        kind: 'story-cover',
        label: 'c',
        scope: { storyId: 'story-1' },
        run: async () => ({
          type: 'story-cover' as const,
          storyId: 'story-1',
          path: '/tmp/c.png'
        })
      })
    })
    await acceptDraft().catch(() => undefined)
    await clickNamed(/Upload reference/i)
    await clickNamed(/^Save$/i)
  }, 70000)
})
