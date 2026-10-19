import { describe, expect, it } from 'vitest';
import { Currency } from '../../../../shared/enums.js';
import type { StrictLedgerProto } from '../../../../shared/types/index.js';
import {
  buildIncomeEntry,
  buildRedemptionEntry,
  classifySecurityExecution,
  getExpectedCommissionCharge,
  getSecurityLocality,
  getWithheldTax,
  validateSecurityCommissions,
  type CommissionExecution,
  type CommissionFeeTransaction,
  type WithheldTaxExecution,
} from '../foreign-securities-ledger.helper.js';
import { LedgerError } from '../utils.helper.js';

/*
 * The building blocks of the foreign-securities ledger: what kind of execution a cash movement is,
 * whether its security is local or foreign, how much tax was withheld from it, and how the base
 * entry (bank ↔ securities account) is reshaped for income and redemptions. All values are made up.
 */

const USD_LABEL = 'דולר ארה"ב';
const ILS_LABEL = 'שקל חדש';

const BANK_USD = 'tax-category-bank-usd';
const SECURITIES_USD = 'tax-category-securities-usd';
const DIVIDEND_INCOME = 'tax-category-dividend-income';
const WITHHOLDING = 'tax-category-withholding';
const GAIN = 'tax-category-gain';
const LOSS = 'tax-category-loss';

const RATE = 3.5;

/** What `ledgerEntryFromMainTransaction` builds for money coming in: bank debit, securities credit */
function baseEntry(overrides: Partial<StrictLedgerProto> = {}): StrictLedgerProto {
  return {
    id: 'transaction-1',
    chargeId: 'charge-1',
    ownerId: 'owner-1',
    invoiceDate: '2025-03-12',
    valueDate: '2025-03-12',
    currency: Currency.Usd,
    isCreditorCounterparty: true,
    debitAccountID1: BANK_USD,
    debitAmount1: 1000,
    localCurrencyDebitAmount1: 1000 * RATE,
    creditAccountID1: SECURITIES_USD,
    creditAmount1: 1000,
    localCurrencyCreditAmount1: 1000 * RATE,
    description: 'securities payment',
    reference: 'origin-1',
    ...overrides,
  };
}

const ilsBaseEntry = (amount: number) =>
  baseEntry({
    currency: Currency.Ils,
    debitAmount1: undefined,
    creditAmount1: undefined,
    localCurrencyDebitAmount1: amount,
    localCurrencyCreditAmount1: amount,
  });

function taxExecution(overrides: Partial<WithheldTaxExecution> = {}): WithheldTaxExecution {
  return {
    trade_currency: USD_LABEL,
    settlement_currency: USD_LABEL,
    net_value_trade_currency: '1000',
    net_value_settlement_currency: '1000',
    net_value_nis: '3500',
    trade_gross_value_trade_currency: '1000',
    foreign_tax_value_settlement_currency: '0',
    israel_tax_value_by_payments_settlement_currency: '0',
    capital_tax_value_settlement_currency: '0',
    ...overrides,
  };
}

describe('classifySecurityExecution', () => {
  it.each([
    ['דבידנד תשלום', 'DIVIDEND'],
    ['ריבית תשלום', 'INTEREST'],
    ['פדיון', 'REDEMPTION'],
    ['קניה', 'OTHER'],
    ['מכירה', 'OTHER'],
    ['העברה לזכות הפקדון', 'OTHER'],
    ['something the bank never sent', 'OTHER'],
  ])('reads trade type "%s" as %s', (tradeType, kind) => {
    expect(classifySecurityExecution({ trade_type: tradeType })).toBe(kind);
  });
});

