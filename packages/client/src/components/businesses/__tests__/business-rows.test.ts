import { describe, expect, it } from 'vitest';
import {
  businessNodesToRows,
  filterBusinessRows,
  formatLocality,
  mergeBusinessUsage,
  type BusinessRow,
  type BusinessRowFilters,
  type BusinessTableRow,
} from '../business-rows.js';

function makeRow(id: string, name: string): BusinessRow {
  return {
    id,
    name,
    hebrewName: null,
    governmentId: null,
    countryCode: null,
    city: null,
    zipCode: null,
    createdAt: null,
    updatedAt: null,
    sortCodeKey: null,
    sortCodeName: null,
    taxCategoryName: null,
    irsCode: null,
    pcn874RecordType: null,
    isClient: false,
    isAdmin: false,
    isActive: true,
    suggestionDescription: null,
    suggestionTags: [],
  };
}

function makeTableRow(overrides: Partial<BusinessTableRow>): BusinessTableRow {
  return {
    ...makeRow(overrides.id ?? 'id', overrides.name ?? 'name'),
    totalTransactions: 0,
    totalDocuments: 0,
    totalMiscExpenses: 0,
    totalLedgerRecords: 0,
    ...overrides,
  };
}

const NO_FILTERS: BusinessRowFilters = {
  name: '',
  client: false,
  admin: false,
  inactive: false,
  unusedOnly: false,
  sortCode: '',
  taxCategory: '',
};

describe('businessNodesToRows', () => {
  it('keeps only LtdFinancialEntity nodes and maps core, categorization and tag fields', () => {
    const rows = businessNodesToRows([
      {
        __typename: 'LtdFinancialEntity',
        id: 'b1',
        name: 'Beta',
        hebrewName: 'בטא',
        governmentId: '123',
        country: { code: 'ISR' },
        city: 'Tel Aviv',
        zipCode: '6000000',
        createdAt: '2024-01-02T00:00:00Z',
        updatedAt: '2024-03-04T00:00:00Z',
        sortCode: { key: 910, name: 'Income' },
        taxCategory: { name: 'Revenue' },
        irsCode: 42,
        pcn874RecordType: 'S1',
        isClient: true,
        isAdmin: false,
        isActive: true,
        suggestions: { description: 'note', tags: [{ name: 'travel' }, { name: 'food' }] },
      },
      { __typename: 'PersonalFinancialEntity', id: 'p1', name: 'A Person' },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      id: 'b1',
      name: 'Beta',
      hebrewName: 'בטא',
      governmentId: '123',
      countryCode: 'ISR',
      city: 'Tel Aviv',
      zipCode: '6000000',
      createdAt: new Date('2024-01-02T00:00:00Z'),
      updatedAt: new Date('2024-03-04T00:00:00Z'),
      sortCodeKey: 910,
      sortCodeName: 'Income',
      taxCategoryName: 'Revenue',
      irsCode: 42,
      pcn874RecordType: 'S1',
      isClient: true,
      isAdmin: false,
      isActive: true,
      suggestionDescription: 'note',
      suggestionTags: ['travel', 'food'],
    });
  });

  it('sorts rows by name case-insensitively and defaults missing fields', () => {
    const rows = businessNodesToRows([
      { __typename: 'LtdFinancialEntity', id: 'b2', name: 'zeta' },
      { __typename: 'LtdFinancialEntity', id: 'b1', name: 'Alpha' },
    ]);

    expect(rows.map(row => row.id)).toEqual(['b1', 'b2']);
    expect(rows[0]).toMatchObject({
      hebrewName: null,
      governmentId: null,
      countryCode: null,
      city: null,
      zipCode: null,
      createdAt: null,
      updatedAt: null,
      sortCodeKey: null,
      sortCodeName: null,
      taxCategoryName: null,
      irsCode: null,
      pcn874RecordType: null,
      isClient: false,
      isAdmin: false,
      isActive: true,
      suggestionDescription: null,
      suggestionTags: [],
    });
  });
});

