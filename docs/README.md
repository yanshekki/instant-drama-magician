# Documentation index · InstantDrama Magician

> **Language:** [English](./README.md) · [中文](./README-ZH.md)

Product version **1.0.0** · Vendor **YSK Limited** · Contact **[email@ysk.hk](mailto:email@ysk.hk)**

**Convention:** files **without** `-ZH` are English; files **with** `-ZH` are Chinese. Each pair must cover the same topics and facts.

## All document pairs

| English | Chinese | Topic |
|---------|---------|--------|
| [../README.md](../README.md) | [../README-ZH.md](../README-ZH.md) | Product README + screenshots |
| [README.md](./README.md) | [README-ZH.md](./README-ZH.md) | This index |
| [project-brief.md](./project-brief.md) | [project-brief-ZH.md](./project-brief-ZH.md) | Product specification |
| [architecture.md](./architecture.md) | [architecture-ZH.md](./architecture-ZH.md) | Architecture |
| [cli.md](./cli.md) | [cli-ZH.md](./cli-ZH.md) | CLI `idm` |
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


## Canonical facts

| Fact | Value |
|------|--------|
| App version | `1.0.0` (`package.json`) |
| IPC / CLI channels | **137** (shared `registerAllHandlers`) |
| Legal copy version | `LEGAL_VERSION` **1.0.0** (`src/domain/legal.ts`) |
| Default LLM | Grok Gateway `http://127.0.0.1:3847/v1` |
| AI clip duration | **6 or 10** seconds only (Grok-style video) |
| FFmpeg | **Bundled** via `ffmpeg-static`; override with `FFMPEG_PATH` |
| Packaged userData (Linux) | `~/.config/instant-drama-magician/` |
| Dev userData (Linux) | `~/.config/instant-drama-magician-dev/` |
| Contact email | **email@ysk.hk** |
| UI locales | 10: en, zh-HK, zh-CN, es, hi, ar, pt-BR, fr, ja, ru |

When code changes any of the above, update **both** language files in the same PR.

