# Release checklist

> **Language:** [English](./release.md) · [中文](./release-ZH.md)

1. `npm run typecheck && npm test && npm run build`  
2. `npm run pack` → inspect `release/linux-unpacked`  
3. Optional: `npm run dist` / `idm build --target installer` (linux AppImage+deb, win NSIS, mac dmg)  
4. Configure Settings → LLM / video provider if using a real API  
5. FFmpeg: bundled via **`ffmpeg-static`**; optional `FFMPEG_PATH`  
6. Never commit `userData` secrets  
7. Version **`1.0.0`**. Contact **email@ysk.hk**. Store signing optional.  
8. Linux icons: pure YSK mark; `StartupWMClass=instant-drama-magician`  

## Ship from a git tag

```bash
git tag v1.0.0
git push origin v1.0.0
# → release.yml: Linux AppImage/deb + Windows NSIS + macOS dmg (unsigned by default)
```

Manual:

```bash
CSC_IDENTITY_AUTO_DISCOVERY=false npm run dist:linux
```

Auto-update feed: GitHub Releases (`build.publish`). See [commercial.md](./commercial.md).

## Optional code signing

- `CSC_LINK` / `CSC_KEY_PASSWORD`  
- Apple notarization secrets for macOS store-grade builds  
- Without secrets, CI sets `CSC_IDENTITY_AUTO_DISCOVERY=false`  

## CI

- `.github/workflows/ci.yml` — typecheck, test, build, pack on `main`  
- `.github/workflows/release.yml` — tag `v*` → multi-platform installers + Release assets  

## Still needs your accounts

- Apple Developer / Microsoft Partner / EV code-signing cert  
- Store listing copy and review submission
