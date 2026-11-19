/**
 * Record 1000 conditional requirements and consistency warnings (SPEC §9.2 stage 4, §10.3): pure
 * checks over the normalized main record, so they run on validated input and on parsed files alike.
 */
import type { Primitive } from '../codec/types.js';
import { Opcn1214InternalError } from '../errors.js';
import { isCapitalGainsRecordType } from '../layout/capital-gains.js';
import type { FieldDef } from '../layout/types.js';
import type { NormalizedRecord, NormalizedReport } from '../model/normalized.js';
import {
  codeKey,
  pathFor,
  REPORTABLE_POSITION_KEYS,
  REPORTABLE_POSITIONS,
} from '../normalize/paths.js';
import { makeIssue, type Issue } from './issue.js';
import type { RuleId } from './rules.js';

type ReportRule = (report: NormalizedReport) => Issue[];

const FAMILY_COMPANY = 'declarations.familyCompany.isFamilyCompany';
const BENEFICIARY_ENTERPRISE = 'declarations.beneficiaryEnterprise.marked';
const SPECIAL_YEAR = 'declarations.specialYear.marked';
const INVESTMENT_LAW = 'declarations.claimsCapitalInvestmentLawBenefits';
/** The field the positions issue is located at, 1000@1034. */
const FIRST_POSITION = 'declarations.reportablePositions[0]';
/** Codes whose presence calls for 849 (p.8). */
const INVESTMENT_LAW_CODES = ['101', '102'] as const;
/** Code 226 value "other cooperative society, not a kibbutz" (p.18). */
const OTHER_COOPERATIVE = 9;
const UNTRANSMITTED_COUNT = 'capitalGainsSummary.untransmittedCount';
/** The reasons for untransmitted capital-gains appendices, 1000@964–967 (p.10–11). */
const UNTRANSMITTED_REASONS = [
  'capitalGainsSummary.reasons.lossOrNoGain',
  'capitalGainsSummary.reasons.overFiveImprovementBalances',
  'capitalGainsSummary.reasons.over14Appendices',
  'capitalGainsSummary.reasons.other',
] as const;
/** Codes derived from `bankAccount` (SPEC §7.4). */
const BANK_ACCOUNT_CODES = ['277', '278', '280'] as const;
const ISRAELI_PURCHASE = 'qualifyingCompany.israeliPurchaseAmount';
const FOREIGN_PURCHASE = 'qualifyingCompany.foreignPurchaseAmount';

/**
 * True for a number above 0: an optional count or amount of 0 is absent in the file (SPEC §8.4), so
 * input and parsed files are judged alike.
 */
function isPositive(value: Primitive): boolean {
  return typeof value === 'number' && value > 0;
}

/** The 1000 records of `report` (one per report). */
function mainRecords(report: NormalizedReport): NormalizedRecord[] {
  return report.records.filter(record => record.recordType === '1000');
}

function mainField(report: NormalizedReport, key: string): FieldDef {
  const field = report.layout.records['1000'].fields.find(def => def.key === key);
  if (!field) {
    throw new Opcn1214InternalError(`Record 1000 has no field "${key}"`);
  }
  return field;
}

/** An issue of `ruleId` located at the header field `key` of `record`. */
function fieldIssue(
  ruleId: RuleId,
  report: NormalizedReport,
  record: NormalizedRecord,
  key: string,
  message: string,
  path = pathFor(record.recordType, record.index, key),
): Issue {
  const field = mainField(report, key);
  return makeIssue(ruleId, {
    message,
    path,
    recordType: record.recordType,
    recordIndex: record.index,
    field: { position: field.position, length: field.length, nameHe: field.nameHe },
    specRef: { page: field.specPage },
  });
}

/** An issue of `ruleId` located at the absent `code` of `record`. */
function codeIssue(
  ruleId: RuleId,
  report: NormalizedReport,
  record: NormalizedRecord,
  code: string,
  message: string,
): Issue {
  const def = report.layout.records['1000'].codes.find(candidate => candidate.code === code);
  if (!def) {
    throw new Opcn1214InternalError(`Record 1000 has no code ${code}`);
  }
  return makeIssue(ruleId, {
    message,
    path: pathFor(record.recordType, record.index, codeKey(code)),
    recordType: record.recordType,
    recordIndex: record.index,
    code,
    specRef: { page: def.specPage },
  });
}