describe('mergeBusinessUsage', () => {
  it('merges usage counts into rows by business id and defaults unmatched rows to null', () => {
    const merged = mergeBusinessUsage(
      [makeRow('b1', 'Alpha'), makeRow('b2', 'Beta')],
      [
        {
          businessId: 'b1',
          totalTransactions: 3,
          totalDocuments: 2,
          totalMiscExpenses: 1,
          totalLedgerRecords: 5,
        },
      ],
    );

    expect(merged[0]).toMatchObject({
      id: 'b1',
      totalTransactions: 3,
      totalDocuments: 2,
      totalMiscExpenses: 1,
      totalLedgerRecords: 5,
    });
    expect(merged[1]).toMatchObject({
      id: 'b2',
      totalTransactions: null,
      totalDocuments: null,
      totalMiscExpenses: null,
      totalLedgerRecords: null,
    });
  });
});

describe('filterBusinessRows', () => {
  it('filters by name / hebrew name substring (case-insensitive)', () => {
    const rows = [
      makeTableRow({ id: 'a', name: 'Acme Ltd', hebrewName: null }),
      makeTableRow({ id: 'b', name: 'Other', hebrewName: 'אקמה' }),
      makeTableRow({ id: 'c', name: 'Nope' }),
    ];
    expect(filterBusinessRows(rows, { ...NO_FILTERS, name: 'acme' }).map(row => row.id)).toEqual([
      'a',
    ]);
    expect(filterBusinessRows(rows, { ...NO_FILTERS, name: 'אקמה' }).map(row => row.id)).toEqual([
      'b',
    ]);
  });

  it('filters by the client flag', () => {
    const rows = [makeTableRow({ id: 'a', isClient: true }), makeTableRow({ id: 'b' })];
    expect(filterBusinessRows(rows, { ...NO_FILTERS, client: true }).map(row => row.id)).toEqual([
      'a',
    ]);
  });

  it('filters inactive businesses', () => {
    const rows = [makeTableRow({ id: 'a', isActive: false }), makeTableRow({ id: 'b' })];
    expect(filterBusinessRows(rows, { ...NO_FILTERS, inactive: true }).map(row => row.id)).toEqual([
      'a',
    ]);
  });

  it('keeps only rows whose four usage counts are all zero for "unused only"', () => {
    const rows = [
      makeTableRow({ id: 'used', totalTransactions: 3 }),
      makeTableRow({ id: 'unused' }),
      makeTableRow({
        id: 'unknown',
        totalTransactions: null,
        totalDocuments: null,
        totalMiscExpenses: null,
        totalLedgerRecords: null,
      }),
    ];
    expect(filterBusinessRows(rows, { ...NO_FILTERS, unusedOnly: true }).map(row => row.id)).toEqual(
      ['unused'],
    );
  });

  it('filters by sort-code key or name, and by tax-category substrings', () => {
    const rows = [
      makeTableRow({
        id: 'a',
        sortCodeKey: 310,
        sortCodeName: 'לקוחות חול',
        taxCategoryName: 'Income',
      }),
      makeTableRow({ id: 'b', sortCodeKey: 200, sortCodeName: 'ספקים', taxCategoryName: 'Expense' }),
    ];
    // by key
    expect(filterBusinessRows(rows, { ...NO_FILTERS, sortCode: '310' }).map(row => row.id)).toEqual([
      'a',
    ]);
    // by name (case-insensitive substring)
    expect(
      filterBusinessRows(rows, { ...NO_FILTERS, sortCode: 'לקוחות' }).map(row => row.id),
    ).toEqual(['a']);
    expect(
      filterBusinessRows(rows, { ...NO_FILTERS, taxCategory: 'exp' }).map(row => row.id),
    ).toEqual(['b']);
  });
});

describe('formatLocality', () => {
  it('resolves the country code to its display name', () => {
    expect(formatLocality({ countryCode: 'ISR' })).toBe('Israel');
    expect(formatLocality({ countryCode: 'USA' })).toBe('United States of America (the)');
  });

  it('returns an empty string when there is no country', () => {
    expect(formatLocality({ countryCode: null })).toBe('');
  });

  it('falls back to the raw code when it is unknown', () => {
    expect(formatLocality({ countryCode: 'ZZZ' })).toBe('ZZZ');
  });
});
