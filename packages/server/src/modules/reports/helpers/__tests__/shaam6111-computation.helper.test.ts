import { describe, expect, it } from 'vitest';
import {
  buildBalanceSheetEntries,
  buildProfitAndLossEntries,
  buildTaxAdjustmentEntries,
  isDebitNaturedBalanceSheetCode,
  isDebitNaturedProfitLossCode,
  netAmountsByFinancialEntity,
  retainedProfitFromProfitAndLoss,
  type Shaam6111Entry,
  type Shaam6111TaxAdjustmentInputs,
} from '../shaam6111-computation.helper.js';

/** A double entry: debit `debit`, credit `credit`, for `amount` in local currency */
function entry(debit: string, credit: string, amount: number) {
  return {
    debit_entity1: debit,
    debit_local_amount1: String(amount),
    credit_entity1: credit,
    credit_local_amount1: String(amount),
    debit_entity2: null,
    debit_local_amount2: null,
    credit_entity2: null,
    credit_local_amount2: null,
  };
}

function amountOf(entries: readonly Shaam6111Entry[], code: number) {
  return entries.find(e => e.code === code)?.amount;
}

/** Entity id → 6111 code */
const IRS_CODES = new Map<string, number>([
  ['bank', 7110],
  ['customer', 7310],
  ['doubtful-allowance', 7380],
  ['computers', 8050],
  ['computers-depreciation', 8150],
  ['accrued-expenses', 9420],
  ['severance-liability', 9710],
  ['severance-fund', 9720],
  ['share-capital', 9910],
  ['revenue', 1030],
  ['purchases', 1320],
  ['closing-inventory', 1450],
  ['inventory', 7810],
  ['salaries', 3511],
  ['depreciation', 3580],
  ['doubtful-debts', 3610],
  ['capital-loss', 5310],
  ['current-taxes', 5610],
]);

/** A small, balanced set of books for a company's first year */
const LEDGER = [
  entry('bank', 'share-capital', 1000),
  entry('customer', 'revenue', 1000),
  entry('salaries', 'bank', 400),
  entry('capital-loss', 'bank', 50),
  entry('current-taxes', 'accrued-expenses', 100),
  entry('computers', 'bank', 300),
  entry('depreciation', 'computers-depreciation', 60),
  entry('severance-fund', 'bank', 20),
  entry('salaries', 'severance-liability', 30),
  entry('doubtful-debts', 'doubtful-allowance', 10),
  entry('purchases', 'bank', 80),
  entry('inventory', 'closing-inventory', 30),
];

describe('netAmountsByFinancialEntity', () => {
  it('nets credit − debit per entity across both entity slots', () => {
    const net = netAmountsByFinancialEntity([
      entry('a', 'b', 100),
      {
        ...entry('a', 'b', 0),
        debit_entity2: 'c',
        debit_local_amount2: '25.5',
        credit_entity2: 'a',
        credit_local_amount2: '25.5',
      },
    ]);
    expect(net.get('a')).toBe(-100 + 25.5);
    expect(net.get('b')).toBe(100);
    expect(net.get('c')).toBe(-25.5);
  });
});

describe('code orientation', () => {
  it('treats expense lines, other expenses, taxes and dividends as debit lines', () => {
    for (const code of [1306, 2510, 3511, 5010, 5310, 5610, 5710]) {
      expect(isDebitNaturedProfitLossCode(code)).toBe(true);
    }
    for (const code of [1010, 5110, 5210, 5810, 1450, 2095, 2068, 3068, 3568]) {
      expect(isDebitNaturedProfitLossCode(code)).toBe(false);
    }
  });

  it('treats contra accounts on the opposite side of their section', () => {
    expect(isDebitNaturedBalanceSheetCode(7110)).toBe(true);
    expect(isDebitNaturedBalanceSheetCode(7380)).toBe(false);
    expect(isDebitNaturedBalanceSheetCode(8150)).toBe(false);
    expect(isDebitNaturedBalanceSheetCode(9710)).toBe(false);
    expect(isDebitNaturedBalanceSheetCode(9720)).toBe(true);
  });
});

