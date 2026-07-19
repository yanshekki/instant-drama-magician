# Testing guide

> **Language:** [English](./testing.md) · [中文](./testing-ZH.md)

## Commands

```bash
npm test                 # all unit + contract tests
npm run test:integration # *.integration.test.ts
npm run test:coverage    # coverage report → coverage/
npm run test:ci          # CI entry (coverage)
```

## Layout

| Area | Location |
|------|----------|
| Helpers | `src/test/` (mockPrisma, tempRuntime, renderWithProviders) |
| Domain | `src/domain/*.test.ts` |
| Services | `src/application/services/*.test.ts` |
| CLI | `src/cli/**/*.test.ts` |
| Runtime / contracts | `src/runtime/*`, `src/contract/*` |
| Presentation | `src/presentation/**/*.test.tsx` (happy-dom) |
| Electron | `electron/*.contract.test.ts` |

## Standards

- No live network AI calls  
- Temp dirs for filesystem / SQLite integration  
- Mock Prisma for service unit tests  
- Progressive coverage thresholds in `vitest.config.ts`  

## Coverage status

| Metric | Status |
|--------|--------|
| Module companion tests | **100%** of production modules (+ electron/server entries) |
| Line coverage (overall) | Progressive (~22% overall; UI/handlers smoke-tested) |
| Channel register count | **137/137** contract + safe invoke matrix |

## Channel parity

`src/contract/channels.contract.test.ts` + `channelParity.test.ts` ensure **137** IPC channels stay registered in headless runtime.  
`channelInvoke.matrix.test.ts` exercises safe no-arg channels without `NOT_FOUND`.

## Related

- Locale parity: `npm run locales:verify`  
- [architecture.md](./architecture.md) · [cli.md](./cli.md)
