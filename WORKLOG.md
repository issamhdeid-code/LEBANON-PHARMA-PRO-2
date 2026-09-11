# WORKLOG — work state & where to resume

> This file travels with the project. The folder was renamed from `sahred-from-google-ai` to
> `lebanon-pharma-pro` (parent: `C:\Users\Administrator\Downloads\remix-lebanon-pharmacy-management-system-46 (10)`).
> Reopen opencode in the NEW path: `...\lebanon-pharma-pro`.

## Git state (last known)
- `origin` = https://github.com/issamhdeid-code/sahred-from-google-ai
- Local `main` == `origin/main` == `e55e3f5` (pushed). Working tree CLEAN after commit
  `feat(perf): virtualize lists, debounce search, stabilize stock grid, integer LBP`
  (23 files: perf work, stock grid fix, LBP integer amounts, build-data-policy bump, WORKLOG + AGENTS.md).
- History note: remote was rewritten to a single "Initial commit" `61d7b79`; both subsequent commits
  (`74918fb`, `4379d31`) were built on top of it. Do not rebase --force against it.
  Latest: `e55e3f5` on top of `4379d31`.

## Environment / commands
- `npm run lint` — `tsc --noEmit` (only type-check). GREEN for the current performance changes.
- `npm run test` — `vitest run` (tests: `src/services/mophParsers.test.ts`, 8 tests, green).
- `npm run build` — vite → `dist/` + esbuild → `dist/server.cjs` (verified working this session).
- Dev: `npm run dev` serves http://localhost:3000. Port 3000 hardcoded.
- `npm run package-exe` — build + electron-builder --win. Requires dev server STOPPED (EPERM lock).
- Deps added: `@tanstack/react-virtual` (^3.x) — used in StockView, SaleView, ScientificsView.
- Deps: vitest ^3.2.7, electron-builder ^26.15.3, React 19, Express + Socket.IO.

## What was completed in the PREVIOUS session (pushed, 4379d31)
MOPH price-list import/update (5,765 drugs), LNDD ingredient cache + smart matching, shared parser
module + 8 vitest tests, price-decrease toggle, progressive ingredient fill, packaging fix. See git log.

## What was completed in THIS session (performance — NOT committed)
Root cause: at ~5,600 products every mutation/keystroke re-rendered huge DOM lists and cascaded through
the whole app. Fixes:

1. **Context value memoized** (`PharmacyContext.tsx`): provider value wrapped in `useMemo` with explicit
   dep list. Previously a fresh object every render → every consumer re-rendered on any state change.
   Biggest win for tab-to-tab navigation.
2. **`useDebounce` hook** (`src/hooks/useDebounce.ts`, new): 250ms debounce applied to the search inputs
   in StockView, SaleView, ScientificsView (search previously re-scanned all 5,600 products per keystroke).
3. **StockView** (`StockView.tsx`): full 12-col table is now VIRTUALIZED via `@tanstack/react-virtual`
   (sticky header, `parentRef` scroll container, `measureElement` rows, ~10-row overscan). Row extracted
   into memoized `StockTableRow` (React.memo + forwardRef). Price-change indicators pre-computed once in a
   `priceChangeInfo` Map keyed by product id instead of inside every row render. Old inline `renderExpiryCell`
   moved into the memoized row.
4. **SaleView** (`SaleView.tsx`): search split so the expensive multi-word/Arabic search only runs on the
   debounced query; cart sorting split out (cart changes no longer re-scan 5,600 products). Product card
   extracted into memoized `ProductCard`. Cart quantities pre-computed in `cartInfoById` Map (no more
   `cart.filter().reduce()` per card per render). 3-column grid VIRTUALIZED (row-virtualized, keyboard
   navigation via `productGridVirtualizer.scrollToIndex`).
5. **ScientificsView** (`ScientificsView.tsx`): drug sidebar list VIRTUALIZED + debounced search.
6. **`@tanstack/react-virtual`** added to dependencies.

Deliberately NOT changed (risk/benefit): `OfflineStorage.saveProducts()` serialization strategy,
granular product-array mutations, and the alert-check effect — these are safe to revisit later.

## What was completed in THIS session (StockView column-alignment fix — NOT committed)
- **Bug**: after virtualization, Stock tab column headers misaligned with body columns. Root cause:
  virtual rows used `position: absolute` on `<tr>`, which turns the row into a block box — the cells no
  longer participate in the table's column layout, so widths collapsed to content and drifted from the
  sticky `<thead>`.
