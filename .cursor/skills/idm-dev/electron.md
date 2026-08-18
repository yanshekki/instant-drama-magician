# Electron main process (this repo)

Vite HMR reloads the renderer only. **IPC / handler / preload / `electron/main` changes need a full Electron restart.**

## Start (Linux / this machine)

Cursor may set `ELECTRON_RUN_AS_NODE=1`, which breaks `electron.app`. Always unset it:

```bash
env -u ELECTRON_RUN_AS_NODE ELECTRON_DISABLE_SANDBOX=1 npm run dev
```

Do not use `ELECTRON_RUN_AS_NODE=1 electron …`.

## After handler edits

1. Stop the running Electron process (the Vite overlay is not enough).
2. Restart with the command above.
3. If the UI still calls the old contract, also check `electron/preload/index.ts` and `src/types/electron-api.ts`.

## Sandbox note

`ELECTRON_DISABLE_SANDBOX=1` is the local-dev workaround on this Linux setup. Packaged builds use the normal Electron sandbox.
