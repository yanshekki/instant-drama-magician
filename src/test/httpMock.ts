import { vi } from 'vitest'

export function mockFetchSequence(
  responses: Array<{
    status?: number
    json?: unknown
    text?: string
    ok?: boolean
  }>
) {
  let i = 0
  const fn = vi.fn(async () => {
    const r = responses[Math.min(i, responses.length - 1)]
    i++
    const status = r.status ?? 200
    const bodyText =
      r.text ?? (r.json !== undefined ? JSON.stringify(r.json) : '')
    return {
      ok: r.ok ?? (status >= 200 && status < 300),
      status,
      text: async () => bodyText,
      json: async () =>
        r.json !== undefined ? r.json : bodyText ? JSON.parse(bodyText) : null
    }
  })
  vi.stubGlobal('fetch', fn)
  return fn
}
