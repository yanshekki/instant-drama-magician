import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// Avoid loading jest-dom globally — it pulls ESM-only CSS packages that break
// under Vitest CJS + jsdom on some Node 20 setups. Use explicit asserts instead.

afterEach(() => {
  // Unmount React trees between tests (prevents "Should not already be working")
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})
