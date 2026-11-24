/**
 * Record 1000 conditional requirements (SPEC §9.2 stage 4, §10.3): pure checks over the normalized
 * main record, so they run on validated input and on parsed files alike.
 */
import { isAbsentValue } from '../codec/record.js';
import { Opcn1214InternalError } from '../errors.js';
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

/**
 * Whether the header field `key` of `record` has no value, judged as the file reads it back
 * (isAbsentValue: 0 and an all-zero digit string are absent in optional fields).
 */
function isAbsent(report: NormalizedReport, record: NormalizedRecord, key: string): boolean {
  return isAbsentValue(mainField(report, key), record.values[key]);
}

/** A rule: when the flag or yes/no `condition` is true, the header field `key` must have a value. */
function requiresField(ruleId: RuleId, condition: string, key: string, why: string): ReportRule {
  return report =>
    mainRecords(report)
      .filter(record => record.values[condition] === true && isAbsent(report, record, key))
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
        REPORTABLE_POSITION_KEYS.every(key => isAbsent(report, record, key)),
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

/** The conditional requirements of record 1000 (main.reportablePositions.max is a normalizer notice). */
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
];
