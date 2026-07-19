# Release Candidate (Round 9)

> **Language:** [English](./rc.md) · [中文](./rc-ZH.md)

On top of Production UX: **more film-like finals** + **downloadable Linux packages** (no store signing).

## Version

- App: see `package.json` (commercial path → `1.0.0`)  
- Shipping/updater: [commercial.md](./commercial.md)

## Film capabilities (this round)

| Capability | Description |
|------------|-------------|
| Transitions | Settings → `fade` (xfade) or `cut` |
| Aspect | 16:9 → 1280×720; 9:16 → 720×1280; 1:1 → 1080² |
| BGM ducking | Lower BGM during TTS dialogue (`duckRatio`) |
| About | Settings shows version / packaged / userData / media |

## Download RC packages

### GitHub Actions

1. Push tag: `git tag v0.3.0 && git push origin v0.3.0` (historical example)  
2. **Release** workflow produces AppImage + deb  
3. Download from GitHub Releases  

Or:

```bash
npm run typecheck && npm test && npm run build
CSC_IDENTITY_AUTO_DISCOVERY=false npx electron-builder --linux AppImage deb
```

### Local dir pack

```bash
npm run pack
# → release/linux-unpacked
```

## System requirements

- Linux x64 (AppImage / deb)  
- **FFmpeg** via `ffmpeg-static`; override with `FFMPEG_PATH`  
- Optional local Grok gateway for real video  

## Known limits

> **Today (v1.0.0 commercial path):** GitHub Releases include **Linux + Windows + macOS**; **electron-updater** is wired; FFmpeg via `ffmpeg-static`. See [commercial.md](./commercial.md), [release.md](./release.md).

Still true:

- No store code-signing / Notarization without your certs  
- TTS quality depends on HTTP TTS config  
- No multi-track NLE  
- Film quality is model-bound  

## Suggested trial

1. Load Demo  
2. Settings: aspect 9:16 or 16:9, transition fade  
3. Generate → export  
4. Check transitions and (if TTS on) BGM ducking
