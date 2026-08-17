# InstantDrama Magician · 瞬劇魔法師

<p align="center">
  <strong>From one idea to a finished short drama — on your desk.</strong><br>
  <a href="./README.md">English</a> · <a href="./README-ZH.md">中文</a>
  · <strong>v1.6.1</strong> · MIT
  · <a href="https://ysk.hk">YSK Limited</a>
  · <a href="mailto:email@ysk.hk">email@ysk.hk</a>
</p>

<p align="center">
  <a href="#install--run"><img src="https://img.shields.io/badge/desktop-Linux%20%7C%20Windows%20%7C%20macOS-1f6feb?style=flat-square" alt="Desktop"></a>
  <a href="#cli-instant-drama"><img src="https://img.shields.io/badge/CLI-183%20channels-238636?style=flat-square" alt="CLI"></a>
  <a href="#ui-languages"><img src="https://img.shields.io/badge/UI-10%20languages-6e40c9?style=flat-square" alt="Languages"></a>
  <img src="https://img.shields.io/badge/license-MIT-8b949e?style=flat-square" alt="MIT">
</p>

Lock a cast. Board every beat. Then work the **same story** three ways: a **timeline** of 6 / 10 second clips, a **comic book** of full pages you can still turn into film, or a **key-art desk** for covers, stills, promo frames, and hero headshots.

<p align="center">
  <img src="./src/assets/screen/7.png" alt="Timeline pipeline — character bible, scene, and props wired on one board" width="100%">
</p>
<p align="center"><em>Timeline — character bible, scene, and props on one board; the clip track stays underneath.</em></p>

<table>
  <tr>
    <td width="50%" valign="top">
      <img src="./src/assets/screen/10.png" alt="Comics artwork tab with a finished page and two video schemes" width="100%">
      <p align="center"><em>Comics — lock the printed page, then animate it or shoot it as a short-drama clip.</em></p>
    </td>
    <td width="50%" valign="top">
      <img src="./src/assets/screen/12.png" alt="Key art desk — four make methods and a publicity still" width="100%">
      <p align="center"><em>Key art — covers, stills, promo, headshots. Four methods, then the take.</em></p>
    </td>
  </tr>
</table>

| Desktop | Remote | CLI |
|---|---|---|
| Linux · Windows · macOS (Electron) | Same project in the browser | `instant-drama` — **183** channels, same as the app |

- **Identity lock** — multi-angle character bibles, costumes, scenes, props, and motion boards  
- **Chapters first** — write the story, then pick chapters and beats when you fill cast, scenes, or props  
- **Comics studio** — even grids or manga panels, 9:16 / 1:1 / 16:9, page vs short-drama video, versioned takes  
- **Key art desk** — eight publicity types, four make methods (new / edit / lock face / continue), versioned stills, set as story cover  
- **Continuity** — previous-beat stills and end frames feed the next clip  
- **Materials first** — pick stills and notes, polish the director prompt, then still and video  
- **You stay in control** — recipe picker, OS completion notifications, ten UI languages  

---

## Table of contents