- **Fix**: replaced the `<table>`/`<thead>`/`<tbody>` markup in `StockView.tsx` with a shared CSS grid.
  Both the sticky header row and every virtual row now use the SAME `STOCK_GRID_COLUMNS`
  (`40px 90px 110px minmax(130px,1.6fr) minmax(125px,1.2fr) 120px 105px 115px 75px 100px 100px 105px`)
  so header and body columns are always pixel-aligned. `STOCK_MIN_WIDTH = 1215` wrapped around header +
  body so horizontal scrolling scrolls them together. Cells keep their existing classes (rounded-xl card
  look, teal accent, dark: variants); dropdown of `max-w-[200px]`/`max-w-[120px]` widths moved to the
  grid tracks (`min-w-0 truncate` on presentation/agent cells). Rows still memoized + measured via
  `measureElement`; empty state is a plain div.
- Verified: `npm run lint` GREEN, `npm run test` (8) GREEN, `npm run build` GREEN. Dev server restarted
  on http://localhost:3000 for visual check (5600+ items — confirm every column lines up while scrolling
  and across sort orders).
- Package if satisfied: stop dev server first, then `npm run package-exe`.

## What was completed in THIS session (LBP integer display — NOT committed)
- **Request**: LBP prices shown app-wide must have no dot (.) and no decimals.
- **Fix**: added `formatLBPValue(amount)` to `src/utils/priceUtils.ts`
  (`Math.round(...).toLocaleString('en-US', { maximumFractionDigits: 0 })`). `formatLBP` in
  `PharmacyContext.tsx` now delegates to it, and every direct `.toLocaleString()` on LBP amounts/rates
  was replaced with `formatLBPValue(...)` across the app:
  PharmacyContext, DashboardView, ReportsView, ReceiptModal, SaleView, ViewSaleModal, EditSaleModal,
  SalesTransactionLog, PurchaseView, StockView, CSVImportModal, BulkEditStockModal, MOPHPriceUpdaterModal
  (price cells only — count badges like "3,417 medications fetched" left as counts),
  DrugDetailsModal, PriceUpdaterModal, ScientificsView.
  Exchange-rate displays (1$ = X L.L.) were included for consistency. USD amounts keep `.toFixed(2)`.
- Verified: `npm run lint`, `npm run test` (8), `npm run build` all GREEN. Dev server on
  http://localhost:3000 hot-reloaded — check Stock/Sale/Receipt/Reports show clean integer LBP.

## What was completed in THIS session (data-free installer — NOT committed)
- **Request**: compile the .exe guaranteeing NO pharmacy data or dev leftovers in it; install must be
  data-free.
- **Preflight**: fresh installs already start with zero products (`storage.ts` `getProducts()` returns []
  when the key is absent). `package.json` `build.files` whitelist only packs `dist/**/*`, `main.cjs`,
  `package.json`, `build-data-policy.json` — nothing else can enter the exe. No `.cache/` in repo.
  Verified via asar listing: app.asar contains only dist assets, main.cjs, package.json,
  build-data-policy.json + prod node_modules (code only).
- **Key step**: bumped `build-data-policy.json` buildId from `1788741078920-p2nrmq` (already applied on
  this PC — old marker + IndexedDB/localStorage test data present in `%ProgramData%\Lebanon Pharma Pro`)
  to `1788975841354-hwuqno`, keeping `mode: "fresh"`. First launch of the new build DELETES the whole
  ProgramData app-data folder and creates the new marker → guaranteed data-free install, even over the
  old one.
- Cleanup: stopped dev server (pid was 2860, required for packaging), removed leftover log files
  (`dev-server.log`, `npm-dev.log`, `server-err.log`, `server-out.log`), old `dist/` and `release/`.
- Result: `release\Lebanon Pharma Pro Setup 0.0.0.exe` (123.6 MB, 9/9/2026 8:45 PM). Verified the
  build-data-policy.json inside app.asar carries the new buildId.
- `INITIAL_PRODUCTS` demo constants remain bundled (only used by the in-app "Reset Demo Data" button;
  a fresh install never loads them).

## Where to resume (ideas for next work)
- Test the packaged `.exe` performance end-to-end (build + package-exe) before committing.
- Phase 3 leftovers (medium priority): batch/debounce `OfflineStorage.saveProducts` writes; make
  single-product mutations avoid re-spreading + re-serializing all 5,600 products; throttle the
  `[products]` alert-check effect; `mergeProductsArrays` O(n·m) → index by code.
- Any new synced entity still needs: broadcast on write, incoming-switch case, snapshot payload entry
  (see AGENTS.md "Two-PC sync model").