describe('buildProfitAndLossEntries', () => {
  const entries = buildProfitAndLossEntries(netAmountsByFinancialEntity(LEDGER), IRS_CODES);

  it('reports income and expense lines as positive amounts', () => {
    expect(amountOf(entries, 1030)).toBe(1000);
    expect(amountOf(entries, 3511)).toBe(430);
    expect(amountOf(entries, 5310)).toBe(50);
    expect(amountOf(entries, 5610)).toBe(100);
  });

  it('subtracts closing inventory from cost of sales', () => {
    expect(amountOf(entries, 1320)).toBe(80);
    expect(amountOf(entries, 1450)).toBe(30);
    expect(amountOf(entries, 1300)).toBe(50);
  });

  it('subtracts other expenses (5300) in profit before tax (6666)', () => {
    expect(amountOf(entries, 1000)).toBe(1000);
    expect(amountOf(entries, 3500)).toBe(430 + 60 + 10);
    expect(amountOf(entries, 5300)).toBe(50);
    // 1000 − 1300 − 3500 − 5300
    expect(amountOf(entries, 6666)).toBe(1000 - 50 - 500 - 50);
    expect(amountOf(entries, 5600)).toBe(100);
  });

  it('lists every 6111 P&L code once, sorted', () => {
    const codes = entries.map(e => e.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect([...codes].sort((a, b) => a - b)).toEqual(codes);
  });
});

describe('buildBalanceSheetEntries', () => {
  const net = netAmountsByFinancialEntity(LEDGER);
  const retainedProfit = retainedProfitFromProfitAndLoss(buildProfitAndLossEntries(net, IRS_CODES));
  const entries = buildBalanceSheetEntries(net, IRS_CODES, retainedProfit);

  it('derives retained earnings from the after-tax profit', () => {
    // 6666 (400) − 5600 (100)
    expect(retainedProfit).toBe(300);
    expect(amountOf(entries, 9980)).toBe(300);
  });

  it('presents contra accounts as positive amounts subtracted from their section', () => {
    expect(amountOf(entries, 7310)).toBe(1000);
    expect(amountOf(entries, 7380)).toBe(10);
    expect(amountOf(entries, 7300)).toBe(990);
    expect(amountOf(entries, 8050)).toBe(300);
    expect(amountOf(entries, 8150)).toBe(60);
    expect(amountOf(entries, 8000)).toBe(240);
    expect(amountOf(entries, 9710)).toBe(30);
    expect(amountOf(entries, 9720)).toBe(20);
    expect(amountOf(entries, 9700)).toBe(10);
  });

  it('balances: total assets (8888) equal liabilities and equity (9999)', () => {
    // bank: 1000 − 400 − 50 − 300 − 20 − 80
    expect(amountOf(entries, 7110)).toBe(150);
    expect(amountOf(entries, 7000)).toBe(150 + 990 + 30);
    expect(amountOf(entries, 8888)).toBe(150 + 990 + 30 + 240);
    expect(amountOf(entries, 9999)).toBe(amountOf(entries, 8888));
  });

  it('adds opening retained earnings booked to an equity entity mapped to 9980', () => {
    const withOpening = buildBalanceSheetEntries(
      netAmountsByFinancialEntity([...LEDGER, entry('bank', 'opening-retained', 500)]),
      new Map([...IRS_CODES, ['opening-retained', 9980]]),
      retainedProfit,
    );
    expect(amountOf(withOpening, 9980)).toBe(800);
    expect(amountOf(withOpening, 9999)).toBe(amountOf(withOpening, 8888));
  });

  it('keeps a negative balance on a non-contra line visible instead of flipping it', () => {
    // an overdrawn bank account must be reclassified (9110), not silently shown as cash
    const overdrawn = buildBalanceSheetEntries(
      netAmountsByFinancialEntity([...LEDGER, entry('salaries', 'bank', 1000)]),
      IRS_CODES,
      retainedProfit - 1000,
    );
    expect(amountOf(overdrawn, 7110)).toBe(150 - 1000);
    expect(amountOf(overdrawn, 9999)).toBe(amountOf(overdrawn, 8888));
  });
});

describe('buildTaxAdjustmentEntries', () => {
  const baseInputs: Shaam6111TaxAdjustmentInputs = {
    profitBeforeTax: 400,
    researchAndDevelopmentAddBack: 0,
    researchAndDevelopmentForTax: 0,
    fines: 10,
    untaxableGifts: 5,
    businessTripsExcessExpenses: 7,
    salaryExcessExpenses: 3,
    reserves: 20,
    nontaxableLinkage: 4,
    taxableIncome: 0,
    hasPreferredTaxRate: false,
  };

  /** The tax report's taxable income (tax.helper.ts), before taking out special-rate income */
  function taxReportTaxableIncome(inputs: Shaam6111TaxAdjustmentInputs) {
    return (
      inputs.profitBeforeTax +
      inputs.researchAndDevelopmentAddBack +
      inputs.researchAndDevelopmentForTax +
      inputs.fines +
      inputs.untaxableGifts +
      inputs.businessTripsExcessExpenses +
      inputs.salaryExcessExpenses +
      inputs.reserves +
      inputs.nontaxableLinkage
    );
  }

  it('spreads the adjustments over the form lines', () => {
    const entries = buildTaxAdjustmentEntries(baseInputs);
    expect(amountOf(entries, 100)).toBe(400);
    expect(amountOf(entries, 104)).toBe(400);
    expect(amountOf(entries, 110)).toBe(10 + 5 + 7 + 3);
    expect(amountOf(entries, 150)).toBe(20);
    expect(amountOf(entries, 190)).toBe(4);
    expect(amountOf(entries, 200)).toBe(0);
    expect(amountOf(entries, 370)).toBe(25 + 20 + 4);
    expect(amountOf(entries, 510)).toBe(0);
  });

  it('keeps 400 = 100 + 370 and 500 equal to the tax report taxable income', () => {
    const entries = buildTaxAdjustmentEntries(baseInputs);
    expect(amountOf(entries, 400)).toBe(amountOf(entries, 100)! + amountOf(entries, 370)!);
    expect(amountOf(entries, 500)).toBe(taxReportTaxableIncome(baseInputs));
  });

  it('reports the section 20A R&D timing difference net: addition in 190, deduction in 200', () => {
    const addition = buildTaxAdjustmentEntries({
      ...baseInputs,
      researchAndDevelopmentAddBack: 300,
      researchAndDevelopmentForTax: -250,
    });
    expect(amountOf(addition, 190)).toBe(50 + 4);
    expect(amountOf(addition, 200)).toBe(0);

    const deductionInputs = {
      ...baseInputs,
      researchAndDevelopmentAddBack: 300,
      researchAndDevelopmentForTax: -400,
    };
    const deduction = buildTaxAdjustmentEntries(deductionInputs);
    expect(amountOf(deduction, 190)).toBe(0);
    expect(amountOf(deduction, 200)).toBe(100 - 4);
    expect(amountOf(deduction, 370)).toBe(25 + 20 - 96);
    expect(amountOf(deduction, 500)).toBe(taxReportTaxableIncome(deductionInputs));
  });

  it('never reports negative excess expenses (110)', () => {
    const entries = buildTaxAdjustmentEntries({
      ...baseInputs,
      fines: -50,
      untaxableGifts: 0,
      businessTripsExcessExpenses: 0,
      salaryExcessExpenses: 0,
      nontaxableLinkage: 0,
    });
    expect(amountOf(entries, 110)).toBe(0);
    expect(amountOf(entries, 200)).toBe(50);
  });

  it('reports special-rate income (510) only with a preferred rate, and never negative', () => {
    expect(
      amountOf(buildTaxAdjustmentEntries({ ...baseInputs, taxableIncome: 449 }), 510),
    ).toBe(0);
    expect(
      amountOf(
        buildTaxAdjustmentEntries({ ...baseInputs, taxableIncome: 449, hasPreferredTaxRate: true }),
        510,
      ),
    ).toBe(449);
    expect(
      amountOf(
        buildTaxAdjustmentEntries({ ...baseInputs, taxableIncome: -10, hasPreferredTaxRate: true }),
        510,
      ),
    ).toBe(0);
  });
});
