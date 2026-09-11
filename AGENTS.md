# AGENTS.md

## Session Resume
Read [WORKLOG.md](WORKLOG.md) when resuming work in a fresh session — it tracks the latest work
state, git pointer, verified commands, and open items. The project folder was renamed to
`lebanon-pharma-pro`; reopen opencode there.

## Project Overview
Lebanon Pharma Pro — an Electron desktop pharmacy POS/inventory app (React 19 + Vite + Tailwind), offline-first, with optional live LAN sync between one "Main PC" and one or more "Secondary PCs" over Socket.IO. There is no backend database; all data lives in the browser's `localStorage`/`IndexedDB` inside the Electron renderer.

## Architecture
- [server.ts](server.ts) — a single Express + Socket.IO server, always on port 3000. In dev it mounts Vite in middleware mode to serve the React app; in production it serves the built `dist/`. It relays `sync_update` and snapshot request/response events between connected PCs (pure relay/router, no server-side persistence), and it also hosts the Gemini-powered `/api/scientifics/enrich` endpoint (gated on `GEMINI_API_KEY` via `dotenv.config()`). It proxies the MOPH price-list XLS + LNDD ingredient lookups from `moph.gov.lb`, persists an LNDD ingredients cache (see Conventions), and exposes `GET /api/moph/now` — trusted online time (Date headers from public HTTPS hosts) used to gate the password-protected "Update from MOPH" feature so its 1-year unlock cannot be gamed with the PC clock.
- [src/services/mophParsers.ts](src/services/mophParsers.ts) — the ONLY place LNDD/XLS parsing lives (LNDD row regex needs the `s` flag — price cells span newlines — and parsing is covered by vitest). `server.ts` and `mophApiService.ts` import from it; do not re-implement parsers inline on either side.
- [main.cjs](main.cjs) — Electron entry point. It `require()`s the built `dist/server.cjs` in-process (not a child process), then loads `http://localhost:3000` in a `BrowserWindow`. Sets a custom `userData` path under `%ProgramData%` (see comments in the file) so app data survives reinstall/uninstall.
- [src/context/PharmacyContext.tsx](src/context/PharmacyContext.tsx) — the single source of truth: virtually all business logic (products, sales, purchases, suppliers, customers, users, settings, and the LAN sync engine) lives in this one large context provider. Most feature work touches this file.
- [src/services/storage.ts](src/services/storage.ts) — persistence layer (`localStorage` + `IndexedDB` via [indexedDbStorage.ts](src/services/indexedDbStorage.ts)), plus the `INITIAL_*` demo-data constants used only by the "Reset Demo Data" feature (fresh installs start empty, not seeded).
- [src/services/syncEngine.ts](src/services/syncEngine.ts) — thin Socket.IO client wrapper (connect/broadcast/snapshot request-response), used exclusively by `PharmacyContext`.
- Two-PC sync model: `settings.syncMode` is `'main'` or `'secondary'`. A Secondary connects to Main's IP; on (re)connect it sends its own local data along with the snapshot request, and Main merges it in (`mergeById` / `mergeProductsArrays` in `PharmacyContext`) before replying, so work done while disconnected isn't lost. Any new synced entity needs: a broadcast on write, a case in the incoming-message switch, and an entry in the snapshot payload both directions — copy the pattern used for products/sales/suppliers.

## Build & Run
- `npm run dev` — dev server on `http://localhost:3000` (tsx + Vite middleware/HMR).
- `npm run build` — `vite build` (frontend → `dist/`) + esbuild bundles `server.ts` → `dist/server.cjs`. Run before packaging.
- `npm run lint` — `tsc --noEmit`. This is the only type-check in the repo.
- `npm run test` — `vitest run`. Unit tests live next to their source as `*.test.ts` (currently `src/services/mophParsers.test.ts`). Run both after touching `server.ts`/`mophParsers.ts`.
- `npm run package-exe` — runs `node scripts/package-exe.cjs` (build + `electron-builder --win`); the `build` config in `package.json` is valid. Or run `npx electron-builder --win` directly.
- Other scripts: `start` = `node dist/server.cjs` (serves built app, needs `build` first), `preview` = `vite preview`, `clean` = `rm -rf dist server.js`.
- Both `package-lock.json` and `bun.lock` are committed. Install with `npm` (do not let `bun` drift the lockfile).

## Conventions & Gotchas
- The repo root has ~80 leftover `patch_*.cjs`/`.js` and `test*.cjs` files from earlier ad-hoc sessions that regex-patched compiled output directly. They are not part of the build and aren't referenced anywhere — ignore them, don't run them, and don't add new ones. Edit the real source in `src/`, `server.ts`, and `main.cjs` directly.
- `package.json` has `"type": "module"`, so Electron's main process (`main.cjs`) must stay CommonJS `.cjs` — a `.js` file here would break `require('electron')`.
- Editing `PharmacyContext.tsx` reliably breaks Vite Fast Refresh (`"usePharmacy" export is incompatible"` in the dev server log) — after such an edit, do a full browser reload rather than trusting HMR, and expect in-memory-only state (e.g. `activeSessions`) to reset.
- The LNDD ingredients cache lives on disk so restarts don't re-hit the public site: dev default `cwd/.cache/lndd-ingredients-cache.json`, production `%ProgramData%\Lebanon Pharma Pro\lndd-ingredients-cache.json`, overridable via `LNDD_CACHE_FILE`. Lookups are deduped in flight, capped to 100 items/request in the client, and the server matches via a few candidate terms per drug (exact name, name minus trailing numbers/units, longest alphabetic word) because LNDD only does substring token matching (`LIKE '%term%'`) and rejects multi-word queries.
- Running `npx electron-builder --win` or `npm run package-exe` fails with `EPERM ... rename win-unpacked.tmp` if a `npm run dev` instance is still running — its file watcher locks freshly-extracted files under `release/`. Stop the dev server before packaging.
- `build-data-policy.json` (`{"mode":"fresh","buildId":...}`) is read by `main.cjs` at startup: if `mode` is `fresh` and a `.build-policy-<buildId>` marker is absent, it **deletes the entire ProgramData user-data folder** and applies the marker. Bumping `buildId` forces a clean reset of all pharmacy data on the next launch — never change it casually, and never ship a build with a stale/wrong policy marker if you care about the user's data.
- Port 3000 is hardcoded everywhere (dev, prod, and `main.cjs`'s startup polling). If `npm run dev` fails with `EADDRINUSE`, check `Get-NetTCPConnection -LocalPort 3000` — a leftover packaged exe or previous dev server is the usual cause.

## Code Quality Bar
- Match the existing Tailwind + `lucide-react` conventions already used across `src/components/**` (rounded-xl cards, teal accent, `dark:` variants, slate neutrals) rather than introducing a different visual style.
- Prefer fixing the root cause over the symptom. This codebase has a history of copy-paste bugs (e.g. broadcasting `updated[0]` instead of the just-edited record) — double-check array/index logic whenever similar blocks are duplicated.
- Before considering a change done: verify it compiles (`npm run lint`), and if it touches synced state, verify the write is broadcast, handled on receipt, and included in the snapshot payload.
