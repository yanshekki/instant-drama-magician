import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  render,
  screen,
  fireEvent,
  waitFor
} from '@testing-library/react'
import { createMockApi } from '../../test/mockApi'

const api = createMockApi()

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string) => k,
    i18n: { language: 'en' }
  })
}))

vi.mock('../../lib/api', () => ({
  getApi: () => api
}))

import { ImageGenConfirmModal } from './ImageGenConfirmModal'

describe('ImageGenConfirmModal', () => {
  afterEach(() => {
    cleanup()
    document.body.innerHTML = ''
  })

  it('returns null when closed', () => {
    const { container } = render(
      <ImageGenConfirmModal
        open={false}
        payload={null}
        onCancel={() => undefined}
        onConfirm={() => undefined}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('shows prompt textarea without separate hardRules callout', () => {
    render(
      <ImageGenConfirmModal
        open
        payload={{
          prompt:
            'draw a cup\n\nHARD RULES (highest priority — must obey; override any conflicting earlier details):\nno wires\nIf any earlier instruction conflicts with HARD RULES, follow HARD RULES.',
          referencePaths: [],
          useIdentityEdit: false,
          summary: 'test summary'
        }}
        onCancel={() => undefined}
        onConfirm={() => undefined}
      />
    )
    expect(screen.getByText('common.imageGenConfirmTitle')).toBeTruthy()
    expect(screen.getByText('common.imageGenConfirmPrompt')).toBeTruthy()
    expect(screen.queryByText('common.hardRules')).toBeNull()
    const ta = document.body.querySelector('textarea') as HTMLTextAreaElement
    expect(ta).toBeTruthy()
    expect(ta.value).toContain('HARD RULES')
    expect(ta.value).toContain('no wires')
  })

  it('confirm passes edited prompt', () => {
    const onConfirm = vi.fn()
    render(
      <ImageGenConfirmModal
        open
        payload={{
          prompt: 'original',
          referencePaths: [],
          useIdentityEdit: false
        }}
        onCancel={() => undefined}
        onConfirm={onConfirm}
      />
    )
    const ta = document.body.querySelector(
      'textarea'
    ) as HTMLTextAreaElement
    fireEvent.change(ta, { target: { value: 'edited prompt' } })
    fireEvent.click(screen.getByText('common.imageGenConfirmGo'))
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: 'edited prompt' })
    )
  })

  it('cancel and busy state; reference thumbs load/fail', async () => {
    api.media.toPreviewUrl = vi
      .fn()
      .mockResolvedValueOnce({ url: 'blob:1' })
      .mockRejectedValueOnce(new Error('fail'))
    const onCancel = vi.fn()
    const { rerender } = render(
      <ImageGenConfirmModal
        open
        busy
        payload={{
          prompt: 'p',
          referencePaths: ['/ok.png', '/bad.png', '  '],
          useIdentityEdit: true,
          summary: 'sum'
        }}
        onCancel={onCancel}
        onConfirm={() => undefined}
      />
    )
    await waitFor(() => expect(api.media.toPreviewUrl).toHaveBeenCalled())
    // busy disables cancel
    expect(
      (screen.getByText('common.cancel').closest('button') as HTMLButtonElement)
        .disabled
    ).toBe(true)
    // img onError when loaded
    await waitFor(() => {
      expect(document.body.querySelectorAll('img').length).toBeGreaterThan(0)
    })
    document.body
      .querySelectorAll('img')
      .forEach((img) => fireEvent.error(img))
    // cancel works when not busy
    rerender(
      <ImageGenConfirmModal
        open
        payload={{
          prompt: 'p',
          referencePaths: ['/ok.png'],
          useIdentityEdit: false
        }}
        onCancel={onCancel}
        onConfirm={() => undefined}
      />
    )
    fireEvent.click(screen.getByText('common.cancel'))
    expect(onCancel).toHaveBeenCalled()
  })
  it('zero residual Escape backdrop not busy', () => {
    const onCancel = vi.fn()
    render(
      <ImageGenConfirmModal
        open
        busy={false}
        payload={{
          prompt: 'p',
          referencePaths: [],
          useIdentityEdit: false
        }}
        onCancel={onCancel}
        onConfirm={vi.fn()}
      />
    )
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    const backdrop = document.querySelector('[role="presentation"]')
    if (backdrop) fireEvent.click(backdrop)
    expect(onCancel).toHaveBeenCalled()
  })

})
