---
name: two-pc-sync
description: 'Use when adding, changing, or debugging LAN sync between the Main PC and Secondary PC(s) in Lebanon Pharma Pro (products/sales/suppliers/customers/purchases/users, login sessions, or the reconnect/reconciliation logic). Covers the checklist for wiring a new synced entity, how snapshot merge-on-reconnect works, and how to test two PCs on one machine.'
---

# Two-PC LAN Sync

See [AGENTS.md](../../../AGENTS.md) for the overall architecture (`server.ts`, `syncEngine.ts`, `PharmacyContext.tsx`). This skill is the procedural detail for working inside that system.

## Mental Model
- The server ([server.ts](../../../server.ts)) is a dumb relay: it forwards `sync_update` broadcasts to other connected sockets and routes snapshot request/response by socket id. It stores nothing itself.
- All real logic lives in `PharmacyContext.tsx`'s sync `useEffect` (search for `connectSyncEngine`): outgoing broadcasts are added at each mutation function (`addX`/`updateX`/`recordX`), incoming messages are handled in one big `if/else` on `payload.type`, and full-state reconciliation happens in the snapshot request/response pair.
- A Secondary always initiates: on every socket `connect` (including auto-reconnects), it emits `request_snapshot` with its own current local data attached. Main merges that data into its own state, then replies with the consolidated result. Secondary merges that reply into its own state too. This is what makes offline-made records on either side survive a reconnect instead of being overwritten — see `mergeById` / `mergeProductsArrays` in `PharmacyContext.tsx`.

## Checklist: Adding Sync Support for a New Entity/Action
Follow the existing pattern for products/sales/suppliers/customers/purchases/users — don't invent a new mechanism.

1. **Broadcast on write** — in the `addX`/`updateX`/`deleteX`/`recordX` function, after `setX(...)` and `OfflineStorage.saveX(...)`, call `syncEngine.broadcast('YOUR_TYPE', payloadData)`. Wrap in `try {} catch (e) {}` (matches existing calls) since it's a best-effort side effect.
2. **Add the payload type** — extend the `SyncPayload['type']` union in [syncEngine.ts](../../../src/services/syncEngine.ts).
3. **Handle it on receipt** — add a branch in the big `if/else` inside `connectSyncEngine`'s `onMessage` callback. Use `mergeById`/`upsertById` helpers already defined in that file rather than writing a new merge strategy.
4. **Include it in the snapshot** — add the array/value to:
   - The `getLocalSnapshot` callback (what a Secondary sends about itself), and
   - The `onSnapshotRequested` handler (what Main merges in + sends back), and
   - The `snapshotData` handler (what Secondary applies from Main's reply).
   All three must agree on the shape, or reconciliation silently drops data.
5. If the entity has a `version`/`updatedAt`-like field, prefer version-aware merging (see `mergeProductsArrays`) over plain `mergeById` (which is "remote wins on id conflict, union otherwise" — fine for mostly-append-only data like sales, weaker for frequently-edited records like customers/suppliers since there's no real last-write-wins there today).

## Known Limitations (don't "fix" silently — flag to the user first)
- No deletion tombstone/log: if a record is deleted on one PC while the other has it locally during an outage, a naive union-merge can resurrect it on reconnect. Current behavior accepts this trade-off in exchange for not losing offline-made records.
- `SaleTransaction`, `PurchaseInvoice`, `Supplier`, `Customer`, `User` have no `updatedAt`/version field, so `mergeById` conflicts (same id edited differently on both sides) always resolve "remote wins" rather than true last-write-wins.
- Login sessions (`activeSessions` map in `PharmacyContext.tsx`) are in-memory only, re-announced on every socket connect — a PC that crashes without a clean disconnect can leave a "ghost" active session until it reconnects or the other side re-announces.

## Testing Two PCs on One Machine
Real hardware isn't required. Browsers treat `localhost` and `127.0.0.1` as different origins (separate `localStorage`), so you can simulate Main + Secondary against the *same* running dev server:

1. `npm run dev`, then open `http://localhost:3000` — this becomes "PC A".
2. Open a second, forced-new browser page at `http://127.0.0.1:3000` — this becomes "PC B" with completely isolated storage.
3. Run the First-Run Setup wizard on PC A as Main; on PC B choose Secondary and enter `localhost:3000` as the Main PC IP.
4. To simulate a network outage: stop the dev server (kills both sockets), make changes on either "PC", then restart `npm run dev` and confirm both sides reconcile (check Settings → Users & Roles for session state, and the relevant list view for data).
5. Remember `PharmacyContext.tsx` edits break Fast Refresh — reload both tabs after any server-side code change, not just the one you're actively testing.
