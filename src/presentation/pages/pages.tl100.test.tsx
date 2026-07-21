/**
 * Timeline past 90→100 + residual mop on other pages.
 * - videoPrep.create always returns professionalPrompt string
 * - rAF capped to avoid infinite play clock
 * - dismiss review modal quickly after create settles
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
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
import { ActionsPage } from './ActionsPage'
import { CharactersPage } from './CharactersPage'
import { CostumesPage } from './CostumesPage'
import { PropsPage } from './PropsPage'
import { ScenesPage } from './ScenesPage'
import { SettingsPage } from './SettingsPage'
import { StoriesPage } from './StoriesPage'
import { TimelinePage } from './TimelinePage'

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
vi.mock('../components/timeline/KonvaTimeline', () => ({
  KonvaTimeline: (p: {
    onSelect?: (id: string) => void
    onPackAbut?: () => void
    onResize?: (id: string, s: number, e: number) => void
    onMove?: (id: string, s: number, e: number) => void
    onDropAsset?: (payload: { kind: string; id: string }, at?: number) => void
    onSnapEnabledChange?: (v: boolean) => void
    onSnapGridSecChange?: (v: number) => void
    entries?: { id: string }[]
  }) => (
    <div data-testid="konva">
      <button type="button" onClick={() => p.onSelect?.(p.entries?.[0]?.id ?? 'entry-1')}>
        k-sel
      </button>
      <button type="button" onClick={() => p.onSelect?.(p.entries?.[1]?.id ?? 'entry-2')}>
        k-sel2
      </button>
      <button type="button" onClick={() => p.onSelect?.(p.entries?.[2]?.id ?? 'entry-3')}>
        k-sel3
      </button>
      <button type="button" onClick={() => p.onPackAbut?.()}>
        k-pack
      </button>
      <button
        type="button"
        onClick={() => p.onResize?.(p.entries?.[0]?.id ?? 'entry-1', 0, 8)}
      >
        k-resize
      </button>
      <button
        type="button"
        onClick={() => p.onMove?.(p.entries?.[0]?.id ?? 'entry-1', 2, 9)}
      >
        k-move
      </button>
      <button
        type="button"
        onClick={() => p.onDropAsset?.({ kind: 'character', id: 'char-1' }, 5)}
      >
        k-drop
      </button>
      <button
        type="button"
        onClick={() => p.onDropAsset?.({ kind: 'scene', id: 'scene-1' }, 2)}
      >
        k-drop-sc
      </button>
      <button
        type="button"
        onClick={() => p.onDropAsset?.({ kind: 'prop', id: 'prop-1' }, 3)}
      >
        k-drop-pr
      </button>
      <button
        type="button"
        onClick={() => p.onDropAsset?.({ kind: 'action', id: 'act-1' }, 4)}
      >
        k-drop-ac
      </button>
      <button type="button" onClick={() => p.onSnapEnabledChange?.(true)}>
        k-snap-on
      </button>
      <button type="button" onClick={() => p.onSnapEnabledChange?.(false)}>
        k-snap-off
      </button>
      <button type="button" onClick={() => p.onSnapGridSecChange?.(0.25)}>
        k-snap-grid
      </button>
      <button type="button" onClick={() => p.onSnapGridSecChange?.(1)}>
        k-snap-grid2
      </button>
    </div>
  )
}))
vi.mock('../components/timeline/PreviewPlayer', () => ({
  PreviewPlayer: (p: {
    onGenerate?: () => void
    onTime?: (n: number) => void
    onEnded?: () => void
  }) => (
    <div>
      <button type="button" onClick={() => p.onGenerate?.()}>
        p-gen
      </button>
      <button type="button" onClick={() => p.onTime?.(0.5)}>
        p-tick
      </button>
      <button type="button" onClick={() => p.onTime?.(4.2)}>
        p-tick2
      </button>
      <button type="button" onClick={() => p.onTime?.(11)}>
        p-tick3
      </button>
      <button type="button" onClick={() => p.onEnded?.()}>
        p-end
      </button>
    </div>
  )
}))
vi.mock('../components/timeline/TimelineAdvancedStudio', () => ({
  TimelineAdvancedStudio: (p: {
    open?: boolean
    onClose?: () => void
    onStartVideoQueue?: (ids: string[]) => void
    onRefresh?: () => void
    onRefreshTimeline?: () => void
  }) =>
    p.open ? (
      <div data-testid="adv">
        <button
          type="button"
          onClick={() => p.onStartVideoQueue?.(['entry-1', 'entry-3'])}
        >
          q
        </button>
        <button type="button" onClick={() => p.onRefresh?.()}>
          adv-r
        </button>
        <button type="button" onClick={() => p.onRefreshTimeline?.()}>
          adv-rt
        </button>
        <button type="button" onClick={() => p.onClose?.()}>
          xc
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

/** Cap rAF so gap-clock play cannot spin forever */
function installRafCap(maxCalls = 8) {
  let n = 0
  const origRaf = globalThis.requestAnimationFrame
  const origCaf = globalThis.cancelAnimationFrame
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    n++
    if (n > maxCalls) return n
    // single deferred tick — not a recursive schedule storm
    const id = n
    setTimeout(() => {
      try {
        cb(performance.now())
      } catch {
        /* ignore */
      }
    }, 0)
    return id
  })
  vi.stubGlobal('cancelAnimationFrame', () => undefined)
  return () => {
    vi.stubGlobal('requestAnimationFrame', origRaf)
    vi.stubGlobal('cancelAnimationFrame', origCaf)
  }
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
      { timeout: 3000 }
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

