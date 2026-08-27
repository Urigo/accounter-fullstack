import { describe, expect, it } from 'vitest';
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