/** A rule: when the flag or yes/no `condition` is true, the header field `key` must have a value. */
function requiresField(ruleId: RuleId, condition: string, key: string, why: string): ReportRule {
  return report =>
    mainRecords(report)
      .filter(record => record.values[condition] === true && record.values[key] === undefined)
      .map(record =>
        fieldIssue(
          ruleId,
          report,
          record,
          key,
          `${why}: field ${key} (1000@${mainField(report, key).position}) is required.`,
        ),
      );
}

/**
 * A rule: when the flag or yes/no `condition` is true, `code` must be in the code-amount section
 * (with value 0 when the code is zeroAllowed: zeros of other codes are omitted while normalizing).
 */
function requiresCode(ruleId: RuleId, condition: string, code: string, why: string): ReportRule {
  return report =>
    mainRecords(report)
      .filter(record => record.values[condition] === true && !record.codes.has(code))
      .map(record => codeIssue(ruleId, report, record, code, `${why}: code ${code} is required.`));
}

/** main.familyCompany.fileNumber: 836 marked without 837 (p.7). */
const familyCompanyFileNumber = requiresField(
  'main.familyCompany.fileNumber',
  FAMILY_COMPANY,
  'declarations.familyCompany.representativeFileNumber',
  'The company is a family company (1000@836)',
);

/** main.familyCompany.code080: 836 marked without code 080, 0 allowed (p.15). */
const familyCompanyCode080 = requiresCode(
  'main.familyCompany.code080',
  FAMILY_COMPANY,
  '080',
  'The company is a family company (1000@836)',
);

/** main.houseCompany.code084: 846 marked without code 084, 0 allowed (p.15). */
const houseCompanyCode084 = requiresCode(
  'main.houseCompany.code084',
  'declarations.isHouseCompany',
  '084',
  'The company is a house company (1000@846)',
);

/** main.investmentLaw.flag: code 101 or 102 filled but 849 not marked (p.8). */
function investmentLawFlag(report: NormalizedReport): Issue[] {
  return mainRecords(report).flatMap(record => {
    const filled = INVESTMENT_LAW_CODES.filter(code => record.codes.has(code));
    if (filled.length === 0 || record.values[INVESTMENT_LAW] === true) {
      return [];
    }
    return [
      fieldIssue(
        'main.investmentLaw.flag',
        report,
        record,
        INVESTMENT_LAW,
        `Code ${filled.join(' and ')} is filled, so ${INVESTMENT_LAW} (1000@849) must be marked.`,
      ),
    ];
  });
}

/** main.beneficiaryEnterprise.noticeDate: 851 marked without 852 (p.8). */
const beneficiaryEnterpriseNoticeDate = requiresField(
  'main.beneficiaryEnterprise.noticeDate',
  BENEFICIARY_ENTERPRISE,
  'declarations.beneficiaryEnterprise.noticeDate',
  'A beneficiary enterprise is marked (1000@851)',
);

/** main.specialYear.balanceSheetDate: 863 marked without 864 (p.8). */
const specialYearBalanceSheetDate = requiresField(
  'main.specialYear.balanceSheetDate',
  SPECIAL_YEAR,
  'declarations.specialYear.balanceSheetDate',
  'A special year is marked (1000@863)',
);

/** main.kibbutz.code226: isKibbutz without code 226 (p.9, p.18; SPEC §15 A-13). */
const kibbutzCode226 = requiresCode(
  'main.kibbutz.code226',
  'declarations.isKibbutz',
  '226',
  'The company is a kibbutz (1000@877)',
);

/** main.buildingIncome.code259: hasBuildingIncome (884 = yes) without code 259 (p.9). */
const buildingIncomeCode259 = requiresCode(
  'main.buildingIncome.code259',
  'declarations.hasBuildingIncome',
  '259',
  'The company has income from a building (1000@884)',
);

