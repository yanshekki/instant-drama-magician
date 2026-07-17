# Release checklist

1. `npm run typecheck && npm test && npm run build`
2. `npm run pack` → inspect `release/linux-unpacked`
3. Optional: `npm run dist` for installers (linux AppImage/deb)
4. Configure Settings → video mode if real API available
5. Ensure `ffmpeg` is installed on target machine
6. Never commit `userData` secrets; settings stay local
7. Version is `0.2.0` (Production UX). Bump for store/sign builds later.

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs typecheck, test, build on `main`,  
and uploads a **linux pack** artifact (`npm run pack` → `release/`).

## Not yet (commercial)

- Code signing / notarization  
- Auto-update channel  
- Store listings (Windows / macOS / Linux store)
