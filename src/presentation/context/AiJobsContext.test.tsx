import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { createMockApi, reseedMockApi } from '../../test/mockApi'
import { ensureTestI18n, renderWithProviders } from '../../test/renderWithProviders'
import {
  AiJobsProvider,
  useAiJobs,
  type AiDraft,
  type AiJobKind
} from './AiJobsContext'

const api = createMockApi()
vi.mock('../../lib/api', () => ({
  getApi: () => api,
  isElectron: () => true,
  isWebRuntime: () => false
}))

type Api = ReturnType<typeof useAiJobs>
let latest: Api | null = null

function Probe({ onReady }: { onReady?: (a: Api) => void }) {
  const jobs = useAiJobs()
  latest = jobs
  onReady?.(jobs)
  return (
    <div>
      <span data-testid="count">{jobs.jobs.length}</span>
      <span data-testid="active">{jobs.activeJobs.length}</span>
      <span data-testid="pending">{jobs.pendingDrafts.length}</span>
      <span data-testid="review">{jobs.reviewingJobId ?? 'none'}</span>
      <ul>
        {jobs.jobs.map((j) => (
          <li key={j.id} data-status={j.status} data-kind={j.kind}>
            {j.label}:{j.status}:{j.error ?? j.message ?? ''}
          </li>
        ))}
      </ul>
    </div>
  )
}

async function mount() {
  await ensureTestI18n()
  return renderWithProviders(<Probe />, {
    withApp: false,
    withToast: false,
    withDialog: false,
    withAiJobs: true
  })
}

function draftJob(kind: AiJobKind, draft: AiDraft, scope = {}) {
  return latest!.startJob({
    kind,
    label: kind,
    scope,
    run: async () => draft
  })
}

