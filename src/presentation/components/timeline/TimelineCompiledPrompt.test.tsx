import { describe, expect, it, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } })
}))

import { TimelineCompiledPrompt } from './TimelineCompiledPrompt'

describe('TimelineCompiledPrompt', () => {
  afterEach(() => cleanup())

  it('locks to a hand-written draft and reverts', () => {
    const onDraft = vi.fn()
    const onRevert = vi.fn()
    render(
      <TimelineCompiledPrompt
        text="live compile"
        locked
        draft="hand text"
        onDraftChange={onDraft}
        onLock={() => undefined}
        onRevert={onRevert}
      />
    )
    expect(screen.getByText('timeline.desk.handWritten')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('timeline.desk.handWritten'), {
      target: { value: 'edited' }
    })
    expect(onDraft).toHaveBeenCalledWith('edited')
    fireEvent.click(screen.getByText('timeline.desk.revertPrompt'))
    expect(onRevert).toHaveBeenCalled()
  })
})
