import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import { ImageGenConfirmModal } from './ImageGenConfirmModal'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string) => k,
    i18n: { language: 'en' }
  })
}))

vi.mock('../../lib/api', () => ({
  getApi: () => ({
    media: {
      toPreviewUrl: vi.fn().mockResolvedValue({ url: 'blob:x' })
    }
  })
}))

describe('ImageGenConfirmModal', () => {
  afterEach(() => {
    cleanup()
    // Portal roots may leave dialogs on body
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
    // Portal mounts on document.body
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
    expect(ta).toBeTruthy()
    fireEvent.change(ta, { target: { value: 'edited prompt' } })
    fireEvent.click(screen.getByText('common.imageGenConfirmGo'))
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: 'edited prompt' })
    )
  })
})
