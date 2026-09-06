import { describe, expect, it, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { TimelineEntry } from '../../../types/domain'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } })
}))

import { TimelineDirectorInspector } from './TimelineDirectorInspector'

const entry: TimelineEntry = {
  id: 'e1',
  storyId: 's1',
  startTime: 0,
  endTime: 6,
  characterId: null,
  sceneId: null,
  propId: null,
  actionId: null,
  characterIds: [],
  sceneIds: [],
  propIds: [],
  actionIds: [],
  dialogue: 'hi',
  beatContentJson: null,
  order: 0,
  mediaPath: '/clip.mp4',
  mediaStatus: 'READY',
  mediaError: null,
  videoJobId: null
}

describe('TimelineDirectorInspector', () => {
  afterEach(() => cleanup())

  it('shows an empty hint without a clip', () => {
    render(
      <TimelineDirectorInspector
        entry={null}
        compiledText=""
        compiledLocked={false}
        compiledDraft=""
        onCompiledDraftChange={() => undefined}
        onLockCompiled={() => undefined}
        onRevertCompiled={() => undefined}
        onDuration={() => undefined}
      />
    )
    expect(screen.getByText('timeline.desk.noClip')).toBeTruthy()
  })

  it('renders clip actions when handlers are provided', () => {
    const onDuration = vi.fn()
    const onGenerate = vi.fn()
    const onImport = vi.fn()
    const onOpen = vi.fn()
    const onExport = vi.fn()
    const onDelete = vi.fn()
    render(
      <TimelineDirectorInspector
        entry={entry}
        compiledText="compiled"
        compiledLocked={false}
        compiledDraft=""
        onCompiledDraftChange={() => undefined}
        onLockCompiled={() => undefined}
        onRevertCompiled={() => undefined}
        onDuration={onDuration}
        onGenerate={onGenerate}
        onImport={onImport}
        onOpen={onOpen}
        onExport={onExport}
        onDelete={onDelete}
        generateLabel="Go"
      />
    )
    fireEvent.click(screen.getByText('10s'))
    expect(onDuration).toHaveBeenCalledWith(10)
    fireEvent.click(screen.getByText('Go'))
    expect(onGenerate).toHaveBeenCalled()
    fireEvent.click(screen.getByText('timeline.importClip'))
    expect(onImport).toHaveBeenCalled()
    fireEvent.click(screen.getByText('timeline.openClip'))
    expect(onOpen).toHaveBeenCalled()
    fireEvent.click(screen.getByText('timeline.exportClip'))
    expect(onExport).toHaveBeenCalled()
    fireEvent.click(screen.getByText('common.delete'))
    expect(onDelete).toHaveBeenCalled()
  })

  it('renders extra inspector content', () => {
    render(
      <TimelineDirectorInspector
        entry={entry}
        compiledText=""
        compiledLocked={false}
        compiledDraft=""
        onCompiledDraftChange={() => undefined}
        onLockCompiled={() => undefined}
        onRevertCompiled={() => undefined}
        onDuration={() => undefined}
        extra={<div data-testid="inspector-extra">spatial</div>}
      />
    )
    expect(screen.getByTestId('inspector-extra').textContent).toBe('spatial')
  })

  it('omits optional clip buttons when handlers are absent', () => {
    render(
      <TimelineDirectorInspector
        entry={{ ...entry, mediaPath: null }}
        compiledText=""
        compiledLocked={false}
        compiledDraft=""
        onCompiledDraftChange={() => undefined}
        onLockCompiled={() => undefined}
        onRevertCompiled={() => undefined}
        onDuration={() => undefined}
      />
    )
    expect(screen.queryByText('timeline.importClip')).toBeNull()
    expect(screen.queryByText('timeline.openClip')).toBeNull()
    expect(screen.queryByText('common.delete')).toBeNull()
  })
})