## What was completed in THIS session (Purchase inputs default to 0 — NOT committed)
- **Request**: "default input should be 0 always" for purchase item quantity and cost inputs.
- **Fix**: Modified `src/components/purchase/PurchaseView.tsx`:
  - Set `itemQty` and `itemCostUSD` `useState` initial values to `'0'`.
  - Updated `placeholder` properties from '10' and '5.00' to '0'.
  - Fixed form reset logic across all three instances (`handleAddItemToInvoice`, `handleOpenCreate`, `handleEditPurchase`) to reset these fields to `'0'`.
  - Fixed fallback parsing in `handleAddItemToInvoice` so that a user entry of `'0'` correctly yields `0`, instead of falling back to a default value (e.g. `1` or `5.00`) due to javascript `||` falsy checks.
- Verified: `npm run lint` and `npm run build` GREEN.
## What was completed in THIS session (dropped MediTrack — NOT committed)
- **Request**: drop all use of `meditrack.moph.gov.lb`; rely only on `moph.gov.lb` for "Update from MOPH".
- **Server** (`server.ts`): removed `/api/moph/authenticate` and `/api/moph/price-catalog` routes, the
  `MOPH_API_BASE` constant, and the MediTrack comment block. The price-list XLS scraping
  (`/api/moph/price-list` → `moph.gov.lb/en/Pages/3/3101/drugs-public-price-list-`) and LNDD ingredient
  lookup (`www.moph.gov.lb/en/Drugs/index/3/4848`) are unchanged and already moph.gov.lb only.
- **Client** (`src/services/mophApiService.ts`): removed `MOPHPriceRecord`, `MOPHAuthResult`,
  `authenticateMOPH`, `fetchMOPHPriceCatalog`, `matchMedicationsToProducts`. Kept `fetchMOPHPriceList`
  + `fetchMOPHLNDDIngredients`.
- **Modal** (`MOPHPriceUpdaterModal.tsx`): credential/login step replaced with a credential-free start
  screen. `handleFetch` now fetches the official price list once, partitions rows into
  matched-in-stock vs importable, and builds matched items (price/margin/agent/name/strength/form)
  straight from the XLS rows — same fields the MediTrack catalog used to provide. Removed username/
  password/save-username state, `Eye/EyeOff/Lock` icons, and the `mophData` catalog record. Re-fetch
  buttons now re-run `handleFetch`.
- **StockView.tsx**: button tooltip now reads "official MOPH price list" instead of "MOPH MediTrack".
- Trade-offs accepted: lose GTIN barcode + prescription flags (never used by the feature) and the
  unmarketed-catalog fallback in imports; stock codes present only in the catalog (not in the marketed
  XLS) no longer match.
- **NEW — password lock on "Update from MOPH"**: the modal now opens on a `locked` step. The password is
  a top-of-file constant `MOPH_UPDATE_PASSWORD = 'pharma2026'` in `MOPHPriceUpdaterModal.tsx` (the value
  the owner edits to set their own password). Wrong password → inline error; correct → proceed to
  `start`. Stepper is hidden while locked. Includes show/hide toggle and Enter-to-submit via `<form>`.
  NOTE: the constant ships in the renderer bundle, so this is a deterrent/soft lock, not real security —
  anyone with the exe can read it from the JS. Not stored anywhere else.
- **NEW — 1-year unlock**: first successful password entry writes `moph_unlock_expires_at` (expiry =
  now + 365d) to localStorage. Modal opens straight to `start` while a future expiry exists (no password
  prompt for 1 year). After expiry, the key is cleared on mount and the lock screen returns; re-entering
  the password starts a fresh 1-year window. Start screen shows "Unlocked — password won't be asked
  again until <date>". Per-PC (localStorage), and a fresh-data wipe (build policy) resets it.
- **NEW — online time for the unlock (no OS clock)**: the PC's local clock is never trusted. Server
  exposes `GET /api/moph/now` → current time fetched from public HTTPS hosts (moph.gov.lb `Date` header,
  fallback cloudflare `/cdn-cgi/trace` `ts=`), cached 60s, `trusted` flag. The modal opens at a
  `checking` step and verifies `moph_unlock_expires_at` against that online timestamp; `handleUnlock`
  also stamps the 1-year window from online time. Fails CLOSED: if no online source is reachable the
  feature stays locked with a "could not verify current time online" message.
- Verified: `npm run lint` GREEN after the 1-year unlock change (HMR clean); after the online-time change
  `npm run lint`/`test`/`build` all GREEN (server restarted — `/api/moph/now` returns trusted online
  time: unixMs=1788995671000 → 09/10/2026 02:14).
- Verified: `npm run lint` GREEN after the lock change (dev server hot-reloaded the modal cleanly).
- Verified: `npm run lint`, `npm run test` (8), `npm run build` all GREEN. No `meditrack` references
  remain in the repo.
