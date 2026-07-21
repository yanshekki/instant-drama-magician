# Testing guide

## Layers

| Layer | What | How |
|-------|------|-----|
| **Contract** | Channels, i18n keys, import paths | `src/contract/*`, `channelInvoke.matrix` |
| **Domain** | Pure logic | Sibling `foo.test.ts` |
| **Application** | Services / pipeline | Sibling tests + mocks |
| **Handlers** | IPC register* modules | `handlerTestUtils` + mock services |
| **CLI** | Commands | Mock `runProcess` / fs |
| **UI pages** | Large React pages | Smoke only; logic in hooks/domain |

## Alignment gate

```bash
npm run test:align
# or
node scripts/check-test-alignment.mjs
```

Every scannable module under `domain`, `application`, `runtime/handlers`, `cli`,
`infrastructure`, `lib`, `presentation/hooks|lib` must have a sibling
`*.test.ts(x)` **or** sit on the allowlist in `scripts/check-test-alignment.mjs`.

## Handler unit pattern

```ts
import { describe, expect, it, vi } from 'vitest'
import { makeHandlerContext, invokeRegistered } from '../../test/handlerTestUtils'
import { registerCharactersCrud } from './crud'

describe('characters crud handlers', () => {
  it('lists globally', async () => {
    const list = vi.fn(async () => [{ id: '1', name: 'A' }])
    const ctx = makeHandlerContext({
      characters: () => ({ list, listForStory: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() }) as never
    })
    registerCharactersCrud(ctx)
    const handlers = (ctx as { handlers: Map<string, unknown> }).handlers
    const rows = await invokeRegistered(handlers, 'characters:list')
    expect(list).toHaveBeenCalled()
    expect(rows).toEqual([{ id: '1', name: 'A' }])
  })
})
```

## Coverage

`vitest.config.ts` thresholds rise as suites grow. Giant `*Page.tsx` files are
not required to hit high line %; keep smoke tests and push logic into tested modules.

## CI

`npm run ci` runs: `test:align` → `locales:verify` → `typecheck` → `test:ci`.
