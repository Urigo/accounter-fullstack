import { describe, expect, it } from 'vitest';
import {
  chargeTypeFromTypename,
  documentDirection,
  flowKindForCharge,
  LOCAL_CURRENCY,
  normalizeDocument,
  normalizeTransaction,
  toLocalAmount,
  type RawDocument,
  type RawTransaction,
} from '../entity-shapes.js';

/**
 * Unit coverage for the derived fields the detail tools expose: local-currency
 * conversion, charge classification, and document direction. These are pure
 * functions, so they are exercised directly rather than through the executor —
 * the tool-level wiring is covered in `detail-tools.test.ts`.
 */

// ---------------------------------------------------------------------------
// Currency conversion
// ---------------------------------------------------------------------------

describe('toLocalAmount', () => {
  const rates = { date: '2021-03-04', ils: 1, usd: 3.3, eur: 4, eth: null };

  // Upstream quotes every field as "local currency per one unit", so the rate
  // is a multiplier. Getting this inverted would silently scale six years of
  // history by ~1/rate², which is exactly the class of error this replaces.
  it('multiplies by the rate for the amount’s own currency', () => {
    expect(toLocalAmount({ raw: 100, formatted: '$100', currency: 'USD' }, rates)).toEqual({
      amountLocal: { value: 330, currency: LOCAL_CURRENCY },
      exchangeRate: 3.3,
    });
  });

  it('matches the currency case-insensitively and keeps local amounts unchanged', () => {
    expect(toLocalAmount({ raw: 50, formatted: '₪50', currency: 'ILS' }, rates)).toEqual({
      amountLocal: { value: 50, currency: LOCAL_CURRENCY },
      exchangeRate: 1,
    });
  });

  it('preserves the sign of a debit', () => {
    const converted = toLocalAmount({ raw: -20, formatted: '-$20', currency: 'USD' }, rates);
    expect(converted?.amountLocal.value).toBeCloseTo(-66);
  });

  // Returning null (rather than the origin-currency number) keeps an
  // unconvertible row visibly unconverted instead of quietly mixing currencies.
  it.each([
    ['a currency with no rate on file', { raw: 10, formatted: '₿10', currency: 'BTC' }, rates],
    ['a null rate', { raw: 10, formatted: 'Ξ10', currency: 'ETH' }, rates],
    ['missing rates entirely', { raw: 10, formatted: '$10', currency: 'USD' }, null],
  ])('returns null for %s', (_label, amount, rateSet) => {
    expect(toLocalAmount(amount, rateSet)).toBeNull();
  });

  it('returns null when there is no amount', () => {
    expect(toLocalAmount(null, rates)).toBeNull();
  });
});

describe('normalizeTransaction', () => {
  const base: RawTransaction = {
    id: 'tx1',
    chargeId: 'c1',
    eventDate: '2021-03-04',
    direction: 'CREDIT',
    amount: { raw: 100, formatted: '$100', currency: 'USD' },
    sourceDescription: 'WIRE IN',
  };

  it('exposes the derived pair and not the raw rates object', () => {
    const normalized = normalizeTransaction({
      ...base,
      eventExchangeRates: { date: '2021-03-04', usd: 3.3 },
    });
    expect(normalized.amountLocal).toEqual({ value: 330, currency: LOCAL_CURRENCY });
    expect(normalized.exchangeRate).toBe(3.3);
    expect(normalized).not.toHaveProperty('eventExchangeRates');
  });

  it('degrades to nulls when the rates are absent', () => {
    const normalized = normalizeTransaction(base);
    expect(normalized.amountLocal).toBeNull();
    expect(normalized.exchangeRate).toBeNull();
    expect(normalized.amount).toEqual({ value: 100, formatted: '$100', currency: 'USD' });
  });
});

// ---------------------------------------------------------------------------
// Charge classification
// ---------------------------------------------------------------------------

describe('chargeTypeFromTypename', () => {
  it('maps typenames onto the byChargeTypes filter vocabulary', () => {
    expect(chargeTypeFromTypename('CommonCharge')).toBe('COMMON');
    expect(chargeTypeFromTypename('SalaryCharge')).toBe('PAYROLL');
    expect(chargeTypeFromTypename('MonthlyVatCharge')).toBe('VAT');
    expect(chargeTypeFromTypename('CreditcardBankCharge')).toBe('CREDITCARD_BANK');
  });

  it('returns null for an absent or unrecognized typename', () => {
    expect(chargeTypeFromTypename(undefined)).toBeNull();
    expect(chargeTypeFromTypename('SomeFutureCharge')).toBeNull();
  });
});

