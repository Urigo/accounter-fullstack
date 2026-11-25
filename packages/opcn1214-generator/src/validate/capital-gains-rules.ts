/**
 * Capital-gains appendix rules (SPEC §9.2 stage 4, §10.6): pure checks over the normalized 30xx
 * records, so they run on validated input and on parsed files alike.
 */
import { Opcn1214InternalError } from '../errors.js';
import type { RecordType } from '../layout/types.js';
import type { NormalizedReport } from '../model/normalized.js';
import { inputIndexOf, pathFor } from '../normalize/paths.js';
import { makeIssue, type Issue } from './issue.js';

type ReportRule = (report: NormalizedReport) => Issue[];

/** 30xx@145 "רווח מקרן השקעות" (yes/no). */
const INVESTMENT_FUND = 'gainFromInvestmentFund';

/**
 * The one value 30xx@145 may hold per record type (SPEC §15 A-8): the PDF lists only "2 - לא" for
 * 3060 (p.43) and 3065 (p.50), and only "1 – כן" for 3064 (p.48). Absent is always allowed.
 */
const INVESTMENT_FUND_VALUES: Readonly<Partial<Record<RecordType, boolean>>> = {
  '3060': false,
  '3064': true,
  '3065': false,
};

/**
 * cg.investmentFund.value: 30xx@145 holds the other yes/no value than the one the PDF allows for
 * its record type (INVESTMENT_FUND_VALUES). Located at the appendix's gainFromInvestmentFund.
 */
function investmentFundValue(report: NormalizedReport): Issue[] {
  return report.records.flatMap(record => {
    const allowed = INVESTMENT_FUND_VALUES[record.recordType];
    const value = record.values[INVESTMENT_FUND];
    if (allowed === undefined || value === undefined || value === allowed) {
      return [];
    }
    const field = report.layout.records[record.recordType].fields.find(
      def => def.key === INVESTMENT_FUND,
    );
    if (!field) {
      throw new Opcn1214InternalError(
        `Record ${record.recordType} has no field "${INVESTMENT_FUND}"`,
      );
    }
    const expected = allowed ? 'true (1) or absent' : 'false (2) or absent';
    return [
      makeIssue('cg.investmentFund.value', {
        message: `${INVESTMENT_FUND} (${record.recordType}@145) may only be ${allowed ? 'yes (1)' : 'no (2)'} in record ${record.recordType}, or absent.`,
        path: pathFor(record.recordType, inputIndexOf(record), INVESTMENT_FUND),
        recordType: record.recordType,
        recordIndex: record.index,
        field: { position: field.position, length: field.length, nameHe: field.nameHe },
        value,
        expected,
        specRef: { page: field.specPage },
      }),
    ];
  });
}

/** The capital-gains rules, in catalogue order (SPEC §10.6). */
export const CAPITAL_GAINS_RULES: readonly ReportRule[] = [investmentFundValue];
