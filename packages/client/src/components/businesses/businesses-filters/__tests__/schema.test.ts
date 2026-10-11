import { describe, expect, it } from 'vitest';
import { decodeFilters, encodeFilters, normalizeFilter } from '@/router/routes.js';
import {
  businessesPageFilterSchema,
  countActiveFilters,
  filterToFormValues,
  formValuesToFilter,
  hasActiveFilters,
  NONE_OPTION_VALUE,
  toServerFilter,
  type BusinessesPageFilter,
} from '../schema.js';

const TAX_CATEGORY_1 = '0a7c6c3e-1111-4f1a-9a55-1b2c3d4e5f60';
const TAX_CATEGORY_2 = '0a7c6c3e-2222-4f1a-9a55-1b2c3d4e5f60';

const FULL_FILTER: BusinessesPageFilter = {
  name: 'acme',
  taxCategoryIds: [TAX_CATEGORY_1, TAX_CATEGORY_2],
  withoutTaxCategory: true,
  sortCodes: [100, 200],
  withoutSortCode: true,
  countries: ['ISR'],
  isClient: false,
  isActive: true,
  isAdmin: false,
  unusedOnly: true,
};

const parseBusinessesFilterParam = (param: string | null) =>
  decodeFilters(param, businessesPageFilterSchema);

describe('decoding the businesses filter param', () => {
  it('round-trips a filter through its URL encoding', () => {
    expect(parseBusinessesFilterParam(encodeFilters(FULL_FILTER))).toEqual(FULL_FILTER);
  });

  it('reads a missing parameter as no filter', () => {
    expect(parseBusinessesFilterParam(null)).toEqual({});
  });

  it('falls back to no filter on malformed or mistyped input', () => {
    expect(parseBusinessesFilterParam('%7Bnot-json')).toEqual({});
    expect(parseBusinessesFilterParam(encodeURIComponent('[1,2]'))).toEqual({});
    expect(parseBusinessesFilterParam(encodeFilters({ sortCodes: ['abc'] }))).toEqual({});
    expect(parseBusinessesFilterParam(encodeFilters({ countries: ['Israel'] }))).toEqual({});
    expect(parseBusinessesFilterParam(encodeFilters({ taxCategoryIds: ['tc-1'] }))).toEqual({});
  });

  it('ignores nulls and unknown keys', () => {
    expect(
      parseBusinessesFilterParam(encodeFilters({ isClient: null, isActive: true, page: 3 })),
    ).toEqual({ isActive: true });
  });
});

describe('form mapping', () => {
  it('round-trips every dialog field', () => {
    const { name: _name, ...dialogFields } = FULL_FILTER;
    expect(normalizeFilter(formValuesToFilter(filterToFormValues(FULL_FILTER)))).toEqual(
      dialogFields,
    );
  });

  it('puts the "none" options in the selects, and back into their flags', () => {
    const values = filterToFormValues({ withoutTaxCategory: true, sortCodes: [100] });
    expect(values.taxCategories).toEqual([NONE_OPTION_VALUE]);
    expect(values.sortCodes).toEqual(['100']);

    expect(
      formValuesToFilter({ taxCategories: [NONE_OPTION_VALUE, 'tc-1'], sortCodes: [NONE_OPTION_VALUE] }),
    ).toMatchObject({
      taxCategoryIds: ['tc-1'],
      withoutTaxCategory: true,
      sortCodes: undefined,
      withoutSortCode: true,
    });
  });

  it('collapses every unset state to undefined, but keeps a tri-state "No"', () => {
    const filter = normalizeFilter(
      formValuesToFilter({ taxCategories: [], countries: [], unusedOnly: false, isClient: false }),
    );
    expect(filter).toEqual({ isClient: false });
    expect(normalizeFilter(formValuesToFilter({}))).toEqual({});
    expect(encodeFilters(normalizeFilter(formValuesToFilter({})))).toBeNull();
  });
});

describe('countActiveFilters', () => {
  it('counts each selected option and each set flag, but not the name search', () => {
    // 2 tax categories + none, 2 sort codes + none, 1 country, 3 tri-states, unused only
    expect(countActiveFilters(FULL_FILTER)).toBe(11);
    expect(countActiveFilters({ name: 'acme' })).toBe(0);
    expect(countActiveFilters({})).toBe(0);
  });

  it('counts a tri-state "No" as active', () => {
    expect(countActiveFilters({ isActive: false })).toBe(1);
  });
});

describe('hasActiveFilters', () => {
  it('includes the name search, ignoring blanks', () => {
    expect(hasActiveFilters({ name: 'acme' })).toBe(true);
    expect(hasActiveFilters({ name: '  ' })).toBe(false);
    expect(hasActiveFilters({ isClient: false })).toBe(true);
    expect(hasActiveFilters({})).toBe(false);
  });
});

describe('toServerFilter', () => {
  it('strips the browser-only unusedOnly flag', () => {
    const { unusedOnly: _unusedOnly, ...serverFields } = FULL_FILTER;
    expect(toServerFilter(FULL_FILTER)).toEqual(serverFields);
  });
});