describe('flowKindForCharge', () => {
  const ils = (raw: number) => ({ raw, formatted: `₪${raw}`, currency: 'ILS' });

  // The whole point of `flowKind`: these three move money between the owner's
  // own accounts, so counting them as income/expense double-counts.
  it.each(['INTERNAL', 'BANK_DEPOSIT', 'CREDITCARD_BANK'])(
    'classifies %s as an internal transfer regardless of sign',
    chargeType => {
      expect(flowKindForCharge(chargeType, ils(5000))).toBe('internal_transfer');
      expect(flowKindForCharge(chargeType, ils(-5000))).toBe('internal_transfer');
    },
  );

  it('maps the remaining intrinsic types', () => {
    expect(flowKindForCharge('CONVERSION', ils(-1))).toBe('conversion');
    expect(flowKindForCharge('FOREIGN_SECURITIES', ils(-1))).toBe('investment');
    expect(flowKindForCharge('PAYROLL', ils(-1))).toBe('payroll');
    expect(flowKindForCharge('VAT', ils(-1))).toBe('tax');
    expect(flowKindForCharge('DIVIDEND', ils(-1))).toBe('dividend');
    expect(flowKindForCharge('FINANCIAL', ils(-1))).toBe('financial');
    expect(flowKindForCharge('BUSINESS_TRIP', ils(1))).toBe('expense');
  });

  it('falls back to the amount sign for the catch-all COMMON type', () => {
    expect(flowKindForCharge('COMMON', ils(1200))).toBe('income');
    expect(flowKindForCharge('COMMON', ils(-1200))).toBe('expense');
  });

  it('stays unknown rather than guessing without a type or amount', () => {
    expect(flowKindForCharge(null, ils(100))).toBe('unknown');
    expect(flowKindForCharge('COMMON', null)).toBe('unknown');
    expect(flowKindForCharge('COMMON', ils(0))).toBe('unknown');
  });
});

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

describe('documentDirection', () => {
  const OWNER = 'owner-1';
  const OTHER = 'other-1';
  const doc = (creditor: string | null, debtor: string | null): RawDocument => ({
    id: 'd1',
    creditor: creditor ? { id: creditor, name: creditor } : null,
    debtor: debtor ? { id: debtor, name: debtor } : null,
  });

  it('reads issued when the owner is the creditor', () => {
    expect(documentDirection(doc(OWNER, OTHER), OWNER)).toBe('issued');
  });

  it('reads received when the owner is the debtor', () => {
    expect(documentDirection(doc(OTHER, OWNER), OWNER)).toBe('received');
  });

  // A wrong direction flips an expense into revenue, so the ambiguous cases the
  // feedback hit — credit invoices, a missing creditor — must stay null.
  it('returns null when the owner is neither party', () => {
    expect(documentDirection(doc(OTHER, OTHER), OWNER)).toBeNull();
  });

  it('returns null when a party is missing or the owner is unknown', () => {
    expect(documentDirection(doc(null, OWNER), null)).toBeNull();
    expect(documentDirection(doc(null, null), OWNER)).toBeNull();
  });
});

describe('normalizeDocument', () => {
  it('derives direction from the owning charge and nets VAT off the amount', () => {
    const normalized = normalizeDocument({
      id: 'd1',
      __typename: 'Invoice',
      amount: { raw: 1170, formatted: '₪1170', currency: 'ILS' },
      vat: { raw: 170, formatted: '₪170', currency: 'ILS' },
      creditor: { id: 'owner-1', name: 'Acme' },
      debtor: { id: 'cust-1', name: 'Customer' },
      charge: { id: 'c1', owner: { id: 'owner-1' } },
    });
    expect(normalized.direction).toBe('issued');
    expect(normalized.amountExVat).toEqual({
      value: 1000,
      formatted: '1000 ILS',
      currency: 'ILS',
    });
  });

  it('treats a document with no VAT as fully net', () => {
    const normalized = normalizeDocument({
      id: 'd2',
      amount: { raw: -500, formatted: '₪-500', currency: 'ILS' },
      charge: { id: 'c2', owner: { id: 'owner-1' } },
      debtor: { id: 'owner-1', name: 'Acme' },
    });
    expect(normalized.direction).toBe('received');
    expect(normalized.amountExVat?.value).toBe(-500);
  });

  it('leaves amountExVat null when there is no amount', () => {
    expect(normalizeDocument({ id: 'd3' }).amountExVat).toBeNull();
  });
});
