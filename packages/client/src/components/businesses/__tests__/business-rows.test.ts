import { describe, expect, it } from 'vitest';
import {
  businessNodesToRows,
  formatLocality,
  mergeBusinessUsage,
  type BusinessRow,
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

describe('formatLocality', () => {
  it('joins the present parts and skips the empty ones', () => {
    expect(formatLocality({ city: 'Tel Aviv', zipCode: null, countryCode: 'ISR' })).toBe(
      'Tel Aviv, ISR',
    );
    expect(formatLocality({ city: 'Tel Aviv', zipCode: '6000000', countryCode: 'ISR' })).toBe(
      'Tel Aviv, 6000000, ISR',
    );
    expect(formatLocality({ city: null, zipCode: null, countryCode: null })).toBe('');
  });
});
