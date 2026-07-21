/**
 * Coverage campaign: import page modules (hits module-level code).
 * Full render of giant pages needs full app providers — covered incrementally.
 */
import { describe, expect, it } from 'vitest'

describe('pages module load (coverage campaign)', () => {
  it('loads StoriesPage module', async () => {
    const m = await import('./StoriesPage')
    expect(m.StoriesPage || m.default).toBeTypeOf('function')
  })

  it('loads CharactersPage module', async () => {
    const m = await import('./CharactersPage')
    expect(m.CharactersPage || m.default).toBeTypeOf('function')
  })

  it('loads ScenesPage module', async () => {
    const m = await import('./ScenesPage')
    expect(m.ScenesPage || m.default).toBeTypeOf('function')
  })

  it('loads PropsPage module', async () => {
    const m = await import('./PropsPage')
    expect(m.PropsPage || m.default).toBeTypeOf('function')
  })

  it('loads ActionsPage module', async () => {
    const m = await import('./ActionsPage')
    expect(m.ActionsPage || m.default).toBeTypeOf('function')
  })

  it('loads CostumesPage module', async () => {
    const m = await import('./CostumesPage')
    expect(m.CostumesPage || m.default).toBeTypeOf('function')
  })

  it('loads SettingsPage module', async () => {
    const m = await import('./SettingsPage')
    expect(m.SettingsPage || m.default).toBeTypeOf('function')
  })

  it('loads AuditLogPage module', async () => {
    const m = await import('./AuditLogPage')
    expect(m.AuditLogPage || m.default).toBeTypeOf('function')
  })
})
