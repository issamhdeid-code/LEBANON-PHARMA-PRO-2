# AI_STUDIO_BRIEF — coding cheat sheet for Google AI Studio (Gemini)

> Distilled version of `AGENTS.md` for use as the System Instruction / context
> in Google AI Studio. If this repo has changed, re-read `AGENTS.md` first — it
> wins on any conflict.

## Project identity
Lebanon Pharma Pro — two-terminal (LAN, real-time sync) pharmacy management.
React 19 + TypeScript (strict) + Tailwind CSS (no CSS files, no inline style
except layout geometry) + Electron (main.cjs) + Express/Socket.IO backend.
Keyboard-first, high-density, hardware-barcode-scanner UX. Node v24.

- Resume state = `WORKLOG.md`. Read it and `package.json` at session start.
- **Do NOT use `@/` path aliases** even if tsconfig defines one — full relative
  imports only (`../../hooks/...`).
- No emojis, no placeholder comments, no truncated code.
- Exit-code discipline: any edit that doesn't compile or passes no gates = revert.

## CRITICAL-PATH — ask before touching (sync can silently break)
- `src/context/PharmacyContext.tsx`
- `src/services/syncEngine.ts`
- `src/services/storage.ts`
- `src/services/offlineStorage.ts`
Unless the task is explicitly about these, DO NOT modify them. Every other
module is safe.

## Two-PC sync pattern (when adding a synced entity)
1. After local write: `syncEngine.broadcast('ENTITY_UPSERT', entity)` (or
   `'ENTITY_DELETED'`).
2. In `PharmacyContext.tsx` `onSyncUpdate`: add a `case` to receive/apply to
   local state + storage.
3. Include the entity type in the snapshot request/response payload.

## Verification contract (mandatory)
- AFTER EVERY code change: `npm run lint` must pass before proceeding.
- AFTER a completed task: ALL of `npm run lint`, `npm run test`, `npm run build`.
  Any failure = fix before anything else.
- `npm run build` BEFORE running the E2E harness or `npm run package-exe`
  (both consume `dist/`; the harness boots `dist/server.cjs`, not live source).

## Ports & servers
- Dev server (user only): `npm run dev` = http://localhost:3000. Never start it
  for a task; verify before claiming the app runs.
- Puppeteer/E2E harness: `tests/*.js` (plain JS, not TS), own ports 3456+,
  never use port 3000, never modify `server.ts` for tests.
- E2E: `node tests\monthly-usage.js --days 30` (fast: `--fast --days 5`).

## Authentication / data notes
- Main PC seeds admin (`admin`/`admin123`); the SECOND PC signs in as a
  different account (the app blocks one identity on two devices).
- Pairing needs ONLY the Main PC's IP address (Settings → Network & Sync). The
  old shared sync key was removed — no secret to provision or copy.
- localStorage keys: `pharmalebanon_*_v1` (products, sales, purchases, users,
  settings...). E2E harness uses separate browser profiles + virtual clock.
- The MOPH price-list modal is password-locked (`pharma2026`, 1-year unlock).

## Git discipline
- Describe a feature/fix and COMMIT with a descriptive message.
- Never `git commit --amend`, `git rebase`, `git reset --hard`,
  `git push --force`. Push only when the user asks.
- Commits are the ONLY undo available (opencode snapshots are disabled).

## Cross-tool handoff (Gemini ⇄ opencode)
The repo may be edited from two tools. GitHub `main` is the single source of
truth. On every switch:
1. **Pull before you start**: `git pull` and confirm `git status` is clean.
   Never edit against a remote that is ahead.
2. **Edit locally, commit with a descriptive message**, push only when asked.
   The other tool then MUST `git pull` before editing.
3. **Never edit the same file as the other tool at the same time.** Resolve
   conflicts with a normal `git pull` merge — never force-push, never rebase.
4. READ `WORKLOG.md` and `AGENTS.md` at session start but do NOT rewrite them
   (opencode owns those two files — avoids churn/conflicts).
5. If you touch a critical-path file (see section above), SAY SO explicitly —
   the other side must re-verify sync before committing further work.
- Never hand-edit `.gitattributes` (it normalizes line endings for both tools).

## When in doubt
- Ask the user rather than guessing.
- Never create README/*.md docs unless explicitly asked.
- Never commit `.cache/`, secrets, or keys.