import { describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/api', () => ({
  getApi: () => ({
    stories: { list: vi.fn().mockResolvedValue([]) },
    characters: { list: vi.fn().mockResolvedValue([]) },
    scenes: { list: vi.fn().mockResolvedValue([]) },
    props: { list: vi.fn().mockResolvedValue([]) },
    costumes: { list: vi.fn().mockResolvedValue([]) },
    timeline: { list: vi.fn().mockResolvedValue([]) },
    settings: { get: vi.fn().mockResolvedValue({ uiLanguage: 'en', legalAcceptedVersion: '1.0.0' }), set: vi.fn() },
    activity: { recent: vi.fn().mockResolvedValue([]), query: vi.fn().mockResolvedValue([]) },
    ai: { status: vi.fn().mockResolvedValue({ available: true }), listModels: vi.fn().mockResolvedValue([]) },
    app: { getInfo: vi.fn().mockResolvedValue({ version: '1.0.0' }), onMenuAction: () => () => {} },
    media: { checkFfmpeg: vi.fn().mockResolvedValue({ available: true }) },
    diagnostics: { full: vi.fn().mockResolvedValue({}) },
    webServer: { status: vi.fn().mockResolvedValue({ running: false }), generateToken: vi.fn().mockResolvedValue('t') },
    updates: { status: vi.fn().mockResolvedValue({ status: 'idle' }), onState: () => () => {} },
    generation: { onProgress: () => () => {} }
  }),
  isElectron: () => true,
  isWebRuntime: () => false
}))

import * as Page from './AuditLogPage'

describe('AuditLogPage', () => {
  it('exports a component', () => {
    const Comp = (Page as Record<string, unknown>).AuditLogPage || Object.values(Page)[0]
    expect(typeof Comp).toBe('function')
  })
})
