# Release checklist

1. `npm run typecheck && npm test && npm run build`
2. `npm run pack` → inspect `release/linux-unpacked`
3. Optional: `npm run dist` for installers (linux AppImage/deb)
4. Configure Settings → video mode if real API available
5. Ensure `ffmpeg` is installed on target machine
6. Never commit `userData` secrets; settings stay local
7. Version is **`0.3.0`** (Release Candidate). Store/sign builds later.

## Ship an RC from git tag

```bash
git tag v0.3.0
git push origin v0.3.0
# → .github/workflows/release.yml builds AppImage + deb and publishes Release
```

Manual:

```bash
CSC_IDENTITY_AUTO_DISCOVERY=false npx electron-builder --linux AppImage deb
```

See [rc.md](./rc.md).

## CI

- `.github/workflows/ci.yml` — typecheck, test, build, pack artifact on `main`  
- `.github/workflows/release.yml` — tag `v*` / workflow_dispatch → AppImage + deb  

## Not yet (commercial)

- Code signing / notarization  
- Auto-update channel  
- Store listings (Windows / macOS / Linux store)
