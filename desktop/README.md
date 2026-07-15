# Flashy Desktop (Electron)

Developer notes for the Electron wrapper. For what the app does and how to use
it, see the [top-level README](../README.md).

## How it works

- The Express server runs **embedded in the Electron main process**. It's
  bundled into a single file (`dist/server.cjs`) with esbuild, so no server
  `node_modules` need shipping.
- The window loads `http://127.0.0.1:<free port>/`; the same server serves the
  API and the built client, so the client's relative `/api` calls work.
- Data lives in `app.getPath("userData")`, outside the app bundle, so it
  survives updates.
- Closing the window quits the app; `before-quit` runs the server's
  sync-on-shutdown first. A single-instance lock focuses the existing window.

Key files: [`src/main.ts`](src/main.ts) (Electron lifecycle),
[`scripts/make-icon.mjs`](scripts/make-icon.mjs) (generates the brand icon).

## Commands (from the repo root)

| Command | What it does |
| --- | --- |
| `npm run desktop:start` | Build client + app and launch the window (dev run). |
| `npm run desktop:dist` | Build the Windows installer + portable `.exe` into `desktop/release/`. |
| `npm run desktop:publish` | Build and upload a draft GitHub release (needs `GH_TOKEN`). |

`desktop:dist` builds the client (`vite`), bundles the server (esbuild),
compiles the main process (`tsc`) and generates the icon, then runs
`electron-builder`. Output in `desktop/release/`:

- `Flashy Setup <version>.exe` — NSIS installer
- `Flashy <version>.exe` — portable, single-file build
- `latest.yml` + `.blockmap` — metadata for GitHub publishing / auto-updates

The app is **not code-signed** (no certificate). Fine for local use; Windows
SmartScreen may warn on first launch.

> electron-builder **25** used to break the Windows build with "Cannot create
> symbolic link" (macOS symlinks in its `winCodeSign` tool). This project uses
> electron-builder **26+**, where that no longer happens — no workaround needed.

## Publishing releases on GitHub

electron-builder can upload the installer straight to a GitHub release
(including `latest.yml` for future auto-updates).

1. **Token** — create a GitHub PAT with the `repo` scope and set it as an env
   var: PowerShell `$env:GH_TOKEN = "ghp_…"`.
2. **Target repo** — taken from the `repository` field in `package.json`
   (`publish: github`). Point it elsewhere with
   `{ "provider": "github", "owner": "…", "repo": "…" }`.
3. **Bump the version** in `desktop/package.json` (`"version"`); otherwise the
   upload overwrites the existing release.
4. **Publish** from the repo root: `npm run desktop:publish`. This uploads a
   **draft** release — review it under *Releases* on GitHub and click *Publish
   release*.

You can also attach the files from `desktop/release/` to a release by hand.

## Electron / Node version

Keep the `electron` devDependency and `electronVersion` in the build config in
sync (currently **43.1.0**: Node 24, Chromium 150). The embedded server uses
`node:sqlite`, so the packaged Electron must bundle **Node ≥ 22.5** — any
current Electron release qualifies. When bumping, update both fields together so
the dev run and the shipped app match, and stay on a security-supported stable
release.
