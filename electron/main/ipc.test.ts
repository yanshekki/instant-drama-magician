import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('electron ipc bridge', () => {
  it('wires createRuntime channels to ipcMain', () => {
    const src = readFileSync(join(__dirname, 'ipc.ts'), 'utf8')
    expect(src).toMatch(/createRuntime|registerIpcHandlers|ipcMain\.handle/)
  })
})
