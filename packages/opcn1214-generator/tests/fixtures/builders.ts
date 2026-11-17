/**
 * Input builders for tests. `minimalInput()` is the smallest fileable report: it must stay valid
 * against EVERY rule of SPEC §10 (no errors and no warnings); later steps rely on that, so any
 * change here has to keep it so.
 */
import type { Report1214Input } from '../../src/model/input.js';

/** Overrides for a builder: objects merge recursively, arrays and other values replace. */
export type DeepPartial<T> = T extends readonly unknown[]
  ? T
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepMerge(base: unknown, overrides: unknown): unknown {
  if (!isPlainObject(base) || !isPlainObject(overrides)) {
    return overrides;
  }
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    merged[key] = deepMerge(base[key], value);
  }
  return merged;
}

/** A valid skeleton report (SPEC §7.2) with `overrides` deep-merged into it. */
export function minimalInput(overrides: DeepPartial<Report1214Input> = {}): Report1214Input {
  const base: Report1214Input = {
    taxYear: 2024,
    company: {
      fileNumber: '514000009',
      registeredName: 'חברה לדוגמה בע"מ',
      mailingAddress: 'רחוב הרצל 1, תל אביב',
      businessAddress: 'רחוב הרצל 1, תל אביב',
      phone: { prefix: '03', number: '1234567' },
    },
    declarations: {
      hasTaxPlanningAction: false,
      hadRelatedPartyTransactions: false,
      controlsBodyOfPersons: false,
      holdsRightsInBodyOfPersons: false,
      appliesAccountingStandards: false,
      directorsReceivedOpinion: false,
      tookReportablePosition: false,
    },
    amounts: { '018': 4, '072': 0, '081': 1000, '094': 0, '263': 1 },
    shareholders: [
      {
        idNumber: '123456782',
        fullName: 'ישראל ישראלי',
        isControllingShareholder: true,
        dividendRightsPercent: 100,
      },
    ],
  };
  return deepMerge(base, overrides) as Report1214Input;
}

/**
 * `minimalInput()` with the preparer and every optional declaration set (SPEC §7.2), each to a
 * value that is written to the file (flags marked, yes/no members answered), plus the codes the
 * declarations call for (080 family company, 084 house company, 226 kibbutz). `overrides` are
 * deep-merged into it.
 */
export function fullDeclarationsInput(
  overrides: DeepPartial<Report1214Input> = {},
): Report1214Input {
  const base = minimalInput({
    preparer: {
      officeName: 'משרד רואי חשבון',
      contactName: 'דנה כהן',
      name: 'יוסי לוי',
      profession: 'רואה חשבון',
      licensedDealerNumber: '012345678',
      address: 'רחוב יפו 10, ירושלים',
      phone: { prefix: '02', number: '6543210' },
    },
    declarations: {
      tookReportablePosition: true,
      reportablePositions: [12, 7, 345, 1, 999],
      form6111Obligation: 'obliged',
      financialStatementsAttached: true,
      familyCompany: { representativeFileNumber: '300000007' },
      isHouseCompany: true,
      form1343Attached: true,
      form1344Attached: true,
      claimsCapitalInvestmentLawBenefits: true,
      preferredEnterprise: true,
      beneficiaryEnterprise: { noticeDate: '2023-05-14' },
      dividendDistributed: true,
      specialYear: { balanceSheetDate: '2024-09-30' },
      foreignInvestors: true,
      consolidatedReport: 'consolidatesWithParent',
      partnerInPartnership: true,
      isKibbutz: true,
      requestsAdvancePayments: true,
      hasBuildingIncome: false,
      isTrustBeneficiary: true,
      nonDeductibleSalaryExpenses: true,
      fewMembersCompany62A: true,
      partOfMultinationalGroup: true,
      noBankAccount: true,
      hasCapitalGainsAppendix: true,
    },
    amounts: { '080': 0, '084': 0, '226': 1 },
  });
  return deepMerge(base, overrides) as Report1214Input;
}

/**
 * `fullDeclarationsInput()` with the remaining header groups of record 1000 set (SPEC §7.2): other
 * taxable income, attachments (with the codes 070 and 010 they certify), the capital-gains summary
 * and the qualifying company, each member to a value that is written to the file. 833 is derived
 * from the untransmitted count, so `hasCapitalGainsAppendix` is left out (the input is canonical).
 * `overrides` are deep-merged into it.
 */
export function fullMainInput(overrides: DeepPartial<Report1214Input> = {}): Report1214Input {
  const base = deepMerge(fullDeclarationsInput(), {
    otherTaxableIncome: { source: 'דמי שכירות', amount: 25_000, ratePercent: 10.23 },
    attachments: { donationReceiptsCount: 2, withholdingCertificatesCount: 3 },
    capitalGainsSummary: {
      totalAppendicesCount: 4,
      untransmittedCount: 3,
      reasons: {
        lossOrNoGain: true,
        overFiveImprovementBalances: true,
        over14Appendices: true,
        other: true,
        otherText: 'העסקה בוטלה',
      },
    },
    qualifyingCompany: {
      purchased: true,
      israeliPurchaseAmount: 1_000_000,
      foreignPurchaseAmount: 2_500_000,
      amortizationClaimed: true,
      amortizationAmount: 150_000,
    },
    amounts: { '010': 1200, '070': 500 },
  }) as Report1214Input;
  delete base.declarations.hasCapitalGainsAppendix;
  return deepMerge(base, overrides) as Report1214Input;
}
