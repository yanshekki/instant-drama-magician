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

## Recent focus areas (1.3.0)

| Area | Tests (examples) |
|------|------------------|
| Timeline continuity | `writeClipContinuityStill.test.ts`, `promptContinuity` (`resolveTimelineStillRefs`), `AdvancedPrepService` end-frame heal |
| MediaGen timeline | `mediaGen.test.ts` (extract / generate continuity path), `timelineMediaGen.test.ts` |
| MediaGen UI host | `MediaGenHost.test.tsx` (`idm:timeline-still-done`) |
| Advanced studio | `TimelineAdvancedStudio.test.tsx` (refine → `startMediaGen`) |
| Costume dual-write | `costumes.test.ts` (`appendTryOnStill`), `AiJobsContext.test.tsx` |
| Shared gallery | `EntityGalleryPanel.test.tsx` |

```bash
npx vitest run src/runtime/handlers/mediaGen.test.ts \
  src/presentation/components/MediaGenHost.test.tsx \
  src/domain/timelineMediaGen.test.ts \
  src/application/video/writeClipContinuityStill.test.ts
```

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

## Coverage (Full lines → 100% campaign)

**Product goal:** overall **lines ≈ 100%** (hard KPI). Pure type modules
(`electron-api.ts`, `*.d.ts`, prisma client, locales) are excluded from the
denominator because they contain no runtime statements.

| Command | Scope |
|---------|--------|
| `npm run test:coverage` | Full (src + electron + server, minus type-only) |
| `npm run test:coverage:core` | domain / application / infrastructure / runtime / cli / lib |

**Strategy:**

1. Domain + services + handlers: real unit tests → **≥95–100%** of those trees  
2. Giant pages: extract pure helpers; RTL tests for every user-visible branch  
3. Electron: mock `electron` APIs; cover pure helpers 100%  
4. Raise `vitest.config.ts` thresholds every PR until **100 / 100 / 100**

Progress is tracked in CI coverage artifacts (`coverage/index.html`).

## CI

`npm run ci` runs: `test:align` → `locales:verify` → `typecheck` → `test:ci`.
