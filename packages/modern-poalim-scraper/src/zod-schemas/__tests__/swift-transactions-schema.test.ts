import { describe, expect, it } from 'vitest';
import { SwiftTransactionsSchema } from '../swift-transactions-schema.js';

// Synthetic fixtures only — never lifted from a real bank capture.
const swiftItem = {
  startDate: 20_260_101,
  formattedStartDate: '2026-01-01T00:00:00.000Z',
  swiftStatusCode: '0Y',
  swiftStatusDesc: 'ההעברה בוצעה',
  amount: 100,
  currencyCodeCatenatedKey: '19',
  currencyLongDescription: 'דולר אמריקאי',
  chargePartyName: 'EXAMPLE PAYER',
  referenceNumber: 'REF0000000001',
  transferCatenatedId: '0000000000000001',
  dataOriginCode: 1,
  documentTypeCode: 1,
  swiftUrl: null,
};

function response(items: unknown[]) {
  return {
    metadata: { messages: [], links: {} },
    trailersCounter: items.length,
    minInputDate: 20_250_101,
    formattedMinInputDate: null,
    swiftsList: items,
    fyiMessages: [],
    currencyCodeCatenatedKey: { code: '-1', values: [] },
    swiftStatusCode: { code: '-1', values: [] },
  };
}

describe('SwiftTransactionsSchema', () => {
  it('accepts an integer documentTypeCode', () => {
    expect(SwiftTransactionsSchema.safeParse(response([swiftItem])).success).toBe(true);
  });

  it.each([null, 'x', 1.5])('rejects documentTypeCode %j', documentTypeCode => {
    const result = SwiftTransactionsSchema.safeParse(response([{ ...swiftItem, documentTypeCode }]));
    expect(result.success).toBe(false);
  });

  it('rejects an item without documentTypeCode', () => {
    const { documentTypeCode: _omitted, ...withoutCode } = swiftItem;
    expect(SwiftTransactionsSchema.safeParse(response([withoutCode])).success).toBe(false);
  });
});
