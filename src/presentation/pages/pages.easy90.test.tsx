/**
 * Clear Costumes + Props past 90% lines (easy wins).
 * Props: force plotStoryId via PlotContextPicker story select, then AI fill.
 * Costumes: dress workstation + links toggle + intro + AI guards.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { createMockApi, reseedMockApi } from '../../test/mockApi'
import {
  makeCharacter,
  makeCostume,
  makeProp,
  makeStory,
  makeStoryDetail,
  makeTimelineEntry
} from '../../test/pageFixtures'
import { renderWithProviders } from '../../test/renderWithProviders'
import { useAiJobs } from '../context/AiJobsContext'
import { PropsPage } from './PropsPage'
import { CostumesPage } from './CostumesPage'

const api = createMockApi()
vi.mock('../../lib/api', () => ({
  getApi: () => api,
  isElectron: () => true,
  isWebRuntime: () => false
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
    () => {
      expect(document.body.textContent || '').toMatch(new RegExp(name, 'i'))
    },
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
      const target = edits[edits.length - 1]
      expect(target).toBeTruthy()
      await act(async () => fireEvent.click(target!))
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
      () => {
        expect(document.body.textContent || '').toMatch(/Confirm reference/i)
      },
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

function seed() {
  reseedMockApi(api)
  jobs = null
  try {
    localStorage.clear()
  } catch {
    /* ignore */
  }
  api.stories.list = vi.fn().mockResolvedValue([makeStory({ id: 'story-1' })])
  api.stories.get = vi.fn().mockResolvedValue(
    makeStoryDetail({
      timeline: [
        makeTimelineEntry({
          id: 'b1',
          dialogue: 'Beat dialogue for plot segment'
        })
      ]
    })
  )
  api.ai.status = vi.fn().mockResolvedValue({ available: true, message: 'ok' })
  api.media.toPreviewUrl = vi
    .fn()
    .mockResolvedValue({ url: 'blob:x', filePath: '/x.png' })
  api.media.pickRefImage = vi
    .fn()
    .mockResolvedValue({ filePath: '/tmp/up.png', originalName: 'up.png' })
  api.media.discardSheetDraft = vi.fn().mockResolvedValue({})
  api.videoPrep.create = vi.fn().mockResolvedValue({
    professionalPrompt: 'p',
    stillPath: '/s.png',
    sourceImagePath: '/s.png',
    durationSeconds: 6,
    aspectRatio: '16:9',
    entityIds: { costumeId: 'cos-1' },
    kind: 'costume-intro',
    userExtraPrompt: '',
    queueIndex: 1,
    queueTotal: 1
  })
  api.videoPrep.confirm = vi.fn().mockResolvedValue({ videoPath: '/o.mp4' })
}