describe('getSecurityLocality', () => {
  it('is local for an Israeli issuer and foreign for any other', () => {
    expect(getSecurityLocality({ issuer_country_code: 'IL', isin: 'US0000000001' })).toBe('LOCAL');
    expect(getSecurityLocality({ issuer_country_code: 'US', isin: 'IL0000000001' })).toBe(
      'FOREIGN',
    );
  });

  it('falls back to the ISIN prefix when the issuer country is missing', () => {
    expect(getSecurityLocality({ issuer_country_code: null, isin: 'IL0011223344' })).toBe('LOCAL');
    expect(getSecurityLocality({ issuer_country_code: null, isin: 'FR0011223344' })).toBe(
      'FOREIGN',
    );
  });

  it('is unknown with neither', () => {
    expect(getSecurityLocality({ issuer_country_code: null, isin: null })).toBeNull();
  });
});

describe('getWithheldTax', () => {
  it('is zero when the execution reports no tax and gross equals net', () => {
    expect(getWithheldTax(taxExecution(), Currency.Usd)).toEqual({
      withheld: 0,
      deduced: 0,
      isConsistent: true,
    });
  });

  it('reads the reported tax and confirms it against gross minus net', () => {
    const result = getWithheldTax(
      taxExecution({
        trade_gross_value_trade_currency: '22.5',
        net_value_trade_currency: '15.75',
        net_value_settlement_currency: '15.75',
        foreign_tax_value_settlement_currency: '6.75',
      }),
      Currency.Usd,
    );

    expect(result.withheld).toBeCloseTo(6.75, 6);
    expect(result.deduced).toBeCloseTo(6.75, 6);
    expect(result.isConsistent).toBe(true);
  });

  it('adds up the foreign, Israeli and capital tax columns', () => {
    const result = getWithheldTax(
      taxExecution({
        trade_gross_value_trade_currency: '100',
        net_value_trade_currency: '70',
        net_value_settlement_currency: '70',
        foreign_tax_value_settlement_currency: '15',
        israel_tax_value_by_payments_settlement_currency: '10',
        capital_tax_value_settlement_currency: '5',
      }),
      Currency.Usd,
    );

    expect(result.withheld).toBeCloseTo(30, 6);
    expect(result.isConsistent).toBe(true);
  });

  it('keeps the sign of a refund of previously withheld tax', () => {
    const result = getWithheldTax(
      taxExecution({
        trade_gross_value_trade_currency: '100',
        net_value_trade_currency: '105',
        net_value_settlement_currency: '105',
        israel_tax_value_by_payments_settlement_currency: '-5',
      }),
      Currency.Usd,
    );

    expect(result.withheld).toBeCloseTo(-5, 6);
    expect(result.isConsistent).toBe(true);
  });

  it('flags a reported tax that gross minus net does not confirm', () => {
    const result = getWithheldTax(
      taxExecution({
        trade_gross_value_trade_currency: '1010',
        foreign_tax_value_settlement_currency: '0',
      }),
      Currency.Usd,
    );

    expect(result.withheld).toBe(0);
    expect(result.deduced).toBeCloseTo(10, 6);
    expect(result.isConsistent).toBe(false);
  });

  it('skips the check when the bank reports no gross value', () => {
    const result = getWithheldTax(
      taxExecution({ trade_gross_value_trade_currency: null }),
      Currency.Usd,
    );

    expect(result).toEqual({ withheld: 0, deduced: null, isConsistent: true });
  });

  it('refuses a cash movement in another currency than the execution settled in', () => {
    expect(() => getWithheldTax(taxExecution({ net_value_nis: '3500' }), Currency.Ils)).toThrow(
      LedgerError,
    );
  });

  it('works for an execution settled in shekels', () => {
    const result = getWithheldTax(
      taxExecution({
        trade_currency: ILS_LABEL,
        settlement_currency: ILS_LABEL,
        trade_gross_value_trade_currency: '500',
        net_value_trade_currency: '375',
        net_value_settlement_currency: '375',
        israel_tax_value_by_payments_settlement_currency: '125',
      }),
      Currency.Ils,
    );

    expect(result.withheld).toBeCloseTo(125, 6);
    expect(result.isConsistent).toBe(true);
  });
});

