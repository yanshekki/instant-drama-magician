import { describe, expect, it } from 'vitest'
import { defaultExportFinalOptions } from './exportOptions'

describe('defaultExportFinalOptions', () => {
  it('returns balanced defaults', () => {
    const o = defaultExportFinalOptions()
    expect(o.exportProfile).toBe('balanced')
    expect(o.burnSubtitles).toBe(true)
    expect(o.bgmVolume).toBe(0.25)
    expect(o.dialogueVolume).toBe(1)
  })

  it('clamps volumes and accepts fast profile', () => {
    const o = defaultExportFinalOptions({
      exportProfile: 'fast',
      bgmVolume: 2,
      dialogueVolume: -1
    })
    expect(o.exportProfile).toBe('fast')
    expect(o.bgmVolume).toBe(1)
    expect(o.dialogueVolume).toBe(0)
  })

  it('treats non-fast profile as balanced', () => {
    const o = defaultExportFinalOptions({
      exportProfile: 'nope' as 'balanced'
    })
    expect(o.exportProfile).toBe('balanced')
  })
})
