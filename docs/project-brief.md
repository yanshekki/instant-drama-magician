# InstantDrama Magician — Professional Project Specification

> **Language:** [English](./project-brief.md) · [中文](./project-brief-ZH.md)

**Project name:** InstantDrama Magician (瞬劇魔法師)  
**Tagline:** AI professional short-drama desktop tool  
**Type:** Cross-platform Electron desktop application  

> ### Status note (v1.0.0)
>
> | Item | Current |
> |------|---------|
> | Version | **1.0.0** |
> | Pages | Stories · Characters · **Costumes** · Scenes · Props · Timeline · Activity · Settings |
> | i18n | **10** locales |
> | CLI / Web | Full **138**-channel shared runtime |
> | Contact | **email@ysk.hk** · YSK Limited |
> | User guides | [../README.md](../README.md) · [../README-ZH.md](../README-ZH.md) |
> | Docs index | [README.md](./README.md) |
>
> Sections below preserve the **original bootstrap specification**.

## Project goal

Build a professional, modular, extensible AI short-drama generator. Users create characters, scenes, props, and multiple stories on independent pages, then control short-film generation with a **linear timeline**. The system supports idea-to-film workflows and precise timeline management given AI video length limits (6s/10s).

## Core tech stack

- **Frontend:** React 18 + TypeScript + TailwindCSS + Vite  
- **Desktop:** Electron + electron-vite  
- **Database:** SQLite + Prisma  
- **AI:** OpenAI-compatible (default Grok CLI gateway)  
- **i18n:** react-i18next (10 languages today)  
- **Media:** FFmpeg (`ffmpeg-static`), custom timeline UI  

## Architecture

Clean Architecture + feature layers: Presentation · Application · Domain · Infrastructure.  
Shared `registerAllHandlers` powers Electron IPC, Web `/api/invoke`, and CLI `instant-drama invoke`.

## Independent creation pages (original + shipped extras)

1. Stories  
2. Characters (soul.md / SoulMD Hub)  
3. Scenes  
4. Props  
5. Timeline  
6. **Costumes** (shipped)  
7. **Activity** (shipped)  
8. **Settings** (shipped)  

## Related

- [architecture.md](./architecture.md) · [commercial.md](./commercial.md) · Contact [email@ysk.hk](mailto:email@ysk.hk)
