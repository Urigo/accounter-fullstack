import { describe, expect, it } from 'vitest';
import { decodeFilters, encodeFilters } from '@/router/routes.js';
import {
  AccountantStatus,
  ChargeFilterType,
  ChargeSortByField,
  ChargeType,
} from '../../../../gql/graphql.js';
import { buildDefaultFormValues, buildEmptyFormValues } from '../constants.js';
import { countActiveFilters, countEntities } from '../counts.js';
import {
  chargeFilterFormSchema,
  chargeFilterUrlSchema,
  filterToFormValues,
  formValuesToFilter,
  type ChargeFilterFormValues,
} from '../schema.js';

const defaults = buildDefaultFormValues({ adminBusinessId: 'owner-1', withDefaultDateRange: true });

describe('chargeFilterFormSchema', () => {
  /**
   * codegen emits enums with `enumsAsConst`, i.e. plain objects rather than TS native
   * enums. zod 4's `z.enum()` accepts those directly (`z.nativeEnum` is the deprecated
   * spelling), so these assert the schema really validates rather than passing
   * everything through.
   */
  it('accepts the generated enum objects and rejects values outside them', () => {
    const base = buildEmptyFormValues();

    expect(
      chargeFilterFormSchema.safeParse({
        ...base,
        chargesType: ChargeFilterType.Income,
        byChargeTypes: [ChargeType.BankDeposit],
        accountantStatus: [AccountantStatus.Approved],
        sortBy: { field: ChargeSortByField.Amount, asc: true },
      }).success,
    ).toBe(true);

    expect(chargeFilterFormSchema.safeParse({ ...base, chargesType: 'BOGUS' }).success).toBe(false);
    expect(chargeFilterFormSchema.safeParse({ ...base, byChargeTypes: ['NOPE'] }).success).toBe(
      false,
    );
    expect(
      chargeFilterFormSchema.safeParse({ ...base, sortBy: { field: 'NOPE', asc: true } }).success,
    ).toBe(false);
  });

  it('rejects malformed dates and an inverted range', () => {
    const base = buildEmptyFormValues();
    expect(chargeFilterFormSchema.safeParse({ ...base, fromAnyDate: '01/02/2024' }).success).toBe(
      false,
    );
    expect(
      chargeFilterFormSchema.safeParse({
        ...base,
        fromAnyDate: '2024-05-01',
        toAnyDate: '2024-04-01',
      }).success,
    ).toBe(false);
  });

  it('rejects a single-character free text but allows two or none', () => {
    const base = buildEmptyFormValues();
    expect(chargeFilterFormSchema.safeParse({ ...base, freeText: 'a' }).success).toBe(false);
    expect(chargeFilterFormSchema.safeParse({ ...base, freeText: 'ab' }).success).toBe(true);
    expect(chargeFilterFormSchema.safeParse({ ...base, freeText: undefined }).success).toBe(true);
  });
});

describe('filterToFormValues', () => {
  it('ignores nulls rather than letting them clobber a default', () => {
    // JSON-parsed URL payloads carry explicit nulls; a plain spread would wipe the
    // default owner and date range.
    const values = filterToFormValues(
      { byOwners: null, fromAnyDate: null, freeText: 'coffee' },
      defaults,
    );
    expect(values.byOwners).toEqual(['owner-1']);
    expect(values.fromAnyDate).toBe(defaults.fromAnyDate);
    expect(values.freeText).toBe('coffee');
  });

  it('falls back to the defaults when the stored filter is structurally invalid', () => {
    const values = filterToFormValues(
      { chargesType: 'NOT_A_TYPE' } as never,
      defaults,
    );
    expect(values).toEqual(defaults);
  });

  it('keeps a value the option list no longer offers, so chips can still remove it', () => {
    const values = filterToFormValues({ byOwners: ['retired-owner'] }, defaults);
    expect(values.byOwners).toEqual(['retired-owner']);
  });
});

