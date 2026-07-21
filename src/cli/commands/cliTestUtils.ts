import { vi } from 'vitest'

export function mockExit(): ReturnType<typeof vi.spyOn> {
  return vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
    throw new Error(`process.exit:${code ?? 0}`)
  }) as never)
}

export function mockClient(overrides?: {
  invoke?: ReturnType<typeof vi.fn>
  channels?: ReturnType<typeof vi.fn>
  mode?: 'local' | 'remote'
}) {
  const dispose = vi.fn()
  return {
    mode: overrides?.mode ?? ('local' as const),
    invoke: overrides?.invoke ?? vi.fn().mockResolvedValue({ ok: true }),
    channels:
      overrides?.channels ??
      vi.fn().mockResolvedValue(['stories:list', 'stories:delete']),
    describe: () => ({ mode: 'local', dataDir: '/tmp' }),
    dispose
  }
}