/** main.cgReasons.otherText: reason "other" (967) marked without its text (968) (p.11). */
const cgReasonsOtherText = requiresField(
  'main.cgReasons.otherText',
  'capitalGainsSummary.reasons.other',
  'capitalGainsSummary.reasons.otherText',
  'The capital-gains reason "other" is marked (1000@967)',
);

/**
 * main.reportablePositions.required: tookReportablePosition (1030 = yes) and none of the positions
 * 1034–1046 (p.11). Reported at the positions array, located at the first position field.
 */
function reportablePositionsRequired(report: NormalizedReport): Issue[] {
  return mainRecords(report)
    .filter(
      record =>
        record.values['declarations.tookReportablePosition'] === true &&
        REPORTABLE_POSITION_KEYS.every(key => record.values[key] === undefined),
    )
    .map(record =>
      fieldIssue(
        'main.reportablePositions.required',
        report,
        record,
        FIRST_POSITION,
        `declarations.tookReportablePosition is yes (1000@1030), so at least one reportable position number (1000@1034–1046) is required.`,
        REPORTABLE_POSITIONS,
      ),
    );
}

/** main.kibbutz.code226Other: code 226 = 9 ("other cooperative, not kibbutz") while kibbutz (p.18). */
function kibbutzCode226Other(report: NormalizedReport): Issue[] {
  return mainRecords(report)
    .filter(
      record =>
        record.values['declarations.isKibbutz'] === true &&
        record.codes.get('226') === OTHER_COOPERATIVE,
    )
    .map(record => ({
      ...codeIssue(
        'main.kibbutz.code226Other',
        report,
        record,
        '226',
        `The company is a kibbutz (1000@877), but code 226 is ${OTHER_COOPERATIVE} ("other cooperative society, not a kibbutz").`,
      ),
      value: OTHER_COOPERATIVE,
    }));
}

/**
 * main.reportablePositions.unexpected: positions 1034–1046 given while tookReportablePosition
 * (1030) is no (p.11). Reported at the positions array, located at the first position field.
 */
function reportablePositionsUnexpected(report: NormalizedReport): Issue[] {
  return mainRecords(report)
    .filter(
      record =>
        record.values['declarations.tookReportablePosition'] === false &&
        REPORTABLE_POSITION_KEYS.some(key => record.values[key] !== undefined),
    )
    .map(record =>
      fieldIssue(
        'main.reportablePositions.unexpected',
        report,
        record,
        FIRST_POSITION,
        `Reportable position numbers (1000@1034–1046) are given, but declarations.tookReportablePosition is no (1000@1030).`,
        REPORTABLE_POSITIONS,
      ),
    );
}

/** Code 165: the total of the investments in R&D companies, detailed in records 1030 (p.17). */
const RD_TOTAL_CODE = '165';

/** The amount a field or code holds in whole shekels, as the file holds it; 0 when not a number. */
function wholeShekels(value: Primitive): number {
  return typeof value === 'number' ? Math.round(value) : 0;
}

/** main.rd.records: code 165 > 0 without any 1030 record (p.17). */
function rdRecords(report: NormalizedReport): Issue[] {
  if (report.records.some(record => record.recordType === '1030')) {
    return [];
  }
  return mainRecords(report)
    .filter(record => isPositive(record.codes.get(RD_TOTAL_CODE)))
    .map(record =>
      codeIssue(
        'main.rd.records',
        report,
        record,
        RD_TOTAL_CODE,
        `Code ${RD_TOTAL_CODE} (investments in R&D companies) is filled, so the investments must be detailed in rdInvestments (records 1030).`,
      ),
    );
}

/**
 * main.rd.total: the investment amounts of the 1030 records do not add up to code 165 (p.17),
 * compared in whole shekels (each amount rounded as it is written). Checked only when code 165 and
 * at least one 1030 record are present: code 165 without records is main.rd.records.
 */
