import { describe, expect, it } from 'vitest';
import { buildChargeFilters, chargeFiltersInput } from '../charge-filters.js';

/**
 * The `excluded*` predicates reach the model through the shared charge-filter shape.
 * They spent a release in `UNSUPPORTED_UPSTREAM_CHARGE_FILTER_FIELDS` because upstream
 * accepted and ignored them; now that the SQL exists they are exposed, and the two
 * halves that could silently regress are the zod shape accepting them and
 * `buildChargeFilters` forwarding them.
 */
const SCOPE = ['owner-1'] as const;

describe('charge filter exclusions', () => {
  it('accepts the excluded predicates on the shared input shape', () => {
    const parsed = chargeFiltersInput.safeParse({
      excludedBusinesses: ['biz-2'],
      excludedFinancialAccounts: ['account-2'],
      excludedTags: ['tag-2'],
      excludedFreeText: 'refund',
    });
    expect(parsed.success).toBe(true);
  });

  it('forwards each exclusion to the upstream filter', () => {
    const filters = buildChargeFilters(
      {
        excludedBusinesses: ['biz-2'],
        excludedFinancialAccounts: ['account-2'],
        excludedTags: ['tag-2'],
        excludedFreeText: 'refund',
      },
      SCOPE,
    );
    expect(filters).toMatchObject({
      excludedBusinesses: ['biz-2'],
      excludedFinancialAccounts: ['account-2'],
      excludedTags: ['tag-2'],
      excludedFreeText: 'refund',
    });
  });

  it('carries include and exclude sides together for "mentions X but not Y"', () => {
    const filters = buildChargeFilters(
      { freeText: 'invoice', excludedFreeText: 'refund', byTags: ['a'], excludedTags: ['b'] },
      SCOPE,
    );
    expect(filters.freeText).toBe('invoice');
    expect(filters.excludedFreeText).toBe('refund');
    expect(filters.byTags).toEqual(['a']);
    expect(filters.excludedTags).toEqual(['b']);
  });

  it('omits the exclusion keys entirely when unused', () => {
    const filters = buildChargeFilters({ byTags: ['a'] }, SCOPE);
    expect(filters).not.toHaveProperty('excludedBusinesses');
    expect(filters).not.toHaveProperty('excludedFinancialAccounts');
    expect(filters).not.toHaveProperty('excludedTags');
    expect(filters).not.toHaveProperty('excludedFreeText');
  });

  // Same floor as `freeText` — a single character is a near-match-everything scan.
  it('holds excluded free text to the same minimum length as freeText', () => {
    expect(chargeFiltersInput.safeParse({ excludedFreeText: 'a' }).success).toBe(false);
    expect(chargeFiltersInput.safeParse({ excludedFreeText: 'ab' }).success).toBe(true);
  });

  // The shared array helper preprocesses `[]` to absent, so an empty exclusion never
  // becomes a predicate. Exercised through parse-then-build, which is the real path:
  // `[]` is truthy, so the builder alone would forward it (true of the positive
  // twins too — zod is what normalizes it away).
  it('treats an empty exclusion array as an omitted predicate', () => {
    const parsed = chargeFiltersInput.parse({ excludedTags: [], excludedBusinesses: [] });
    expect(parsed.excludedTags).toBeUndefined();
    expect(parsed.excludedBusinesses).toBeUndefined();

    const filters = buildChargeFilters(parsed, SCOPE);
    expect(filters).not.toHaveProperty('excludedTags');
    expect(filters).not.toHaveProperty('excludedBusinesses');
  });
});
