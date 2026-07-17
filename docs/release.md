# Release checklist

1. `npm run typecheck && npm test && npm run build`
2. `npm run pack` → inspect `release/linux-unpacked`
3. Optional: `npm run dist` for installers (linux AppImage/deb)
4. Configure Settings → video mode if real API available
5. Ensure `ffmpeg` is installed on target machine
6. Never commit `userData` secrets; settings stay local
7. Version is **`1.0.0`** (commercial distribution path). Store signing still optional.

## Ship a release from git tag

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

Set repo secrets when you have certificates:

- `CSC_LINK` / `CSC_KEY_PASSWORD` (Windows / generic)
- Apple notarization secrets for macOS store-grade builds

Without secrets, CI sets `CSC_IDENTITY_AUTO_DISCOVERY=false`.

## CI

- `.github/workflows/ci.yml` — typecheck, test, build, pack on `main`  
- `.github/workflows/release.yml` — tag `v*` → multi-platform installers + Release assets  

## Still needs your accounts

- Apple Developer / Microsoft Partner / EV code-signing cert  
- Store listing copy and review submission