describe('buildIncomeEntry', () => {
  it('moves the credit to the income category, amounts unchanged, when nothing was withheld', () => {
    const entry = buildIncomeEntry(baseEntry(), {
      incomeTaxCategoryId: DIVIDEND_INCOME,
      withheldTax: 0,
    });

    expect(entry).toMatchObject({
      debitAccountID1: BANK_USD,
      debitAmount1: 1000,
      localCurrencyDebitAmount1: 3500,
      creditAccountID1: DIVIDEND_INCOME,
      creditAmount1: 1000,
      localCurrencyCreditAmount1: 3500,
      currency: Currency.Usd,
      isCreditorCounterparty: true,
    });
    expect(entry.debitAccountID2).toBeUndefined();
    expect(entry.creditAccountID2).toBeUndefined();
  });

  it('books withheld tax as a second debit and the gross as income', () => {
    const entry = buildIncomeEntry(baseEntry(), {
      incomeTaxCategoryId: DIVIDEND_INCOME,
      withholdingTaxCategoryId: WITHHOLDING,
      withheldTax: 250,
    });

    expect(entry.debitAccountID1).toBe(BANK_USD);
    expect(entry.debitAmount1).toBe(1000);
    expect(entry.localCurrencyDebitAmount1).toBeCloseTo(3500, 6);
    expect(entry.debitAccountID2).toBe(WITHHOLDING);
    expect(entry.debitAmount2).toBeCloseTo(250, 6);
    expect(entry.localCurrencyDebitAmount2).toBeCloseTo(875, 6);
    expect(entry.creditAccountID1).toBe(DIVIDEND_INCOME);
    expect(entry.creditAmount1).toBeCloseTo(1250, 6);
    expect(entry.localCurrencyCreditAmount1).toBe(
      entry.localCurrencyDebitAmount1 + entry.localCurrencyDebitAmount2!,
    );
  });

  it('books a tax refund as a second credit', () => {
    const entry = buildIncomeEntry(baseEntry(), {
      incomeTaxCategoryId: DIVIDEND_INCOME,
      withholdingTaxCategoryId: WITHHOLDING,
      withheldTax: -50,
    });

    expect(entry.debitAccountID2).toBeUndefined();
    expect(entry.creditAccountID2).toBe(WITHHOLDING);
    expect(entry.creditAmount2).toBeCloseTo(50, 6);
    expect(entry.creditAmount1).toBeCloseTo(950, 6);
    expect(entry.localCurrencyCreditAmount1 + entry.localCurrencyCreditAmount2!).toBeCloseTo(
      entry.localCurrencyDebitAmount1,
      6,
    );
  });

  it('carries no foreign amounts for a shekel cash movement', () => {
    const entry = buildIncomeEntry(ilsBaseEntry(400), {
      incomeTaxCategoryId: DIVIDEND_INCOME,
      withholdingTaxCategoryId: WITHHOLDING,
      withheldTax: 100,
    });

    expect(entry.currency).toBe(Currency.Ils);
    expect(entry.debitAmount1).toBeUndefined();
    expect(entry.debitAmount2).toBeUndefined();
    expect(entry.creditAmount1).toBeUndefined();
    expect(entry.localCurrencyDebitAmount2).toBeCloseTo(100, 6);
    expect(entry.localCurrencyCreditAmount1).toBeCloseTo(500, 6);
  });

  it('drops a withholding line too small to store', () => {
    const entry = buildIncomeEntry(baseEntry(), {
      incomeTaxCategoryId: DIVIDEND_INCOME,
      withholdingTaxCategoryId: WITHHOLDING,
      withheldTax: 0.001,
    });

    expect(entry.debitAccountID2).toBeUndefined();
    expect(entry.creditAmount1).toBe(1000);
  });

  it('refuses money going out', () => {
    expect(() =>
      buildIncomeEntry(
        baseEntry({
          isCreditorCounterparty: false,
          debitAccountID1: SECURITIES_USD,
          creditAccountID1: BANK_USD,
        }),
        { incomeTaxCategoryId: DIVIDEND_INCOME, withheldTax: 0 },
      ),
    ).toThrow(LedgerError);
  });
});

