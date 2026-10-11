import { describe, expect, it } from 'vitest';
import { decodeFilters, encodeFilters } from '@/router/routes.js';
import { DocumentType } from '../../../../../gql/graphql.js';
import { documentsFilterUrlSchema } from '../documents-filter-schema.js';

const decode = (filter: Record<string, unknown>) =>
  decodeFilters(encodeFilters(filter), documentsFilterUrlSchema);

describe('documentsFilterUrlSchema', () => {
  it('round-trips every field', () => {
    const filter = {
      businessIDs: ['biz-1'],
      chargeIDs: ['charge-1'],
      freeText: 'coffee',
      fromDate: '2025-01-01',
      missingCounterparty: true,
      missingInfo: false,
      ownerIDs: ['owner-1'],
      toDate: '2025-12-31',
      type: [DocumentType.Invoice, DocumentType.Receipt],
      unmatched: true,
    };
    expect(decode(filter)).toEqual(filter);
  });

  it('drops nulls and unknown keys', () => {
    expect(decode({ ownerIDs: null, unmatched: true, page: 2 })).toEqual({ unmatched: true });
  });

  it('falls back to no filter on a value the server would reject', () => {
    expect(decode({ fromDate: '01/02/2025' })).toEqual({});
    expect(decode({ type: ['NOTE'] })).toEqual({});
    expect(decode({ unmatched: 'yes' })).toEqual({});
  });
});
