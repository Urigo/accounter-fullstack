import { describe, expect, it } from 'vitest';
import {
  buildBalanceSheetEntries,
  buildProfitAndLossEntries,
  buildTaxAdjustmentEntries,
  fileEntries,
  isCorporateRegistrationNumber,
  isDebitNaturedBalanceSheetCode,
  isDebitNaturedProfitLossCode,
  irsCodesByBalanceSide,
  isOverridableTaxAdjustmentCode,
  netAmountsByFinancialEntity,
  profitAndLossMatchesBooks,
  retainedProfitFromProfitAndLoss,
  roundingTolerance,
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

  it('subtracts financing expenses (5000) in profit before tax (6666), per rule 3.1', () => {
    const withFees = buildProfitAndLossEntries(
      netAmountsByFinancialEntity([...LEDGER, entry('bank-fees', 'bank', 15)]),
      new Map([...IRS_CODES, ['bank-fees', 5010]]),
    );
    expect(amountOf(withFees, 5010)).toBe(15);
    expect(amountOf(withFees, 5000)).toBe(15);
    expect(amountOf(withFees, 6666)).toBe(amountOf(entries, 6666)! - 15);
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

  it('moves a balance on the wrong side to the entity contra code', () => {
    const contraCodes = new Map([['bank', 9110]]);
    const overdrawnNet = netAmountsByFinancialEntity([...LEDGER, entry('salaries', 'bank', 1000)]);
    const overdrawn = buildBalanceSheetEntries(
      overdrawnNet,
      irsCodesByBalanceSide(overdrawnNet, IRS_CODES, contraCodes),
      retainedProfit - 1000,
    );
    expect(amountOf(overdrawn, 7110)).toBe(0);
    expect(amountOf(overdrawn, 9110)).toBe(1000 - 150);
    expect(amountOf(overdrawn, 9999)).toBe(amountOf(overdrawn, 8888));

    // the same entity on its usual side keeps its own code
    const net = netAmountsByFinancialEntity(LEDGER);
    expect(irsCodesByBalanceSide(net, IRS_CODES, contraCodes).get('bank')).toBe(7110);
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
      inputs.nontaxableLinkage +
      (inputs.donations ?? 0)
    );
  }

  it('spreads the adjustments over the form lines', () => {
    const entries = buildTaxAdjustmentEntries(baseInputs);
    expect(amountOf(entries, 100)).toBe(400);
    expect(amountOf(entries, 104)).toBe(400);
    expect(amountOf(entries, 110)).toBe(10 + 5 + 7 + 3);
    expect(amountOf(entries, 150)).toBe(20);
    expect(amountOf(entries, 182)).toBe(4);
    expect(amountOf(entries, 190)).toBe(0);
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
    expect(amountOf(addition, 190)).toBe(50);
    expect(amountOf(addition, 200)).toBe(0);

    const deductionInputs = {
      ...baseInputs,
      researchAndDevelopmentAddBack: 300,
      researchAndDevelopmentForTax: -400,
    };
    const deduction = buildTaxAdjustmentEntries(deductionInputs);
    expect(amountOf(deduction, 190)).toBe(0);
    expect(amountOf(deduction, 200)).toBe(100);
    expect(amountOf(deduction, 370)).toBe(25 + 20 + 4 - 100);
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

  it('reports book and tax depreciation (120 / 130) as equal, leaving 370 unchanged', () => {
    const entries = buildTaxAdjustmentEntries({ ...baseInputs, depreciation: 1234.4 });
    expect(amountOf(entries, 120)).toBe(1234);
    expect(amountOf(entries, 130)).toBe(1234);
    expect(amountOf(entries, 370)).toBe(25 + 20 + 4);
  });

  it('reports financing expenses on tax debts in 182, and a net credit as a deduction', () => {
    const credit = buildTaxAdjustmentEntries({ ...baseInputs, nontaxableLinkage: -30 });
    expect(amountOf(credit, 182)).toBe(0);
    expect(amountOf(credit, 200)).toBe(30);
  });

  it('reports donations in 183 and keeps 500 on the taxable income', () => {
    const inputs = { ...baseInputs, donations: 60 };
    const entries = buildTaxAdjustmentEntries(inputs);
    expect(amountOf(entries, 183)).toBe(60);
    expect(amountOf(entries, 370)).toBe(25 + 20 + 4 + 60);
    expect(amountOf(entries, 500)).toBe(taxReportTaxableIncome(inputs));
  });

  it('replaces computed lines with manual amounts and recomputes the totals', () => {
    const entries = buildTaxAdjustmentEntries({
      ...baseInputs,
      overrides: new Map([
        [110, 0],
        [160, 15],
        [480, 100],
        // totals and 100 are always computed
        [370, 999],
        [100, 999],
      ]),
    });
    expect(amountOf(entries, 100)).toBe(400);
    expect(amountOf(entries, 110)).toBe(0);
    expect(amountOf(entries, 160)).toBe(15);
    expect(amountOf(entries, 370)).toBe(20 + 15 + 4);
    expect(amountOf(entries, 400)).toBe(400 + 39);
    expect(amountOf(entries, 480)).toBe(100);
    expect(amountOf(entries, 500)).toBe(439 - 100);
  });

  it('only accepts manual amounts for lines that are not computed totals', () => {
    expect(isOverridableTaxAdjustmentCode(480)).toBe(true);
    expect(isOverridableTaxAdjustmentCode(120)).toBe(true);
    expect(isOverridableTaxAdjustmentCode(100)).toBe(false);
    expect(isOverridableTaxAdjustmentCode(370)).toBe(false);
    expect(isOverridableTaxAdjustmentCode(500)).toBe(false);
    expect(isOverridableTaxAdjustmentCode(12345)).toBe(false);
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

describe('rounding to the shekel', () => {
  const ROUNDING_IRS_CODES = new Map<string, number>([
    ['bank', 7110],
    ['share-capital', 9910],
    ['revenue', 1030],
    ['salaries', 3511],
  ]);

  it('allows half a shekel per rounded line, plus half a shekel for the total', () => {
    expect(roundingTolerance(0)).toBe(0.5);
    expect(roundingTolerance(4)).toBe(2.5);
  });

  it('sets 100 to 6666 when they differ only by rounding, and keeps 400 on the books', () => {
    // revenue 1,000.60 and salaries 300.40 round to 1,001 and 300: 6666 = 701, the books 700.20
    const profitAndLoss = buildProfitAndLossEntries(
      netAmountsByFinancialEntity([
        entry('bank', 'revenue', 1000.6),
        entry('salaries', 'bank', 300.4),
      ]),
      ROUNDING_IRS_CODES,
    );
    expect(amountOf(profitAndLoss, 6666)).toBe(701);
    expect(profitAndLossMatchesBooks(profitAndLoss, 700.2)).toBe(true);

    const taxAdjustment = buildTaxAdjustmentEntries({
      profitBeforeTax: 700.2,
      profitAndLossTotal: 701,
      researchAndDevelopmentAddBack: 0,
      researchAndDevelopmentForTax: 0,
      fines: 0,
      untaxableGifts: 0,
      businessTripsExcessExpenses: 0,
      salaryExcessExpenses: 0,
      reserves: 0,
      nontaxableLinkage: 0,
      taxableIncome: 700.2,
      hasPreferredTaxRate: false,
    });
    // rule 3.7: 100 = 6666
    expect(amountOf(taxAdjustment, 100)).toBe(701);
    // the rounding difference is a deduction, so the taxable income stays the books' 700
    expect(amountOf(taxAdjustment, 200)).toBe(1);
    expect(amountOf(taxAdjustment, 400)).toBe(700);
    expect(amountOf(taxAdjustment, 500)).toBe(700);
  });

  it('does not treat a real mapping gap as rounding', () => {
    const profitAndLoss = buildProfitAndLossEntries(
      netAmountsByFinancialEntity([entry('bank', 'revenue', 1000)]),
      ROUNDING_IRS_CODES,
    );
    // the books also hold 300 of expenses that no IRS code carries into 6666
    expect(profitAndLossMatchesBooks(profitAndLoss, 700)).toBe(false);
  });

  it('absorbs a rounding difference between the two sides of the balance sheet in 9980', () => {
    // bank 1,000.80 funded by share capital 600.40 and revenue 400.40: 1,001 against 600 + 400
    const net = netAmountsByFinancialEntity([
      entry('bank', 'share-capital', 600.4),
      entry('bank', 'revenue', 400.4),
    ]);
    const profitAndLoss = buildProfitAndLossEntries(net, ROUNDING_IRS_CODES);
    const balanceSheet = buildBalanceSheetEntries(
      net,
      ROUNDING_IRS_CODES,
      retainedProfitFromProfitAndLoss(profitAndLoss),
      1,
    );
    expect(amountOf(balanceSheet, 7110)).toBe(1001);
    expect(amountOf(balanceSheet, 9910)).toBe(600);
    expect(amountOf(balanceSheet, 9980)).toBe(401);
    expect(amountOf(balanceSheet, 9999)).toBe(amountOf(balanceSheet, 8888));
  });

  it('leaves a difference larger than rounding visible', () => {
    // 100 left the bank to an entity with no IRS code: the sides really differ
    const net = netAmountsByFinancialEntity([
      entry('bank', 'share-capital', 1000),
      entry('unmapped', 'bank', 100),
    ]);
    const balanceSheet = buildBalanceSheetEntries(net, ROUNDING_IRS_CODES, 0);
    expect(amountOf(balanceSheet, 8888)).toBe(900);
    expect(amountOf(balanceSheet, 9999)).toBe(1000);
    expect(amountOf(balanceSheet, 9980)).toBe(0);
  });
});

describe('fileEntries', () => {
  it('keeps non-zero lines and the mandatory totals only', () => {
    const balanceSheet = [
      { code: 7000, amount: 0 },
      { code: 7110, amount: 0 },
      { code: 7310, amount: 5 },
      { code: 8888, amount: 0 },
      { code: 9000, amount: 0 },
      { code: 9999, amount: 0 },
    ];
    expect(fileEntries(balanceSheet, 'balanceSheet').map(e => e.code)).toEqual([
      7000, 7310, 8888, 9000, 9999,
    ]);
    expect(
      fileEntries(
        [
          { code: 1010, amount: 0 },
          { code: 6666, amount: 0 },
        ],
        'profitAndLoss',
      ).map(e => e.code),
    ).toEqual([6666]);
  });

  it('fits a full report in the 150-line sections', () => {
    const entries = buildProfitAndLossEntries(netAmountsByFinancialEntity(LEDGER), IRS_CODES);
    expect(entries.length).toBeGreaterThan(150);
    expect(fileEntries(entries, 'profitAndLoss').length).toBeLessThan(150);
  });
});

describe('isCorporateRegistrationNumber', () => {
  it('recognizes companies, not partnerships or personal IDs', () => {
    expect(isCorporateRegistrationNumber('516123456')).toBe(true);
    expect(isCorporateRegistrationNumber('520000000')).toBe(true);
    expect(isCorporateRegistrationNumber('550000000')).toBe(false);
    expect(isCorporateRegistrationNumber('012345678')).toBe(false);
    expect(isCorporateRegistrationNumber('51612345')).toBe(false);
    expect(isCorporateRegistrationNumber(null)).toBe(false);
  });
});