describe('buildRedemptionEntry', () => {
  it('credits the securities account with the purchase cost and books the gain', () => {
    const entry = buildRedemptionEntry(baseEntry(), {
      costForeign: 900,
      withheldTax: 0,
      gainTaxCategoryId: GAIN,
      lossTaxCategoryId: LOSS,
    });

    expect(entry.debitAccountID1).toBe(BANK_USD);
    expect(entry.debitAmount1).toBe(1000);
    expect(entry.creditAccountID1).toBe(SECURITIES_USD);
    expect(entry.creditAmount1).toBeCloseTo(900, 6);
    expect(entry.localCurrencyCreditAmount1).toBeCloseTo(900 * RATE, 6);
    expect(entry.creditAccountID2).toBe(GAIN);
    expect(entry.creditAmount2).toBeCloseTo(100, 6);
    expect(entry.localCurrencyCreditAmount2).toBeCloseTo(100 * RATE, 6);
    expect(entry.debitAccountID2).toBeUndefined();
    expect(entry.localCurrencyCreditAmount1 + entry.localCurrencyCreditAmount2!).toBeCloseTo(
      entry.localCurrencyDebitAmount1,
      6,
    );
  });

  it('books a loss as a second debit', () => {
    const entry = buildRedemptionEntry(baseEntry(), {
      costForeign: 1150,
      withheldTax: 0,
      gainTaxCategoryId: GAIN,
      lossTaxCategoryId: LOSS,
    });

    expect(entry.debitAccountID2).toBe(LOSS);
    expect(entry.debitAmount2).toBeCloseTo(150, 6);
    expect(entry.creditAmount1).toBeCloseTo(1150, 6);
    expect(entry.localCurrencyCreditAmount1).toBeCloseTo(
      entry.localCurrencyDebitAmount1 + entry.localCurrencyDebitAmount2!,
      6,
    );
    expect(entry.creditAccountID2).toBeUndefined();
  });

  it('has no secondary line at break-even', () => {
    const entry = buildRedemptionEntry(baseEntry(), {
      costForeign: 1000,
      withheldTax: 0,
      gainTaxCategoryId: GAIN,
      lossTaxCategoryId: LOSS,
    });

    expect(entry.creditAccountID1).toBe(SECURITIES_USD);
    expect(entry.creditAmount1).toBeCloseTo(1000, 6);
    expect(entry.debitAccountID2).toBeUndefined();
    expect(entry.creditAccountID2).toBeUndefined();
  });

  it('computes the gain on gross proceeds when tax was withheld', () => {
    // received 1,000 after 50 withheld: gross 1,050, cost 900, gain 150
    const entry = buildRedemptionEntry(baseEntry(), {
      costForeign: 900,
      withheldTax: 50,
      gainTaxCategoryId: GAIN,
      withholdingTaxCategoryId: WITHHOLDING,
    });

    expect(entry.debitAccountID2).toBe(WITHHOLDING);
    expect(entry.debitAmount2).toBeCloseTo(50, 6);
    expect(entry.creditAccountID2).toBe(GAIN);
    expect(entry.creditAmount2).toBeCloseTo(150, 6);
    expect(entry.creditAmount1).toBeCloseTo(900, 6);
  });

  it('refuses a loss together with withheld tax, which needs a third debit', () => {
    expect(() =>
      buildRedemptionEntry(baseEntry(), {
        costForeign: 1200,
        withheldTax: 50,
        lossTaxCategoryId: LOSS,
        withholdingTaxCategoryId: WITHHOLDING,
      }),
    ).toThrow(LedgerError);
  });

  it('carries no foreign amounts for a shekel redemption', () => {
    const entry = buildRedemptionEntry(ilsBaseEntry(1000), {
      costForeign: 800,
      withheldTax: 0,
      gainTaxCategoryId: GAIN,
    });

    expect(entry.creditAmount1).toBeUndefined();
    expect(entry.creditAmount2).toBeUndefined();
    expect(entry.localCurrencyCreditAmount1).toBeCloseTo(800, 6);
    expect(entry.localCurrencyCreditAmount2).toBeCloseTo(200, 6);
  });
});

