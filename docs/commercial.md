# Commercial distribution path · v1.0.0

> **Language:** [English](./commercial.md) · [中文](./commercial-ZH.md)

Ship path for **commercial distribution** (GitHub Releases + auto-update + support report).  
**Store listing and paid code-signing** still need your Apple/Microsoft certificates — the repo is prepared but does not obtain accounts for you.

## Honest status

| Item | Status |
|------|--------|
| GitHub multi-platform packages (Linux / Windows / mac, unsigned by default) | **Done** |
| `electron-updater` check / download / restart | **Done** (packaged) |
| Activity log + support report (redacted API keys) | **Done** |
| publish → GitHub Releases | **Done** |
| Apple/Windows **store-grade signing** | **Needs certs (not done)** |
| Cinema-grade automatic film quality | **Model-bound** |

## Auto-update

- `electron-updater` + `build.publish` → `github:yanshekki/instant-drama-magician`  
- Settings → **Check / Download / Restart**  
- Dev (`!app.isPackaged`) returns `dev-skipped` (no outbound check)  

### Ship a release

```bash
# 1. bump package.json version (currently 1.0.0)
# 2. commit + tag
git tag v1.0.0
git push origin v1.0.0
# 3. Release workflow uploads linux/win/mac assets
```

Feeds: `latest.yml` / `latest-linux.yml` / `latest-mac.yml`.

## Signing (optional secrets)

| Platform | Variables |
|----------|-----------|
| Windows | `CSC_LINK` / `CSC_KEY_PASSWORD` |
| macOS | `CSC_LINK` / Apple ID / team (+ notarize) |
| None | `CSC_IDENTITY_AUTO_DISCOVERY=false` (CI default) |

See [release.md](./release.md).

## Support report

Settings → **Export support report**:

- app version / platform / packaged  
- chat / video / ffmpeg diagnostics  
- settings (**apiKey redacted**)  
- recent activity.jsonl  

## Activity log

`userData/logs/activity.jsonl`: generation / export / update / support events.

## FFmpeg

- Bundled via **`ffmpeg-static`** (asarUnpack)  
- Override with **`FFMPEG_PATH`**  
- `instant-drama media check-ffmpeg --json` or Settings diagnostics  

## Contact

- **YSK Limited** · [email@ysk.hk](mailto:email@ysk.hk)  
- Chinese product guide: [../README-ZH.md](../README-ZH.md)

## Intentionally out of scope

- App Store / Microsoft Store submission  
- Paid license servers  
- Store-grade signing without your certs
