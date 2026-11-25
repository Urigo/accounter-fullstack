import { describe, expect, it } from 'vitest';
import type { Injector } from 'graphql-modules';
import { Currency } from '../../../../shared/enums.js';
import type { LedgerProto } from '../../../../shared/types/index.js';
import type { IGetDepreciationDisposalsByIdsResult } from '../../../depreciation/types.js';
import {
  buildCostRefundExchangeEntries,
  generateCostRefundExchangeLedger,
  hasForeignCurrencyRefunds,
  netCreditToAccount,
  type ForeignCostRefund,
} from '../depreciation-refund-exchange-ledger.helper.js';

/*
 * The acquisition case's refund charge (all names and amounts fictional): the supplier refunds
 * USD 100,000 by a credit note dated 2024-04-14 (₪3.650), booked to the clearing account P. The
 * refund corrects four assets bought at ₪3.700, so their cost drops by ₪370,000 while the credit
 * note credits P only ₪365,000: a ₪5,000 exchange loss on the refund receivable.
 */

const CHARGE_ID = 'charge-supplier-refund';
const OWNER_ID = 'owner-business';
const SUPPLIER_ID = 'business-supplier';
const BANK_ID = 'tax-category-usd-bank';
const FEES_ID = 'tax-category-fees';
const CLEARING_ID = 'tax-category-refund-clearing';
const EXCHANGE_RATES_ID = 'tax-category-exchange-rates';
const DATE = '2024-04-14';

function entry(
  overrides: Partial<LedgerProto> &
    Pick<
      LedgerProto,
      'debitAccountID1' | 'creditAccountID1' | 'localCurrencyDebitAmount1' | 'currency'
    >,
): LedgerProto {
  return {
    id: 'entry',
    chargeId: CHARGE_ID,
    ownerId: OWNER_ID,
    invoiceDate: DATE,
    valueDate: DATE,
    isCreditorCounterparty: true,
    localCurrencyCreditAmount1: overrides.localCurrencyDebitAmount1,
    ...overrides,
  };
}

/** The refund charge's own entries: the credit note, the bank receipt and the bank fee */
function chargeEntries(creditNoteUsd = 100_000): LedgerProto[] {
  return [
    entry({
      description: 'credit note',
      currency: Currency.Usd,
      debitAccountID1: SUPPLIER_ID,
      creditAccountID1: CLEARING_ID,
      debitAmount1: creditNoteUsd,
      creditAmount1: creditNoteUsd,
      localCurrencyDebitAmount1: creditNoteUsd * 3.65,
    }),
    entry({
      description: 'receipt',
      currency: Currency.Usd,
      debitAccountID1: BANK_ID,
      creditAccountID1: SUPPLIER_ID,
      debitAmount1: 99_980,
      creditAmount1: 99_980,
      localCurrencyDebitAmount1: 364_927,
    }),
    entry({
      description: 'fee',
      currency: Currency.Usd,
      debitAccountID1: FEES_ID,
      creditAccountID1: SUPPLIER_ID,
      debitAmount1: 20,
      creditAmount1: 20,
      localCurrencyDebitAmount1: 73,
    }),
  ];
}

/**
 * The four refunds, from activation. Converted at the assets' ₪3.700, their cost reductions are
 * 222,000 / 59,200 / 74,000 / 14,800: the ₪370,000 the cost-reduction rows move out of P.
 */
const refunds: ForeignCostRefund[] = [
  { id: 'goodwill', originalAmount: 60_000 },
  { id: 'software', originalAmount: 16_000 },
  { id: 'customer-relationships', originalAmount: 20_000 },
  { id: 'trademarks', originalAmount: 4000 },
].map(refund => ({ ...refund, currency: Currency.Usd, disposalDate: DATE }));
const COST_REDUCTIONS = 222_000 + 59_200 + 74_000 + 14_800;

function usdRefund(originalAmount: number): ForeignCostRefund[] {
  return [{ id: 'software', currency: Currency.Usd, originalAmount, disposalDate: DATE }];
}

function build(
  entries = chargeEntries(),
  refundEvents = refunds,
  expectedProceeds = COST_REDUCTIONS,
) {
  return buildCostRefundExchangeEntries({
    refunds: refundEvents,
    expectedProceeds,
    chargeEntries: entries,
    proceedsAccountId: CLEARING_ID,
    exchangeRateAccountId: EXCHANGE_RATES_ID,
    chargeId: CHARGE_ID,
    ownerId: OWNER_ID,
    localCurrency: Currency.Ils,
  });
}

describe('hasForeignCurrencyRefunds', () => {
  it('tells refunds entered in a foreign currency apart from local events', () => {
    expect(hasForeignCurrencyRefunds([{ original_amount: null }])).toBe(false);
    expect(hasForeignCurrencyRefunds([{ original_amount: null }, { original_amount: '16000' }])).toBe(
      true,
    );
  });
});

describe('netCreditToAccount', () => {
  it('nets what the entries credit to the account, in local currency and per currency', () => {
    const credit = netCreditToAccount(chargeEntries(), CLEARING_ID);

    expect(credit.local).toBeCloseTo(365_000);
    expect(credit.foreign.get(Currency.Usd)).toBe(100_000);
    expect(netCreditToAccount(chargeEntries(), FEES_ID).local).toBe(-73);
  });
});

