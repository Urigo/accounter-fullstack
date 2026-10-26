import { describe, expect, it } from 'vitest';
import {
  areNetZero,
  isNetZero,
  netAmountsByCurrency,
  pruneOffsettingSecurityCandidates,
  type NettableTransaction,
} from '../securities-counterparty.helper.js';

// Synthetic values only — never lifted from a real bank capture.
const FUND_ALPHA = 'fund-alpha';
const FUND_BETA = 'fund-beta';
const BANK = 'bank';
const SECURITIES = new Set([FUND_ALPHA, FUND_BETA]);

function transaction(overrides: Partial<NettableTransaction> = {}): NettableTransaction {
  return {
    business_id: FUND_ALPHA,
    is_fee: false,
    amount: '-1000.00',
    currency: 'USD',
    ...overrides,
  };
}

describe('netAmountsByCurrency', () => {
  it('sums per currency and leaves fees out', () => {
    const nets = netAmountsByCurrency([
      transaction({ amount: '-1000.00' }),
      transaction({ amount: '250.50' }),
      transaction({ amount: '-10', currency: 'ILS' }),
      transaction({ amount: '-5', is_fee: true }),
    ]);

    expect(nets).toEqual(
      new Map([
        ['USD', -749.5],
        ['ILS', -10],
      ]),
    );
  });
});

describe('netAmountsByCurrency — rounding', () => {
  it('rounds float residue off to the cent, with no negative zero', () => {
    const nets = netAmountsByCurrency([
      transaction({ amount: '0.3' }),
      transaction({ amount: '-0.1' }),
      transaction({ amount: '-0.2' }),
    ]);

    // 0.3 - 0.1 - 0.2 is -2.8e-17 in floats, which would read as a negative amount
    expect(Object.is(nets.get('USD'), 0)).toBe(true);
  });
});

describe('isNetZero', () => {
  it('is true for a buy reversed by a sell of the same amount', () => {
    expect(isNetZero([transaction({ amount: '-1000' }), transaction({ amount: '1000' })])).toBe(
      true,
    );
  });

  it('ignores sub-cent float residue', () => {
    expect(isNetZero([transaction({ amount: '0.1' }), transaction({ amount: '0.2' }), transaction({ amount: '-0.3' })])).toBe(true);
  });

  it('is false with no transactions, or fees only', () => {
    expect(isNetZero([])).toBe(false);
    expect(isNetZero([transaction({ is_fee: true })])).toBe(false);
    expect(areNetZero(new Map())).toBe(false);
  });

  it('requires every currency to cancel out', () => {
    expect(
      isNetZero([
        transaction({ amount: '-1000' }),
        transaction({ amount: '1000' }),
        transaction({ amount: '-10', currency: 'ILS' }),
      ]),
    ).toBe(false);
  });
});

describe('pruneOffsettingSecurityCandidates', () => {
  it('drops a security whose trades cancel out, leaving the one that moved money', () => {
    const transactions = [
      transaction({ business_id: FUND_ALPHA, amount: '-1000' }),
      transaction({ business_id: FUND_BETA, amount: '-1000' }),
      transaction({ business_id: FUND_BETA, amount: '1000' }),
      transaction({ business_id: BANK, amount: '-12.34', currency: 'ILS', is_fee: true }),
    ];

    expect(
      pruneOffsettingSecurityCandidates([FUND_ALPHA, FUND_BETA], transactions, SECURITIES),
    ).toEqual([FUND_ALPHA]);
  });

  it('keeps every security that carries exposure', () => {
    const transactions = [
      transaction({ business_id: FUND_ALPHA, amount: '1000' }),
      transaction({ business_id: FUND_BETA, amount: '-1000' }),
    ];

    expect(
      pruneOffsettingSecurityCandidates([FUND_ALPHA, FUND_BETA], transactions, SECURITIES),
    ).toEqual([FUND_ALPHA, FUND_BETA]);
  });

  it('returns the candidates unchanged when every one cancels out', () => {
    const transactions = [
      transaction({ business_id: FUND_ALPHA, amount: '-1000' }),
      transaction({ business_id: FUND_ALPHA, amount: '1000' }),
      transaction({ business_id: FUND_BETA, amount: '-500' }),
      transaction({ business_id: FUND_BETA, amount: '500' }),
    ];

    expect(
      pruneOffsettingSecurityCandidates([FUND_ALPHA, FUND_BETA], transactions, SECURITIES),
    ).toEqual([FUND_ALPHA, FUND_BETA]);
  });

  it('never drops a business that is not a security', () => {
    const transactions = [
      transaction({ business_id: FUND_ALPHA, amount: '-1000' }),
      transaction({ business_id: BANK, amount: '-20' }),
      transaction({ business_id: BANK, amount: '20' }),
    ];

    expect(
      pruneOffsettingSecurityCandidates([FUND_ALPHA, BANK], transactions, SECURITIES),
    ).toEqual([FUND_ALPHA, BANK]);
  });

  it('keeps a reversed security when no other security in the charge moved money', () => {
    // the other candidate is not a security, so nothing can take the reversed one's place
    const transactions = [
      transaction({ business_id: FUND_ALPHA, amount: '-1000' }),
      transaction({ business_id: FUND_ALPHA, amount: '1000' }),
      transaction({ business_id: BANK, amount: '-20' }),
    ];

    expect(
      pruneOffsettingSecurityCandidates([FUND_ALPHA, BANK], transactions, SECURITIES),
    ).toEqual([FUND_ALPHA, BANK]);
  });

  it('keeps a security that offsets in one currency but not another', () => {
    const transactions = [
      transaction({ business_id: FUND_ALPHA, amount: '-1000' }),
      transaction({ business_id: FUND_BETA, amount: '-1000' }),
      transaction({ business_id: FUND_BETA, amount: '1000' }),
      transaction({ business_id: FUND_BETA, amount: '-50', currency: 'EUR' }),
    ];

    expect(
      pruneOffsettingSecurityCandidates([FUND_ALPHA, FUND_BETA], transactions, SECURITIES),
    ).toEqual([FUND_ALPHA, FUND_BETA]);
  });

  it('does not count fee rows toward a security', () => {
    const transactions = [
      transaction({ business_id: FUND_ALPHA, amount: '-1000' }),
      transaction({ business_id: FUND_BETA, amount: '-1000' }),
      transaction({ business_id: FUND_BETA, amount: '1000' }),
      transaction({ business_id: FUND_BETA, amount: '-3', is_fee: true }),
    ];

    expect(
      pruneOffsettingSecurityCandidates([FUND_ALPHA, FUND_BETA], transactions, SECURITIES),
    ).toEqual([FUND_ALPHA]);
  });

  it('leaves a single candidate alone', () => {
    const transactions = [
      transaction({ business_id: FUND_ALPHA, amount: '-1000' }),
      transaction({ business_id: FUND_ALPHA, amount: '1000' }),
    ];

    expect(pruneOffsettingSecurityCandidates([FUND_ALPHA], transactions, SECURITIES)).toEqual([
      FUND_ALPHA,
    ]);
  });
});
