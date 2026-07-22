# Production UX (Round 8)

> **Language:** [English](./production-ux.md) · [中文](./production-ux-ZH.md)

Trial-deepening layer on top of Beta: **controllable generation, dialogue audio, character consistency, packable builds**.

## Capabilities

| Capability | Description |
|------------|-------------|
| Cancel generation | Full pipeline and single clip via `generation:cancel` |
| Retry failed only | Video step only (skip script…export) |
| Live progress | Clip status badges + job id |
| Dialogue TTS | Optional synthesis mixed with `adelay` on export |
| BGM | Optional path + volume |
| Character refs | Characters page; live warns if missing |
| Style bible | Story `styleNote` injected into clip prompts |
| Continuity | Previous beat **end-frame** continuity still + prompt lock; multi-ref polish; batch fills earlier missing stills |
| MediaGen shell | Materials → polish → still/video for library pages and timeline **refine** |
| Costume try-on dual-write | Accept dressed still → character gallery **and** costume multi-gallery |
| Reveal export | `openExportFolder` after save |
| Pack | `npm run pack` → `release/linux-unpacked` |

## Suggested trial path

1. Load Demo (with styleNote)  
2. Add character reference images  
3. Timeline → generate clip / full run  
4. Optionally enable TTS + BGM in Settings  
5. Export → folder opens  

## Still not done / boundaries

- Code signing, store listing (need your certs)  
- Multi-track NLE  
- Studio-grade TTS / auto scoring  

> **After v1.0.0:** multi-platform GitHub Release, electron-updater, activity log + support report, full CLI/Web **157** channels. See [commercial.md](./commercial.md).

RC transitions/aspect: [rc.md](./rc.md). Release: [release.md](./release.md).
