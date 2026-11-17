import { describe, expect, it } from 'vitest';
import { generateReport, parseReport } from '@accounter/shaam6111-generator';
import type { Shaam6111Data } from '../../../../__generated__/types.js';
import {
  buildBalanceSheetEntries,
  buildProfitAndLossEntries,
  buildTaxAdjustmentEntries,
  fileEntries,
  netAmountsByFinancialEntity,
  retainedProfitFromProfitAndLoss,
} from '../shaam6111-computation.helper.js';
import {
  convertLocalReportDataToShaam6111ReportData,
  validateShaam6111Report,
} from '../shaam6111.helper.js';

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

const IRS_CODES = new Map<string, number>([
  ['bank', 7110],
  ['customer', 7310],
  ['accrued-expenses', 9420],
  ['share-capital', 9910],
  ['revenue', 1040],
  ['salaries', 3511],
  ['gifts', 3625],
  ['current-taxes', 5610],
]);

const LEDGER = [
  entry('bank', 'share-capital', 5000),
  entry('customer', 'revenue', 5000),
  entry('salaries', 'bank', 3000),
  entry('gifts', 'bank', 200),
  entry('current-taxes', 'accrued-expenses', 400),
];

function buildReport(): Shaam6111Data {
  const net = netAmountsByFinancialEntity(LEDGER);
  const profitAndLoss = buildProfitAndLossEntries(net, IRS_CODES);
  const balanceSheet = buildBalanceSheetEntries(
    net,
    IRS_CODES,
    retainedProfitFromProfitAndLoss(profitAndLoss),
  );
  const taxAdjustment = buildTaxAdjustmentEntries({
    profitBeforeTax: 1800,
    researchAndDevelopmentAddBack: 0,
    researchAndDevelopmentForTax: 0,
    fines: 0,
    untaxableGifts: 200,
    businessTripsExcessExpenses: 0,
    salaryExcessExpenses: 0,
    reserves: 0,
    nontaxableLinkage: 0,
    taxableIncome: 2000,
    hasPreferredTaxRate: false,
  });
  return {
    id: 'test',
    individualOrCompany: 'COMPANY',
    profitAndLoss,
    taxAdjustment,
    balanceSheet,
    header: {
      taxFileNumber: '516123452',
      taxYear: '2025',
      idNumber: '516123452',
      vatFileNumber: '516123452',
      withholdingTaxFileNumber: '937000008',
      industryCode: '6201',
      businessDescription: 'פיתוח תוכנה',
      businessType: 'SERVICE',
      reportingMethod: 'ACCRUAL',
      accountingMethod: 'DOUBLE_ENTRY',
      accountingSystem: 'COMPUTERIZED',
      includesProfitLoss: true,
      includesTaxAdjustment: true,
      includesBalanceSheet: true,
      profitLossEntryCount: fileEntries(profitAndLoss, 'profitAndLoss').length,
      taxAdjustmentEntryCount: fileEntries(taxAdjustment, 'taxAdjustment').length,
      balanceSheetEntryCount: fileEntries(balanceSheet, 'balanceSheet').length,
      softwareRegistrationNumber: '99999999',
      isPartnership: false,
      ifrsImplementationYear: '9999',
      ifrsReportingOption: 'NONE',
      currencyType: 'SHEKELS',
      amountsInThousands: false,
      auditOpinionType: 'UNQUALIFIED',
    },
  };
}

describe('SHAAM 6111 report validation', () => {
  it('produces a report that passes the SHAAM rules for a balanced set of books', () => {
    const report = buildReport();
    const { isValid, issues } = validateShaam6111Report(report);
    expect(issues).toEqual([]);
    expect(isValid).toBe(true);
  });

  it('generates a file whose lines round-trip', () => {
    const fileData = convertLocalReportDataToShaam6111ReportData(buildReport());
    const parsed = parseReport(generateReport(fileData, true), false);
    expect(parsed.profitAndLoss).toEqual(fileData.profitAndLoss);
    expect(parsed.taxAdjustment).toEqual(fileData.taxAdjustment);
    expect(parsed.balanceSheet).toEqual(fileData.balanceSheet);
    expect(parsed.taxAdjustment.find(e => e.code === 500)?.amount).toBe(2000);
    expect(parsed.taxAdjustment.find(e => e.code === 110)?.amount).toBe(200);
  });

  it('reports an unbalanced balance sheet and diagnostics as blocking issues', () => {
    const report = buildReport();
    const unbalanced = {
      ...report,
      balanceSheet: report.balanceSheet!.map(e => (e.code === 9999 ? { ...e, amount: 1 } : e)),
    };
    const { isValid, issues } = validateShaam6111Report(unbalanced, [
      { severity: 'WARNING', message: 'unmapped', path: 'mapping' },
    ]);
    expect(isValid).toBe(false);
    expect(issues.some(issue => issue.severity === 'ERROR' && /8888/.test(issue.message))).toBe(
      true,
    );
    expect(issues.at(-1)).toEqual({ severity: 'WARNING', message: 'unmapped', path: 'mapping' });
  });

  it('does not block the file on warnings alone', () => {
    const { isValid } = validateShaam6111Report(buildReport(), [
      { severity: 'WARNING', message: 'check the withholding file number' },
    ]);
    expect(isValid).toBe(true);
  });
});
