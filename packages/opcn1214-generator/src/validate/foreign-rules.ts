/**
 * Foreign appendix rules (SPEC §9.2 stage 4, §10.5): pure checks over the normalized 2000 record,
 * so they run on validated input and on parsed files alike.
 */
import type { Primitive } from '../codec/types.js';
import { Opcn1214InternalError } from '../errors.js';
import type { NormalizedRecord, NormalizedReport } from '../model/normalized.js';
import { pathFor } from '../normalize/paths.js';
import { makeIssue, type Issue } from './issue.js';
import type { RuleId } from './rules.js';

type ReportRule = (report: NormalizedReport) => Issue[];

const OTHER_INCOME = 'otherTaxableIncome';
const OTHER_INCOME_DESCRIPTION = 'otherTaxableIncomeDescription';
const REFUND_DECLARATION = 'taxRefundDeclaration';
const REFUND_AMOUNT = 'taxRefundDeclarationAmount';

/**
 * True for a number above 0: an optional amount of 0 is absent in the file (SPEC §8.4), so input
 * and parsed files are judged alike.
 */
function isPositive(value: Primitive): boolean {
  return typeof value === 'number' && value > 0;
}

function foreignRecords(report: NormalizedReport): NormalizedRecord[] {
  return report.records.filter(record => record.recordType === '2000');
}

/** An issue of `ruleId` located at the header field `key` of the 2000 `record`. */
function fieldIssue(
  ruleId: RuleId,
  report: NormalizedReport,
  record: NormalizedRecord,
  key: string,
  message: string,
): Issue {
  const field = report.layout.records['2000'].fields.find(def => def.key === key);
  if (!field) {
    throw new Opcn1214InternalError(`Record 2000 has no field "${key}"`);
  }
  return makeIssue(ruleId, {
    message,
    path: pathFor(record.recordType, record.index, key),
    recordType: record.recordType,
    recordIndex: record.index,
    field: { position: field.position, length: field.length, nameHe: field.nameHe },
    specRef: { page: field.specPage },
  });
}

/** foreign.otherIncome.description: other taxable income (2000@187) > 0 without 2000@137 (p.26). */
function otherIncomeDescription(report: NormalizedReport): Issue[] {
  return foreignRecords(report)
    .filter(
      record =>
        isPositive(record.values[OTHER_INCOME]) &&
        record.values[OTHER_INCOME_DESCRIPTION] === undefined,
    )
    .map(record =>
      fieldIssue(
        'foreign.otherIncome.description',
        report,
        record,
        OTHER_INCOME_DESCRIPTION,
        'The foreign appendix has other taxable income (2000@187), so its description (2000@137) is required.',
      ),
    );
}

/**
 * foreign.refund.amount: a tax refund declaration (2000@247 yes) without its amount (2000@248);
 * an amount of 0 is written as absent, so it counts as missing.
 */
function refundAmount(report: NormalizedReport): Issue[] {
  return foreignRecords(report)
    .filter(
      record =>
        record.values[REFUND_DECLARATION] === true && !isPositive(record.values[REFUND_AMOUNT]),
    )
    .map(record =>
      fieldIssue(
        'foreign.refund.amount',
        report,
        record,
        REFUND_AMOUNT,
        'The foreign appendix declares a tax refund (2000@247), but its amount (2000@248) is missing.',
      ),
    );
}

/** The business rules of record 2000, in catalogue order (SPEC §10.5). */
export const FOREIGN_RULES: readonly ReportRule[] = [otherIncomeDescription, refundAmount];
