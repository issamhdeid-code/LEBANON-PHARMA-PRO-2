import { describe, it, expect } from 'vitest';
import { mergeProductsArrays } from './productMerge';
import { Product, ProductTombstone } from '../types/pharmacy';

function prod(id: string, version: number, extra: Partial<Product> = {}): Product {
  return {
    id,
    code: id.toUpperCase(),
    name: `Product ${id}`,
    version,
    ...extra,
  } as Product;
}

function tomb(id: string, version: number): ProductTombstone {
  return { id, version } as ProductTombstone;
}

describe('mergeProductsArrays', () => {
  it('keeps products that exist on only one side instead of dropping the shorter side', () => {
    const local = [prod('a', 1), prod('local-only', 1)];
    const remote = [prod('a', 1), prod('b', 1), prod('c', 1)];

    const { merged } = mergeProductsArrays(local, remote);

    expect(merged.map(p => p.id).sort()).toEqual(['a', 'b', 'c', 'local-only']);
  });

  it('lets the higher version win for a shared id', () => {
    const local = [prod('a', 5, { name: 'local v5' })];
    const remote = [prod('a', 3, { name: 'remote v3' })];

    const { merged } = mergeProductsArrays(local, remote);

    expect(merged[0].name).toBe('local v5');
  });

  it('adopts the higher version coming from the other side', () => {
    const local = [prod('a', 2, { name: 'local v2' })];
    const remote = [prod('a', 7, { name: 'remote v7' })];

    const { merged, changed } = mergeProductsArrays(local, remote);

    expect(merged[0].name).toBe('remote v7');
    expect(changed).toBe(true);
  });

  it('never resurrects a deleted product from a stale copy', () => {
    const local: Product[] = [];
    const remote = [prod('gone', 2)];

    const { merged, changed } = mergeProductsArrays(local, remote, [tomb('gone', 2)]);

    // The tombstone suppresses the incoming copy, so the local list is untouched and
    // `changed` correctly stays false — the local side had nothing to lose.
    expect(merged).toHaveLength(0);
    expect(changed).toBe(false);
  });

  it('reports a change when a tombstone strips a product the local side was holding', () => {
    const local = [prod('gone', 1), prod('kept', 1)];
    const remote: Product[] = [];

    const { merged, changed } = mergeProductsArrays(local, remote, [tomb('gone', 4)]);

    expect(merged.map(p => p.id)).toEqual(['kept']);
    expect(changed).toBe(true);
  });

  it('keeps a product whose version is higher than the tombstone', () => {
    const local = [prod('back', 9)];
    const remote: Product[] = [];

    const { merged } = mergeProductsArrays(local, remote, [tomb('back', 3)]);

    expect(merged.map(p => p.id)).toEqual(['back']);
  });

  it('ignores the oldest tombstone when several exist for one id', () => {
    const local = [prod('x', 1)];
    const remote: Product[] = [];

    const { merged } = mergeProductsArrays(local, remote, [tomb('x', 7), tomb('x', 2)]);

    expect(merged).toHaveLength(0);
  });

  it('replaces the matched row when the same code arrives under a new id', () => {
    // Regression: the code fallback used to store the incoming product under its own id
    // while leaving the row it matched in place, leaving two catalog rows on one code.
    const local = [prod('old-id', 1, { code: 'ABC', name: 'local copy' })];
    const remote = [prod('new-id', 4, { code: 'abc', name: 'remote copy' })];

    const { merged, changed } = mergeProductsArrays(local, remote);

    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe('new-id');
    expect(merged[0].name).toBe('remote copy');
    expect(changed).toBe(true);
  });

  it('keeps the local row when the same code arrives under a new id at a lower version', () => {
    const local = [prod('old-id', 9, { code: 'ABC', name: 'local copy' })];
    const remote = [prod('new-id', 2, { code: 'abc', name: 'remote copy' })];

    const { merged } = mergeProductsArrays(local, remote);

    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe('old-id');
  });

  it('does not re-match a row that a previous displacement already removed', () => {
    // The displaced row must leave the code index too. With a stale index the third
    // product would be compared against the already-removed old-id (version 1) instead of
    // mid-id (version 5), wrongly win, and leave two rows on the same code again. Versions
    // descend here on purpose so the assertion actually distinguishes the two behaviours.
    const local = [prod('old-id', 1, { code: 'ABC', name: 'local copy' })];
    const remote = [
      prod('mid-id', 5, { code: 'ABC', name: 'middle copy' }),
      prod('late-id', 2, { code: 'ABC', name: 'late copy' }),
    ];

    const { merged } = mergeProductsArrays(local, remote);

    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe('mid-id');
  });

  it('leaves genuinely distinct products with different codes alone', () => {
    const local = [prod('a', 1, { code: 'AAA' }), prod('b', 1, { code: 'BBB' })];
    const remote = [prod('c', 1, { code: 'CCC' })];

    const { merged } = mergeProductsArrays(local, remote);

    expect(merged.map(p => p.id).sort()).toEqual(['a', 'b', 'c']);
  });

  it('still merges a shared id without touching any other row', () => {
    const local = [prod('a', 1, { code: 'AAA' }), prod('b', 1, { code: 'BBB' })];
    const remote = [prod('a', 3, { code: 'AAA', name: 'updated' })];

    const { merged } = mergeProductsArrays(local, remote);

    expect(merged).toHaveLength(2);
    expect(merged.find(p => p.id === 'a')?.name).toBe('updated');
    expect(merged.find(p => p.id === 'b')?.name).toBe('Product b');
  });

  it('reports no change when the other side adds nothing new', () => {
    const local = [prod('a', 1), prod('b', 1)];
    const remote: Product[] = [];

    const { merged, changed } = mergeProductsArrays(local, remote);

    expect(changed).toBe(false);
    expect(merged).toHaveLength(2);
  });

  it('treats a missing version as 0', () => {
    const local = [prod('a', 0)];
    const remote = [prod('a', 1)];

    const { merged } = mergeProductsArrays(local, remote);

    expect(merged[0].version).toBe(1);
  });
});
