# Media generation path deprecations

**Production UI** uses a single shell:

1. `mediaGen:extract` → materials  
2. `mediaGen:polish` → prompt (image, then video stage)  
3. `mediaGen:generateImage` → still / keyframe  
4. `videoPrep:confirm` → final video (when kind is video)

## Unmounted UI

| Component | Status |
|-----------|--------|
| `MediaGenHost` | **Mounted** in `Layout` |
| `VideoPrepHost` / `VideoPrepModal` | **Not mounted** — unit tests only |

`startVideoPrep` and draft **Continue** open MediaGen (same draft storage keys).

## Deprecated IPC (still registered for CLI / tests)

Prefer mediaGen for new code. These channels remain until a future major:

- `characters:generateSheet`
- `characters:generateIntroVideo`
- `characters:swapCostume`
- `scenes:generatePlate` / `generateIntroVideo` / `swapAtmosphere`
- `props:generatePlate` / `generateIntroVideo`
- `actions:generatePlate` / `generateIntroVideo`
- `costumes:generateIntroVideo`

## Still first-class

- `characters:commitSheet`, `scenes:commitPlate`, `props:commitPlate`, …
- `videoPrep:create` with `stillOnly` (Advanced Studio batch stills)
- `videoPrep:confirm` (video export from MediaGen)
- `mediaGen:*`

See `src/runtime/channelManifest.ts` (`deprecated: true` on specs).
