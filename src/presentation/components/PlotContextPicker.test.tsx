import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { useState } from 'react'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react'
import { createMockApi } from '../../test/mockApi'

const api = createMockApi()
vi.mock('../../lib/api', () => ({ getApi: () => api }))

/** Stable t so useEffect([..., t]) does not infinite-loop. */
const i18nMock = vi.hoisted(() => {
  const t = (k: string, o?: Record<string, unknown>) =>
    o ? `${k}:${JSON.stringify(o)}` : k
  return {
    t,
    i18n: { language: 'en' }
  }
})
vi.mock('react-i18next', () => ({
  useTranslation: () => i18nMock
}))

import {
  applyPlotGroupSelection,
  filterPlotKeysToKnown,
  plotBeatCharacterLabel,
  plotBeatHasBind,
  plotBeatHasBindId,
  plotPickerKeysFromProps,
  PlotContextPicker,
  reconcilePlotPickerKeys,
  togglePlotSegmentKey
} from './PlotContextPicker'

describe('plot picker key helpers', () => {
  it('normalizes legacy segmentKey and toggles groups', () => {
    expect(plotPickerKeysFromProps(undefined, 'all')).toEqual([])
    expect(plotPickerKeysFromProps(undefined, 'scene:a')).toEqual(['scene:a'])
    expect(plotPickerKeysFromProps(['chapter:a'], 'all')).toEqual(['chapter:a'])
    expect(togglePlotSegmentKey(['a'], 'b')).toEqual(['a', 'b'])
    expect(togglePlotSegmentKey(['a', 'b'], 'a')).toEqual(['b'])
    expect(applyPlotGroupSelection(['x'], ['a', 'b'], true)).toEqual([
      'x',
      'a',
      'b'
    ])
    expect(applyPlotGroupSelection(['x', 'a'], ['a', 'b'], false)).toEqual([
      'x'
    ])
    expect(filterPlotKeysToKnown(['a', 'gone'], ['a', 'b'])).toEqual(['a'])
  })

  it('defaults empty selection to story-selected beats only', () => {
    const known = ['chapter:ch1', 'beat:t1', 'beat:t3']
    expect(reconcilePlotPickerKeys([], known, ['beat:t1'])).toEqual(['beat:t1'])
    expect(reconcilePlotPickerKeys([], known)).toEqual([])
    expect(reconcilePlotPickerKeys(['chapter:ch1'], known, ['beat:t1'])).toEqual(
      ['chapter:ch1']
    )
    expect(reconcilePlotPickerKeys(['scene:gone'], known, ['beat:t1'])).toEqual([
      'beat:t1'
    ])
  })

  it('only treats the matching bind as selected in the story', () => {
    const withChar = { characterIds: '["c1"]', characterId: 'c1' }
    const withScene = { sceneIds: '["sc1"]', sceneId: 'sc1' }
    expect(plotBeatHasBind(withChar, 'character')).toBe(true)
    expect(plotBeatHasBind(withChar, 'scene')).toBe(false)
    expect(plotBeatHasBind(withScene, 'scene')).toBe(true)
    expect(plotBeatHasBindId(withScene, 'scene', 'sc1')).toBe(true)
    expect(plotBeatHasBindId(withScene, 'scene', 'sc-other')).toBe(false)
    expect(plotBeatHasBindId(withScene, 'scene', '')).toBe(false)
    expect(plotBeatHasBind(withScene, 'character')).toBe(false)
    expect(plotBeatHasBind({ propIds: ['p1'] }, 'prop')).toBe(true)
    expect(plotBeatHasBind({ actionId: 'a1' }, 'action')).toBe(true)
    expect(
      plotBeatHasBind(
        {
          characterId: null,
          sceneId: null,
          propId: null,
          actionId: null
        },
        'scene'
      )
    ).toBe(false)
  })

  it('labels beats from characterIds against the story cast', () => {
    expect(
      plotBeatCharacterLabel(
        { characterIds: '["c1"]', characterId: null, character: null },
        [{ id: 'c1', name: '沈執一' }],
        'unknown'
      )
    ).toBe('沈執一')
    expect(
      plotBeatCharacterLabel(
        { characterIds: ['c1', 'c2'], character: { name: 'Ignored' } },
        [
          { id: 'c1', name: 'A' },
          { id: 'c2', name: 'B' }
        ],
        'unknown'
      )
    ).toBe('A、B')
    expect(
      plotBeatCharacterLabel(
        { characterId: null, characterIds: null, character: null },
        [{ id: 'c1', name: 'A' }],
        'unknown'
      )
    ).toBe('unknown')
  })
})