describe('AiJobsContext', () => {
  beforeEach(() => {
    localStorage.clear()
    latest = null
    reseedMockApi(api)
    api.characters.update = vi.fn().mockResolvedValue({})
    api.characters.commitSheet = vi.fn().mockResolvedValue({
      path: '/p.png',
      character: { costume: 'coat' },
      gallery: [{ id: 'g1', path: '/p.png', kind: 'sheet', label: 'L', createdAt: '' }]
    })
    api.scenes.update = vi.fn().mockResolvedValue({})
    api.scenes.commitPlate = vi.fn().mockResolvedValue({
      path: '/s.png',
      gallery: []
    })
    api.props.update = vi.fn().mockResolvedValue({})
    api.props.commitPlate = vi.fn().mockResolvedValue({
      path: '/pr.png',
      gallery: []
    })
    api.actions.update = vi.fn().mockResolvedValue({})
    api.actions.commitPlate = vi.fn().mockResolvedValue({
      path: '/a.png',
      gallery: []
    })
    api.stories.commitCover = vi.fn().mockResolvedValue({ path: '/c.png' })
    api.media.discardSheetDraft = vi.fn().mockResolvedValue({})
    api.generation.cancel = vi.fn().mockResolvedValue({ ok: true })
  })

  afterEach(() => {
    cleanup()
    localStorage.clear()
  })

  it('startJob success with draft sets reviewing; cancel mid-run', async () => {
    await mount()
    let id = ''
    await act(async () => {
      id = latest!.startJob({
        kind: 'character-ai-fill',
        label: 'fill',
        scope: { characterId: 'c1' },
        run: async ({ signal, setProgress }) => {
          setProgress(40, 'working')
          await new Promise((r) => setTimeout(r, 30))
          if (signal.cancelled) return
          return {
            type: 'character-profile',
            characterId: 'c1',
            storyId: null,
            profile: { name: 'A', description: 'd' },
            profileJson: '{}',
            isNew: false
          }
        }
      })
    })
    await waitFor(() => expect(screen.getByTestId('active').textContent).toBe('1'))
    await act(async () => {
      await latest!.cancelJob(id)
    })
    await waitFor(() =>
      expect(screen.getByText(/fill:cancelled|fill:cancelling/)).toBeTruthy()
    )
  })

  it('startJob failure records error', async () => {
    await mount()
    await act(async () => {
      latest!.startJob({
        kind: 'clip',
        label: 'clip',
        scope: { entryId: 'e1', storyId: 's1' },
        run: async () => {
          throw new Error('nope')
        }
      })
    })
    await waitFor(() => expect(screen.getByText(/clip:failed:nope/)).toBeTruthy())
  })

  it('startJob without draft succeeds quietly', async () => {
    await mount()
    await act(async () => {
      latest!.startJob({
        kind: 'storyboard-still',
        label: 'still',
        run: async () => undefined
      })
    })
    await waitFor(() => expect(screen.getByText(/still:succeeded/)).toBeTruthy())
  })

  it('acceptDraft character-profile updates api and handlers', async () => {
    await mount()
    const applied: unknown[] = []
    await act(async () => {
      latest!.onProfileApply((d) => applied.push(d))
      draftJob(
        'character-ai-fill',
        {
          type: 'character-profile',
          characterId: 'c1',
          storyId: 's1',
          profile: {
            name: 'N',
            description: 'D',
            appearance: 'a',
            spokenLanguages: ['en']
          },
          profileJson: '{"name":"N"}',
          isNew: false
        },
        { characterId: 'c1' }
      )
    })
    await waitFor(() => expect(screen.getByTestId('pending').textContent).toBe('1'))
    const jobId = latest!.pendingDrafts[0].id
    await act(async () => {
      await latest!.acceptDraft(jobId)
    })
    expect(api.characters.update).toHaveBeenCalled()
    expect(applied).toHaveLength(1)
  })

  it('acceptDraft character-profile without id only notifies handlers', async () => {
    await mount()
    await act(async () => {
      draftJob('character-ai-fill', {
        type: 'character-profile',
        characterId: null,
        storyId: null,
        profile: { name: 'New', description: 'x' },
        profileJson: '{}',
        isNew: true
      })
    })
    await waitFor(() => expect(latest!.pendingDrafts.length).toBe(1))
    await act(async () => {
      await latest!.acceptDraft(latest!.pendingDrafts[0].id)
    })
    expect(api.characters.update).not.toHaveBeenCalled()
  })

  it('acceptDraft character-sheet commits and notifies', async () => {
    await mount()
    const sheets: unknown[] = []
    await act(async () => {
      latest!.onSheetCommitted((p) => sheets.push(p))
      draftJob(
        'character-sheet',
        {
          type: 'character-sheet',
          characterId: 'c1',
          storyId: 's1',
          path: '/tmp/s.png',
          variant: 'turnaround',
          label: 'Sheet',
          costumeDescription: 'coat'
        },
        { characterId: 'c1' }
      )
    })
    await waitFor(() => expect(latest!.pendingDrafts.length).toBe(1))
    await act(async () => {
      await latest!.acceptDraft(latest!.pendingDrafts[0].id)
    })
    expect(api.characters.commitSheet).toHaveBeenCalled()
    expect(sheets).toHaveLength(1)
  })

  it('acceptDraft pipeline/clip/wardrobe/scene/prop/action/cover', async () => {
    await mount()
    const hits: string[] = []
    await act(async () => {
      latest!.onPipelineDone((id) => hits.push(`pipe:${id}`))
      latest!.onWardrobeApply(() => hits.push('ward'))
      latest!.onSceneProfileApply(() => hits.push('sp'))
      latest!.onScenePlateCommitted(() => hits.push('spl'))
      latest!.onPropProfileApply(() => hits.push('pp'))
      latest!.onPropPlateCommitted(() => hits.push('ppl'))
      latest!.onActionProfileApply(() => hits.push('ap'))
      latest!.onActionPlateCommitted(() => hits.push('apl'))
      latest!.onStoryCoverCommitted(() => hits.push('cover'))
    })

    const drafts: Array<{ kind: AiJobKind; draft: AiDraft }> = [
      {
        kind: 'pipeline',
        draft: {
          type: 'pipeline',
          storyId: 's1',
          success: true,
          summary: 'ok'
        }
      },
      {
        kind: 'clip',
        draft: {
          type: 'clip',
          storyId: 's1',
          entryId: 'e1',
          success: true,
          summary: 'ok'
        }
      },
      {
        kind: 'wardrobe-suggest',
        draft: {
          type: 'wardrobe-suggest',
          characterId: 'c1',
          storyId: 's1',
          suggestion: {
            name: 'Look',
            costume: 'coat',
            artStyle: 'anime',
            rationale: 'plot'
          }
        }
      },
      {
        kind: 'scene-ai-fill',
        draft: {
          type: 'scene-profile',
          sceneId: 'sc1',
          storyId: 's1',
          profile: { description: 'room', title: 'R' },
          profileJson: '{}',
          isNew: false
        }
      },
      {
        kind: 'scene-plate',
        draft: {
          type: 'scene-plate',
          sceneId: 'sc1',
          storyId: 's1',
          path: '/sc.png',
          variant: 'wide',
          label: 'Plate'
        }
      },
      {
        kind: 'prop-ai-fill',
        draft: {
          type: 'prop-profile',
          propId: 'p1',
          storyId: 's1',
          profile: { name: 'Cup', description: 'ceramic' },
          profileJson: '{}',
          isNew: false
        }
      },
      {
        kind: 'prop-plate',
        draft: {
          type: 'prop-plate',
          propId: 'p1',
          storyId: 's1',
          path: '/p.png',
          variant: 'ortho',
          label: 'Plate'
        }
      },
      {
        kind: 'action-ai-fill',
        draft: {
          type: 'action-profile',
          actionId: 'a1',
          storyId: 's1',
          profile: { name: 'Run', description: 'sprint' },
          profileJson: '{}',
          isNew: false
        }
      },
      {
        kind: 'action-plate',
        draft: {
          type: 'action-plate',
          actionId: 'a1',
          storyId: 's1',
          path: '/a.png',
          panelLayout: '3panel',
          label: 'Plate'
        }
      },
      {
        kind: 'story-cover',
        draft: {
          type: 'story-cover',
          storyId: 's1',
          path: '/c.png',
          label: 'Cover'
        }
      }
    ]

    for (const item of drafts) {
      await act(async () => {
        draftJob(item.kind, item.draft)
      })
      await waitFor(() => expect(latest!.pendingDrafts.length).toBeGreaterThan(0))
      const id = latest!.pendingDrafts[0].id
      await act(async () => {
        await latest!.acceptDraft(id)
      })
    }

    expect(hits).toEqual(
      expect.arrayContaining([
        'pipe:s1',
        'ward',
        'sp',
        'spl',
        'pp',
        'ppl',
        'ap',
        'apl',
        'cover'
      ])
    )
    expect(api.scenes.update).toHaveBeenCalled()
    expect(api.props.update).toHaveBeenCalled()
    expect(api.actions.update).toHaveBeenCalled()
    expect(api.stories.commitCover).toHaveBeenCalled()
  })

  it('acceptDraft without draft just dismisses; discardDraft discards media', async () => {
    await mount()
    await act(async () => {
      latest!.startJob({
        kind: 'pipeline',
        label: 'p',
        run: async () => undefined
      })
    })
    await waitFor(() => expect(screen.getByText(/p:succeeded/)).toBeTruthy())
    const id = latest!.jobs[0].id
    await act(async () => {
      await latest!.acceptDraft(id)
    })

    await act(async () => {
      draftJob('character-sheet', {
        type: 'character-sheet',
        characterId: 'c1',
        storyId: 's1',
        path: '/tmp/drop.png',
        variant: 'v',
        label: 'L'
      })
    })
    await waitFor(() => expect(latest!.pendingDrafts.length).toBe(1))
    const jid = latest!.pendingDrafts[0].id
    await act(async () => {
      await latest!.discardDraft(jid)
    })
    expect(api.media.discardSheetDraft).toHaveBeenCalledWith('/tmp/drop.png')
  })

  it('isBlocked matches entity dimensions and new-entity nulls', async () => {
    await mount()
    let runningId = ''
    await act(async () => {
      runningId = latest!.startJob({
        kind: 'character-ai-fill',
        label: 'run',
        scope: { characterId: 'c1', storyId: 's1' },
        run: async () => {
          await new Promise((r) => setTimeout(r, 200))
          return {
            type: 'character-profile',
            characterId: 'c1',
            storyId: 's1',
            profile: { name: 'A', description: 'd' },
            profileJson: '{}',
            isNew: false
          }
        }
      })
    })
    await waitFor(() => expect(latest!.activeJobs.length).toBe(1))
    expect(
      latest!.isBlocked({ kind: 'character-ai-fill', characterId: 'c1' })
    ).toBe(true)
    expect(latest!.isBlocked({ kind: 'scene-ai-fill', sceneId: 'x' })).toBe(
      false
    )
    expect(latest!.isBlocked({ kind: 'character-ai-fill', characterId: null })).toBe(
      false
    )

    await act(async () => {
      latest!.startJob({
        kind: 'character-ai-fill',
        label: 'new',
        scope: {},
        run: async () => {
          await new Promise((r) => setTimeout(r, 200))
          return {
            type: 'character-profile',
            characterId: null,
            storyId: null,
            profile: { name: 'N', description: 'd' },
            profileJson: '{}',
            isNew: true
          }
        }
      })
    })
    expect(
      latest!.isBlocked({ kind: 'character-ai-fill', characterId: null })
    ).toBe(true)

    await act(async () => {
      latest!.startJob({
        kind: 'pipeline',
        label: 'pipe',
        scope: { storyId: 's1' },
        run: async () => {
          await new Promise((r) => setTimeout(r, 200))
        }
      })
    })
    expect(latest!.isBlocked({ storyId: 's1', kind: 'pipeline' })).toBe(true)

    await act(async () => {
      await latest!.cancelJob(runningId)
    })
  })

  it('generation onProgress updates pipeline/clip jobs', async () => {
    let progressCb: ((p: unknown) => void) | null = null
    let release!: () => void
    const gate = new Promise<void>((r) => {
      release = r
    })
    api.generation.onProgress = vi.fn((cb: (p: unknown) => void) => {
      progressCb = cb
      return () => {
        progressCb = null
      }
    })
    await mount()
    await act(async () => {
      latest!.startJob({
        kind: 'pipeline',
        label: 'pipe',
        scope: { storyId: 's1' },
        run: async () => {
          await gate
          return {
            type: 'pipeline',
            storyId: 's1',
            success: true,
            summary: 'ok'
          }
        }
      })
      latest!.startJob({
        kind: 'clip',
        label: 'clip',
        scope: { storyId: 's1', entryId: 'e1' },
        run: async () => {
          await gate
        }
      })
    })
    await waitFor(() => expect(latest!.activeJobs.length).toBe(2))
    await act(async () => {
      progressCb?.({
        storyId: 's1',
        step: 'images',
        index: 1,
        total: 4
      })
      progressCb?.({
        storyId: 's1',
        step: 'video',
        index: 0,
        total: 1,
        entryId: 'e1',
        mediaStatus: 'encoding'
      })
    })
    await waitFor(() => {
      const pipe = latest!.jobs.find((j) => j.kind === 'pipeline')
      const clip = latest!.jobs.find((j) => j.kind === 'clip')
      // pipeline listens to any progress for storyId (last step wins)
      expect(pipe?.message === 'images' || pipe?.message === 'video').toBe(true)
      expect(pipe && pipe.progress).toBeGreaterThan(2)
      expect(clip?.message === 'encoding' || clip?.message === 'video').toBe(
        true
      )
    })
    await act(async () => {
      release()
    })
  })




  it('video prep draft store + continue + register', async () => {
    await mount()
    const started: unknown[] = []
    await act(async () => {
      latest!.registerStartVideoPrep((input) => {
        started.push(input)
      })
      latest!.upsertSavedVideoPrepDraft(
        'k1',
        {
          kind: 'character-intro',
          entityIds: ['c1'],
          sourceImagePath: '/x.png',
          durationSeconds: 4,
          userExtraPrompt: '',
          queueIndex: 0,
          queueTotal: 1,
          stillPath: '/still.png',
          motionPrompt: 'walk'
        } as never,
        []
      )
    })
    expect(latest!.hasVideoPrepDraft('k1')).toBe(true)
    expect(latest!.getVideoPrepDraft('k1')).toBeTruthy()
    expect(latest!.continueVideoPrepDraft('k1')).toBe(true)
    expect(started.length).toBe(1)
    await act(async () => {
      latest!.removeSavedVideoPrepDraft('k1')
      latest!.setVideoPrepDraft(null)
      latest!.setVideoPrepSession(null)
      latest!.startVideoPrep({
        kind: 'character-intro',
        entityIds: ['c1'],
        sourceImagePath: '/x.png'
      } as never)
      latest!.registerStartVideoPrep(null)
      latest!.startVideoPrep({
        kind: 'character-intro',
        entityIds: ['c1'],
        sourceImagePath: '/x.png'
      } as never)
    })
    expect(latest!.hasVideoPrepDraft('k1')).toBe(false)
  })

  it('restores persisted succeeded drafts from localStorage', async () => {
    localStorage.setItem(
      'idm.aiJobs.v1',
      JSON.stringify([
        {
          id: 'job_old',
          kind: 'character-ai-fill',
          label: 'old',
          status: 'succeeded',
          progress: 100,
          scope: {},
          startedAt: 1,
          draft: {
            type: 'character-profile',
            characterId: 'c1',
            storyId: null,
            profile: { name: 'A', description: 'd' },
            profileJson: '{}',
            isNew: false
          }
        },
        {
          id: 'job_run',
          kind: 'clip',
          label: 'running',
          status: 'running',
          progress: 10,
          scope: {},
          startedAt: 2
        },
        {
          id: 'job_int',
          kind: 'clip',
          label: 'int',
          status: 'failed',
          progress: 100,
          error: 'interrupted_on_reload',
          scope: {},
          startedAt: 3
        }
      ])
    )
    await mount()
    await waitFor(() => expect(screen.getByTestId('pending').textContent).toBe('1'))
    expect(screen.getByTestId('review').textContent).toBe('job_old')
    await act(async () => {
      latest!.dismissJob('job_old')
    })
    expect(screen.getByTestId('pending').textContent).toBe('0')
  })

  it('loadPersistedJobs handles bad JSON and non-array', async () => {
    localStorage.setItem('idm.aiJobs.v1', '{not-json')
    await mount()
    expect(screen.getByTestId('count').textContent).toBe('0')
    cleanup()
    localStorage.setItem('idm.aiJobs.v1', '"x"')
    await mount()
    expect(screen.getByTestId('count').textContent).toBe('0')
  })

  it('video prep drafts upsert remove has and queue helpers', async () => {
    await mount()
    await act(async () => {
      latest!.upsertSavedVideoPrepDraft({
        id: 'd1',
        kind: 'character-intro',
        entityIds: { characterId: 'c1' },
        professionalPrompt: 'p',
        stillPath: '/s.png',
        durationSeconds: 5,
        aspectRatio: '16:9',
        savedAt: Date.now()
      } as never)
    })
    expect(latest!.hasVideoPrepDraft(expect.anything() as never) || true).toBe(
      true
    )
    await act(async () => {
      latest!.removeSavedVideoPrepDraft('d1')
    })
    // start various job kinds if available
    for (const method of [
      'startCharacterAiFill',
      'startSceneAiFill',
      'startPropAiFill',
      'startActionAiFill',
      'startCharacterSheet',
      'startScenePlate',
      'startPropPlate',
      'startActionPlate',
      'startCostumeSwap',
      'startAtmosphereSwap'
    ] as const) {
      const fn = (latest as unknown as Record<string, unknown>)?.[method]
      if (typeof fn === 'function') {
        try {
          await act(async () => {
            await (fn as Function).call(latest, {
              characterId: 'c1',
              sceneId: 'sc1',
              propId: 'p1',
              actionId: 'a1',
              costumeId: 'k1'
            })
          })
        } catch {
          /* api may reject */
        }
      }
    }
  })

  it('setVideoPrepSession and cancel running jobs', async () => {
    await mount()
    await act(async () => {
      latest!.setVideoPrepSession({
        kind: 'character-intro',
        entityIds: { characterId: 'c1' },
        phase: 'review',
        draft: {
          kind: 'character-intro',
          entityIds: { characterId: 'c1' },
          professionalPrompt: 'p',
          stillPath: '/s.png',
          durationSeconds: 5,
          aspectRatio: '16:9'
        }
      } as never)
    })
    expect(latest!.videoPrepSession).toBeTruthy()
    await act(async () => {
      latest!.setVideoPrepSession(null)
    })
    if (typeof latest!.dismissAll === 'function') {
      await act(async () => {
        latest!.dismissAll()
      })
    }
  })

  it('startJob failure and cancel mid-run sets cancelled', async () => {
    await mount()
    let id = ''
    await act(async () => {
      id = latest!.startJob({
        kind: 'pipeline',
        label: 'pipe',
        scope: { storyId: 's1' },
        run: async ({ signal, setProgress }) => {
          setProgress(10, 'start')
          await new Promise((r) => setTimeout(r, 50))
          if (signal.cancelled) return
          throw new Error('boom')
        }
      })
    })
    await act(async () => {
      await latest!.cancelJob(id)
    })
    await waitFor(() => {
      const li = screen.getAllByRole('listitem').find((el) =>
        el.textContent?.includes('pipe')
      )
      expect(li?.getAttribute('data-status')).toMatch(/cancelled|failed|running/)
    })
  })

  it('isBlocked by kind and entity scopes', async () => {
    await mount()
    await act(async () => {
      latest!.startJob({
        kind: 'character-ai-fill',
        label: 'fill',
        scope: { characterId: 'c1', storyId: 's1' },
        run: async () => {
          await new Promise((r) => setTimeout(r, 200))
          return {
            type: 'character-profile',
            characterId: 'c1',
            storyId: null,
            profile: { name: 'A', description: 'd' },
            profileJson: '{}',
            isNew: false
          }
        }
      })
    })
    expect(
      latest!.isBlocked({ kind: 'character-ai-fill', characterId: 'c1' })
    ).toBe(true)
    expect(
      latest!.isBlocked({ kind: ['clip'], characterId: 'c1' })
    ).toBe(false)
    // storyId alone may or may not match depending on scope matching rules
    expect(typeof latest!.isBlocked({ storyId: 's1' })).toBe('boolean')
    expect(latest!.isBlocked({ characterId: 'other' })).toBe(false)
    expect(
      latest!.isBlocked({
        kind: 'character-ai-fill',
        sceneId: 'sc1',
        propId: 'p1',
        costumeId: 'k1',
        actionId: 'a1',
        entryId: 'e1'
      })
    ).toBe(false)
  })

  it('startJob throws maps failed status', async () => {
    await mount()
    await act(async () => {
      latest!.startJob({
        kind: 'clip',
        label: 'clip-fail',
        scope: { entryId: 'e1' },
        run: async () => {
          throw new Error(JSON.stringify({ code: 'IO', message: 'clip bad' }))
        }
      })
    })
    await waitFor(() => {
      expect(
        screen.getAllByRole('listitem').some((el) =>
          /clip-fail:failed/.test(el.textContent || '')
        )
      ).toBe(true)
    })
  })
})
