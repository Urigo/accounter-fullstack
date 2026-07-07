import { describe, expect, it } from 'vitest';
import { Currency } from '../../../../shared/enums.js';
import type { LedgerProto } from '../../../../shared/types/index.js';
import { aggregateConversionSideEntries } from '../conversion-charge-ledger.helper.js';

function makeEntry(overrides: Partial<LedgerProto> = {}): LedgerProto {
  return {
    id: 'entry-1',
    invoiceDate: new Date('2024-11-27'),
    valueDate: new Date('2024-11-27'),
    currency: Currency.Ils,
    localCurrencyCreditAmount1: 100,
    localCurrencyDebitAmount1: 100,
    isCreditorCounterparty: true,
    ownerId: 'owner-1',
    chargeId: 'charge-1',
    ...overrides,
  };
}

describe('aggregateConversionSideEntries', () => {
  it('returns the single entry unchanged when the side has one transaction', () => {
    const entry = makeEntry({ creditAmount1: 50, debitAmount1: 50 });
    expect(aggregateConversionSideEntries([entry])).toBe(entry);
  });

  it('sums local currency amounts across multiple same-currency entries', () => {
    const result = aggregateConversionSideEntries([
      makeEntry({
        id: 'a',
        localCurrencyCreditAmount1: 23_468.9,
        localCurrencyDebitAmount1: 23_468.9,
      }),
      makeEntry({
        id: 'b',
        localCurrencyCreditAmount1: 41_517.3,
        localCurrencyDebitAmount1: 41_517.3,
      }),
    ]);
    expect(result.localCurrencyCreditAmount1).toBeCloseTo(64_986.2, 5);
    expect(result.localCurrencyDebitAmount1).toBeCloseTo(64_986.2, 5);
    // meta copied from the first entry
    expect(result.id).toBe('a');
    expect(result.currency).toBe(Currency.Ils);
  });

  it('sums foreign amounts when present', () => {
    const result = aggregateConversionSideEntries([
      makeEntry({
        id: 'a',
        currency: Currency.Usd,
        creditAmount1: 10_000,
        debitAmount1: 10_000,
        localCurrencyCreditAmount1: 36_000,
        localCurrencyDebitAmount1: 36_000,
      }),
      makeEntry({
        id: 'b',
        currency: Currency.Usd,
        creditAmount1: 8_000,
        debitAmount1: 8_000,
        localCurrencyCreditAmount1: 28_800,
        localCurrencyDebitAmount1: 28_800,
      }),
    ]);
    expect(result.creditAmount1).toBe(18_000);
    expect(result.debitAmount1).toBe(18_000);
    expect(result.localCurrencyCreditAmount1).toBe(64_800);
  });

  it('leaves foreign amount undefined when the side is the local currency', () => {
    const result = aggregateConversionSideEntries([
      makeEntry({ id: 'a', localCurrencyCreditAmount1: 100, localCurrencyDebitAmount1: 100 }),
      makeEntry({ id: 'b', localCurrencyCreditAmount1: 200, localCurrencyDebitAmount1: 200 }),
    ]);
    expect(result.creditAmount1).toBeUndefined();
    expect(result.debitAmount1).toBeUndefined();
    expect(result.localCurrencyCreditAmount1).toBe(300);
  });

  it('throws when the side is empty', () => {
    expect(() => aggregateConversionSideEntries([])).toThrow();
  });
});
