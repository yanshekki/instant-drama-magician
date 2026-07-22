# 文件總覽 · InstantDrama Magician

> **語言：** [English](./README.md) · [中文](./README-ZH.md)

產品版本 **1.3.3** · 廠商 **YSK Limited** · 聯絡 **[email@ysk.hk](mailto:email@ysk.hk)**

**命名規則：** 檔名**無** `-ZH` 為英文版；**有** `-ZH` 為中文版。每一對必須涵蓋相同主題與事實。

## 全部文件配對

| English | Chinese | Topic |
|---------|---------|--------|
| [../README.md](../README.md) | [../README-ZH.md](../README-ZH.md) | Product README + screenshots |
| [README.md](./README.md) | [README-ZH.md](./README-ZH.md) | This index |
| [project-brief.md](./project-brief.md) | [project-brief-ZH.md](./project-brief-ZH.md) | Product specification |
| [architecture.md](./architecture.md) | [architecture-ZH.md](./architecture-ZH.md) | Architecture |
| [cli.md](./cli.md) | [cli-ZH.md](./cli-ZH.md) | CLI `instant-drama` |
| [agent-cli.md](./agent-cli.md) | [agent-cli-ZH.md](./agent-cli-ZH.md) | Agents |
| [self-host.md](./self-host.md) | [self-host-ZH.md](./self-host-ZH.md) | Web remote |
| [grok-gateway.md](./grok-gateway.md) | [grok-gateway-ZH.md](./grok-gateway-ZH.md) | Grok Gateway |
| [video-providers.md](./video-providers.md) | [video-providers-ZH.md](./video-providers-ZH.md) | Video / image providers |
| [soulmd-hub.md](./soulmd-hub.md) | [soulmd-hub-ZH.md](./soulmd-hub-ZH.md) | SoulMD Hub |
| [commercial.md](./commercial.md) | [commercial-ZH.md](./commercial-ZH.md) | Commercial release path |
| [release.md](./release.md) | [release-ZH.md](./release-ZH.md) | Release checklist |
| [legal.md](./legal.md) | [legal-ZH.md](./legal-ZH.md) | Legal versioning |
| [testing.md](./testing.md) | [testing-ZH.md](./testing-ZH.md) | Testing |
| [beta.md](./beta.md) | [beta-ZH.md](./beta-ZH.md) | Historical beta |
| [production-ux.md](./production-ux.md) | [production-ux-ZH.md](./production-ux-ZH.md) | Historical production UX |
| [rc.md](./rc.md) | [rc-ZH.md](./rc-ZH.md) | Historical RC |
| [../skills/idm/SKILL.md](../skills/idm/SKILL.md) | [../skills/idm/SKILL-ZH.md](../skills/idm/SKILL-ZH.md) | OpenClaw skill |
| [../resources/README.md](../resources/README.md) | [../resources/README-ZH.md](../resources/README-ZH.md) | App icons |


## 準則事實

| 項目 | 值 |
|------|-----|
| App 版本 | `1.3.3`（`package.json`） |
| IPC／CLI channel | **157**（共用 `registerAllHandlers`） |
| 法律文檔版本 | `LEGAL_VERSION` **1.0.0**（`src/domain/legal.ts`） |
| 預設 LLM | Grok Gateway `http://127.0.0.1:3847/v1` |
| AI clip 時長 | **僅 6 或 10** 秒（Grok 風格影片） |
| FFmpeg | 經 **`ffmpeg-static`** 打包；可用 `FFMPEG_PATH` 覆寫 |
| 安裝版 userData（Linux） | `~/.config/instant-drama-magician/` |
| 開發 userData（Linux） | `~/.config/instant-drama-magician-dev/` |
| 聯絡電郵 | **email@ysk.hk** |
| UI 語系 | 10 種：en, zh-HK, zh-CN, es, hi, ar, pt-BR, fr, ja, ru |

程式若改動上表，請在同一 PR 更新**兩種語言**文件。