function commissionExecution(overrides: Partial<CommissionExecution> = {}): CommissionExecution {
  return {
    security: '7654321',
    trade_currency: USD_LABEL,
    commissions_currency: ILS_LABEL,
    trade_commission_value_nis: '15.30',
    trade_commission_value_trade_currency: '4.25',
    ...overrides,
  };
}

function commissionFee(
  overrides: Partial<CommissionFeeTransaction> = {},
): CommissionFeeTransaction {
  return {
    amount: '-15.30',
    currency: Currency.Ils,
    source_description: "ניעז עמ' תשלום FSEC PYMNT FEE",
    source_reference: '7654321',
    ...overrides,
  };
}

describe('getExpectedCommissionCharge', () => {
  it('expects a shekel commission to be charged as money going out', () => {
    expect(getExpectedCommissionCharge(commissionExecution())).toEqual({
      currency: Currency.Ils,
      amount: -15.3,
    });
  });

  it('expects a cancelled execution’s negated commission to come back as a refund', () => {
    expect(
      getExpectedCommissionCharge(commissionExecution({ trade_commission_value_nis: '-15.30' })),
    ).toEqual({ currency: Currency.Ils, amount: 15.3 });
  });

  it('reads a commission charged in the trade currency from the trade-currency column', () => {
    expect(
      getExpectedCommissionCharge(commissionExecution({ commissions_currency: USD_LABEL })),
    ).toEqual({ currency: Currency.Usd, amount: -4.25 });
  });

  it('expects nothing when there is no commission', () => {
    expect(
      getExpectedCommissionCharge(commissionExecution({ trade_commission_value_nis: '0' })),
    ).toBeNull();
  });

  it('expects nothing when the commission currency is not reported', () => {
    expect(getExpectedCommissionCharge(commissionExecution({ commissions_currency: null }))).toBeNull();
  });
});

describe('validateSecurityCommissions', () => {
  it('accepts a commission charged by a fee of the same amount', () => {
    expect(validateSecurityCommissions([commissionExecution()], [commissionFee()])).toEqual([]);
  });

  it('reports a commission with no fee transaction', () => {
    const execution = commissionExecution();

    expect(validateSecurityCommissions([execution], [])).toEqual([
      { execution, currency: Currency.Ils, expected: -15.3, charged: 0 },
    ]);
  });

  it('reports a fee that differs from the reported commission', () => {
    const execution = commissionExecution();

    expect(
      validateSecurityCommissions([execution], [commissionFee({ amount: '-12.00' })]),
    ).toEqual([{ execution, currency: Currency.Ils, expected: -15.3, charged: -12 }]);
  });

  it('expects the refund of a cancelled execution’s commission', () => {
    expect(
      validateSecurityCommissions(
        [commissionExecution({ trade_commission_value_nis: '-15.30' })],
        [commissionFee({ amount: '15.30' })],
      ),
    ).toEqual([]);
  });

  it('expects no fee when there is no commission', () => {
    expect(
      validateSecurityCommissions([commissionExecution({ trade_commission_value_nis: '0' })], []),
    ).toEqual([]);
  });

  it('does not count a fee of another security', () => {
    expect(
      validateSecurityCommissions(
        [commissionExecution()],
        [commissionFee({ source_reference: '1111111' })],
      ),
    ).toHaveLength(1);
  });

  it('adds up the commissions of several executions of one security', () => {
    expect(
      validateSecurityCommissions(
        [commissionExecution(), commissionExecution({ trade_commission_value_nis: '4.70' })],
        [commissionFee({ amount: '-20.00' })],
      ),
    ).toEqual([]);
  });
});