1. [UI screenshots](#ui-screenshots)
2. [Feature overview](#feature-overview)
3. [Desktop app details](#desktop-app-details)
4. [Recommended workflow](#recommended-workflow)
5. [Install & run](#install--run)
6. [CLI (`instant-drama`)](#cli-instant-drama)
7. [Web remote & self-host](#web-remote--self-host)
8. [AI & media providers](#ai--media-providers)
9. [UI languages](#ui-languages)
10. [Data directories & backup](#data-directories--backup)
11. [Architecture](#architecture)
12. [Documentation index](#documentation-index)
13. [Creator](#-creator)
14. [License & contact](#license--contact)

---

## UI screenshots

From the running app (`src/assets/screen/`, v1.6.1). The heroes above are the **timeline**, **comics**, and **key-art** desks.

### 1. Story management

Covers, draft status, cast / scene / prop / clip counts, search, **export backup** / **import story backup**.

![Story management](./src/assets/screen/1.png)

### 2. Story editor — basics

Cover, AI style note, title, art style, and the **style bible** (must / must-not rules).

![Story editor basics](./src/assets/screen/2.png)

### 3. Story chapters

Write the narrative first. AI can fill or polish chapters; those bodies become the plot source for later fills.

![Story chapters](./src/assets/screen/13.png)

### 4. Plot beats

Split chapters into filmable beats. Bind character, scene, prop, and action on each beat.

![Plot beats](./src/assets/screen/14.png)

### 5. Bind cast, sets, props

Browse the global libraries and attach what this story actually uses.

![Bind cast sets and props](./src/assets/screen/15.png)

### 6. Character library

Global cast: multi-image cards, gender / style / soul / language filters.

![Character library](./src/assets/screen/3.png)

### 7. Character bible

Identity, body, costume, and detail stills plus the written profile and hard rules.

![Character bible](./src/assets/screen/4.png)

### 8. Character reference schemes

Turnaround packs, face locks, costume plates — pick a scheme, then generate.

![Character reference schemes](./src/assets/screen/19.png)

### 9. Costume try-on

Pick the wearer, a body-plate, and a pose. The still writes to both costume and character galleries.

![Costume try-on](./src/assets/screen/16.png)

### 10. Scene plates

Establishing, hero, interior, weather — generate or swap atmosphere on the same set.

![Scene plates](./src/assets/screen/17.png)

### 11. Prop stills

Hero product, three-quarter, detail, material, scale.

![Prop stills](./src/assets/screen/18.png)

### 12. Comics — page templates

Even grids and irregular manga layouts. Format (9:16 / 1:1 / 16:9) follows the template.

![Comics layout templates](./src/assets/screen/9.png)

### 13. Comics — finished page

Two video schemes: animate the printed page, or shoot it as a short-drama clip.

![Comics artwork and video schemes](./src/assets/screen/10.png)

### 14. Key art — pick a type

Cover, poster, still, promo, social, headshot, bust, lineup.

![Key art types and page format](./src/assets/screen/11.png)

### 15. Key art — make methods

New image, edit this still, lock the face, continue the last take. One click sets the story cover.

![Key art methods](./src/assets/screen/12.png)

### 16. MediaGen — prepare a clip

Previous still, this beat’s still, character, scene, then lock continuity in text.

![MediaGen clip prep](./src/assets/screen/8.png)

### 17. Timeline track

Snap, 6s / 10s clips, bound assets, beat screenplay, per-clip generate.

![Timeline track](./src/assets/screen/5.png)

### 18. Timeline pipeline

The same beats as a board: character → scene → props → action, with the track underneath.

![Timeline pipeline](./src/assets/screen/7.png)

### 19. Advanced prep

Cast lock → storyboard stills → video. Continuity lock and per-cell refine.

![Advanced prep](./src/assets/screen/6.png)

### 20. Settings — languages and notify

Ten UI languages, light / dark / system, OS completion notifications.

![Settings languages and notifications](./src/assets/screen/20.png)

### 21. Settings — providers

Local Grok Gateway by default, plus cloud and local LLM / image / video cards.

![Settings providers](./src/assets/screen/21.png)

---

## Feature overview

| Area | What you can do |
|------|-----------------|
| **Stories** | Multi-story management, cover AI, style bible, **chapters**, multi-select **plot beats**, cast binding (characters / scenes / props / **actions**), `.idm.zip` backup import/export |
| **Characters** | Global cast library, soul.md / SoulMD Hub, multi-angle sheets, identity lock, external refs, intro video, **vision AI fill** from a still |
| **Costumes** | Wardrobe library, costume swap, wardrobe suggestions, **AI fill from reference photo only**, multi-still gallery; **try-on dual-write** to character **and** costume multi-gallery (`costumes:appendTryOnStill`) |
| **Scenes** | Scene copy, plates / looks / atmosphere, scene gallery, **vision AI fill** from a plate still |
| **Props** | Prop descriptions, master prompts, plate variants, **vision AI fill** from a still |
| **Actions** | Global **motion-direction** library: multi-panel instruction boards (2–6 panels), art styles, external refs, cast refs, **vision AI fill**, multi-gallery |
| **MediaGen shell** | Unified materials → multi-vision polish → still / video (`mediaGen:extract` · `polish` · `generateImage`); used by library pages and timeline refine |
| **Gallery UI** | Shared **EntityGalleryPanel**: large preview, zoom/save/cover/remove/intro, multi-thumb strip (preview vs identity-lock multi-select) |
| **Timeline** | Linear layout, snap/pack, per-clip generate, bind character / scene / prop / **action**, 6s/10s duration, dialogue & camera tags; **pipeline board** stacks to the live window height |
| **Comics** | Turn beats into full pages (even grids + manga layouts), 9:16 / 1:1 / 16:9, page vs short-drama video schemes, versioned page videos, export a film of pages that already have video |
| **Key art** | Story publicity stills: cover / poster / still / promo / social / headshot / bust / lineup; four make methods; versioned PNGs; optional **set as story cover** |
| **Advanced prep** | Cast lock → storyboard stills (**end-frame continuity**, prev keyframe edit base, multi-ref polish) → video; per-cell **Refine still / Refine to video** (MediaGen) |
| **Audio / subtitles** | Optional TTS mix, burn-in dialogue subs, xfade / ducking, aspect-aware export |
| **Activity log** | Generation / export / update events (JSONL) for debugging |
| **Settings** | LLM / image / video providers, **OS completion notifications**, diagnostics, FFmpeg, web server, auto-update, support report, legal terms |
| **CLI `instant-drama`** | Local headless or remote invoke; build/open desktop app; OpenClaw / Hermes agents (**183** IPC channels) |
| **Web remote** | In-app web server or standalone `instant-drama server`; browser uses the same data |
| **i18n** | 10 UI languages (incl. zh-HK written Chinese, zh-CN Mainland written Chinese, Arabic RTL); **recipe picker** before LLM improve/generate; MediaGen chrome localized |
| **Auto-update** | Packaged builds via GitHub Releases (electron-updater) |

---

## Desktop app details

Sidebar: **Stories · Characters · Costumes · Scenes · Props · Actions · Comics · Key art · Timeline · Activity · Settings**.

### Stories

- Create / edit / delete multiple independent short-drama projects  
- Status, cover presence, sort (e.g. recently updated)  
- Cover: Zoom / Regenerate / Save As  
- **Import story backup** / **Export backup** (story-level `.idm.zip`)  
- Edit tabs:  
  - **Basics**: cover, AI quick create, title, status, art style, style bible  
  - **Cast**: link **characters, scenes, props, and actions** (search + linked/unlinked filters)  
  - **Script beats**: per-beat multi-bind of characters / scenes / props / **actions**, plus beat screenplay  

### Characters

- **Global cast library** (stories can share cast)  
- Search and filters: gender, art style, has image, soul, language  
- Multi-image cards; Edit / Delete  
- Edit tabs:  
  - **Profile**: name, description, age, gender, language, voice, etc.; **AI fill** from idea, draft, soul, or **uploaded still only** (vision)  
  - **References**: multi-angle bible (front / ¾ / close-up…), body/base/costume pipeline, external refs, identity lock, generate professional refs, Intro video  
  - **Costume**: bind wardrobe  
- **SoulMD Hub** (soulmd-hub.ysk.hk): index suggestions, import soul.md as character soul  
- Details: [docs/soulmd-hub.md](./docs/soulmd-hub.md) · [docs/soulmd-hub-ZH.md](./docs/soulmd-hub-ZH.md)

### Costumes

- Global wardrobe library (link 0…N characters)  
- **AI fill from reference photo only** (no idea text required)  
- Multi-still gallery, cover, intro video; **identity-lock multi-select** on thumbs  
- Dress / try-on / swap onto a character with identity lock  
- **Accept try-on draft** → still is committed to the **character gallery and this costume multi-gallery** so every linked user can browse it (`costumes:appendTryOnStill`)  

### Scenes

- Scene description and script fields  
- Scene plates, looks, atmosphere  
- Scene gallery and variants  
- **Vision AI fill** from a selected / cover plate still  

### Props

- Prop name and description  
- Prop master prompt, plate variants  
- Bound on timeline clips  
- **Vision AI fill** from a reference still  

### Actions (motion direction)

- **Global motion library** — reusable action / blocking guides (not tied to one story until cast-linked)  
- **Multi-panel instruction boards**: 2 / 3 / 4 / 5 / 6 panels (strips or 2×2 / 2×3 grids); panel 1 = first beat, panel N = last  
- Art style, external reference stills, cast refs from character / costume / scene / prop libraries  
- **Vision AI fill** from a still; multi-gallery accumulate (append plates, reorder, cover)  
- Linked into story cast, script beats, and timeline clips; video gen injects motion notes / can use the instruction still as image ref  

### Comics

- One comic book per story; pages are full multi-panel stills, not the timeline  
- **Layout** tab: even grids + manga irregular panels; book / page format **tall 9:16**, **square 1:1**, **wide 16:9**  
- **Panels** tab: caption, bind a timeline beat, art style (inherit the book or override)  
- **Artwork** tab: generate the page still; two resident scheme cards  
  - **Page animation** — lock gutters and print layout, gentle camera  
  - **Short-drama shot** — same lock / camera / materials polish as timeline **Generate video**  
- Versioned **page videos** in a grid; set primary for export; delete only when you choose  
- **Export film** concatenates pages that already have video (`clipSource: comics`) — does not rewrite the story timeline  
- Optional **import page stills** onto the timeline as continuity locks  

### Key art

- One key-art book per story; each item is a publicity still (not a comic page, not a timeline clip)  
- **Type** tab: eight cards — cover poster, tall poster, production still, promo, social story, hero headshot, bust, cast lineup  
- Format chips **tall 9:16** / **square 1:1** / **wide 16:9** follow the type, or you override  
- **Materials** tab: brief, art style, multi-select characters, scene, timeline beat, optional comic page  
- **Artwork** tab: four resident make-method cards  
  - **New image** — refs lock identity only  
  - **Edit this still** — this take is the pixel base (needs artwork)  
  - **Lock the face, redraw** — same person, new pose / crop  
  - **Continue last still** — same people and place, next beat of the shoot  
- Versioned stills in a grid; set primary; delete only when you choose  
- **Set as story cover** writes `Story.coverPath` — never automatic  

### Timeline (main production desk)

- Select current story; **Play** / **Undo** / **Redo**  
- **Generate** batch; **Export** final; **Export history**  
- Total duration, ready count, video mode, AI clips **6s or 10s only**  
- Zoom, **Timeline snap**, snap grid, **Pack clips**  
- **Clip editor**: bind character / scene / prop / **action**, duration, beat screenplay (`[MOOD]` / `[ATMO]` / `[DIALOGUE]`, etc.)  
- Per clip: **Generate this clip** / **Regenerate** / **Continue video**  
- Retry failures; cancel generation; retry-failed-only  
- Export options: TTS, burn-in subtitles, xfade, BGM ducking, aspect ratio  

### Advanced prep

Opened from Timeline **Advanced**:

1. **Cast lock** — lock on-screen character looks  
2. **Storyboard stills** — batch keyframes per beat with **continuity** to the previous cell  
   - Continuity still prefers the **end frame** of the previous clip video when healing / after export  
   - Next still/video **edit base** prefers the previous continuity keyframe  
   - Multi-image polish can attach prev + cast + library stills  
   - Batch “missing” expands earlier missing stills so text-only beats are not generated silently  
   - Status badges explain **stale / need previous / ready**  
3. **Video** — queue video when stills are ready (can skip existing video)  
4. **Per-cell refine** — **Refine still** (`timeline-still`) or **Refine to video** (`timeline-clip`) opens the MediaGen materials shell for that beat only  

Best when you want continuity locked before video generation.

### Activity

- View local `activity.jsonl`-style events  
- Generation, export, update, support-report trails  
- Helps diagnose API / pipeline issues  

### Settings

| Block | Contents |
|-------|----------|
| **LLM** | OpenAI-compatible; default **Grok Gateway** (e.g. `http://127.0.0.1:3847`); also OpenAI / Custom / **Kimi (Moonshot)**, etc. |
| **Image** | Same as LLM or independent base URL / key / model (incl. Ark **Seedream**) |
| **Video** | `auto` / `http` / `stub`; **Seedance (Volcengine Ark)**, Grok `/v1/videos`, etc.; 6/10s; poll & timeout |
| **Diagnostics** | Test Chat, list models, connection status |
| **FFmpeg** | Hard dependency; optional `FFMPEG_PATH` |
| **Web server** | Enable browser remote, port, token, localhost / LAN |
| **Auto-update** | Check / download / restart (packaged only; skipped in dev) |
| **Support report** | Export diagnostics JSON (**API keys redacted**) |
| **UI language** | See languages below |
| **Legal** | Disclaimer & Acceptable Use Policy (AUP); re-accept when version changes |

---

## Recommended workflow

```text
1) Settings → paste API key → Test Chat
2) Stories → create / AI style note + beats
3) Characters → multi-angle sheet → lock identity
   (or upload a still → AI fill profile with vision only)
4) Scenes / Props / Costumes / Actions → complete assets
   (Actions: generate multi-panel instruction boards)
5) Story Cast → link characters, scenes, props, actions
6) Script beats → bind assets per beat (incl. actions)
7) Timeline → lay out clips, write beat screenplay
   *or* Comics → pick a template → write panels → generate the page → page video
   *or* Key art → pick a type → bind cast → choose a make method → generate stills / set cover
8) Advanced prep → stills (continuity) → video
9) Export → final (optional TTS / subtitles); Comics can export its own film from pages that have video
```

Demo: load a sample story in dev; CLI also has `instant-drama stories seed-demo`.

---

## Install & run

### CLI only (global npm)

```bash
npm install -g instant-drama-magician
instant-drama doctor --json
```

See [CLI (`instant-drama`)](#cli-instant-drama) for full commands. Package name on npm: **`instant-drama-magician`**.

### Packages (end users)

| Platform | Artifacts |
|----------|-----------|
| **Linux / Ubuntu** | `.AppImage`, `.deb` |
| **Windows** | NSIS installer |
| **macOS** | `.dmg` |

Local builds land in `release/`; or download from GitHub Releases.

```bash
# Linux example
sudo dpkg -i release/instant-drama-magician_1.6.1_amd64.deb
# or
./release/InstantDrama\ Magician-1.0.0.AppImage
```

Or via CLI:

```bash
instant-drama build --target installer
instant-drama open
```

### Developer quick start

```bash
# (Recommended) Grok OpenAI-compatible gateway in another terminal
# gctoac start  →  http://127.0.0.1:3847

cd instant-drama-magician
npm install
npx prisma db push
npm run dev
```

1. **Settings** → API key → **Test Chat**  
2. Create or open a story → timeline generate  
3. Export final  

Details: [docs/grok-gateway.md](./docs/grok-gateway.md).

### Common npm scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Electron development |
| `npm run build` | Compile main / preload / renderer |
| `npm test` | Vitest |
| `npm run dist:linux` / `dist:win` / `dist:mac` | Platform installers |
| `npm run instant-drama -- …` | Run CLI without global link |

---

## CLI (`instant-drama`)

Drive the **full** surface from the shell: local headless runtime or a running web server. For scripts, CI, and **OpenClaw / Hermes** agents.

Command on PATH after global install: **`instant-drama`**.

### Install CLI globally (recommended)

Requires **Node.js 20+**. Package on npm: [instant-drama-magician](https://www.npmjs.com/package/instant-drama-magician).

```bash
npm install -g instant-drama-magician

# Verify
instant-drama --help
instant-drama doctor --json
instant-drama version
```

#### CLI updates (npm)

```bash
instant-drama update              # check npm registry for a newer version
instant-drama update install --yes   # global install latest (with post-verify)
instant-drama update install 1.6.1 --yes   # pin a version
```

`instant-drama doctor` also reports npm update status (skip with `IDM_SKIP_UPDATE=1`).

#### Desktop app updates (GitHub Releases)

Packaged installers use **electron-updater**. On launch the app quietly checks for a newer GitHub Release; if one is available you get a **banner + toast**.  
**Settings → App → Updates**: check / download / restart to install.

What you get:

| Binary | Purpose |
|--------|---------|
| `instant-drama` | CLI (only command name; avoids clash with unrelated npm package `idm`) |

Typical usage after global install:

```bash
instant-drama --local stories list --json
instant-drama server start --port 8787
instant-drama channels list --json          # ~183 channels
```

> **Note:** Global install provides the **CLI / headless / web-server** control plane (stories, cast, generation, export helpers, agent tools). Building or opening the **Electron desktop GUI** (`instant-drama build` / `instant-drama open`) still needs a full git clone with `npm install` (devDependencies such as Electron) and a local `release/` tree.

### Install from this repository

```bash
git clone https://github.com/yanshekki/instant-drama-magician.git
cd instant-drama-magician
npm install
npm link                 # puts instant-drama on PATH
# or without link:
npm run instant-drama -- doctor --json
```

### Modes

| Mode | When | Behavior |
|------|------|----------|
| **local** | `--local` or no URL | Operate on `IDM_DATA_DIR` (default: OS app data root, same as desktop) |
| **remote** | `--url` / `IDM_URL` | `POST {url}/api/invoke` + Bearer |

### Common commands

```bash
# Diagnostics (channel count should be ~183)
instant-drama doctor --json
instant-drama channels list --json

# Any channel
instant-drama invoke stories:list --json
instant-drama invoke generation:run '["storyId"]' --json

# Domain sugar
instant-drama stories list --json
instant-drama stories create --title "My drama" --json
instant-drama characters list --json
instant-drama characters generate-sheet --args '[{"characterId":"…"}]' --json
instant-drama costumes list --json
instant-drama costumes append-try-on-still --args '[{"costumeId":"…","sourcePath":"/path/to/still.png"}]' --json
instant-drama mediaGen extract --args '[{"kind":"timeline-still","storyId":"…","entryId":"…"}]' --json
instant-drama mediaGen polish --args '[{...}]' --json
instant-drama mediaGen generate-image --args '[{...}]' --json
instant-drama timeline get-advanced-prep --args '["STORY_ID"]' --json
instant-drama videoPrep create --args '[{"kind":"timeline-clip","storyId":"…","entryId":"…","stillOnly":true}]' --json
instant-drama invoke actions:list --json
instant-drama generation run <storyId> --json
instant-drama settings get --json
instant-drama ai status --json
instant-drama media check-ffmpeg --json

# Desktop lifecycle (macOS · Ubuntu · Windows)
instant-drama build                         # local unpacked
instant-drama build --target installer      # dmg / AppImage+deb / nsis
instant-drama open                          # open packaged app
instant-drama open --dev                    # development mode
instant-drama open --build-if-missing

# Web server
instant-drama server start --port 8787 --data-dir ./data

# Agent tool definitions
instant-drama tools schema --openai > tools.json
```

**Example namespaces:**  
`activity` · `ai` · `app` · `characters` · `costumes` · `diagnostics` · `gateway` · `generation` · `media` · `project` · `props` · `scenes` · `settings` · `shell` · `souls` · `stories` · `support` · `timeline` · `updates` · `videoPrep` · `webServer`

Headless file-dialog substitutes: `IDM_PICK_FILE`, `IDM_SAVE_PATH`.

Full docs: [docs/cli.md](./docs/cli.md) · Agent: [docs/agent-cli.md](./docs/agent-cli.md) · OpenClaw: [`skills/idm/SKILL.md`](./skills/idm/SKILL.md)

---

## Web remote & self-host

### Mode A — built into the desktop app (recommended)

1. Open the Electron desktop app  
2. **Settings → Web server (browser control)**  
3. Enable, copy URL and token  
4. Open in a browser; **shares the same userData** as desktop  

### Mode B — standalone process

```bash
npm run build:web
export IDM_DATA_DIR=./data
export IDM_AUTH_TOKEN='your-long-secret'
export IDM_PORT=8787
export DATABASE_URL="file:${IDM_DATA_DIR}/instant-drama.db"
npx prisma db push
instant-drama server start
# Browser → http://127.0.0.1:8787  paste token
```

Details: [docs/self-host.md](./docs/self-host.md).

---

## AI & media providers

### LLM (chat / script / style)

- Unified **OpenAI-compatible** Chat Completions  
- Default: **Grok CLI Gateway** (port `3847`; legacy port can migrate)  
- Also: OpenAI, custom base URL, **Kimi (Moonshot)**, etc.  

### Image

- Share with LLM or configure independently  
- Gateway images API, Ark **Seedream**, etc. (per settings)  

### Video

| Mode | Behavior |
|------|----------|
| `auto` | Prefer real video API; fall back to stub on failure |
| `http` | Always OpenAI-style `/v1/videos` (or configured provider) |
| `stub` | Color placeholders (no real model) |

- Duration aligned to providers: **6 or 10 seconds only** (Grok-style video)  
- **Seedance (Volcengine Ark)** as a dedicated video provider  
- Settings: poll interval, timeout, retries, concurrency, aspect ratio  

Details: [docs/video-providers.md](./docs/video-providers.md), [docs/grok-gateway.md](./docs/grok-gateway.md).

### FFmpeg

- **Hard dependency**: concat, transitions, mix, burn-in subtitles, export  
- Bundled via **`ffmpeg-static`**; override with `FFMPEG_PATH`  

> **Honest limits:** Look depends on your models and prompts. This tool owns workflow, continuity, and export—not guaranteed “cinema-grade” auto film. Store signing / Notarize needs your certificates.

---

## UI languages

Switch in Settings:

| Code | Language |
|------|----------|
| `zh-HK` | Traditional Chinese (Hong Kong) |
| `zh-CN` | Simplified Chinese |
| `en` | English |
| `es` | Español |
| `hi` | हिन्दी |
| `ar` | العربية (RTL) |
| `pt-BR` | Português (Brasil) |
| `fr` | Français |
| `ja` | 日本語 |
| `ru` | Русский |

---

## Data directories & backup

Single **data root** per profile (DB + settings + media together). Resolved by `src/domain/appPaths.ts`.

| Context | Linux (Ubuntu) | macOS | Windows |
|---------|----------------|-------|---------|
| **Packaged desktop / CLI default** | `~/.config/instant-drama-magician/` | `~/Library/Application Support/instant-drama-magician/` | `%APPDATA%\instant-drama-magician\` |
| **Dev `npm run dev`** | `~/.config/instant-drama-magician-dev/` | `~/Library/Application Support/instant-drama-magician-dev/` | `%APPDATA%\instant-drama-magician-dev\` |
| **Override** | `IDM_DATA_DIR` or `--data-dir` | same | same |
| **Profile** | `IDM_PROFILE=default\|dev\|…` | same | same |

Inside every data root:

```
instant-drama.db   settings.json   media/   logs/   cache/   exports/
```

On first launch the app may **copy** (never delete) legacy data from `prisma/dev.db`, `~/.local/share/idm`, etc.

**Backup:**

- Story-level: Stories page **Export backup** (`.idm.zip`)  
- Full / diagnostics: app backup + support report (Settings / CLI `support`)  

Wipe packaged user data (**deletes stories and media**):

```bash
rm -rf ~/.config/instant-drama-magician
```

> Installers **do not** ship your test data. Old stories after install usually mean existing local userData on the same machine.

---

## Architecture

| Layer | Tech |
|-------|------|
| Desktop | Electron + electron-vite |
| UI | React 18 + TypeScript + Tailwind |
| Data | SQLite + Prisma |
| Media | FFmpeg; timeline UI |
| Integration | OpenAI-compatible HTTP; Grok Gateway |
| Runtime | Shared `registerAllHandlers` → Electron IPC / Web `/api/invoke` / CLI `instant-drama invoke` |

Details: [docs/architecture.md](./docs/architecture.md).

---

## Documentation index

**Rule:** files **without** `-ZH` are English; files **with** `-ZH` are Chinese. Pairs must match in content.

Full index + canonical facts: **[docs/README.md](./docs/README.md)** · **[docs/README-ZH.md](./docs/README-ZH.md)**

| English | Chinese | Topic |
|---------|---------|--------|
| [docs/README.md](./docs/README.md) | [docs/README-ZH.md](./docs/README-ZH.md) | Docs index + facts |
| [docs/project-brief.md](./docs/project-brief.md) | [docs/project-brief-ZH.md](./docs/project-brief-ZH.md) | Product spec |
| [docs/cli.md](./docs/cli.md) | [docs/cli-ZH.md](./docs/cli-ZH.md) | CLI (183 channels) |
| [docs/agent-cli.md](./docs/agent-cli.md) | [docs/agent-cli-ZH.md](./docs/agent-cli-ZH.md) | Agents / OpenClaw |
| [docs/self-host.md](./docs/self-host.md) | [docs/self-host-ZH.md](./docs/self-host-ZH.md) | Web remote |
| [docs/grok-gateway.md](./docs/grok-gateway.md) | [docs/grok-gateway-ZH.md](./docs/grok-gateway-ZH.md) | Grok Gateway |
| [docs/video-providers.md](./docs/video-providers.md) | [docs/video-providers-ZH.md](./docs/video-providers-ZH.md) | Video / image providers |
| [docs/soulmd-hub.md](./docs/soulmd-hub.md) | [docs/soulmd-hub-ZH.md](./docs/soulmd-hub-ZH.md) | SoulMD Hub |
| [docs/commercial.md](./docs/commercial.md) | [docs/commercial-ZH.md](./docs/commercial-ZH.md) | Releases & updater |
| [docs/release.md](./docs/release.md) | [docs/release-ZH.md](./docs/release-ZH.md) | Release checklist |
| [docs/legal.md](./docs/legal.md) | [docs/legal-ZH.md](./docs/legal-ZH.md) | Legal versioning |
| [docs/testing.md](./docs/testing.md) | [docs/testing-ZH.md](./docs/testing-ZH.md) | Testing |
| [docs/architecture.md](./docs/architecture.md) | [docs/architecture-ZH.md](./docs/architecture-ZH.md) | Architecture |
| [docs/beta.md](./docs/beta.md) | [docs/beta-ZH.md](./docs/beta-ZH.md) | Historical beta |
| [docs/production-ux.md](./docs/production-ux.md) | [docs/production-ux-ZH.md](./docs/production-ux-ZH.md) | Historical UX |
| [docs/rc.md](./docs/rc.md) | [docs/rc-ZH.md](./docs/rc-ZH.md) | Historical RC |
| [skills/idm/SKILL.md](./skills/idm/SKILL.md) | [skills/idm/SKILL-ZH.md](./skills/idm/SKILL-ZH.md) | OpenClaw skill |
| [resources/README.md](./resources/README.md) | [resources/README-ZH.md](./resources/README-ZH.md) | App icons |

---

## 👤 Creator

**Ki (yanshekki)** — Full-stack developer, quant trader, founder of [YSK Limited](https://ysk.hk/).

🌐 [linktr.ee/yanshekki](https://linktr.ee/yanshekki) · 🏢 [ysk.hk](https://ysk.hk/)

### ☕ Support / Donate

If InstantDrama Magician helps your short-drama production workflow, consider buying me a coffee!

| Network | Address |
| --- | --- |
| **EVM** (ETH/BSC/AVAX) | `yanshekki.eth` |
| **NEAR** | `yanshekki.near` |
| **ADA** (Cardano) | `$yanshekki` |

---

## License & contact

- **License:** MIT  
- **Vendor:** YSK Limited  
- **Email:** [email@ysk.hk](mailto:email@ysk.hk)  
- **Repository:** see `package.json` → `repository.url`  

Please attach a **support report** when filing issues (Settings; keys redacted).

---

**InstantDrama Magician** — turn AI short-drama ideas into an editable, exportable, iterable professional workflow.
