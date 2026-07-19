# SoulMD Hub integration

> **Language:** [English](./soulmd-hub.md) · [中文](./soulmd-hub-ZH.md)

**Site:** https://soulmd-hub.ysk.hk  
**API docs:** https://soulmd-hub.ysk.hk/api-docs  

Characters page uses the public API to pick souls (no login, no fork to account).

## Endpoints used

| Purpose | Path |
|---------|------|
| List | `GET /api/souls?page=&limit=&is_nft=0` |
| Search | `GET /api/souls?q=&limit=` (+ local index) |
| Categories | `GET /api/categories` |
| Detail | `GET /api/soul/{id}` (**singular** soul) |

## 50-page quick suggestions

App fetches `page=1…50` (limit=12) into `userData/cache/soulmd-index.json` for:

- Search **suggestion chips** (role / domain / title)  
- Local filter when Hub `q` is unstable  

## Character form mapping

Selecting a soul fills `name` / `description` / `soulMdPath=soulmd-hub://{id}` / `soulHubId`.  
`content` (single_md or full_soul_folder) can preview, then **AI master prompt** structures fields.

## Multi-angle images

Characters → generate multi-angle reference sheets via configured image provider (default Grok Gateway `POST /v1/images/generations` with `imagesApi`; or Seedream, etc.).

## Related

- Screenshots: [../README.md](../README.md) · [../README-ZH.md](../README-ZH.md)  
- Contact: [email@ysk.hk](mailto:email@ysk.hk)