function rdTotal(report: NormalizedReport): Issue[] {
  const investments = report.records.filter(record => record.recordType === '1030');
  if (investments.length === 0) {
    return [];
  }
  const total = investments.reduce(
    (sum, record) => sum + wholeShekels(record.values['investmentAmount']),
    0,
  );
  return mainRecords(report)
    .filter(record => {
      const code = record.codes.get(RD_TOTAL_CODE);
      return code !== undefined && wholeShekels(code) !== total;
    })
    .map(record => {
      const code = wholeShekels(record.codes.get(RD_TOTAL_CODE));
      return {
        ...codeIssue(
          'main.rd.total',
          report,
          record,
          RD_TOTAL_CODE,
          `Code ${RD_TOTAL_CODE} is ${code}, but the R&D investments (records 1030) total ${total}.`,
        ),
        value: code,
        expected: String(total),
      };
    });
}

/**
 * main.cgUntransmitted.reason: untransmitted appendices (962 > 0) without any of the reasons
 * 964–967 (p.10–11). Reported at the reasons object, located at the first reason field.
 */
function cgUntransmittedReason(report: NormalizedReport): Issue[] {
  return mainRecords(report)
    .filter(
      record =>
        isPositive(record.values[UNTRANSMITTED_COUNT]) &&
        UNTRANSMITTED_REASONS.every(key => record.values[key] !== true),
    )
    .map(record =>
      fieldIssue(
        'main.cgUntransmitted.reason',
        report,
        record,
        UNTRANSMITTED_REASONS[0],
        `${String(record.values[UNTRANSMITTED_COUNT])} capital-gains appendices were not transmitted (1000@962), but no reason (1000@964–967) is marked.`,
        'capitalGainsSummary.reasons',
      ),
    );
}

/** main.cgUntransmitted.reasonWithoutCount: a reason 964–967 marked while 962 is 0 or absent. */
function cgUntransmittedReasonWithoutCount(report: NormalizedReport): Issue[] {
  return mainRecords(report)
    .filter(
      record =>
        UNTRANSMITTED_REASONS.some(key => record.values[key] === true) &&
        !isPositive(record.values[UNTRANSMITTED_COUNT]),
    )
    .map(record =>
      fieldIssue(
        'main.cgUntransmitted.reasonWithoutCount',
        report,
        record,
        UNTRANSMITTED_COUNT,
        `A reason for untransmitted capital-gains appendices (1000@964–967) is marked, but ${UNTRANSMITTED_COUNT} (1000@962) is 0 or absent.`,
      ),
    );
}

const TOTAL_APPENDICES = 'capitalGainsSummary.totalAppendicesCount';

/**
 * main.appendixTotal.min: the total number of appendices (960, "transmitted and not") is lower than
 * the appendices the report transmits, the foreign appendix (2000) and the capital-gains records
 * (30xx), plus the untransmitted ones (962) (p.10; SPEC §15 A-12). Checked only when 960 is above
 * 0: 0 is written as absent.
 */
function appendixTotalMin(report: NormalizedReport): Issue[] {
  const transmitted = report.records.filter(
    record => record.recordType === '2000' || isCapitalGainsRecordType(record.recordType),
  ).length;
  return mainRecords(report).flatMap(record => {
    const total = record.values[TOTAL_APPENDICES];
    const untransmitted = record.values[UNTRANSMITTED_COUNT];
    const expected = transmitted + (isPositive(untransmitted) ? Number(untransmitted) : 0);
    if (!isPositive(total) || Number(total) >= expected) {
      return [];
    }
    return [
      {
        ...fieldIssue(
          'main.appendixTotal.min',
          report,
          record,
          TOTAL_APPENDICES,
          `${TOTAL_APPENDICES} (1000@960) is ${String(total)}, but the report transmits ${transmitted} appendices (2000 and 30xx records) and ${expected - transmitted} were not transmitted (1000@962).`,
        ),
        value: total,
        expected: `at least ${expected}`,
      },
    ];
  });
}

