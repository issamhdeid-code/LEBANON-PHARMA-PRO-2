import { describe, it, expect } from 'vitest';
import { mergeByIdPreferNewer } from './collectionMerge';

type Row = { id: string; timestamp?: number; updatedAt?: number; label?: string };

describe('mergeByIdPreferNewer', () => {
  it('keeps records that exist on only one side, instead of dropping the shorter side', () => {
    // The case a length comparison gets wrong: localStorage holds 2 rows, IndexedDB holds 3,
    // and one of the local rows is absent from IndexedDB. Nothing may be lost.
    const stored: Row[] = [
      { id: 'a', timestamp: 100 },
      { id: 'local-only', timestamp: 500 },
    ];
    const incoming: Row[] = [
      { id: 'a', timestamp: 100 },
      { id: 'b', timestamp: 200 },
      { id: 'c', timestamp: 300 },
    ];

    const { merged } = mergeByIdPreferNewer(stored, incoming);

    expect(merged.map(r => r.id).sort()).toEqual(['a', 'b', 'c', 'local-only']);
  });

  it('does not let an older copy overwrite a newer stored record', () => {
    // Re-importing a stale CSV export must not revert an edit made in the app afterwards.
    const stored: Row[] = [{ id: 'sale-1', timestamp: 500, label: 'edited in app' }];
    const incoming: Row[] = [{ id: 'sale-1', timestamp: 100, label: 'stale export' }];

    const { merged, applied } = mergeByIdPreferNewer(stored, incoming);

    expect(merged[0].label).toBe('edited in app');
    expect(applied).toHaveLength(0);
  });

  it('applies a strictly newer copy and reports it', () => {
    const stored: Row[] = [{ id: 'sale-1', timestamp: 100, label: 'old' }];
    const incoming: Row[] = [{ id: 'sale-1', timestamp: 200, label: 'new' }];

    const { merged, applied } = mergeByIdPreferNewer(stored, incoming);

    expect(merged[0].label).toBe('new');
    expect(applied).toHaveLength(1);
    expect(applied[0].label).toBe('new');
  });

  it('keeps the stored copy on an exact timestamp tie, so re-importing is idempotent', () => {
    const stored: Row[] = [{ id: 'sale-1', timestamp: 100, label: 'stored' }];
    const incoming: Row[] = [{ id: 'sale-1', timestamp: 100, label: 'incoming' }];

    const { merged, applied } = mergeByIdPreferNewer(stored, incoming);

    expect(merged[0].label).toBe('stored');
    expect(applied).toHaveLength(0);
  });

  it('treats a missing timestamp as oldest rather than as a conflict', () => {
    const stored: Row[] = [{ id: 'sale-1', timestamp: 100 }];
    const incoming: Row[] = [{ id: 'sale-1' }];

    expect(mergeByIdPreferNewer(stored, incoming).merged[0].timestamp).toBe(100);
    expect(mergeByIdPreferNewer(incoming, stored).merged[0].timestamp).toBe(100);
  });

  it('reports every genuinely new record as applied', () => {
    const stored: Row[] = [{ id: 'a', timestamp: 100 }];
    const incoming: Row[] = [
      { id: 'a', timestamp: 100 },
      { id: 'b', timestamp: 100 },
      { id: 'c', timestamp: 100 },
    ];

    const { applied } = mergeByIdPreferNewer(stored, incoming);

    expect(applied.map(r => r.id)).toEqual(['b', 'c']);
  });

  it('is stable when replayed, so a repeated import converges', () => {
    const stored: Row[] = [{ id: 'a', timestamp: 100 }];
    const incoming: Row[] = [{ id: 'b', timestamp: 200 }, { id: 'a', timestamp: 50 }];

    const first = mergeByIdPreferNewer(stored, incoming);
    const second = mergeByIdPreferNewer(first.merged, incoming);

    expect(second.merged).toEqual(first.merged);
    expect(second.applied).toHaveLength(0);
  });

  it('converges regardless of which side sends, so two terminals end up agreeing', () => {
    // Regression: the receiving side used to replace unconditionally, so a terminal that
    // already held the newer copy would take the older one off the wire while the sender
    // took the newer one — leaving the two PCs permanently disagreeing. Applying the same
    // recency rule on both sides makes the outcome independent of direction.
    const pc1: Row[] = [{ id: 'a', timestamp: 900, label: 'newer' }];
    const pc2: Row[] = [{ id: 'a', timestamp: 100, label: 'older' }];

    const atPc1 = mergeByIdPreferNewer(pc1, pc2);
    const atPc2 = mergeByIdPreferNewer(pc2, pc1);

    expect(atPc1.merged).toEqual(atPc2.merged);
    expect(atPc1.merged[0].label).toBe('newer');
    expect(atPc2.merged[0].label).toBe('newer');
  });

  it('preserves the stored ordering and appends new records at the end', () => {
    const stored: Row[] = [{ id: 'a', timestamp: 3 }, { id: 'b', timestamp: 2 }];
    const incoming: Row[] = [{ id: 'c', timestamp: 1 }];

    const { merged } = mergeByIdPreferNewer(stored, incoming);

    expect(merged.map(r => r.id)).toEqual(['a', 'b', 'c']);
  });

  it('does not mutate the stored array it was given', () => {
    const stored: Row[] = [{ id: 'a', timestamp: 100, label: 'stored' }];
    const snapshot = JSON.parse(JSON.stringify(stored));

    mergeByIdPreferNewer(stored, [{ id: 'a', timestamp: 900, label: 'new' }, { id: 'b', timestamp: 1 }]);

    expect(stored).toEqual(snapshot);
  });

  it('handles duplicate ids inside the incoming batch by keeping the newest', () => {
    const stored: Row[] = [];
    const incoming: Row[] = [
      { id: 'a', timestamp: 100, label: 'first' },
      { id: 'a', timestamp: 300, label: 'third' },
      { id: 'a', timestamp: 200, label: 'second' },
    ];

    const { merged } = mergeByIdPreferNewer(stored, incoming);

    expect(merged).toHaveLength(1);
    expect(merged[0].label).toBe('third');
  });

  describe('recency reads updatedAt, so an in-app edit still wins', () => {
    it('applies an edit whose timestamp is unchanged but which carries a newer updatedAt', () => {
      // The regression this covers: updateSale keeps the original `timestamp` because that
      // value is the sale's accounting date and must not move when the sale is edited. Under
      // a timestamp-only recency rule the edit tied with the peer's copy, was reported as not
      // applied, and the edit was silently dropped on the second terminal forever.
      const stored: Row[] = [{ id: 'sale-1', timestamp: 1000, label: 'original' }];
      const incoming: Row[] = [{ id: 'sale-1', timestamp: 1000, updatedAt: 5000, label: 'edited in app' }];

      const { merged, applied } = mergeByIdPreferNewer(stored, incoming);

      expect(merged[0].label).toBe('edited in app');
      expect(applied).toHaveLength(1);
    });

    it('leaves the business timestamp alone, so the record keeps its accounting day', () => {
      const stored: Row[] = [{ id: 'sale-1', timestamp: 1000 }];
      const incoming: Row[] = [{ id: 'sale-1', timestamp: 1000, updatedAt: 5000 }];

      expect(mergeByIdPreferNewer(stored, incoming).merged[0].timestamp).toBe(1000);
    });

    it('still refuses a stale export that predates the edit', () => {
      // The property the recency rule exists to protect must survive the new field.
      const stored: Row[] = [{ id: 'sale-1', timestamp: 1000, updatedAt: 5000, label: 'edited in app' }];
      const incoming: Row[] = [{ id: 'sale-1', timestamp: 1000, label: 'stale export' }];

      const { merged, applied } = mergeByIdPreferNewer(stored, incoming);

      expect(merged[0].label).toBe('edited in app');
      expect(applied).toHaveLength(0);
    });

    it('keeps the stored copy when updatedAt ties, so replaying an import is idempotent', () => {
      const stored: Row[] = [{ id: 'sale-1', timestamp: 1000, updatedAt: 5000, label: 'stored' }];
      const incoming: Row[] = [{ id: 'sale-1', timestamp: 1000, updatedAt: 5000, label: 'incoming' }];

      const { merged, applied } = mergeByIdPreferNewer(stored, incoming);

      expect(merged[0].label).toBe('stored');
      expect(applied).toHaveLength(0);
    });

    it('lets a later edit win over an earlier one', () => {
      const stored: Row[] = [{ id: 'sale-1', timestamp: 1000, updatedAt: 5000, label: 'first edit' }];
      const incoming: Row[] = [{ id: 'sale-1', timestamp: 1000, updatedAt: 9000, label: 'second edit' }];

      expect(mergeByIdPreferNewer(stored, incoming).merged[0].label).toBe('second edit');
    });

    it('lets the copy whose content was written later win, whoever wrote it', () => {
      // `updatedAt ?? timestamp` is "when this record's content was last written", and an
      // edit time and a creation time are both wall-clock, so they are directly comparable.
      // The stored copy was edited at 5000; the incoming one was merely created at 4000 and
      // never edited, so the edit is the more recent write and must survive.
      const stored: Row[] = [{ id: 'sale-1', timestamp: 1000, updatedAt: 5000, label: 'edited' }];
      const incoming: Row[] = [{ id: 'sale-1', timestamp: 4000, label: 'created later but never edited' }];

      expect(mergeByIdPreferNewer(stored, incoming).merged[0].label).toBe('edited');
    });

    it('lets a genuinely later creation displace an older untouched record', () => {
      const stored: Row[] = [{ id: 'sale-1', timestamp: 1000, label: 'older' }];
      const incoming: Row[] = [{ id: 'sale-1', timestamp: 9000, label: 'later' }];

      expect(mergeByIdPreferNewer(stored, incoming).merged[0].label).toBe('later');
    });

    it('converges whichever terminal applies the edit', () => {
      const pc1: Row[] = [{ id: 'a', timestamp: 1000, updatedAt: 5000, label: 'newer' }];
      const pc2: Row[] = [{ id: 'a', timestamp: 1000, label: 'older' }];

      const atPc1 = mergeByIdPreferNewer(pc1, pc2);
      const atPc2 = mergeByIdPreferNewer(pc2, pc1);

      expect(atPc1.merged).toEqual(atPc2.merged);
      expect(atPc1.merged[0].label).toBe('newer');
      expect(atPc2.merged[0].label).toBe('newer');
    });
  });
});
