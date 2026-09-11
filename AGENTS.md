# AGENTS.md — Lebanon Pharma Pro operational conventions

> If this file exists, agents MUST follow it. If it conflicts with what the user says, follow the user's explicit instruction.

## 1. Agent Identity & Working Directory
- Every session starts by reading `WORKLOG.md` (resume state) and `package.json` (current version/deps/scripts).
- `npm run dev` (NOT `npx vite` or `vite`) is the only way to start the dev server. Verify `http://localhost:3000` responds before claiming "app running."
- Always run commands from the project root. Never `cd` mid-command — use the `workdir` parameter instead.
- **Do NOT use path aliases (`@/`)** even if `tsconfig.json` defines one. Use full relative imports (`../../hooks/...`).

## 2. Testing Discipline
- **After EVERY code change (any block/module/feature):** `npm run lint` (runs `tsc --noEmit`). This is MANDATORY. Only proceed once it passes.
- **After completing a full task:** run ALL of:
  ```
  npm run lint
  npm run test
  npm run build
  ```
  If any fails, fix before doing anything else.
- Do NOT attempt to start a running dev server — check `localhost:3000` first.
- Puppeteer tests live in `tests/*.js` (not `*.ts`); run from project root via `node tests/<name>.test.js`.

## 3. Node Version
- Currently in use: **v24.20.0**.

## 4. Critical Path Protection
- If your task is NOT specifically about refactoring `syncEngine`, `storage.ts`, `offlineStorage.ts`, or `PharmacyContext.tsx` core sync logic, **do NOT modify those modules**. They are critical-path and any unintended side effect can silently break data sync.
- Changes to these files require explicit user approval before implementation.

## 5. Git Workflow
- After completing each feature/fix, commit with a descriptive message:
  ```
  git add .
  git commit -m "descriptive message"
  ```
- Do NOT auto-push to remote. Only push when the user explicitly requests it.
- Never use `git commit --amend`, `git rebase`, `git reset --hard`, or `git push --force`.

## 6. Productivity & Reliability Rules
- **Do NOT hallucinate file contents.** Always read a file before editing it.
- **Do NOT apologize.** Never say sorry, my mistake, or I forgot.
- **Do NOT assume files exist** — always verify before referencing or editing.
- **Do NOT assume a dev server is already running** — verify with `localhost:3000`.
- **Do NOT use stale state** — re-read files before large edits even if recently read.
- **When uncertain, ask the user** rather than guessing.
- **Never create README files** unless explicitly asked.

## 7. Code Output Standards
- Output **complete, production-ready code** — no truncation, no placeholder comments (`// rest goes here`).
- Follow the system instructions for UI density, scanner handling, color safety, and keyboard-first navigation.
- TypeScript strict typing. React 19 functional components. Tailwind CSS only (no separate CSS files, no inline `style` except layout geometry).
- Follow existing code conventions in the file/area you are editing.

## 8. Two-PC Sync Model (reference)
When adding a new synced entity:
1. After writing locally: `syncEngine.broadcast('ENTITY_UPSERT', entity)` or `syncEngine.broadcast('ENTITY_DELETED', { id })`.
2. In the `onSyncUpdate` handler in `PharmacyContext.tsx`: add a `case` to receive and apply the payload to local state + storage.
3. Include the entity type in the snapshot request/response payload (`PharmacyContext.tsx:611`).

## 9. Puppeteer Testing Patterns
- Never use a shared browser instance — each test gets its own.
- Port 3000 is for the Vite dev server only; Puppeteer tests must use separate ports (e.g., 3456+).
- Never modify `server.ts` for tests — tests launch their own Express app.
- Log `page.url()` on failure for debugging.
