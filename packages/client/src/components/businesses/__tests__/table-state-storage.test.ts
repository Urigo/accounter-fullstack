import { describe, expect, it } from 'vitest';
import type { ColumnVisibilityState, SortingState } from '@tanstack/react-table';
import { reviveColumnVisibility, reviveSorting } from '../table-state-storage.js';

const SORTING_FALLBACK: SortingState = [];
const VISIBILITY_FALLBACK: ColumnVisibilityState = { name: true, city: false };

describe('reviveSorting', () => {
  it('accepts a well-shaped sorting state', () => {
    const stored = [{ id: 'name', desc: true }];
    expect(reviveSorting(stored, SORTING_FALLBACK)).toEqual(stored);
  });

  it('accepts an empty array', () => {
    expect(reviveSorting([], SORTING_FALLBACK)).toEqual([]);
  });

  it.each([
    ['a non-array', { id: 'name', desc: true }],
    ['null', null],
    ['entries missing desc', [{ id: 'name' }]],
    ['entries with a non-string id', [{ id: 3, desc: true }]],
    ['entries that are not objects', ['name']],
  ])('falls back on %s', (_label, stored) => {
    expect(reviveSorting(stored, SORTING_FALLBACK)).toBe(SORTING_FALLBACK);
  });
});

describe('reviveColumnVisibility', () => {
  it('merges the stored value over the defaults', () => {
    expect(reviveColumnVisibility({ name: false }, VISIBILITY_FALLBACK)).toEqual({
      name: false,
      city: false,
    });
  });

  it('keeps the default for a column added since the value was stored', () => {
    // `city` is absent from the stored value, so it keeps its (hidden) default.
    expect(reviveColumnVisibility({ name: false }, VISIBILITY_FALLBACK)).toEqual({
      name: false,
      city: false,
    });
  });

  it('carries over a stored entry for a column that no longer exists', () => {
    // Harmless: the table ignores visibility entries with no matching column, and keeping the
    // entry means a column that comes back keeps the visibility the user last chose for it.
    expect(reviveColumnVisibility({ gone: true }, VISIBILITY_FALLBACK)).toEqual({
      name: true,
      city: false,
      gone: true,
    });
  });

  it('ignores non-boolean entries', () => {
    expect(reviveColumnVisibility({ name: 'yes', city: true }, VISIBILITY_FALLBACK)).toEqual({
      name: true,
      city: true,
    });
  });

  it.each([
    ['an array', []],
    ['null', null],
    ['a primitive', 'name'],
  ])('falls back on %s', (_label, stored) => {
    expect(reviveColumnVisibility(stored, VISIBILITY_FALLBACK)).toBe(VISIBILITY_FALLBACK);
  });
});
