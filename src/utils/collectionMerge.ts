/**
 * Merge helpers for id-keyed record collections (sales, purchases, payments, expenses).
 *
 * These collections are held in three places at once: React state (the read source),
 * localStorage (the boot cache, capped at ~5MB) and IndexedDB (the full catalog backup).
 * Whenever two of them disagree, one has to win — and the choice has to be made per record,
 * never by comparing how many records each side happens to hold. A length comparison silently
 * throws away every record that exists on only the shorter side, which is exactly the data a
 * quota-failed localStorage write was hiding.
 */

export interface MergeResult<T> {
  merged: T[];
  /** The records that were actually added or that displaced the stored copy. */
  applied: T[];
}

/**
 * Unions two collections keyed by `id`. A record only displaces the stored copy when its
 * `timestamp` is strictly newer; otherwise the stored copy is kept.
 *
 * This makes a merge:
 *  - lossless: a record present on only one side is always kept, never dropped;
 *  - monotonic: the same inputs always produce the same output, so replaying an import or
 *    re-running boot hydration is idempotent;
 *  - safe against stale copies: an older export (e.g. a CSV the user re-imports after editing
 *    a record in the app) cannot revert the newer in-app edit.
 *
 * @param stored   the copy currently held by the app
 * @param incoming the copy being merged in
 */
export function mergeByIdPreferNewer<T extends { id: string; timestamp?: number }>(
  stored: T[],
  incoming: T[]
): MergeResult<T> {
  const merged = stored.map(s => s);
  const index = new Map(merged.map((s, i) => [s.id, i]));
  const applied: T[] = [];

  for (const record of incoming) {
    const idx = index.get(record.id);
    if (idx === undefined) {
      index.set(record.id, merged.length);
      merged.push(record);
      applied.push(record);
    } else if ((record.timestamp ?? 0) > (merged[idx].timestamp ?? 0)) {
      merged[idx] = record;
      applied.push(record);
    }
  }

  return { merged, applied };
}
