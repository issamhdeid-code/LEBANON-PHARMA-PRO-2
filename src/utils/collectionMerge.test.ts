import { describe, it, expect } from 'vitest';
import { mergeByIdPreferNewer } from './collectionMerge';

type Row = { id: string; timestamp?: number; label?: string };

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
});
