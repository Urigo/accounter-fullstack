import type { Injector } from 'graphql-modules';
import { describe, expect, it, vi } from 'vitest';
import { BusinessesProvider } from '../../providers/businesses.provider.js';
import { TaxCategoriesProvider } from '../../providers/tax-categories.provider.js';
import { taxCategoriesResolvers } from '../tax-categories.resolver.js';

/**
 * `TaxCategory` scalar field mappings.
 *
 * The parent here is a `financial_entities` row joined with `tax_categories`, so
 * every field whose GraphQL name differs from its column name needs an explicit
 * mapping. `TaxCategory` cannot spread `commonFinancialEntityFields` the way
 * `LtdFinancialEntity` does — that map is typed against the business row — so
 * the mappings are hand-written and a missing one fails silently: GraphQL's
 * default resolver looks for `parent.irsCode`, finds nothing on a snake_case
 * row, and serves `null` forever. `irsCode` shipped that way.
 */

const ROW = {
  id: 'cc000000-0000-4000-8000-000000000001',
  owner_id: 'bb000000-0000-4000-8000-000000000001',
  name: 'Some Tax Category',
  irs_code: 310,
  sort_code: 100,
  type: 'tax_category',
  created_at: new Date('2024-01-01T00:00:00Z'),
  updated_at: new Date('2024-06-01T00:00:00Z'),
  is_active: true,
  hashavshevet_name: 'HASH',
  tax_excluded: true,
} as const;

/**
 * The generated `Resolver` type is a union of a plain function and a
 * `{ resolve }` object, so a registered field cannot be called directly. Unwrap
 * whichever form it is rather than casting the union away, which would let a
 * resolver silently change shape without this test noticing.
 */
function resolveField(field: string, parent: unknown, context: unknown = {}): unknown {
  const resolvers = taxCategoriesResolvers.TaxCategory as Record<string, unknown>;
  const resolver = resolvers[field];
  if (!resolver) {
    throw new Error(`TaxCategory.${field} has no resolver — the default one would serve null`);
  }
  const resolve = typeof resolver === 'function' ? resolver : (resolver as { resolve: unknown }).resolve;
  return (resolve as (parent: unknown, args: unknown, context: unknown, info: unknown) => unknown)(
    parent,
    {},
    context,
    {},
  );
}

describe('TaxCategory field mappings', () => {
  it.each([
    ['id', ROW.id],
    ['ownerId', ROW.owner_id],
    ['name', ROW.name],
    ['irsCode', ROW.irs_code],
    ['createdAt', ROW.created_at],
    ['updatedAt', ROW.updated_at],
    ['isActive', true],
    ['taxExcluded', true],
  ])('resolves %s off the row', (field, expected) => {
    expect(resolveField(field, ROW)).toStrictEqual(expected);
  });

  it('defaults isActive to true when the column is null', () => {
    expect(resolveField('isActive', { ...ROW, is_active: null })).toBe(true);
  });

  it('reports taxExcluded as a boolean even when the column is null', () => {
    expect(resolveField('taxExcluded', { ...ROW, tax_excluded: null })).toBe(false);
  });

  it('serves a null irsCode rather than undefined', () => {
    expect(resolveField('irsCode', { ...ROW, irs_code: null })).toBeNull();
  });
});

/**
 * `TaxCategory.businesses` — the businesses this category is the default for.
 *
 * The two loaders it spans fail in different shapes: the match loader rejects,
 * but `loadMany` turns a rejected business batch into per-key `Error` values
 * rather than throwing. Filtering those out alongside the genuine misses would
 * dress a database outage up as "no businesses use this default".
 */

const BUSINESS = { id: 'aa000000-0000-4000-8000-000000000001', name: 'Some Business' };

function contextWith(businessIds: string[], loadManyResult: unknown[]) {
  const load = vi.fn().mockResolvedValue(businessIds);
  const loadMany = vi.fn().mockResolvedValue(loadManyResult);
  const injector = {
    get: (token: unknown) => {
      if (token === TaxCategoriesProvider) {
        return { businessIdsByTaxCategoryIdLoader: { load } };
      }
      if (token === BusinessesProvider) {
        return { getBusinessByIdLoader: { loadMany } };
      }
      throw new Error('unexpected provider requested');
    },
  } as unknown as Injector;
  return { context: { injector }, load, loadMany };
}

describe('TaxCategory.businesses', () => {
  it('returns the matched business rows', async () => {
    const { context } = contextWith([BUSINESS.id], [BUSINESS]);

    await expect(resolveField('businesses', ROW, context)).resolves.toStrictEqual([BUSINESS]);
  });

  it('skips a match row whose business row is gone', async () => {
    const { context } = contextWith([BUSINESS.id, 'missing'], [BUSINESS, undefined]);

    await expect(resolveField('businesses', ROW, context)).resolves.toStrictEqual([BUSINESS]);
  });

  it('throws when the business batch failed instead of reporting an empty list', async () => {
    const { context } = contextWith([BUSINESS.id], [new Error('connection terminated')]);

    await expect(resolveField('businesses', ROW, context)).rejects.toThrow(
      /Failed to load businesses of tax category/,
    );
  });

  it('does not query businesses when nothing matches', async () => {
    const { context, loadMany } = contextWith([], []);

    await expect(resolveField('businesses', ROW, context)).resolves.toStrictEqual([]);
    expect(loadMany).not.toHaveBeenCalled();
  });
});
