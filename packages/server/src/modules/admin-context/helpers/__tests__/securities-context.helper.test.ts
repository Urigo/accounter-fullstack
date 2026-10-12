import { describe, expect, it } from 'vitest';
import {
  EMPTY_SECURITIES_CONTEXT,
  mergeSecuritiesContext,
  parseSecuritiesContextPatch,
  parseStoredSecuritiesContext,
  SECURITIES_TAX_CATEGORY_KEYS,
  serializeSecuritiesContext,
  withLegacySecuritiesColumns,
} from '../securities-context.helper.js';

/*
 * `user_context.securities_context`: the tenant's securities tax categories and sort code, kept as
 * jsonb. Reads are lenient (a bad stored value must never break the admin context every request
 * loads); writes are strict.
 */

const DIVIDEND_INCOME_ID = '0190a1b2-0000-7000-8000-000000000001';
const WITHHOLDING_ID = '0190a1b2-0000-7000-8000-000000000002';
const GAIN_ID = '0190a1b2-0000-7000-8000-000000000003';
const BUSINESS_ID = '0190a1b2-0000-7000-8000-000000000004';
const FEES_ID = '0190a1b2-0000-7000-8000-000000000005';

describe('parseStoredSecuritiesContext', () => {
  it('reads the stored shape into keyed tax categories', () => {
    const context = parseStoredSecuritiesContext({
      sortCode: 990,
      taxCategories: {
        foreignDividendIncome: DIVIDEND_INCOME_ID,
        dividendWithholdingTax: WITHHOLDING_ID,
      },
    });

    expect(context).toEqual({
      foreignSecuritiesBusinessId: null,
      sortCode: 990,
      taxCategories: {
        FOREIGN_DIVIDEND_INCOME: DIVIDEND_INCOME_ID,
        DIVIDEND_WITHHOLDING_TAX: WITHHOLDING_ID,
      },
    });
  });

  it('is empty for a missing or empty value', () => {
    expect(parseStoredSecuritiesContext(undefined)).toEqual(EMPTY_SECURITIES_CONTEXT);
    expect(parseStoredSecuritiesContext(null)).toEqual(EMPTY_SECURITIES_CONTEXT);
    expect(parseStoredSecuritiesContext({})).toEqual(EMPTY_SECURITIES_CONTEXT);
  });

  it('drops bad values one field at a time instead of failing', () => {
    const context = parseStoredSecuritiesContext({
      sortCode: 'not a number',
      foreignSecuritiesBusinessId: 'not-a-uuid',
      taxCategories: {
        foreignDividendIncome: 'not-a-uuid',
        localDividendIncome: 42,
        foreignSecuritiesSaleGain: GAIN_ID,
        somethingElse: DIVIDEND_INCOME_ID,
      },
    });

    expect(context).toEqual({
      foreignSecuritiesBusinessId: null,
      sortCode: null,
      taxCategories: { FOREIGN_SECURITIES_SALE_GAIN: GAIN_ID },
    });
  });

  it('is empty when the stored value is not an object at all', () => {
    expect(parseStoredSecuritiesContext('junk')).toEqual(EMPTY_SECURITIES_CONTEXT);
    expect(parseStoredSecuritiesContext({ taxCategories: 'junk' })).toEqual(
      EMPTY_SECURITIES_CONTEXT,
    );
  });
});

describe('serializeSecuritiesContext', () => {
  it('writes the stored shape back, leaving unset keys out', () => {
    expect(
      serializeSecuritiesContext({
        foreignSecuritiesBusinessId: null,
        sortCode: 990,
        taxCategories: { BOND_WITHHOLDING_TAX: WITHHOLDING_ID },
      }),
    ).toEqual({ sortCode: 990, taxCategories: { bondWithholdingTax: WITHHOLDING_ID } });

    expect(serializeSecuritiesContext(EMPTY_SECURITIES_CONTEXT)).toEqual({ taxCategories: {} });
  });

  it('round-trips through the parser for every key', () => {
    const taxCategories = Object.fromEntries(
      SECURITIES_TAX_CATEGORY_KEYS.map((key, index) => [
        key,
        `0190a1b2-0000-7000-8000-${String(index).padStart(12, '0')}`,
      ]),
    );
    const context = { foreignSecuritiesBusinessId: BUSINESS_ID, sortCode: 123, taxCategories };

    expect(parseStoredSecuritiesContext(serializeSecuritiesContext(context))).toEqual(context);
  });
});

