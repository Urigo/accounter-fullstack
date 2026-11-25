import { describe, expect, it } from 'vitest';
import { HapoalimDepositsTaxCollectionSchema } from '../hapoalim-deposits-tax-collection-schema.js';

// Synthetic fixtures only — never lifted from a real bank capture.
const capitalized = {
  eventSerialNumber: 1,
  executingDate: 20250102,
  formattedExecutingDate: '2025-01-02T00:00:00.000Z',
  actionTypeDescription: 'תשלום ריבית ל',
  shortProductName: 'פר"י',
  taxActionTypeDescription: 'תשלום',
  taxEventAmount: 3.21,
  debitCurrencyShortedDescription: 'ש"ח',
  debitAmount: 0,
  crditAmount: 0,
  additionalInformationExistenceSwitch: 1,
};
const paidOut = {
  ...capitalized,
  eventSerialNumber: 2,
  actionTypeDescription: 'משיכה',
  taxEventAmount: 0.05,
  debitAmount: 0.01,
};

describe('HapoalimDepositsTaxCollectionSchema', () => {
  it('parses a report with capitalized and paid-out rows and the info message', () => {
    const result = HapoalimDepositsTaxCollectionSchema.safeParse({
      savingsAndCurrentProductsTaxEvents: [capitalized, paidOut],
      messages: [{ messageCode: 5, messageDescription: 'לידיעה בלבד', messageTypeCode: 'I' }],
    });
    expect(result.success).toBe(true);
    expect(result.data?.savingsAndCurrentProductsTaxEvents).toHaveLength(2);
    expect(result.data?.savingsAndCurrentProductsTaxEvents[1]?.debitAmount).toBe(0.01);
  });

  it('defaults a missing events list to empty', () => {
    const result = HapoalimDepositsTaxCollectionSchema.safeParse({ messages: [] });
    expect(result.success).toBe(true);
    expect(result.data?.savingsAndCurrentProductsTaxEvents).toEqual([]);
  });

  it('accepts unseen action types', () => {
    const result = HapoalimDepositsTaxCollectionSchema.safeParse({
      savingsAndCurrentProductsTaxEvents: [{ ...capitalized, actionTypeDescription: 'פרעון' }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects an unknown field so bank-side changes surface', () => {
    const result = HapoalimDepositsTaxCollectionSchema.safeParse({
      savingsAndCurrentProductsTaxEvents: [{ ...capitalized, depositSerialId: 7 }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-numeric amount', () => {
    const result = HapoalimDepositsTaxCollectionSchema.safeParse({
      savingsAndCurrentProductsTaxEvents: [{ ...capitalized, taxEventAmount: '3.21' }],
    });
    expect(result.success).toBe(false);
  });
});
