# AGENTS.md â€” Lebanon Pharma Pro operational conventions

> If this file exists, agents MUST follow it. User instructions override it.

## 1. System model: one authoritative Main + one live Secondary
- The MAIN PC owns the data: it runs the Express + Socket.IO server
  (server.ts, port 3000, bound 0.0.0.0) and its storage is the snapshot source.
  The SECONDARY PC is a live replica that pulls a full snapshot on connect and
  applies broadcast mutations in real time.
- Storage is LOCAL-FIRST on every terminal: in-memory cache is the read source,
  localStorage (via OfflineStorage) is the boot cache, IndexedDB is the full
  catalog backup. Never bypass OfflineStorage/indexedDbStorage for writers.
- Not a single core flow may block on the peer or the server: a terminal must
  keep selling while the LAN link is down (offline retry queue, capped at 500,
  flushed on reconnect).

## 2. Pairing & sync security (IP-only, no shared key)
- Pairing a Secondary PC needs ONLY the Main PC's IP address, entered in
  Settings â†’ Network & Sync. There is NO shared key, sync secret, or provisioning
  endpoint â€” do not reintroduce one.
- The LAN surface is still kept in a locked envelope; never weaken these:
  - Host-header allow-list (localhost + this machine's own IPv4s + *.run.app)
    on the HTTP API â†’ blocks DNS rebinding.
  - Socket.IO origin allow-list matching the host allow-list.
  - SYNC_PROTOCOL_VERSION checked on every inbound mutation (server-side and in
    syncEngine); unknown/foreign protocol payloads are dropped.
  - Timer-based rate limits on all public-data and AI proxy routes.
- Trade-off (accepted): any device already on the LAN can join the ring or call
  the rate-limited /api/moph/* and /api/scientifics/enrich routes. Off-LAN access
  is still refused by the allow-lists above.

## 3. Adding a new synced entity (mandatory checklist)
1. Add OfflineStorage get/save pair in storage.ts.
2. syncEngine.broadcast('ENTITY_UPSERT'|'ENTITY_DELETED', payload) on every write.
3. Register the type in:
   - KNOWN_SYNC_TYPES whitelist in server.ts (unknown relay types are dropped),
   - the SyncPayload union in src/services/syncEngine.ts,
   - an onSyncUpdate `case` in PharmacyContext.tsx applying to state + storage,
   - the snapshot request/response payload in PharmacyContext.tsx (snapshot area).
4. Version-compare merges (Product.version); never merge by array length or
   `res.length + 1` id/invoice counters (use nextInvoiceNumber).

## 4. Internet-dependent features (online-only, never block the POS)
The core (sales, stock, customers, purchases, reports) must work fully offline.
Online features are extensions:
- MOPH official price list (`/api/moph/price-list`, scraped WebMarketed XLS)
- LNDD ingredient lookup (`/api/moph/lndd-ingredients`, disk-cached)
- Gemini drug monographs (`/api/scientifics/enrich`, requires GEMINI_API_KEY
  on the SERVER only â€” .env, never in renderer or bundled code)
- Google Drive backup (user-provided OAuth client ID)
- Trusted online time (`/api/moph/now`) for the 1-year MOPH unlock â€” fails
  CLOSED, never trust the local clock.
Rules: all external calls are server-side proxies (renderer never fetches
MOPH/Google/Gemini directly beyond the Drive OAuth flow); respect the rate
limits, politeness delays and caches (6h price list, 60s trusted time, disk
LNDD); on any error/timeout degrade gracefully with a fallback message and never
throw into the checkout path.

## 5. Critical Path Protection
These files are the sync critical path â€” do NOT modify unless the task is
specifically about them, and require explicit user approval: PharmacyContext.tsx,
syncEngine.ts, storage.ts, indexedDbStorage.ts, and server.ts (sync/handshake/
security sections).

## 6. Testing & non-regression discipline
- NON-REGRESSION GUARANTEE â€” applies to EVERY code change, no exceptions:
  adding, removing, or modifying an option, feature, button, or function must
  never break any other option/feature/button/function.
- PROPORTIONAL VERIFICATION (speed-aware): never run the full test battery
  after every single edit. Spend verification time proportional to the change:
  1. Map every affected surface: the edited code's callers and callees, shared
     state/context, sync broadcasts, and every UI/feature that consumes the
     touched data or props.
  2. After EVERY change, run `npm run lint` (tsc --noEmit) â€” fast and
     MANDATORY â€” plus any quick targeted check that fits the change (unit test,
     spot-check in the running app).
  3. Full gates per completed task: `npm run lint` + `npm run test` (vitest) IN
     PARALLEL in one message, then `npm run build` last â€” always when the change
     touches UI flows or shared data (stock, sales/checkout, purchases,
     customers, scientifics, reports, settings, sync). For small isolated
     changes that pass fast checks, defer the heavy gates to the task's final
     run.
- FULL-WALKTHROUGH REQUIRES APPROVAL: never run the Puppeteer full-walkthrough
  automatically â€” ALWAYS ask the user first, wait for explicit go-ahead, and
  report the pass/fail result (and any break) after it finishes.
- IF ANYTHING IS BROKEN: stop and escalate â€” run the quick tests needed to
  confirm and scope the break, then REPORT to the user with a clear
  recommendation of the required fix, and let the user decide what to do next.
  If the full harness would help confirm the break, ask the user before running
  it. Never silently work around a known break and never claim a pass that did
  not happen.
- Where automated coverage cannot reach a feature, manually verify that feature
  AND its neighbors still work. "It compiles" is never proof.
- VERIFY-THEN-REPORT GATE â€” every completed task ends with a report that
  includes the verification evidence actually run (e.g. the `npm run lint`
  result, targeted test output, spot-check note), never just an assertion of
  success. If a gate was skipped, say so and why. Reports must not contain
  claims the gates did not produce.
- Puppeteer E2E harness lives in tests/*.js (e.g. tests/full-walkthrough.js:
  boots its OWN server on port 3456; pass/fail exit code). NEVER touch the dev
  server and NEVER modify server.ts for tests. Port 3000 is dev-only.
- Node version in use: v24.20.0. Dev server: `npm run dev` only; verify
  http://localhost:3000 before claiming "app running".

## 7. Packaging & deployment
- Data-free installer: bump buildId in build-data-policy.json (mode "fresh") so
  first launch wipes ProgramData app-data. Only dist/**/*, main.cjs, package.json,
  build-data-policy.json + prod deps ship in the exe.
- main.cjs verifies /api/health fingerprint before loadURL and applies the
  data-policy wipe once per deliberately-bumped buildId (state file lives in
  appData, outside the wiped folder).
- `npm run package-exe` requires the dev server STOPPED (EPERM lock on port 3000).

## 8. Git workflow
- Commit per feature/fix with a descriptive message. Never auto-push; push only
  when asked. Never amend, rebase, reset --hard, or force-push.
- Multi-tool handoff: `git pull` + clean `git status` BEFORE editing; the remote
  is the single source of truth. WORKLOG.md is write-only from opencode unless
  the user explicitly asks. Line endings are normalized by .gitattributes â€”
  stop and inspect if a push shows a full-file diff.

## 9. Code output standards
- TypeScript strict, React 19 functional components, Tailwind only. Full relative
  imports (no @/ aliases). No comments unless asked. No README creation.
- Formatting invariants: LBP amounts as integer strings via formatLBPValue (no
  dot/decimals), USD with .toFixed(2). Products carry version for sync merges;
  scientificInfo compaction is handled by compactProductsForStorage â€” do not
  inline.

## 10. UI/UX engineering (pharmacy product rules)
- Hardware barcode scanners type text + Enter (useBarcodeScanner.ts: cooldown,
  human-Enter rejection, buffer cap). Enter must never submit a form from a
  non-checkout field; after a code matches, the scan field resets and regains
  focus for continuous hand-scanning.
- Persistent sync status pill (Connected green / Connecting amber / Offline red,
  distinct error state). Show field-level lock cues while the other terminal
  edits the same item. Keep an unambiguous Offline / Local Mode marker when
  disconnected.
- High-density layouts: compact spacing (p-1/p-2/gap-1/gap-2), typography only
  text-xs/sm/base, tight but readable line-heights (leading-tight/normal).
- Keyboard-first: visible focus rings (focus:ring-2 focus:ring-primary
  focus:outline-none) on every interactive element; keyboard hooks for Enter,
  Tab/Arrows, and F1-F12 module shortcuts.
- High-contrast semantic colors only: harsh red (text-red-600/bg-red-50) for
  expiry/critical/narcotics warnings, amber for restock/controlled substances,
  emerald/blue for active prescriptions/normal states; font-bold/semibold on
  dosages, drug names, allergies, and stock alerts.

## 11. Execution style
- Read before edit; no hallucinated file contents; no apologies; ask when
  uncertain. Batch independent tool calls in one message; token economy: read
  only target-referenced files. Independent gates run in parallel; verify before
  claiming success.
- ASSUMPTION LIST â€” any fact not just verified with a tool (external behavior,
  unread file contents, guessed directory structure, third-party API shape) must
  be labeled *assumed* in the final report; only tool-verified facts may be
  stated as fact. When a load-bearing assumption is unavoidable, state it BEFORE
  implementing so the user can correct it early.

## 12. Verification truth-checks (anti-hallucination)
- MEASURE, DON'T THEORIZE: when a coordinate/geometry/zoom/behavior claim is in
  doubt, get numbers from the page first. A suspicious measurement supersedes
  any amount of reasoning; an impossible number (e.g. a > innerWidth offset)
  is a measurement artifact — re-derive it from a clean reload + real input,
  never debug the math in your head.
- REAL-INPUT BIAS: for anything geometric or behavioral, reproduce with the
  real cursor/browser mouse (browser.hover/click over fresh refs on a clean
  reload), not only synthetic dispatched events — a synthetic event path can
  silently use stale or wrong-space coordinates and "verify" a lie.
- ZOOM STAYS APP-OWNED: the app applies documentElement.style.zoom from
  settings.appZoom on boot. Changing zoom mid-session (style.zoom flips +
  reload) produces frozen innerWidth and garbage offsets — never treat those
  as real data. Set the settings key, do a FULL reload so the app boots at
  that zoom, then measure.
- NEVER GUESS STORAGE KEYS: enumerate localStorage (Object.keys) first and
  read the real settings key (e.g. pharmalebanon_settings_v1.appZoom) before
  assuming or writing one. Same for any localStorage flag: enumerate before
  activate.
- COMMIT, THEN PROVE IT LANDED: git log only says a commit was created.
  To claim a fix is committed, run git show HEAD:<file> and confirm the
  intended lines are present. Claims of "committed" or "verified" must be
  tool-verified, not inferred.
- LABEL ASSUMED vs VERIFIED in every report, and say which gates produced
  each claim (lint / test / build / live preview / e2e). A claim with no
  gate behind it is an assumption; say so explicitly.