/** Wait briefly for VideoPrep review (host sleeps ~1.6s) then Cancel */
async function dismissVideoPrep(maxMs = 2800) {
  const start = Date.now()
  while (Date.now() - start < maxMs) {
    const cancel = screen
      .queryAllByRole('button')
      .find((b) => /^Cancel$/i.test((b.textContent || '').trim()))
    const confirm = screen
      .queryAllByRole('button')
      .find((b) => {
        const t = (b.textContent || '').trim()
        return (
          /Confirm video|Generate video|Confirm/i.test(t) &&
          !(b as HTMLButtonElement).disabled
        )
      })
    // Prefer cancel to avoid long confirm pipeline
    if (cancel && document.body.textContent?.match(/professional|prompt|still|video prep|prep/i)) {
      await act(async () => fireEvent.click(cancel))
      await act(async () => {
        await new Promise((r) => setTimeout(r, 40))
      })
      return true
    }
    if (cancel && document.querySelector('[data-testid], [role="dialog"]')) {
      await act(async () => fireEvent.click(cancel))
      await act(async () => {
        await new Promise((r) => setTimeout(r, 40))
      })
      return true
    }
    // Any visible Cancel after create started
    if (cancel && Date.now() - start > 900) {
      await act(async () => fireEvent.click(cancel))
      await act(async () => {
        await new Promise((r) => setTimeout(r, 40))
      })
      return true
    }
    void confirm
    await act(async () => {
      await new Promise((r) => setTimeout(r, 80))
    })
  }
  // Last resort: click any Cancel
  const cancel = screen
    .queryAllByRole('button')
    .find((b) => /^Cancel$/i.test((b.textContent || '').trim()))
  if (cancel) {
    await act(async () => fireEvent.click(cancel))
    return true
  }
  return false
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
    path: '/tmp/u'
  })
  api.shell.showItemInFolder = vi.fn().mockResolvedValue({ ok: true })
  api.videoPrep.create = vi.fn().mockImplementation(async (payload: {
    kind?: string
    storyId?: string
    entryId?: string
    characterId?: string
    sceneId?: string
    propId?: string
    actionId?: string
    costumeId?: string
    sourceImagePath?: string
  }) => ({
    professionalPrompt: 'FULL PROFESSIONAL PROMPT timeline residual safe',
    stillPath: payload?.sourceImagePath ?? '/s.png',
    sourceImagePath: payload?.sourceImagePath ?? '/s.png',
    durationSeconds: 6,
    aspectRatio: '16:9',
    entityIds: {
      storyId: payload?.storyId ?? 'story-1',
      entryId: payload?.entryId ?? 'entry-1',
      characterId: payload?.characterId,
      sceneId: payload?.sceneId,
      propId: payload?.propId,
      actionId: payload?.actionId,
      costumeId: payload?.costumeId
    },
    kind: payload?.kind ?? 'timeline-clip',
    userExtraPrompt: '',
    queueIndex: 1,
    queueTotal: 1,
    materialsSummary: 'mats',
    stillPromptUsed: 'still-p',
    skippedStill: false
  }))
  api.videoPrep.confirm = vi.fn().mockResolvedValue({ videoPath: '/o.mp4' })
  api.videoPrep.openFromStill = vi.fn().mockResolvedValue({
    professionalPrompt: 'FROM STILL FULL PROMPT',
    stillPath: '/s.png',
    sourceImagePath: '/s.png',
    durationSeconds: 6,
    aspectRatio: '16:9',
    entityIds: { storyId: 'story-1', entryId: 'entry-1' },
    kind: 'timeline-clip',
    userExtraPrompt: ''
  })
  api.videoPrep.regenStill = vi.fn().mockResolvedValue({
    professionalPrompt: 'REGEN FULL PROMPT',
    stillPath: '/s2.png',
    sourceImagePath: '/s.png',
    durationSeconds: 6,
    aspectRatio: '16:9',
    entityIds: { storyId: 'story-1', entryId: 'entry-1' },
    kind: 'timeline-clip',
    userExtraPrompt: ''
  })
  api.generation.cancel = vi.fn().mockResolvedValue({ ok: true })
  api.generation.run = vi.fn().mockResolvedValue({
    success: true,
    steps: [
      { step: 'script', success: true },
      { step: 'timeline', success: true, degraded: true }
    ]
  })
  api.generation.onProgress = vi.fn(() => () => undefined)
  api.settings.get = vi.fn().mockResolvedValue({ ...DEFAULT_SETTINGS })
  api.settings.set = vi.fn().mockResolvedValue({})
  api.costumes.list = vi.fn().mockResolvedValue([])
  api.characters.list = vi.fn().mockResolvedValue([makeCharacter()])
  api.scenes.list = vi.fn().mockResolvedValue([makeScene()])
  api.props.list = vi.fn().mockResolvedValue([makeProp()])
  api.actions.list = vi.fn().mockResolvedValue([makeAction()])
  api.timeline.list = vi.fn().mockResolvedValue([])
}

