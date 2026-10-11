import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { areFiltersEqual, decodeFilters, encodeFilters, normalizeFilter } from '../routes.js';

const schema = z.object({
  name: z.string().optional(),
  ids: z.array(z.number().int()).optional(),
  active: z.boolean().optional(),
});

describe('normalizeFilter', () => {
  it('sorts keys and drops unset values, keeping false and 0', () => {
    const normalized = normalizeFilter({
      name: '',
      zero: 0,
      ids: [],
      active: false,
      empty: null,
      missing: undefined,
      list: [1],
    });
    expect(normalized).toEqual({ active: false, list: [1], zero: 0 });
    expect(Object.keys(normalized)).toEqual(['active', 'list', 'zero']);
  });

  it('makes equal filters encode to the same string', () => {
    expect(encodeFilters(normalizeFilter({ name: 'a', active: true }))).toBe(
      encodeFilters(normalizeFilter({ active: true, name: 'a', ids: [] })),
    );
  });
});

describe('areFiltersEqual', () => {
  it('ignores key order and unset values', () => {
    expect(
      areFiltersEqual<Record<string, unknown>>(
        { active: true, name: 'acme', ids: [] },
        { name: 'acme', active: true, other: undefined },
      ),
    ).toBe(true);
    expect(areFiltersEqual({ active: true }, { active: false })).toBe(false);
  });
});

describe('decodeFilters', () => {
  it('round-trips a filter through its URL encoding', () => {
    const filter = { name: 'acme', ids: [1, 2], active: false };
    expect(decodeFilters(encodeFilters(filter), schema)).toEqual(filter);
  });

  it('reads a missing parameter as no filter', () => {
    expect(decodeFilters(null, schema)).toEqual({});
    expect(decodeFilters(undefined, schema)).toEqual({});
    expect(decodeFilters('', schema)).toEqual({});
  });

  it('falls back to no filter on malformed or mistyped input', () => {
    expect(decodeFilters('%7Bnot-json', schema)).toEqual({});
    expect(decodeFilters('%E0%A4%A', schema)).toEqual({});
    expect(decodeFilters(encodeURIComponent('[1,2]'), schema)).toEqual({});
    expect(decodeFilters(encodeURIComponent('"text"'), schema)).toEqual({});
    expect(decodeFilters(encodeFilters({ ids: ['abc'] }), schema)).toEqual({});
  });

  it('ignores nulls, unset values and unknown keys', () => {
    expect(
      decodeFilters(encodeFilters({ name: null, ids: [], active: true, page: 3 }), schema),
    ).toEqual({ active: true });
  });

  it('returns the canonical key order', () => {
    const decoded = decodeFilters(encodeFilters({ name: 'a', active: true }), schema);
    expect(Object.keys(decoded)).toEqual(['active', 'name']);
  });

  it('applies a custom normalizer to the parsed filter', () => {
    expect(
      decodeFilters(encodeFilters({ name: '  acme ' }), schema, filter => ({
        ...filter,
        name: filter.name?.trim(),
      })),
    ).toEqual({ name: 'acme' });
  });
});