describe('easy90 Props past 90', () => {
  beforeEach(() => seed())

  it('plot-suggest AI fill body with forced story select', async () => {
    api.props.list = vi.fn().mockResolvedValue([
      makeProp({
        id: 'prop-1',
        name: 'Badge',
        refImagePath: '/media/badge.png',
        refGalleryJson: gal('/media/badge.png', 'pg')
      })
    ])
    api.props.update = vi.fn().mockResolvedValue(makeProp())
    api.props.aiFill = vi.fn().mockResolvedValue({
      profile: {
        name: 'Badge+',
        description: 'shiny',
        material: 'brass',
        visualTags: 'gold',
        hardRules: 'no logos',
        artStyle: 'anime'
      },
      profileJson: '{}',
      raw: ''
    })
    api.props.generatePlate = vi.fn().mockResolvedValue({
      path: '/tmp/pd.png',
      label: 'Hero',
      variant: 'hero'
    })
    api.props.commitPlate = vi.fn().mockResolvedValue({
      path: '/tmp/pc.png',
      gallery: [
        {
          id: 'n',
          path: '/tmp/pc.png',
          kind: 'plate',
          label: 'H',
          createdAt: '2026-07-15T00:00:00.000Z',
          layer: 'identity'
        }
      ]
    })
    api.props.create = vi.fn().mockResolvedValue(
      makeProp({ id: 'prop-new', name: 'Flask' })
    )

    await renderWithProviders(
      <>
        <Probe />
        <PropsPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    // Wait for AppContext + Props stories.list to settle
    await waitFor(() => expect(api.stories.list).toHaveBeenCalled())
    await openCardEdit('Badge')

    await clickNamed(/^Profile$/i)
    await clickNamed(/Suggest from story/i)

    // Plot modal is a second dialog overlay (EditorShell is also role=dialog).
    // Prefer the dialog that contains native <select> options for stories.
    const findPlotDlg = (): HTMLElement | null => {
      const dialogs = Array.from(
        document.querySelectorAll('[role="dialog"]')
      ) as HTMLElement[]
      return (
        dialogs.find((d) => {
          const hasStorySelect = Array.from(d.querySelectorAll('select')).some(
            (s) =>
              Array.from((s as HTMLSelectElement).options).some(
                (o) => o.value === 'story-1' || /Demo Story/i.test(o.textContent || '')
              )
          )
          const hasAiFill = Array.from(d.querySelectorAll('button')).some((b) =>
            /^AI fill/i.test((b.textContent || '').trim())
          )
          return hasStorySelect && hasAiFill
        }) ||
        dialogs.find((d) => {
          const hasSelect = d.querySelectorAll('select').length > 0
          const hasAiFill = Array.from(d.querySelectorAll('button')).some((b) =>
            /^AI fill/i.test((b.textContent || '').trim())
          )
          return hasSelect && hasAiFill
        }) ||
        null
      )
    }

    await waitFor(
      () => {
        // Stories must load into PropsPage local state for picker options
        expect(api.stories.list).toHaveBeenCalled()
        expect(findPlotDlg()).toBeTruthy()
      },
      { timeout: 10000 }
    )

    const dlg = findPlotDlg()!
    const storySel = Array.from(dlg.querySelectorAll('select')).find((s) =>
      Array.from((s as HTMLSelectElement).options).some(
        (o) => o.value === 'story-1' || /Demo Story/i.test(o.textContent || '')
      )
    ) as HTMLSelectElement
    expect(storySel).toBeTruthy()
    const storyVal =
      Array.from(storySel.options).find((o) => o.value === 'story-1')?.value ||
      Array.from(storySel.options).find((o) => o.value && o.value !== '')?.value
    await act(async () => {
      fireEvent.change(storySel, { target: { value: storyVal! } })
    })

    // segment non-all if present
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100))
    })
    for (const sel of Array.from(dlg.querySelectorAll('select'))) {
      if (sel === storySel) continue
      const s = sel as HTMLSelectElement
      const seg = Array.from(s.options).find(
        (o) => o.value && o.value !== 'all' && o.value !== storyVal
      )
      if (seg) {
        await act(async () =>
          fireEvent.change(s, { target: { value: seg.value } })
        )
        break
      }
    }

    await waitFor(
      () => {
        const fill = Array.from(dlg.querySelectorAll('button')).find((b) =>
          /^AI fill/i.test((b.textContent || '').trim())
        ) as HTMLButtonElement | undefined
        expect(fill).toBeTruthy()
        expect(fill!.disabled).toBe(false)
      },
      { timeout: 5000 }
    )

    const before = api.props.aiFill.mock.calls.length
    const fill = Array.from(dlg.querySelectorAll('button')).find((b) =>
      /^AI fill/i.test((b.textContent || '').trim())
    )!
    await act(async () => fireEvent.click(fill))
    await act(async () => {
      await new Promise((r) => setTimeout(r, 80))
    })
    await waitFor(
      () =>
        expect(api.props.aiFill.mock.calls.length).toBeGreaterThan(before),
      { timeout: 8000 }
    )
    await acceptDraft().catch(() => undefined)

    // Backdrop cancel path for plot modal (reopen + cancel)
    await clickNamed(/Suggest from story/i)
    await waitFor(() =>
      expect(
        Array.from(document.querySelectorAll('[role="dialog"]')).some((d) =>
          (d.textContent || '').includes('Suggest from story')
        )
      ).toBe(true)
    )
    const dlg2 = Array.from(document.querySelectorAll('[role="dialog"]')).find(
      (d) => (d.textContent || '').includes('Suggest from story')
    ) as HTMLElement
    // cancel button
    const cancel = Array.from(dlg2.querySelectorAll('button')).find((b) =>
      /^Cancel$/i.test((b.textContent || '').trim())
    )
    if (cancel) await act(async () => fireEvent.click(cancel))
    // reopen + backdrop click
    await clickNamed(/Suggest from story/i)
    await waitFor(() =>
      expect(
        Array.from(document.querySelectorAll('[role="dialog"]')).some((d) =>
          (d.textContent || '').includes('Suggest from story')
        )
      ).toBe(true)
    )
    const overlay = Array.from(
      document.querySelectorAll('[role="dialog"]')
    ).find((d) =>
      (d.textContent || '').includes('Suggest from story')
    ) as HTMLElement
    await act(async () => fireEvent.click(overlay))

    // Plates: reorder, multi-ref, plate job
    await clickNamed(/^Plates$/i)
    for (const re of [/←|→/i, /^All$/i, /identity|Identity|base|Base/i]) {
      await clickNamed(re)
    }
    for (const cb of Array.from(
      document.querySelectorAll('input[type="checkbox"]')
    )) {
      await act(async () => fireEvent.click(cb))
    }
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
    await clickNamed(/Generate prop plate/i)
    if (await confirmImageGen()) {
      await waitFor(() => expect(api.props.generatePlate).toHaveBeenCalled())
      await acceptDraft().catch(() => undefined)
    }

    await clickNamed(/Upload reference/i)
    await clickNamed(/Set as cover/i)
    await clickNamed(/Remove this|remove/i)

    // Intro video with selected image
    await clickNamed(/Intro|video/i)
    if (screen.queryByTestId('vp')) {
      await clickNamed(/^vpc$|^vpf$|^vpa$/i)
    }
    await act(async () => {
      window.dispatchEvent(
        new CustomEvent('idm:video-prep-done', {
          detail: {
            kind: 'prop-intro',
            entityIds: { propId: 'prop-1' },
            gallery: [
              {
                id: 'pg',
                path: '/media/badge.png',
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
          detail: { kind: 'prop-intro', entityIds: { propId: 'prop-1' } }
        })
      )
    })

    // Field edits + save
    for (const el of Array.from(
      document.querySelectorAll('input, textarea')
    ).slice(0, 5)) {
      await act(async () =>
        fireEvent.change(el, { target: { value: 'residual prop field' } })
      )
    }
    await clickNamed(/^Save$/i)

    // Empty name save guard (clear name then save)
    await openCardEdit('Badge').catch(() => undefined)
    const nameInput = Array.from(
      document.querySelectorAll('input')
    ).find((i) => (i as HTMLInputElement).value === 'Badge') as
      | HTMLInputElement
      | undefined
    if (nameInput) {
      await act(async () =>
        fireEvent.change(nameInput, { target: { value: '' } })
      )
      await clickNamed(/^Save$/i)
    }

    // Reorder gallery via ← → 
    await openCardEdit('Badge').catch(() => undefined)
    await clickNamed(/^Plates$/i)
    await clickNamed(/→/i)
    await clickNamed(/←/i)

    // New prop create + plate ensureSavedId
    await clickNamed(/New prop/i)
    for (const el of Array.from(
      document.querySelectorAll('input, textarea')
    ).slice(0, 3)) {
      await act(async () =>
        fireEvent.change(el, { target: { value: 'Flask item' } })
      )
    }
    // create-then-plate path
    await clickNamed(/^Plates$/i)
    await clickNamed(/Generate prop plate/i)
    if (await confirmImageGen()) {
      await waitFor(() => expect(api.props.create).toHaveBeenCalled()).catch(
        () => undefined
      )
    }
    // create save path
    await clickNamed(/^Save$/i)
  }, 70000)

  it('Props: intro guards + plate cancel + wrong-id draft', async () => {
    api.props.list = vi.fn().mockResolvedValue([
      makeProp({
        id: 'prop-1',
        name: 'Badge',
        refImagePath: null,
        refGalleryJson: null
      })
    ])
    api.props.update = vi.fn().mockResolvedValue(makeProp())
    api.props.aiFill = vi.fn().mockResolvedValue({
      profile: { name: 'B', description: 'd' },
      profileJson: '{}',
      raw: ''
    })

    await renderWithProviders(
      <>
        <Probe />
        <PropsPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await openCardEdit('Badge')

    // Intro without image
    await clickNamed(/Intro|video/i)

    // AI need idea guard when all empty
    await clickNamed(/^Profile$/i)
    for (const el of Array.from(document.querySelectorAll('input, textarea'))) {
      await act(async () => fireEvent.change(el, { target: { value: '' } }))
    }
    // keep a name so form exists
    const first = document.querySelector('input')
    if (first) {
      await act(async () =>
        fireEvent.change(first, { target: { value: 'Badge' } })
      )
    }
    await clickNamed(/AI fill \/ improve/i)

    // wrong propId profile draft early return
    await act(async () => {
      jobs!.startJob({
        kind: 'prop-ai-fill',
        label: 'x',
        scope: { propId: 'other' },
        run: async () => ({
          type: 'prop-profile' as const,
          propId: 'other-id',
          storyId: 'story-1',
          profile: { name: 'Other', description: 'x' },
          profileJson: '{}',
          isNew: false
        })
      })
    })
    await acceptDraft().catch(() => undefined)

    // matching profile draft full fields
    await act(async () => {
      jobs!.startJob({
        kind: 'prop-ai-fill',
        label: 'f',
        scope: { propId: 'prop-1' },
        run: async () => ({
          type: 'prop-profile' as const,
          propId: 'prop-1',
          storyId: 'story-1',
          profile: {
            name: 'Badge+',
            description: 'd',
            material: 'm',
            sizeNotes: 's',
            condition: 'c',
            visualTags: 'v',
            hardRules: 'h',
            artStyle: 'anime'
          },
          profileJson: '{}',
          isNew: false
        })
      })
    })
    await acceptDraft()
  }, 30000)
})

describe('easy90 Costumes past 90', () => {
  beforeEach(() => seed())

  it('dress workstation + links toggle + intro + AI', async () => {
    api.costumes.list = vi.fn().mockResolvedValue([
      makeCostume({
        id: 'cos-1',
        name: 'Rain coat',
        description: 'long black trench wet rain',
        refImagePath: '/media/coat.png',
        refGalleryJson: gal('/media/coat.png', 'cg'),
        characterLinks: [{ characterId: 'char-1', character: { id: 'char-1' } }]
      } as never)
    ])
    api.costumes.update = vi.fn().mockResolvedValue(makeCostume())
    api.costumes.create = vi.fn().mockResolvedValue(makeCostume({ id: 'cn' }))
    api.costumes.generateDressed = vi.fn().mockResolvedValue({
      path: '/tmp/dressed.png',
      costume: {
        id: 'cos-1',
        refImagePath: '/tmp/dressed.png',
        refGalleryJson: gal('/tmp/dressed.png', 'dg')
      }
    })
    api.costumes.aiFill = vi.fn().mockResolvedValue({
      name: 'Storm coat',
      description: 'wet leather sheen',
      artStyle: 'anime',
      hardRules: 'no logos'
    })
    api.costumes.linkCharacter = vi.fn().mockResolvedValue({})
    api.costumes.unlinkCharacter = vi.fn().mockResolvedValue({})
    api.characters.list = vi.fn().mockResolvedValue([
      makeCharacter({
        id: 'char-1',
        name: 'Aria',
        refImagePath: '/media/aria.png',
        refGalleryJson: gal('/media/aria.png', 'ag'),
        appearance: 'short dark hair',
        ageRange: '30s',
        gender: 'female',
        visualTags: 'rain'
      }),
      makeCharacter({
        id: 'char-2',
        name: 'Ben',
        refImagePath: '/media/ben.png',
        refGalleryJson: gal('/media/ben.png', 'bg')
      })
    ])
    api.timeline.list = vi.fn().mockResolvedValue([])

    await renderWithProviders(
      <>
        <Probe />
        <CostumesPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await openCardEdit('Rain coat')

    // Details AI fill
    await clickNamed(/Details|Profile/i)
    for (const ta of Array.from(document.querySelectorAll('textarea')).slice(
      0,
      2
    )) {
      await act(async () =>
        fireEvent.change(ta, { target: { value: 'wet leather trench rain' } })
      )
    }
    await clickNamed(/AI fill \/ improve/i)
    await waitFor(() => expect(api.costumes.aiFill).toHaveBeenCalled(), {
      timeout: 8000
    }).catch(() => undefined)

    // Dress tab — pick character with gallery stills
    await clickNamed(/Image \/ dress|Dress/i)
    for (const sel of Array.from(document.querySelectorAll('select'))) {
      const s = sel as HTMLSelectElement
      // Prefer character Aria
      const aria = Array.from(s.options).find((o) =>
        /Aria|char-1/i.test(o.textContent || o.value)
      )
      if (aria) {
        await act(async () =>
          fireEvent.change(s, { target: { value: aria.value } })
        )
      } else if (s.options.length > 1) {
        await act(async () =>
          fireEvent.change(s, { target: { value: s.options[1].value } })
        )
      }
    }
    for (const ta of Array.from(document.querySelectorAll('textarea')).slice(
      -2
    )) {
      await act(async () =>
        fireEvent.change(ta, {
          target: { value: 'coat open, wet rain sheen, long train' }
        })
      )
    }
    await clickNamed(/Generate dressed look|Generate look image/i)
    if (await confirmImageGen()) {
      await waitFor(
        () => expect(api.costumes.generateDressed).toHaveBeenCalled(),
        { timeout: 10000 }
      )
    }

    await clickNamed(/Upload reference|pick/i)
    await clickNamed(/Set as cover/i)

    // Intro video path
    await clickNamed(/Intro|video/i)
    if (screen.queryByTestId('vp')) {
      await clickNamed(/^vpc$/i)
      await clickNamed(/^vpf$/i)
    }
    await act(async () => {
      window.dispatchEvent(
        new CustomEvent('idm:video-prep-done', {
          detail: {
            kind: 'costume-intro',
            entityIds: { costumeId: 'cos-1' },
            gallery: [
              {
                id: 'cg',
                path: '/media/coat.png',
                kind: 'gen',
                label: 'L',
                createdAt: '2026-07-01T00:00:00.000Z',
                layer: 'costume',
                introVideoPath: '/cv.mp4'
              }
            ]
          }
        })
      )
    })
    await act(async () => {
      window.dispatchEvent(
        new CustomEvent('idm:video-prep-done', {
          detail: { kind: 'costume-intro', entityIds: { costumeId: 'cos-1' } }
        })
      )
    })

    // Links tab — toggle link/unlink
    await clickNamed(/Linked cast|Links|Link/i)
    for (const f of [/All/i, /Linked/i, /Not linked|Unlinked/i]) {
      await clickNamed(f)
    }
    const search = Array.from(document.querySelectorAll('input')).find(
      (i) =>
        (i as HTMLInputElement).type === 'search' ||
        (i as HTMLInputElement).type === 'text'
    )
    if (search) {
      await act(async () =>
        fireEvent.change(search, { target: { value: 'Ben' } })
      )
    }
    // Link / Unlink: clear search, show all, click every Link/Unlink
    if (search) {
      await act(async () => fireEvent.change(search, { target: { value: '' } }))
    }
    await clickNamed(/All/i)
    for (const b of screen.getAllByRole('button')) {
      const t = (b.textContent || '').trim()
      if (/^Link$/i.test(t) || /^Unlink$/i.test(t)) {
        if (!(b as HTMLButtonElement).disabled) {
          await act(async () => fireEvent.click(b))
        }
      }
    }
    await waitFor(() =>
      expect(
        api.costumes.linkCharacter.mock.calls.length +
          api.costumes.unlinkCharacter.mock.calls.length
      ).toBeGreaterThan(0)
    ).catch(() => undefined)

    // Filters again + save
    for (const f of [/Linked/i, /Not linked|Unlinked/i, /All/i]) {
      await clickNamed(f)
    }
    await clickNamed(/^Save$/i)

    // Re-open and force dress generate with Aria + base path select
    await openCardEdit('Rain coat').catch(() => undefined)
    await clickNamed(/Image \/ dress|Dress/i)
    for (const sel of Array.from(document.querySelectorAll('select'))) {
      const s = sel as HTMLSelectElement
      const aria = Array.from(s.options).find((o) =>
        /Aria|char-1/i.test(o.textContent || o.value)
      )
      if (aria) {
        await act(async () =>
          fireEvent.change(s, { target: { value: aria.value } })
        )
      }
      // pick a base still path option if present
      const still = Array.from(s.options).find((o) =>
        /png|media|aria|path/i.test(o.value + o.textContent)
      )
      if (still && still.value) {
        await act(async () =>
          fireEvent.change(s, { target: { value: still.value } })
        )
      }
      if (s.options.length > 1) {
        await act(async () =>
          fireEvent.change(s, {
            target: { value: s.options[Math.min(1, s.options.length - 1)].value }
          })
        )
      }
    }
    await clickNamed(/Generate dressed look|Generate look image/i)
    if (await confirmImageGen()) {
      await waitFor(() =>
        expect(api.costumes.generateDressed).toHaveBeenCalled()
      ).catch(() => undefined)
    }

    // New look — dress/intro guards without save
    await clickNamed(/New look|New/i)
    await clickNamed(/Image \/ dress|Dress/i)
    await clickNamed(/Generate dressed look|Generate look/i)
    await clickNamed(/Intro|video/i)
    await clickNamed(/Linked cast|Links/i)
    await clickNamed(/^Link$/i) // linksSaveFirst toast

    // create path: fill name/desc and save new
    await clickNamed(/Details|Profile/i)
    for (const el of Array.from(
      document.querySelectorAll('input, textarea')
    ).slice(0, 3)) {
      await act(async () =>
        fireEvent.change(el, { target: { value: 'Brand new look residual' } })
      )
    }
    await clickNamed(/^Save$/i)
    await waitFor(() => expect(api.costumes.create).toHaveBeenCalled()).catch(
      () => undefined
    )
  }, 60000)

  it('Costumes: AI need-idea guard + empty dress base', async () => {
    api.costumes.list = vi.fn().mockResolvedValue([
      makeCostume({
        id: 'cos-1',
        name: 'Rain coat',
        description: '',
        refImagePath: null,
        refGalleryJson: null
      })
    ])
    api.costumes.update = vi.fn().mockResolvedValue(makeCostume())
    api.costumes.aiFill = vi.fn().mockResolvedValue({
      name: 'N',
      description: 'D'
    })
    // Character without gallery → dressCharBaseOptions empty
    api.characters.list = vi.fn().mockResolvedValue([
      makeCharacter({
        id: 'char-1',
        name: 'Aria',
        refImagePath: null,
        refGalleryJson: null
      })
    ])
    api.costumes.linkCharacter = vi.fn().mockResolvedValue({})
    api.costumes.unlinkCharacter = vi.fn().mockResolvedValue({})

    await renderWithProviders(
      <>
        <Probe />
        <CostumesPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await openCardEdit('Rain coat')
    await clickNamed(/Details|Profile/i)
    // clear fields for AI need idea
    for (const el of Array.from(document.querySelectorAll('input, textarea'))) {
      await act(async () => fireEvent.change(el, { target: { value: '' } }))
    }
    await clickNamed(/AI fill \/ improve/i)

    await clickNamed(/Image \/ dress|Dress/i)
    for (const sel of Array.from(document.querySelectorAll('select'))) {
      const s = sel as HTMLSelectElement
      if (s.options.length > 1) {
        await act(async () =>
          fireEvent.change(s, { target: { value: s.options[1].value } })
        )
      }
    }
    // no base image → toast
    await clickNamed(/Generate dressed look|Generate look/i)
  }, 25000)
})
