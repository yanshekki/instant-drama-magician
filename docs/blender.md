# Blender add-on — spatial package client

> **Language:** [English](./blender.md) · [中文](./blender-ZH.md)

InstantDrama Magician does **not** embed Blender. Final video still goes through `mediaGen` stills then existing image-to-video (`videoPrep:confirm`). Blender is an optional DCC client of the same `spatial:*` channels as the in-app shot stage.

## What the add-on does

The add-on in `blender/idm_spatial/` reads and writes an **`idm-spatial-package`** directory:

- `manifest.json` — beat ids, bindings, blocking, camera, duration
- `identity/` — copies of face / wardrobe / scene / prop stills
- `spatial/` — clay PNG playblast
- `mesh/` — optional textured-plane glTF proxies (not production rigs or cloth)

Do **not** treat `.blend` as the library source of truth.

## Install

1. Blender 3.6+ (4.2+ can install the folder as an extension)
2. Edit → Preferences → Add-ons → Install from disk → select the `blender/idm_spatial` folder
3. Enable **InstantDrama Spatial**
4. Set **instant-drama CLI** (default `instant-drama` on `PATH`) and optional **IDM data directory** (`--data-dir` / `IDM_DATA_DIR`)

`spatial:blenderStatus` only reports whether a Blender executable exists. The add-on talks to InstantDrama through the CLI, not by loading the desktop app.

## Typical flow

```bash
instant-drama spatial compile-beat --args '[{"storyId":"S","entryId":"E"}]' --json --local
# or
instant-drama invoke spatial:compileBeat --args '[{"storyId":"S","entryId":"E","destDir":"/tmp/idm-pkg"}]' --json --local
```

In the 3D View sidebar (**IDM**):

1. Fill **Story ID** and **Beat / entry ID**
2. **Compile beat from InstantDrama** — empties named `IDM|<kind>|<id>` plus a camera
3. Block in Blender, optional OpenGL playblast PNG
4. **Push blocking** / **OpenGL playblast PNG then attach** → `spatial:attachRef`
5. Optional **Generate textured-plane glTF proxy** (`spatial:generateMesh`) — props and hard-surface scenes first; costumes stay dressed stills, not cloth sim

Import a folder you already exported with **Import spatial package directory** (`spatial:importPackage`).

## Product limits (intentional)

- White-model stills constrain **placement and camera** for storyboard stills. Identity stills keep faces.
- Using the clay still as I2V first frame is opt-in and **weakens face lock**.
- Current video providers do not ingest a playblast movie plus many identity images in one call. Playblast video is not a second video reference in phase 1.
- Proxy meshes are billboards for the stage / Blender, not the default beauty render.

See `channels describe spatial:compileBeat` for payloads. Do not dump the full channel catalog here.