describe('PlotContextPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.stories.get = vi.fn().mockResolvedValue({
      id: 's1',
      title: 'Story',
      styleNote: 'noir',
      chapters: [
        { id: 'ch1', order: 0, title: 'Night', body: 'Rain on the roof' }
      ],
      scenes: [
        { id: 'sc1', sceneNumber: 1, title: 'Rain', description: 'desc' }
      ],
      characters: [{ id: 'c1', name: '沈執一' }],
      timeline: [
        {
          id: 't1',
          order: 0,
          dialogue: 'Hello there friend',
          characterIds: '["c1"]',
          characterId: 'c1'
        },
        {
          id: 't2',
          order: 1,
          dialogue: '  ',
          character: null
        },
        {
          id: 't3',
          order: 2,
          dialogue: 'Who?',
          sceneIds: '["sc1"]',
          sceneId: 'sc1'
        }
      ]
    })
  })

  afterEach(() => cleanup())

  it('lists chapters and checks two keys', async () => {
    const seen: string[][] = []
    function Harness(): JSX.Element {
      const [keys, setKeys] = useState<string[]>([])
      return (
        <PlotContextPicker
          stories={
            [
              { id: 's1', title: 'S1' },
              { id: 's2', title: 'S2' }
            ] as never
          }
          storyId="s1"
          segmentKeys={keys}
          defaultBeatBind="scene"
          focusBindId="sc1"
          onStoryChange={() => undefined}
          onSegmentKeysChange={(next) => {
            seen.push(next)
            setKeys(next)
          }}
        />
      )
    }
    render(<Harness />)
    await waitFor(() => expect(api.stories.get).toHaveBeenCalledWith('s1'))
    await waitFor(() =>
      expect(screen.getByLabelText(/plot.segmentChapter/)).toBeTruthy()
    )
    await waitFor(() =>
      expect(
        (
          screen.getByLabelText(/plot.segmentBeat.*Who/) as HTMLInputElement
        ).checked
      ).toBe(true)
    )
    fireEvent.click(screen.getByLabelText(/plot.segmentChapter/))
    expect(seen.some((k) => k.join() === 'beat:t3,chapter:ch1')).toBe(true)
    expect(screen.getByLabelText(/沈執一/)).toBeTruthy()
    expect(screen.queryByText('plot.groupScenes')).toBeNull()
  })

  it('select all / none for a group', async () => {
    const onKeys = vi.fn()
    render(
      <PlotContextPicker
        stories={[{ id: 's1', title: 'S' } as never]}
        storyId="s1"
        segmentKeys={[]}
        onStoryChange={() => undefined}
        onSegmentKeysChange={onKeys}
      />
    )
    await waitFor(() => expect(api.stories.get).toHaveBeenCalled())
    const allBtns = await screen.findAllByText('mediaGen.selectAll')
    fireEvent.click(allBtns[0])
    expect(onKeys).toHaveBeenCalledWith(['chapter:ch1'])
    const noneBtns = screen.getAllByText('mediaGen.selectNone')
    fireEvent.click(noneBtns[0])
    expect(onKeys).toHaveBeenCalledWith([])
  })

  it('auto-checks only beats that already have a scene pick', async () => {
    function Harness(): JSX.Element {
      const [keys, setKeys] = useState<string[]>([])
      return (
        <PlotContextPicker
          stories={[{ id: 's1', title: 'S' } as never]}
          storyId="s1"
          segmentKeys={keys}
          defaultBeatBind="scene"
          focusBindId="sc1"
          onStoryChange={() => undefined}
          onSegmentKeysChange={setKeys}
        />
      )
    }
    render(<Harness />)
    await waitFor(() =>
      expect(
        (screen.getByLabelText(/plot.segmentBeat.*Who/) as HTMLInputElement)
          .checked
      ).toBe(true)
    )
    expect(
      (screen.getByLabelText(/plot.segmentChapter/) as HTMLInputElement)
        .checked
    ).toBe(false)
    expect(
      (
        screen.getByLabelText(
          /plot.segmentBeat.*Hello there friend/
        ) as HTMLInputElement
      ).checked
    ).toBe(false)
    expect(screen.queryByLabelText(/plot.segmentScene/)).toBeNull()
  })

  it('does not check beats bound to a different scene', async () => {
    function Harness(): JSX.Element {
      const [keys, setKeys] = useState<string[]>([])
      return (
        <PlotContextPicker
          stories={[{ id: 's1', title: 'S' } as never]}
          storyId="s1"
          segmentKeys={keys}
          defaultBeatBind="scene"
          focusBindId="sc-other"
          onStoryChange={() => undefined}
          onSegmentKeysChange={setKeys}
        />
      )
    }
    render(<Harness />)
    await waitFor(() =>
      expect(screen.getByLabelText(/plot.segmentBeat.*Who/)).toBeTruthy()
    )
    expect(
      (screen.getByLabelText(/plot.segmentBeat.*Who/) as HTMLInputElement)
        .checked
    ).toBe(false)
    expect(
      (
        screen.getByLabelText(
          /plot.segmentBeat.*Hello there friend/
        ) as HTMLInputElement
      ).checked
    ).toBe(false)
  })

  it('keeps an existing valid chapter selection instead of checking beats', async () => {
    const onKeys = vi.fn()
    render(
      <PlotContextPicker
        stories={[{ id: 's1', title: 'S' } as never]}
        storyId="s1"
        segmentKeys={['chapter:ch1']}
        onStoryChange={() => undefined}
        onSegmentKeysChange={onKeys}
      />
    )
    await waitFor(() => expect(api.stories.get).toHaveBeenCalled())
    await waitFor(() =>
      expect(
        (screen.getByLabelText(/plot.segmentChapter/) as HTMLInputElement)
          .checked
      ).toBe(true)
    )
    expect(
      (
        screen.getByLabelText(
          /plot.segmentBeat.*Hello there friend/
        ) as HTMLInputElement
      ).checked
    ).toBe(false)
    expect(onKeys).not.toHaveBeenCalled()
  })

  it('empty storyId uses story select only', async () => {
    render(
      <PlotContextPicker
        stories={[]}
        storyId=""
        segmentKeys={[]}
        onStoryChange={() => undefined}
        onSegmentKeysChange={() => undefined}
      />
    )
    await waitFor(() =>
      expect(screen.getAllByRole('combobox').length).toBe(1)
    )
  })

  it('drops missing keys without filling beats', async () => {
    const onKeys = vi.fn()
    render(
      <PlotContextPicker
        stories={[{ id: 's1', title: 'S' } as never]}
        storyId="s1"
        segmentKeys={['scene:gone']}
        defaultBeatBind="scene"
        focusBindId="sc1"
        onStoryChange={() => undefined}
        onSegmentKeysChange={onKeys}
      />
    )
    await waitFor(() => expect(onKeys).toHaveBeenCalledWith(['beat:t3']))
  })

  it('handles get failure', async () => {
    api.stories.get = vi.fn().mockRejectedValue(new Error('x'))
    render(
      <PlotContextPicker
        stories={[{ id: 's1', title: 'S' } as never]}
        storyId="s1"
        segmentKeys={[]}
        onStoryChange={() => undefined}
        onSegmentKeysChange={() => undefined}
      />
    )
    await waitFor(() => expect(api.stories.get).toHaveBeenCalled())
  })

  it('expands chapter preview and changes story', async () => {
    const onStory = vi.fn()
    render(
      <PlotContextPicker
        stories={[{ id: 's1', title: 'S1' }, { id: 's2', title: 'S2' }] as never}
        storyId="s1"
        segmentKeys={['chapter:ch1']}
        onStoryChange={onStory}
        onSegmentKeysChange={() => undefined}
      />
    )
    await waitFor(() => expect(api.stories.get).toHaveBeenCalled())
    const show = await screen.findAllByText('mediaGen.showTech')
    fireEvent.click(show[0])
    expect(document.body.textContent || '').toMatch(/Rain on the roof/i)
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 's2' }
    })
    expect(onStory).toHaveBeenCalledWith('s2')
  })
})
