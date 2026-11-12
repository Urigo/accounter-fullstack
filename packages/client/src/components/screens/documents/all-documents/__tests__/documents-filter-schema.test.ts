import { describe, expect, it } from 'vitest';
import { decodeFilters, encodeFilters } from '@/router/routes.js';
import { DocumentType } from '../../../../../gql/graphql.js';
import { documentsFilterUrlSchema } from '../documents-filter-schema.js';

// The server types every id here as a UUID, so the URL schema does too.
const OWNER = '0a7c6c3e-1111-4f1a-9a55-1b2c3d4e5f60';
const BUSINESS = '0a7c6c3e-2222-4f1a-9a55-1b2c3d4e5f60';
const CHARGE = '0a7c6c3e-3333-4f1a-9a55-1b2c3d4e5f60';

const decode = (filter: Record<string, unknown>) =>
  decodeFilters(encodeFilters(filter), documentsFilterUrlSchema);

describe('documentsFilterUrlSchema', () => {
  it('round-trips every field', () => {
    const filter = {
      businessIDs: [BUSINESS],
      chargeIDs: [CHARGE],
      freeText: 'coffee',
      fromDate: '2025-01-01',
      missingCounterparty: true,
      missingInfo: false,
      ownerIDs: [OWNER],
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
    expect(decode({ ownerIDs: ['owner-1'] })).toEqual({});
    expect(decode({ businessIDs: [BUSINESS, 'not-a-uuid'] })).toEqual({});
    expect(decode({ chargeIDs: ['charge-1'] })).toEqual({});
  });
});