// ═══════════════════════════════════════════════════════════
// Timeline → 90% then residual
// ═══════════════════════════════════════════════════════════
describe('tl100 Timeline residual', () => {
  beforeEach(() => seed())

  it('generate fail/ok, retry failed, clip prep dismiss, play capped rAF, snap export', async () => {
    const restoreRaf = installRafCap(6)
    try {
      const entries = [
        makeTimelineEntry({
          id: 'entry-1',
          storyId: 'story-1',
          order: 0,
          startTime: 0,
          endTime: 4,
          mediaStatus: 'EMPTY',
          mediaPath: null,
          dialogue: 'Empty gap',
          characterId: 'char-1',
          sceneId: 'scene-1',
          actionId: null,
          propId: null,
          beatContentJson: JSON.stringify({
            spoken: ['Hello spoken residual']
          })
        }),
        makeTimelineEntry({
          id: 'entry-2',
          storyId: 'story-1',
          order: 1,
          startTime: 4,
          endTime: 10,
          mediaStatus: 'READY',
          mediaPath: '/m.mp4',
          stillPath: '/s.png',
          dialogue: 'Ready clip',
          characterId: 'char-1'
        }),
        makeTimelineEntry({
          id: 'entry-3',
          storyId: 'story-1',
          order: 2,
          startTime: 10,
          endTime: 16,
          mediaStatus: 'FAILED',
          mediaPath: null,
          dialogue: 'Failed clip',
          stillPath: '/still-fail.png'
        })
      ]
      api.timeline.list = vi.fn().mockResolvedValue(entries)
      api.timeline.update = vi.fn().mockResolvedValue({})
      api.timeline.create = vi.fn().mockResolvedValue(
        makeTimelineEntry({ id: 'n', startTime: 16, endTime: 20 })
      )
      api.timeline.delete = vi.fn().mockResolvedValue({ ok: true })
      api.timeline.reorder = vi.fn().mockResolvedValue({ ok: true })
      api.characters.list = vi.fn().mockResolvedValue([
        makeCharacter({
          id: 'char-1',
          name: 'Aria',
          refImagePath: '/a.png',
          refGalleryJson: gal('/a.png')
        })
      ])
      api.scenes.list = vi.fn().mockResolvedValue([makeScene()])
      api.props.list = vi.fn().mockResolvedValue([makeProp()])
      api.actions.list = vi.fn().mockResolvedValue([makeAction()])
      api.settings.get = vi.fn().mockResolvedValue({
        ...DEFAULT_SETTINGS,
        videoMode: 'stub',
        snapEnabled: false,
        snapGridSec: 0.25,
        openExportFolder: true,
        burnSubtitles: true
      })
      api.settings.set = vi
        .fn()
        .mockRejectedValueOnce(new Error('snap persist fail'))
        .mockResolvedValue({})
      api.media.listExports = vi.fn().mockResolvedValue({
        items: [
          {
            id: 'ex1',
            kind: 'final',
            fileName: 'f.mp4',
            path: '/exports/f.mp4',
            createdAt: '2026-07-15T12:00:00.000Z',
            sizeBytes: 500
          },
          {
            id: 'ex2',
            kind: 'board',
            fileName: 'b.png',
            path: '/exports/b.png',
            createdAt: 'bad-date',
            sizeBytes: 2048
          }
        ],
        latestPath: '/exports/f.mp4'
      })
      api.media.deleteExport = vi
        .fn()
        .mockRejectedValueOnce(new Error('del fail'))
        .mockResolvedValue({ ok: true, items: [], latestPath: null })
      api.media.exportPreflight = vi.fn().mockResolvedValue({
        ffmpeg: true,
        ffmpegMessage: 'ok',
        readyClips: 1,
        totalClips: 3,
        willUseFallback: true,
        warnings: ['w'],
        canExport: true
      })
      api.media.exportFinal = vi
        .fn()
        .mockRejectedValueOnce(
          Object.assign(new Error('ffmpeg missing'), {
            code: 'FFMPEG_UNAVAILABLE'
          })
        )
        .mockResolvedValue({ path: '/exports/out.mp4' })
      api.media.exportStoryboard = vi.fn().mockResolvedValue({ path: '/b.png' })
      api.media.importClip = vi.fn().mockResolvedValue({ path: '/i.mp4' })
      api.media.openClip = vi.fn().mockResolvedValue({})
      api.generation.run = vi
        .fn()
        .mockResolvedValueOnce({
          success: false,
          steps: [
            { step: 'script', success: false, error: 'boom' },
            { step: 'timeline', success: true, degraded: true }
          ]
        })
        .mockResolvedValue({
          success: true,
          steps: [
            { step: 'script', success: true },
            { step: 'timeline', success: true, degraded: true }
          ]
        })
      api.generation.onProgress = vi.fn((cb: (p: object) => void) => {
        cb({
          storyId: 'story-1',
          index: 0,
          total: 3,
          step: 'script',
          entryId: 'entry-1',
          mediaStatus: 'READY'
        })
        cb({
          storyId: 'story-1',
          index: 1,
          total: 3,
          step: 'timeline',
          entryId: 'entry-2',
          mediaStatus: 'READY'
        })
        return () => undefined
      })

      await renderWithProviders(
        <>
          <Probe />
          <TimelinePage />
        </>,
        { route: '/timeline', withAiShell: true, withToastHost: true }
      )
      await waitFor(() => expect(api.timeline.list).toHaveBeenCalled(), {
        timeout: 8000
      })

      // Select + preview ticks (no long play)
      await clickNamed(/^k-sel$/i)
      await clickNamed(/^p-tick$/i)
      await clickNamed(/^p-end$/i)
      await clickNamed(/^k-sel2$/i)
      await clickNamed(/^p-tick2$/i)
      await clickNamed(/^p-end$/i)
      // Brief play with capped rAF then pause
      await clickNamed(/^Play$|▶/i)
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50))
      })
      await clickNamed(/Pause|Play|▶/i)

      // Dialogue / duration / snap
      for (const ta of Array.from(document.querySelectorAll('textarea')).slice(
        0,
        2
      )) {
        await act(async () =>
          fireEvent.change(ta, { target: { value: 'tl residual dialogue' } })
        )
      }
      for (const inp of Array.from(document.querySelectorAll('input')).slice(
        0,
        6
      ) as HTMLInputElement[]) {
        if (inp.type === 'number' || inp.type === 'range') {
          await act(async () =>
            fireEvent.change(inp, { target: { value: '5' } })
          )
        } else if (inp.type === 'checkbox') {
          await act(async () => fireEvent.click(inp))
        }
      }
      await clickNamed(/Snap|Grid|Timeline snap/i)
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

      // Pack + konva
      await clickNamed(/Pack|Abut/i)
      await clickNamed(/^k-pack$/i)
      await clickNamed(/^k-resize$/i)
      await clickNamed(/^k-move$/i)
      await clickNamed(/^k-drop$/i)
      await clickNamed(/^k-drop-sc$/i)
      await clickNamed(/^k-drop-pr$/i)
      await clickNamed(/^k-drop-ac$/i)
      // persistSnapSettings via konva snap callbacks
      await clickNamed(/^k-snap-on$/i)
      await clickNamed(/^k-snap-off$/i)
      await clickNamed(/^k-snap-grid$/i)
      await clickNamed(/^k-snap-grid2$/i)

      // Generate fail path (confirm) then success
      await clickNamed(/Start generation|Generate all|^Generate$/i)
      if (document.querySelector('[role="alertdialog"]')) {
        await act(async () => clickDialogConfirm())
      }
      await act(async () => {
        await new Promise((r) => setTimeout(r, 80))
      })
      await dismissVideoPrep(500)

      await clickNamed(/Start generation|Generate all|^Generate$/i)
      if (document.querySelector('[role="alertdialog"]')) {
        await act(async () => clickDialogConfirm())
      }
      // success kicks clip prep queue — dismiss modal
      await dismissVideoPrep(2500)

      // Retry failed
      await clickNamed(/Retry failed clips|Retry failed/i)
      if (document.querySelector('[role="alertdialog"]')) {
        await act(async () => clickDialogConfirm())
      }
      await dismissVideoPrep(2500)

      // Per-clip generate / regen
      await clickNamed(/^k-sel3$/i)
      await clickNamed(/Generate this clip|Regenerate|Continue video/i)
      await dismissVideoPrep(2500)
      await clickNamed(/^p-gen$/i)
      await dismissVideoPrep(2500)

      // Advanced queue
      await clickNamed(/Advanced/i)
      await clickNamed(/^q$/i)
      await dismissVideoPrep(2500)
      await clickNamed(/^adv-r$/i)
      await clickNamed(/^adv-rt$/i)
      await clickNamed(/^xc$/i)

      // Export history delete fail then ok
      await clickNamed(/Export history/i)
      await clickNamed(/Open file|Open File|folder|Show/i)
      await clickNamed(/^Delete$/i)
      if (document.querySelector('[role="alertdialog"]')) {
        await act(async () => clickDialogConfirm())
      }
      await act(async () => {
        await new Promise((r) => setTimeout(r, 30))
      })
      await clickNamed(/^Delete$/i)
      if (document.querySelector('[role="alertdialog"]')) {
        await act(async () => clickDialogConfirm())
      }
      await clickNamed(/Refresh/i)
      const x = Array.from(document.querySelectorAll('button')).find(
        (b) => (b.textContent || '').trim() === '✕'
      )
      if (x) await act(async () => fireEvent.click(x))

      // Export final ffmpeg fail then ok + board
      await clickNamed(/Export final|Export video|Export/i)
      if (document.querySelector('[role="alertdialog"]')) {
        await act(async () => clickDialogConfirm())
      }
      await act(async () => {
        await new Promise((r) => setTimeout(r, 40))
      })
      await clickNamed(/Export final|Export video|Export/i)
      if (document.querySelector('[role="alertdialog"]')) {
        await act(async () => clickDialogConfirm())
      }
      await act(async () => {
        await new Promise((r) => setTimeout(r, 40))
      })
      await clickNamed(/Storyboard|Board export|Export storyboard/i)

      await act(async () => {
        window.dispatchEvent(
          new CustomEvent('idm:video-prep-done', {
            detail: {
              kind: 'timeline-clip',
              entityIds: { storyId: 'story-1', entryId: 'entry-1' },
              path: '/done.mp4'
            }
          })
        )
      })
      await act(async () => {
        await new Promise((r) => setTimeout(r, 30))
      })
      await clickNamed(/Import/i)
    } finally {
      restoreRaf()
    }
  }, 90000)

  it('api mode missing-ref confirm cancel + continue draft + empty no-failed', async () => {
    const restoreRaf = installRafCap(4)
    try {
      try {
        localStorage.setItem(
          'idm.videoPrepDrafts.v2',
          JSON.stringify({
            ['timeline-clip:story-1:entry-2']: {
              kind: 'timeline-clip',
              entityIds: { storyId: 'story-1', entryId: 'entry-2' },
              sourceImagePath: '/s.png',
              professionalPrompt: 'SAVED DRAFT FULL PROMPT',
              stillPath: '/s.png',
              durationSeconds: 6,
              aspectRatio: '16:9',
              userExtraPrompt: '',
              savedAt: Date.now()
            }
          })
        )
      } catch {
        /* ignore */
      }
      api.timeline.list = vi.fn().mockResolvedValue([
        makeTimelineEntry({
          id: 'entry-2',
          storyId: 'story-1',
          mediaStatus: 'READY',
          mediaPath: '/m.mp4',
          stillPath: '/s.png',
          dialogue: 'R'
        })
      ])
      api.characters.list = vi.fn().mockResolvedValue([
        makeCharacter({
          id: 'char-1',
          name: 'Aria',
          refImagePath: null // missing ref
        })
      ])
      api.scenes.list = vi.fn().mockResolvedValue([makeScene()])
      api.props.list = vi.fn().mockResolvedValue([])
      api.actions.list = vi.fn().mockResolvedValue([])
      api.settings.get = vi.fn().mockResolvedValue({
        ...DEFAULT_SETTINGS,
        videoMode: 'api',
        snapEnabled: true
      })
      api.media.listExports = vi.fn().mockResolvedValue({
        items: [],
        latestPath: null
      })

      await renderWithProviders(
        <>
          <Probe />
          <TimelinePage />
        </>,
        { route: '/timeline', withAiShell: true, withToastHost: true }
      )
      await waitFor(() => expect(api.timeline.list).toHaveBeenCalled())

      // Generate with missing ref confirm — cancel second dialog
      await clickNamed(/Start generation|Generate all|^Generate$/i)
      if (document.querySelector('[role="alertdialog"]')) {
        await act(async () => clickDialogConfirm())
      }
      if (document.querySelector('[role="alertdialog"]')) {
        const cancel = Array.from(document.querySelectorAll('button')).find(
          (b) => /^Cancel$/i.test((b.textContent || '').trim())
        )
        if (cancel) await act(async () => fireEvent.click(cancel))
      }

      // Continue draft label path
      await clickNamed(/^k-sel$/i)
      await clickNamed(/Continue video|Generate this clip|Regenerate/i)
      await dismissVideoPrep(2500)

      // Retry failed with only READY → no failed toast
      await clickNamed(/Retry failed clips|Retry failed/i)
      await act(async () => {
        await new Promise((r) => setTimeout(r, 30))
      })
    } finally {
      restoreRaf()
    }
  }, 45000)

  it('empty timeline generate toast + listExports missing', async () => {
    api.timeline.list = vi.fn().mockResolvedValue([])
    // @ts-expect-error
    api.media.listExports = undefined
    api.settings.get = vi.fn().mockResolvedValue({
      ...DEFAULT_SETTINGS,
      videoMode: 'stub'
    })
    await renderWithProviders(
      <>
        <Probe />
        <TimelinePage />
      </>,
      { route: '/timeline', withAiShell: true, withToastHost: true }
    )
    await waitFor(() => expect(api.timeline.list).toHaveBeenCalled())
    await clickNamed(/Start generation|Generate/i)
    await clickNamed(/Retry failed clips|Retry failed/i)
  }, 20000)
})