describe('formValuesToFilter', () => {
  const base = buildEmptyFormValues();

  it('drops empty arrays, blank text and false switches', () => {
    // isObjectEmpty treats any defined value as an active filter, so anything "unset"
    // has to collapse to undefined or the trigger badge lights up over nothing.
    const filter = formValuesToFilter({
      ...base,
      byBusinesses: [],
      excludedTags: [],
      freeText: '   ',
      withoutInvoice: false,
    });
    expect(filter.byBusinesses).toBeUndefined();
    expect(filter.excludedTags).toBeUndefined();
    expect(filter.freeText).toBeUndefined();
    expect(filter.withoutInvoice).toBeUndefined();
  });

  it('treats chargesType ALL as no constraint', () => {
    expect(formValuesToFilter({ ...base, chargesType: ChargeFilterType.All }).chargesType).toBeUndefined();
    expect(formValuesToFilter({ ...base, chargesType: ChargeFilterType.Income }).chargesType).toBe(
      ChargeFilterType.Income,
    );
  });

  it('trims free text and carries both include and exclude sides', () => {
    const filter = formValuesToFilter({
      ...base,
      freeText: '  invoice  ',
      excludedFreeText: '  refund  ',
    });
    expect(filter.freeText).toBe('invoice');
    expect(filter.excludedFreeText).toBe('refund');
  });

  it('round-trips the excluded entity lists', () => {
    const values: ChargeFilterFormValues = {
      ...base,
      byBusinesses: ['keep'],
      excludedBusinesses: ['drop'],
      excludedFinancialAccounts: ['acct'],
      excludedTags: ['tag'],
    };
    const filter = formValuesToFilter(values);
    expect(filter.byBusinesses).toEqual(['keep']);
    expect(filter.excludedBusinesses).toEqual(['drop']);
    expect(filter.excludedFinancialAccounts).toEqual(['acct']);
    expect(filter.excludedTags).toEqual(['tag']);
  });
});

describe('counts', () => {
  it('does not count sorting, so a sort-only filter reads as inactive', () => {
    expect(countActiveFilters(buildEmptyFormValues())).toBe(0);
  });

  it('counts included and excluded entities alike', () => {
    expect(
      countEntities({ byBusinesses: ['a', 'b'], excludedBusinesses: ['c'], excludedTags: ['d'] }),
    ).toBe(4);
  });

  it('tolerates the generated filter shape, where every field may be null', () => {
    expect(countActiveFilters({ byBusinesses: null, freeText: null, withoutInvoice: null })).toBe(0);
  });
});

describe('chargeFilterUrlSchema', () => {
  const decode = (filter: Record<string, unknown>) =>
    decodeFilters(encodeFilters(filter), chargeFilterUrlSchema);

  it('reads back the links other screens build (annual audit step 1)', () => {
    const link = {
      byOwners: ['owner-1'],
      fromAnyDate: '2025-01-01',
      toAnyDate: '2025-12-31',
      accountantStatus: [AccountantStatus.Pending, AccountantStatus.Unapproved],
      sortBy: { field: ChargeSortByField.Date, asc: false },
    };
    expect(decode(link)).toEqual(link);
  });

  it('round-trips every field the form applies', () => {
    const filter = formValuesToFilter({
      ...defaults,
      byBusinesses: ['biz-1'],
      excludedTags: ['tag-1'],
      chargesType: ChargeFilterType.Expense,
      byChargeTypes: [ChargeType.Common],
      freeText: 'coffee',
      withoutInvoice: true,
    });
    expect(decode(filter)).toEqual(
      Object.fromEntries(Object.entries(filter).filter(([, value]) => value !== undefined)),
    );
  });

  it('keeps the fields the form does not edit', () => {
    const filter = { fromDate: '2025-01-01', toDate: '2025-02-01', businessTrip: 'trip-1' };
    expect(decode(filter)).toEqual(filter);
  });

  it('drops nulls, and accepts a sort without a direction', () => {
    expect(decode({ freeText: null, sortBy: { field: ChargeSortByField.Date } })).toEqual({
      sortBy: { field: ChargeSortByField.Date },
    });
  });

  it('falls back to no filter on a value the server would reject', () => {
    expect(decode({ fromAnyDate: '2025-13-01' })).toEqual({});
    expect(decode({ chargesType: 'SIDEWAYS' })).toEqual({});
    expect(decode({ accountantStatus: ['MAYBE'] })).toEqual({});
    expect(decode({ byOwners: 'owner-1' })).toEqual({});
    expect(decode({ sortBy: { field: 'COLOR' } })).toEqual({});
  });

  it('does not apply the form-only rules', () => {
    // A one-letter search or an inverted range is a hint in the form, not an invalid filter.
    const filter = { freeText: 'x', fromAnyDate: '2025-12-31', toAnyDate: '2025-01-01' };
    expect(decode(filter)).toEqual(filter);
  });
});