/** main.bankAccount.withNoBank: noBankAccount (1064) marked while a bank account is given (p.12). */
function bankAccountWithNoBank(report: NormalizedReport): Issue[] {
  return mainRecords(report)
    .filter(
      record =>
        record.values['declarations.noBankAccount'] === true &&
        BANK_ACCOUNT_CODES.some(code => record.codes.has(code)),
    )
    .map(record =>
      fieldIssue(
        'main.bankAccount.withNoBank',
        report,
        record,
        'declarations.noBankAccount',
        'declarations.noBankAccount (1000@1064) is marked, but a bank account (codes 277/278/280) is given.',
      ),
    );
}

/**
 * main.qualifyingCompany.purchaseAmounts: purchased (1065 = yes) without either purchase amount
 * (1066, 1078) (p.12). Located at the first amount.
 */
function qualifyingCompanyPurchaseAmounts(report: NormalizedReport): Issue[] {
  return mainRecords(report)
    .filter(
      record =>
        record.values['qualifyingCompany.purchased'] === true &&
        !isPositive(record.values[ISRAELI_PURCHASE]) &&
        !isPositive(record.values[FOREIGN_PURCHASE]),
    )
    .map(record =>
      fieldIssue(
        'main.qualifyingCompany.purchaseAmounts',
        report,
        record,
        ISRAELI_PURCHASE,
        `qualifyingCompany.purchased is yes (1000@1065), but neither ${ISRAELI_PURCHASE} (1000@1066) nor ${FOREIGN_PURCHASE} (1000@1078) is given.`,
      ),
    );
}

/**
 * main.qualifyingCompany.amortizationAmount: amortizationClaimed (1090 = yes) without the amount
 * (1091), where 0 is an amount (p.12; SPEC §15 A-21).
 */
const qualifyingCompanyAmortizationAmount = requiresField(
  'main.qualifyingCompany.amortizationAmount',
  'qualifyingCompany.amortizationClaimed',
  'qualifyingCompany.amortizationAmount',
  'qualifyingCompany.amortizationClaimed is yes (1000@1090)',
);

/** A rule: when the count `countKey` is above 0, `code` must be in the code-amount section (p.10). */
function countRequiresCode(ruleId: RuleId, countKey: string, code: string): ReportRule {
  return report =>
    mainRecords(report)
      .filter(record => isPositive(record.values[countKey]) && !record.codes.has(code))
      .map(record =>
        codeIssue(
          ruleId,
          report,
          record,
          code,
          `${countKey} (1000@${mainField(report, countKey).position}) is ${String(record.values[countKey])}, but code ${code}, whose certificates it counts, is absent.`,
        ),
      );
}

/** main.attachments.code070: donation receipts attached (954 > 0) without code 070. */
const attachmentsCode070 = countRequiresCode(
  'main.attachments.code070',
  'attachments.donationReceiptsCount',
  '070',
);

/** main.attachments.code010: withholding certificates attached (957 > 0) without code 010. */
const attachmentsCode010 = countRequiresCode(
  'main.attachments.code010',
  'attachments.withholdingCertificatesCount',
  '010',
);

/**
 * The conditional requirements and consistency warnings of record 1000
 * (main.reportablePositions.max, main.bankAccount.format and main.capitalGains.flag are normalizer
 * notices).
 */
export const MAIN_RULES: readonly ReportRule[] = [
  familyCompanyFileNumber,
  familyCompanyCode080,
  houseCompanyCode084,
  investmentLawFlag,
  beneficiaryEnterpriseNoticeDate,
  specialYearBalanceSheetDate,
  kibbutzCode226,
  buildingIncomeCode259,
  cgReasonsOtherText,
  reportablePositionsRequired,
  kibbutzCode226Other,
  reportablePositionsUnexpected,
  rdRecords,
  rdTotal,
  cgUntransmittedReason,
  cgUntransmittedReasonWithoutCount,
  appendixTotalMin,
  bankAccountWithNoBank,
  qualifyingCompanyPurchaseAmounts,
  qualifyingCompanyAmortizationAmount,
  attachmentsCode070,
  attachmentsCode010,
];