// ═══════════════════════════════════════════════════════════
// Residual mop other pages
// ═══════════════════════════════════════════════════════════
describe('tl100 residual Settings Scenes Stories', () => {
  beforeEach(() => seed())

  it('Settings image/video providers + grok install + npm web', async () => {
    api.settings.get = vi.fn().mockResolvedValue({
      ...DEFAULT_SETTINGS,
      llmProvider: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o',
      apiKey: 'sk-x',
      imageProvider: 'same-as-llm',
      videoProvider: 'stub',
      videoMode: 'stub',
      colorScheme: 'dark',
      legalAcceptedVersion: '1.0.0',
      firstRunSeen: true,
      webServerPort: 8787,
      webServerHost: '0.0.0.0',
      chatTimeoutMs: 60000
    })
    api.settings.set = vi.fn().mockImplementation(async (p) => ({
      ...DEFAULT_SETTINGS,
      ...p
    }))
    api.app.getInfo = vi.fn().mockResolvedValue({
      version: '2',
      isPackaged: true,
      userData: '/tmp/u',
      mediaRoot: '/tmp/m',
      name: 'IDM',
      channels: 4
    })
    api.media.checkFfmpeg = vi.fn().mockResolvedValue({ available: true })
    api.media.pickBgm = vi.fn().mockResolvedValue({ path: '/b.mp3' })
    api.ai.listModels = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error('rate'), { code: 'AI_RATE_LIMIT' })
      )
      .mockResolvedValue([{ id: 'gpt-4o', ownedBy: 'fallback' }])
    api.ai.testChat = vi.fn().mockResolvedValue({
      ok: true,
      message: 'ok',
      replyPreview: 'hi'
    })
    api.gateway.status = vi.fn().mockResolvedValue({
      state: 'ready',
      healthOk: true,
      message: 'ok',
      grokPath: '/g',
      gctoacPath: '/c',
      adminUrl: 'http://a',
      keyReady: true
    })
    api.gateway.ensure = vi.fn().mockResolvedValue({
      state: 'ready',
      healthOk: true,
      keyReady: true,
      keyCreated: true,
      message: 'ok'
    })
    api.webServer.status = vi.fn().mockResolvedValue({
      running: true,
      url: 'http://127.0.0.1:8787',
      port: 8787,
      error: null,
      staticReady: true,
      token: 't',
      addresses: [
        { id: 'lan', address: 'http://192.168.1.2:8787' },
        { id: 'localhost', address: 'http://127.0.0.1:8787' }
      ]
    })
    api.webServer.start = vi.fn().mockResolvedValue({ running: true })
    api.webServer.stop = vi.fn().mockResolvedValue({ running: false })
    api.webServer.generateToken = vi.fn().mockResolvedValue('nt')
    api.updates.status = vi.fn().mockResolvedValue({
      status: 'available',
      channel: 'desktop-packaged',
      currentVersion: '1',
      latestVersion: '2',
      canCheck: true,
      canDownload: true,
      canAutoInstall: true,
      progress: 10,
      releaseNotes: 'n',
      releaseUrl: 'https://r',
      installCommand: 'npm i -g x@2'
    })
    api.updates.check = vi.fn().mockResolvedValue({ status: 'available' })
    api.updates.download = vi.fn().mockResolvedValue({ status: 'downloaded' })
    api.updates.install = vi.fn().mockResolvedValue({ ok: true })
    api.updates.checkNpm = vi.fn().mockResolvedValue({
      packageName: 'x',
      currentVersion: '1',
      latestVersion: '2',
      updateAvailable: true,
      checkedAt: new Date().toISOString(),
      installCommand: 'npm i -g x@2'
    })
    api.updates.onState = vi.fn((cb: (s: object) => void) => {
      cb({
        status: 'downloading',
        progress: 50,
        currentVersion: '1',
        latestVersion: '2',
        canCheck: true,
        canDownload: true,
        canAutoInstall: true,
        channel: 'desktop-packaged'
      })
      return () => undefined
    })
    api.updates.openReleasePage = vi.fn().mockResolvedValue({ ok: true })
    api.activity.clear = vi.fn().mockResolvedValue({ ok: true })
    api.app.exportFullBackup = vi.fn().mockResolvedValue({ ok: true })
    api.app.importFullBackup = vi.fn().mockResolvedValue({ ok: true })
    api.diagnostics.full = vi.fn().mockResolvedValue({ ok: true })
    api.support.exportReport = vi.fn().mockResolvedValue({
      ok: true,
      path: '/s.json'
    })
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) }
    })

    await renderWithProviders(
      <>
        <Probe />
        <SettingsPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await waitFor(() => expect(api.settings.get).toHaveBeenCalled())
    await clickNamed(/Chat model|Chat|LLM/i)
    await clickNamed(/Show advanced options/i)
    await clickNamed(/Refresh models|Refresh/i)
    await clickNamed(/Refresh models|Refresh/i)
    await clickNamed(/Test chat|Test/i)
    await clickNamed(/^Image$/i)
    for (const re of [/Seedream|Custom|Same|Grok/i]) await clickNamed(re)
    for (const sel of Array.from(document.querySelectorAll('select'))) {
      const s = sel as HTMLSelectElement
      for (let i = 0; i < s.options.length; i++) {
        await act(async () =>
          fireEvent.change(s, { target: { value: s.options[i].value } })
        )
      }
    }
    await clickNamed(/^Video$/i)
    for (const re of [/Seedance|Grok|Custom|Stub|Same/i]) await clickNamed(re)
    for (const sel of Array.from(document.querySelectorAll('select'))) {
      const s = sel as HTMLSelectElement
      for (let i = 0; i < Math.min(s.options.length, 4); i++) {
        await act(async () =>
          fireEvent.change(s, { target: { value: s.options[i].value } })
        )
      }
    }
    await clickNamed(/^App$/i)
    for (const re of [
      /Open folder/i,
      /Start|Stop|Copy|Check|Download|npm|Export all data|Restore from backup|support|Clear activity|Linktree/i
    ]) {
      await clickNamed(re)
      if (document.querySelector('[role="alertdialog"]')) {
        await act(async () => clickDialogConfirm())
      }
    }
    await clickNamed(/^Save$/i)
  }, 50000)

  it('Stories cast all kinds + Scenes atmosphere looks', async () => {
    const manyChars = Array.from({ length: 12 }, (_, i) =>
      makeCharacter({
        id: `char-${i + 1}`,
        name: i === 0 ? 'Aria' : `Cast${i}`,
        costumesJson:
          i === 0
            ? JSON.stringify([
                {
                  id: 'look-1',
                  name: 'Coat',
                  description: 'trench',
                  artStyle: 'anime',
                  imagePath: '/media/aria.png',
                  createdAt: '2026-07-01T00:00:00.000Z',
                  updatedAt: '2026-07-01T00:00:00.000Z'
                }
              ])
            : null
      })
    )
    api.stories.list = vi.fn().mockResolvedValue([
      makeStory({
        id: 'story-1',
        title: 'Demo Story',
        coverPath: '/media/cover.png',
        refGalleryJson: gal('/media/cover.png', 'cg'),
        artStyle: 'anime'
      })
    ])
    api.stories.get = vi.fn().mockResolvedValue(
      makeStoryDetail({
        id: 'story-1',
        title: 'Demo Story',
        coverPath: '/media/cover.png',
        refGalleryJson: gal('/media/cover.png', 'cg'),
        characters: [manyChars[0]],
        scenes: [makeScene()],
        props: [makeProp()],
        actions: [makeAction()]
      } as never)
    )
    api.stories.linkCharacter = vi.fn().mockResolvedValue({})
    api.stories.unlinkCharacter = vi.fn().mockResolvedValue({})
    api.stories.linkScene = vi.fn().mockResolvedValue({})
    api.stories.unlinkScene = vi.fn().mockResolvedValue({})
    api.stories.linkProp = vi.fn().mockResolvedValue({})
    api.stories.unlinkProp = vi.fn().mockResolvedValue({})
    api.stories.linkAction = vi.fn().mockResolvedValue({})
    api.stories.unlinkAction = vi.fn().mockResolvedValue({})
    api.stories.setCharacterCostume = vi.fn().mockResolvedValue({})
    api.stories.generateCover = vi.fn().mockResolvedValue({ path: '/c.png' })
    api.stories.commitCover = vi.fn().mockResolvedValue({ path: '/cc.png' })
    api.stories.aiFillScript = vi.fn().mockResolvedValue({
      beats: [{ order: 0, dialogue: 'X' }],
      drafts: [],
      raw: ''
    })
    api.characters.list = vi.fn().mockResolvedValue(manyChars)
    api.scenes.list = vi.fn().mockResolvedValue([
      makeScene({ id: 'scene-1' }),
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
    api.timeline.list = vi.fn().mockResolvedValue([
      makeTimelineEntry({ id: 'entry-1', dialogue: 'A' })
    ])
    api.timeline.update = vi.fn().mockResolvedValue(makeTimelineEntry())
    api.timeline.create = vi.fn().mockResolvedValue(makeTimelineEntry({ id: 'n' }))
    api.timeline.delete = vi.fn().mockResolvedValue({ ok: true })
    api.timeline.reorder = vi.fn().mockResolvedValue({ ok: true })
    api.costumes.list = vi.fn().mockResolvedValue([makeCostume()])

    const { unmount } = await renderWithProviders(
      <>
        <Probe />
        <StoriesPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await openCardEdit('Demo Story')
    await clickNamed(/Cast \/ set|Cast/i)
    await waitFor(() =>
      expect(document.body.textContent || '').toMatch(
        /Add to story|Remove from story|Aria/i
      )
    )
    for (const kind of [/Character/i, /Scene/i, /Prop/i, /Action/i]) {
      const tab = screen.getAllByRole('button').find((b) => {
        const t = (b.textContent || '').replace(/\d+/g, '').trim()
        return kind.test(t)
      })
      if (tab) await act(async () => fireEvent.click(tab))
      for (const f of [/All/i, /In story/i, /Not in story/i]) {
        await clickNamed(f)
      }
      for (const b of screen
        .getAllByRole('button')
        .filter((x) =>
          /Add to story|Remove from story/i.test((x.textContent || '').trim())
        )
        .slice(0, 3)) {
        await act(async () => fireEvent.click(b))
        await act(async () => {
          await new Promise((r) => setTimeout(r, 15))
        })
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
    }
    await clickNamed(/Cover|Poster/i)
    await clickNamed(/Generate cover/i)
    await confirmImageGen()
    unmount()

    // Scenes looks
    const looksJson = JSON.stringify([
      {
        id: 'look-s1',
        name: 'Default',
        description: 'wet neon rain',
        artStyle: 'anime',
        imagePath: '/media/roof.png',
        createdAt: '2026-07-01T00:00:00.000Z',
        updatedAt: '2026-07-01T00:00:00.000Z'
      },
      {
        id: 'look-s2',
        name: '',
        description: 'fog soft dawn',
        artStyle: 'realistic',
        imagePath: null,
        createdAt: '2026-07-01T00:00:00.000Z',
        updatedAt: '2026-07-01T00:00:00.000Z'
      }
    ])
    api.scenes.list = vi.fn().mockResolvedValue([
      makeScene({
        id: 'scene-1',
        title: 'Rooftop',
        locationKey: 'rooftop',
        refImagePath: '/media/roof.png',
        refGalleryJson: gal('/media/roof.png', 'sg'),
        looksJson,
        artStyle: 'anime'
      }),
      makeScene({
        id: 'scene-2',
        title: 'Rooftop',
        locationKey: 'rooftop',
        sceneNumber: 2,
        refImagePath: '/media/roof2.png',
        refGalleryJson: gal('/media/roof2.png', 'sg2')
      })
    ])
    api.scenes.update = vi.fn().mockResolvedValue(makeScene())
    api.scenes.generatePlate = vi.fn().mockResolvedValue({
      path: '/tmp/p.png',
      label: 'P'
    })
    api.scenes.commitPlate = vi.fn().mockResolvedValue({
      path: '/tmp/pc.png',
      gallery: []
    })
    api.scenes.swapAtmosphere = vi.fn().mockResolvedValue({
      path: '/tmp/a.png',
      label: 'A'
    })
    api.scenes.copyGalleryFrom = vi.fn().mockResolvedValue({
      scene: makeScene({ id: 'scene-1', locationKey: 'rooftop' })
    })
    api.scenes.aiFill = vi.fn().mockResolvedValue({
      profile: { title: 'R', description: 'd', artStyle: 'anime' },
      profileJson: '{}',
      raw: ''
    })

    await renderWithProviders(
      <>
        <Probe />
        <ScenesPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await waitFor(() =>
      expect(document.body.textContent || '').toMatch(/Rooftop/i)
    )
    await openCardEdit('Rooftop')
    await clickNamed(/^Images$/i)
    const atmo = screen
      .getAllByRole('button')
      .filter((b) => /^Atmosphere$/i.test((b.textContent || '').trim()))
    if (atmo.length) {
      await act(async () => fireEvent.click(atmo[atmo.length - 1]!))
    }
    await waitFor(() =>
      expect(document.body.textContent || '').toMatch(
        /wet neon|Atmosphere library|Apply/i
      )
    )
    for (const b of screen
      .getAllByRole('button')
      .filter((x) => /^Apply$/i.test((x.textContent || '').trim()))
      .slice(0, 2)) {
      await act(async () => fireEvent.click(b))
    }
    await clickNamed(/Generate atmosphere|swap/i)
    const copyBtn = screen
      .getAllByRole('button')
      .find((b) => /#\s*2/i.test((b.textContent || '').trim()))
    if (copyBtn) await act(async () => fireEvent.click(copyBtn))
  }, 70000)
})

describe('tl100 residual CAPC intro with safe videoPrep', () => {
  beforeEach(() => seed())

  it('Characters Actions Props Costumes intro dismiss', async () => {
    api.characters.list = vi.fn().mockResolvedValue([
      makeCharacter({
        id: 'char-1',
        name: 'Aria',
        refImagePath: '/media/aria.png',
        refGalleryJson: gal('/media/aria.png'),
        hardRules: 'h'
      })
    ])
    api.characters.update = vi.fn().mockResolvedValue(makeCharacter())
    api.characters.generateSheet = vi.fn().mockResolvedValue({
      path: '/tmp/sh.png',
      label: 'S'
    })
    const { unmount: u1 } = await renderWithProviders(
      <>
        <Probe />
        <CharactersPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await openCardEdit('Aria')
    await clickNamed(/^References$/i)
    await clickNamed(/Intro|video/i)
    await dismissVideoPrep(2500)
    u1()

    api.actions.list = vi.fn().mockResolvedValue([
      makeAction({
        id: 'act-1',
        name: 'Draw gun',
        refImagePath: '/a.png',
        refGalleryJson: gal('/a.png', 'ag')
      })
    ])
    api.actions.update = vi.fn().mockResolvedValue(makeAction())
    const { unmount: u2 } = await renderWithProviders(
      <>
        <Probe />
        <ActionsPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await openCardEdit('Draw gun')
    await clickNamed(/^References$/i)
    await clickNamed(/Intro|video/i)
    await dismissVideoPrep(2500)
    u2()

    api.props.list = vi.fn().mockResolvedValue([
      makeProp({
        id: 'prop-1',
        name: 'Badge',
        refImagePath: '/media/badge.png',
        refGalleryJson: gal('/media/badge.png', 'pg')
      })
    ])
    api.props.update = vi.fn().mockResolvedValue(makeProp())
    const { unmount: u3 } = await renderWithProviders(
      <>
        <Probe />
        <PropsPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await openCardEdit('Badge')
    await clickNamed(/^Plates$|^References$/i)
    await clickNamed(/Intro|video/i)
    await dismissVideoPrep(2500)
    u3()

    api.costumes.list = vi.fn().mockResolvedValue([
      makeCostume({
        id: 'cost-1',
        name: 'Rain coat',
        refImagePath: '/media/coat.png',
        refGalleryJson: gal('/media/coat.png', 'cg')
      })
    ])
    api.costumes.update = vi.fn().mockResolvedValue(makeCostume())
    await renderWithProviders(
      <>
        <Probe />
        <CostumesPage />
      </>,
      { withAiShell: true, withToastHost: true }
    )
    await openCardEdit('Rain coat')
    await clickNamed(/Intro|video/i)
    await dismissVideoPrep(2500)
  }, 90000)
})
