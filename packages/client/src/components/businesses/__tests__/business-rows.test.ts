import { describe, expect, it } from 'vitest';
import { businessNodesToRows, formatLocality } from '../business-rows.js';

describe('businessNodesToRows', () => {
  it('keeps only LtdFinancialEntity nodes and maps their fields', () => {
    const createdAt = new Date('2024-01-02T00:00:00Z');
    const updatedAt = new Date('2024-03-04T00:00:00Z');
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
        createdAt,
        updatedAt,
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
      createdAt,
      updatedAt,
    });
  });

  it('sorts rows by name case-insensitively and defaults missing fields to null', () => {
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
