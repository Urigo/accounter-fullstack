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
  headerFromSettings,
  irsCodesByEntity,
  taxAdjustmentWithOverrides,
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
  ['bank-fees', 5010],
]);

const LEDGER = [
  entry('bank', 'share-capital', 5000),
  entry('customer', 'revenue', 5000),
  entry('salaries', 'bank', 3000),
  entry('gifts', 'bank', 200),
  entry('current-taxes', 'accrued-expenses', 400),
  // financing expenses: 6666 subtracts 5000 (rule 3.1) on both the server and the generator side
  entry('bank-fees', 'bank', 100),
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
    profitBeforeTax: 1700,
    researchAndDevelopmentAddBack: 0,
    researchAndDevelopmentForTax: 0,
    fines: 0,
    untaxableGifts: 200,
    businessTripsExcessExpenses: 0,
    salaryExcessExpenses: 0,
    reserves: 0,
    nontaxableLinkage: 0,
    taxableIncome: 1900,
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
    expect(parsed.profitAndLoss.find(e => e.code === 5000)?.amount).toBe(100);
    expect(parsed.profitAndLoss.find(e => e.code === 6666)?.amount).toBe(1700);
    expect(parsed.taxAdjustment.find(e => e.code === 500)?.amount).toBe(1900);
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

describe('irsCodesByEntity', () => {
  const OWNER = 'owner-a';
  const OTHER_OWNER = 'owner-b';
  // `${owner}:${sortCode}` → default IRS code, as built from the sort codes in the read scope
  const DEFAULTS = new Map([
    [`${OWNER}:100`, 7110],
    [`${OTHER_OWNER}:200`, 7310],
  ]);

  it("prefers the entity's own IRS code, then its owner's sort-code default", () => {
    const codes = irsCodesByEntity(
      [
        { id: 'own-code', irs_code: 7120, sort_code: 100, owner_id: OWNER },
        { id: 'default', irs_code: null, sort_code: 100, owner_id: OWNER },
      ],
      DEFAULTS,
    );
    expect(codes.get('own-code')).toBe(7120);
    expect(codes.get('default')).toBe(7110);
  });

  it("never takes another business's default for the same sort-code key", () => {
    const codes = irsCodesByEntity(
      [{ id: 'unmapped', irs_code: null, sort_code: 200, owner_id: OWNER }],
      DEFAULTS,
    );
    // owner-a's sort code 200 has no default: the entity stays unmapped (and gets flagged)
    expect(codes.has('unmapped')).toBe(false);
  });
});

describe('6111 header from stored settings', () => {
  it('warns about every unset field, and fills the conventional ones with their defaults', () => {
    const { header, issues } = headerFromSettings({});
    expect(header.industryCode).toBe('');
    expect(header.businessType).toBeUndefined();
    expect(header.auditOpinionType).toBeUndefined();
    expect(header.reportingMethod).toBe('ACCRUAL');
    expect(header.softwareRegistrationNumber).toBe('99999999');
    expect(issues.map(issue => issue.path)).toEqual([
      'header.industryCode',
      'header.businessDescription',
      'header.businessType',
      'header.auditOpinionType',
      'header',
    ]);
    expect(issues.every(issue => issue.severity === 'WARNING')).toBe(true);
  });

  it('uses the stored values, with no warnings once all are set', () => {
    const { header, issues } = headerFromSettings({
      industryCode: '6201',
      businessDescription: 'פיתוח תוכנה',
      businessType: 'SERVICE',
      auditOpinionType: 'UNQUALIFIED',
      reportingMethod: 'CASH',
      accountingMethod: 'DOUBLE_ENTRY',
      accountingSystem: 'COMPUTERIZED',
      softwareRegistrationNumber: '99999999',
      isPartnership: false,
      ifrsImplementationYear: '9999',
      ifrsReportingOption: 'NONE',
      currencyType: 'SHEKELS',
      amountsInThousands: false,
    });
    expect(issues).toEqual([]);
    expect(header.businessType).toBe('SERVICE');
    expect(header.reportingMethod).toBe('CASH');
  });

  it('fails SHAAM validation without a business type or industry code', () => {
    const report = buildReport();
    const { isValid } = validateShaam6111Report({
      ...report,
      header: { ...report.header, businessType: undefined, industryCode: '' },
    });
    expect(isValid).toBe(false);
  });
});

describe('manual tax-adjustment amounts', () => {
  const inputs = {
    profitBeforeTax: 1000,
    researchAndDevelopmentAddBack: 0,
    researchAndDevelopmentForTax: 0,
    fines: 0,
    untaxableGifts: 0,
    businessTripsExcessExpenses: 0,
    salaryExcessExpenses: 0,
    reserves: 0,
    nontaxableLinkage: 0,
    taxableIncome: 1000,
    hasPreferredTaxRate: false,
  };

  it('keeps the computed amount next to every line the manual amounts changed', () => {
    const entries = taxAdjustmentWithOverrides(inputs, { '480': 300 });
    const byCode = (code: number) => entries.find(entry => entry.code === code);
    expect(byCode(480)).toMatchObject({ amount: 300, computedAmount: 0 });
    expect(byCode(500)).toMatchObject({ amount: 700, computedAmount: 1000 });
    expect(byCode(100)?.computedAmount).toBeUndefined();
  });
});
