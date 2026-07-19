import { afterEach, vi } from 'vitest'

// Avoid loading jest-dom globally — it pulls ESM-only CSS packages that break
// under Vitest CJS + jsdom on some Node 20 setups. Use explicit asserts instead.

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})