describe('parseSecuritiesContextPatch', () => {
  it('accepts tax category assignments and a sort code', () => {
    expect(
      parseSecuritiesContextPatch({
        sortCode: 990,
        taxCategories: [
          { key: 'FOREIGN_DIVIDEND_INCOME', taxCategoryId: DIVIDEND_INCOME_ID },
          { key: 'DIVIDEND_WITHHOLDING_TAX', taxCategoryId: null },
        ],
      }),
    ).toEqual({
      sortCode: 990,
      taxCategories: [
        { key: 'FOREIGN_DIVIDEND_INCOME', taxCategoryId: DIVIDEND_INCOME_ID },
        { key: 'DIVIDEND_WITHHOLDING_TAX', taxCategoryId: null },
      ],
    });
  });

  it('rejects a malformed tax category id', () => {
    expect(() =>
      parseSecuritiesContextPatch({
        taxCategories: [{ key: 'FOREIGN_DIVIDEND_INCOME', taxCategoryId: 'nope' }],
      }),
    ).toThrow();
  });

  it('rejects an unknown key', () => {
    expect(() =>
      parseSecuritiesContextPatch({
        taxCategories: [{ key: 'SOMETHING_ELSE', taxCategoryId: DIVIDEND_INCOME_ID }],
      }),
    ).toThrow();
  });

  it('rejects a non-positive sort code', () => {
    expect(() => parseSecuritiesContextPatch({ sortCode: 0 })).toThrow();
  });
});

describe('mergeSecuritiesContext', () => {
  const current = {
    foreignSecuritiesBusinessId: BUSINESS_ID,
    sortCode: 990,
    taxCategories: {
      FOREIGN_DIVIDEND_INCOME: DIVIDEND_INCOME_ID,
      DIVIDEND_WITHHOLDING_TAX: WITHHOLDING_ID,
    },
  };

  it('sets, replaces and clears only the keys the patch names', () => {
    expect(
      mergeSecuritiesContext(current, {
        taxCategories: [
          { key: 'FOREIGN_SECURITIES_SALE_GAIN', taxCategoryId: GAIN_ID },
          { key: 'DIVIDEND_WITHHOLDING_TAX', taxCategoryId: null },
        ],
      }),
    ).toEqual({
      foreignSecuritiesBusinessId: BUSINESS_ID,
      sortCode: 990,
      taxCategories: {
        FOREIGN_DIVIDEND_INCOME: DIVIDEND_INCOME_ID,
        FOREIGN_SECURITIES_SALE_GAIN: GAIN_ID,
      },
    });
  });

  it('keeps the sort code unless the patch sets or clears it', () => {
    expect(mergeSecuritiesContext(current, {}).sortCode).toBe(990);
    expect(mergeSecuritiesContext(current, { sortCode: 991 }).sortCode).toBe(991);
    expect(mergeSecuritiesContext(current, { sortCode: null }).sortCode).toBeNull();
  });

  it('keeps the foreign securities business unless the patch sets or clears it', () => {
    const other = '0190a1b2-0000-7000-8000-000000000099';
    expect(mergeSecuritiesContext(current, {}).foreignSecuritiesBusinessId).toBe(BUSINESS_ID);
    expect(
      mergeSecuritiesContext(current, { foreignSecuritiesBusinessId: other })
        .foreignSecuritiesBusinessId,
    ).toBe(other);
    expect(
      mergeSecuritiesContext(current, { foreignSecuritiesBusinessId: null })
        .foreignSecuritiesBusinessId,
    ).toBeNull();
  });

  it('does not mutate the current context', () => {
    mergeSecuritiesContext(current, {
      taxCategories: [{ key: 'FOREIGN_DIVIDEND_INCOME', taxCategoryId: null }],
    });

    expect(current.taxCategories.FOREIGN_DIVIDEND_INCOME).toBe(DIVIDEND_INCOME_ID);
  });
});

describe('withLegacySecuritiesColumns', () => {
  it('fills the business and fees category from the legacy columns when unset', () => {
    expect(
      withLegacySecuritiesColumns(
        { foreignSecuritiesBusinessId: null, sortCode: null, taxCategories: {} },
        {
          foreign_securities_business_id: BUSINESS_ID,
          foreign_securities_fees_category_id: FEES_ID,
        },
      ),
    ).toEqual({
      foreignSecuritiesBusinessId: BUSINESS_ID,
      sortCode: null,
      taxCategories: { FOREIGN_SECURITIES_FEES: FEES_ID },
    });
  });

  it('prefers what securities_context stores', () => {
    const stored = {
      foreignSecuritiesBusinessId: BUSINESS_ID,
      sortCode: 990,
      taxCategories: { FOREIGN_SECURITIES_FEES: FEES_ID },
    };

    expect(
      withLegacySecuritiesColumns(stored, {
        foreign_securities_business_id: '0190a1b2-0000-7000-8000-0000000000aa',
        foreign_securities_fees_category_id: '0190a1b2-0000-7000-8000-0000000000bb',
      }),
    ).toEqual(stored);
  });

  it('leaves the context as is with empty legacy columns', () => {
    const stored = { foreignSecuritiesBusinessId: null, sortCode: null, taxCategories: {} };

    expect(
      withLegacySecuritiesColumns(stored, {
        foreign_securities_business_id: null,
        foreign_securities_fees_category_id: null,
      }),
    ).toEqual(stored);
  });
});
