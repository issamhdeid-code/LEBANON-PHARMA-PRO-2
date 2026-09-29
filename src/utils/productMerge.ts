import { Product, ProductTombstone } from '../types/pharmacy';

export interface ProductMergeResult {
  merged: Product[];
  changed: boolean;
}

/**
 * Same idea as a plain id merge, but for products specifically, which carry a version
 * number: whichever side has the higher version for a shared id wins, instead of
 * "remote always wins".
 *
 * A deletion tombstone (from the optional third argument) wins over any copy whose version
 * is not higher than the tombstone's, so a product deleted on one PC during an outage can
 * never be resurrected by a stale copy merged back afterwards.
 *
 * Used both for the Main/Secondary snapshot exchange and for boot hydration from IndexedDB,
 * so a product list is never replaced wholesale on the way in.
 */
export function mergeProductsArrays(
  local: Product[],
  remote: Product[],
  tombstones?: ProductTombstone[]
): ProductMergeResult {
  const tombstoneById = new Map<string, ProductTombstone>();
  if (Array.isArray(tombstones)) {
    for (const t of tombstones) {
      const existing = tombstoneById.get(t.id);
      if (!existing || (t.version || 0) > (existing.version || 0)) tombstoneById.set(t.id, t);
    }
  }
  const byId = new Map(local.map(p => [p.id, p]));
  const byCode = new Map<string, Product>();
  for (const p of local) {
    const normalized = String(p.code || '').toUpperCase();
    if (normalized && !byCode.has(normalized)) byCode.set(normalized, p);
  }
  let changed = false;
  for (const remoteProd of remote) {
    const tombstone = tombstoneById.get(remoteProd.id);
    if (tombstone && (remoteProd.version || 0) <= (tombstone.version || 0)) continue;
    let localMatch = byId.get(remoteProd.id);
    if (!localMatch) {
      const normalized = String(remoteProd.code || '').toUpperCase();
      localMatch = normalized ? byCode.get(normalized) : undefined;
    }
    if (!localMatch || (remoteProd.version || 0) >= (localMatch.version || 0)) {
      // A code-based match means the same product turned up under a different id (it was
      // re-created or re-imported on the other PC). The incoming copy is stored under its
      // own id, so the row it matched has to be dropped — otherwise the catalog ends up
      // holding two products that share one code, which double-counts stock and makes
      // barcode scans ambiguous. The code index is pruned alongside it so a later
      // same-code product cannot re-match the row that was just removed.
      if (localMatch && localMatch.id !== remoteProd.id) {
        byId.delete(localMatch.id);
        for (const [code, indexed] of byCode) {
          if (indexed.id === localMatch.id) byCode.delete(code);
        }
      }
      byId.set(remoteProd.id, remoteProd);
      const code = String(remoteProd.code || '').toUpperCase();
      if (code && !byCode.has(code)) byCode.set(code, remoteProd);
      changed = true;
    }
  }
  const merged = Array.from(byId.values());
  const cleaned = tombstoneById.size > 0
    ? merged.filter(p => {
        const t = tombstoneById.get(p.id);
        return !t || (p.version || 0) > (t.version || 0);
      })
    : merged;
  if (cleaned.length !== merged.length) changed = true;
  return { merged: cleaned, changed };
}