describe('buildCostRefundExchangeEntries', () => {
  it('books the exchange loss left in the refund account, dated the refund date', () => {
    const { entries, errors } = build();

    // P: credited ₪365,000 by the credit note, debited ₪370,000 by the cost reductions
    expect(errors).toEqual([]);
    expect(entries).toEqual([
      expect.objectContaining({
        debitAccountID1: EXCHANGE_RATES_ID,
        creditAccountID1: CLEARING_ID,
        localCurrencyDebitAmount1: 5000,
        localCurrencyCreditAmount1: 5000,
        currency: Currency.Ils,
        invoiceDate: DATE,
        valueDate: DATE,
        chargeId: CHARGE_ID,
        ownerId: OWNER_ID,
      }),
    ]);
  });

  it('books a gain when the charge credits more than the cost reductions', () => {
    // USD 100,000 converted at ₪3.600: the cost drops by ₪360,000
    const { entries, errors } = build(chargeEntries(), usdRefund(100_000), 360_000);

    expect(errors).toEqual([]);
    expect(entries).toEqual([
      expect.objectContaining({
        debitAccountID1: CLEARING_ID,
        creditAccountID1: EXCHANGE_RATES_ID,
        localCurrencyDebitAmount1: 5000,
      }),
    ]);
  });

  it("reports refunds that don't add up to what the charge credits in their currency", () => {
    // the credit note says USD 99,000, the refunds USD 100,000
    const { entries, errors } = build(chargeEntries(99_000));

    expect(entries).toEqual([]);
    expect(errors).toEqual([
      "Cost refunds of a foreign-currency asset must be invoiced in that currency, for the amounts refunded (100,000.00 USD refunded, 99,000.00 USD credited to the charge's tax category)",
    ]);
  });

  it('reports a refund of a foreign-currency asset invoiced in the local currency', () => {
    // an ILS credit note for the USD refunds: not supported
    const ilsCreditNote = entry({
      description: 'credit note',
      currency: Currency.Ils,
      debitAccountID1: SUPPLIER_ID,
      creditAccountID1: CLEARING_ID,
      localCurrencyDebitAmount1: 370_000,
    });

    const { entries, errors } = build([ilsCreditNote]);

    expect(entries).toEqual([]);
    expect(errors).toEqual([
      "Cost refunds of a foreign-currency asset must be invoiced in that currency, for the amounts refunded (100,000.00 USD refunded, 0.00 USD credited to the charge's tax category)",
    ]);
  });

  it('books nothing when the refund converts at the charge rate', () => {
    // a later rebate, converted at the credit note's ₪3.650
    const { entries, errors } = build(chargeEntries(), usdRefund(100_000), 365_000);

    expect(errors).toEqual([]);
    expect(entries).toEqual([]);
  });

  it('reports a missing exchange rate tax category', () => {
    const { entries, errors } = buildCostRefundExchangeEntries({
      refunds,
      expectedProceeds: COST_REDUCTIONS,
      chargeEntries: chargeEntries(),
      proceedsAccountId: CLEARING_ID,
      exchangeRateAccountId: null,
      chargeId: CHARGE_ID,
      ownerId: OWNER_ID,
      localCurrency: Currency.Ils,
    });

    expect(entries).toEqual([]);
    expect(errors).toEqual([
      'Exchange rate tax category is not defined (cost refund exchange difference)',
    ]);
  });
});

describe('generateCostRefundExchangeLedger', () => {
  function event(
    id: string,
    original: { amount: string; currency: 'USD' } | null,
  ): IGetDepreciationDisposalsByIdsResult {
    return {
      id,
      charge_id: CHARGE_ID,
      created_at: new Date('2024-04-15T00:00:00.000Z'),
      depreciation_id: `asset-${id}`,
      description: null,
      disposal_date: DATE,
      disposed_cost: original ? null : '10000',
      original_amount: original?.amount ?? null,
      original_currency: original?.currency ?? null,
      owner_id: OWNER_ID,
      proceeds: original ? '0' : '12000',
      refund_mode: original ? 'FROM_ACTIVATION' : null,
      type: original ? 'COST_REFUND' : 'SALE',
      updated_at: new Date('2024-04-15T00:00:00.000Z'),
    };
  }

  it('rejects a charge mixing refunds in a foreign currency with other events', async () => {
    // a USD refund and an ILS sale on the same charge: the sale's proceeds can't be checked
    const { entries, errors } = await generateCostRefundExchangeLedger({
      disposals: [event('software', { amount: '16000', currency: 'USD' }), event('laptop', null)],
      proceedsAccountId: CLEARING_ID,
      expectedProceeds: 59_200 + 12_000,
      charge: { id: CHARGE_ID, owner_id: OWNER_ID },
      chargeEntries: chargeEntries(),
      // not reached: the mix is rejected first
      injector: {} as Injector,
    });

    expect(entries).toEqual([]);
    expect(errors).toEqual([
      "The charge carries cost refunds entered in an asset's foreign currency together with other asset events (laptop); book them on separate charges",
    ]);
  });
});
