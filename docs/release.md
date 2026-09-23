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
# → release.yml: Linux AppImage/deb + Windows NSIS + macOS dmg (mac ad-hoc signed before upload)
```

Manual:

```bash
CSC_IDENTITY_AUTO_DISCOVERY=false npm run dist:linux
```

Auto-update feed: GitHub Releases (`build.publish`). See [commercial.md](./commercial.md).

## Code signing

- macOS GitHub Release builds are **ad-hoc signed** (`scripts/adhoc-sign-mac.cjs`) before upload. `mac.identity` stays `null` so electron-builder 25 does not look up a keychain cert named `-`. CI runs `codesign --verify --deep --strict` and requires `Signature=adhoc`; a failed check does not upload.
- First launch still needs System Settings → Privacy & Security → Open Anyway. Notarization is not included.
- `CSC_LINK` / `CSC_KEY_PASSWORD` for Windows Developer signing  
- Apple Developer ID + notarization secrets for store-grade macOS builds  
- CI sets `CSC_IDENTITY_AUTO_DISCOVERY=false` so a missing Developer ID cert does not skip the ad-hoc hook  

## CI

- `.github/workflows/ci.yml` — typecheck, test, build, pack on `main`  
- `.github/workflows/release.yml` — tag `v*` → multi-platform installers + Release assets  

## Still needs your accounts

- Apple Developer / Microsoft Partner / EV code-signing cert  
- Store listing copy and review submission
