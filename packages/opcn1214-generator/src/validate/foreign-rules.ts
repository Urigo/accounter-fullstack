/**
 * Foreign appendix rules (SPEC §9.2 stage 4, §10.5): pure checks over the normalized 2000 and 2200
 * records, so they run on validated input and on parsed files alike.
 */
import type { Primitive } from '../codec/types.js';
import { Opcn1214InternalError } from '../errors.js';
import type { NormalizedRecord, NormalizedReport } from '../model/normalized.js';
import { BREAKDOWN_CODE_KEY, countryEntryKey, inputIndexOf, pathFor } from '../normalize/paths.js';
import { makeIssue, type Issue } from './issue.js';
import type { RuleId } from './rules.js';

type ReportRule = (report: NormalizedReport) => Issue[];

const OTHER_INCOME = 'otherTaxableIncome';
const OTHER_INCOME_DESCRIPTION = 'otherTaxableIncomeDescription';
const REFUND_DECLARATION = 'taxRefundDeclaration';
const REFUND_AMOUNT = 'taxRefundDeclarationAmount';
/** "Country unknown" (SPEC §3.6, p.32), allowed only in the breakdown of code 439. */
const UNKNOWN_COUNTRY = '-88';
const UNKNOWN_COUNTRY_CODE = 439;
/** Key of the country list of a breakdown, for pathFor (record 2200). */
const COUNTRIES_KEY = 'countries';

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

function breakdownRecords(report: NormalizedReport): NormalizedRecord[] {
  return report.records.filter(record => record.recordType === '2200');
}

/** The 3-digit 2000 code a 2200 `record` breaks down (2200@137). */
function breakdownCode(record: NormalizedRecord): string {
  return String(inputIndexOf(record)).padStart(3, '0');
}

/**
 * An issue of `ruleId` on the 2200 `record`, at the input path of `key` below its breakdown
 * (pathFor: the code key is the breakdown itself, `countries` its country list).
 */
function breakdownIssue(
  ruleId: RuleId,
  record: NormalizedRecord,
  key: string,
  message: string,
  details: Pick<Issue, 'value' | 'specRef'> = {},
): Issue {
  return makeIssue(ruleId, {
    message,
    path: pathFor('2200', inputIndexOf(record), key),
    recordType: record.recordType,
    recordIndex: record.index,
    code: breakdownCode(record),
    ...details,
  });
}

/**
 * foreign.breakdown.required: a per-country code written in the 2000 section (442 = 0 included,
 * SPEC §15 A-24) without a 2200 record (p.27). Reported at the missing breakdown.
 */
function breakdownRequired(report: NormalizedReport): Issue[] {
  const perCountry = new Set(
    report.layout.records['2000'].codes.filter(def => def.perCountryBreakdown).map(def => def.code),
  );
  const brokenDown = new Set(breakdownRecords(report).map(breakdownCode));
  return foreignRecords(report).flatMap(record =>
    [...record.codes.keys()]
      .filter(code => perCountry.has(code) && !brokenDown.has(code))
      .map(code =>
        makeIssue('foreign.breakdown.required', {
          message: `Code ${code} of the foreign appendix needs a breakdown by country (record 2200).`,
          path: pathFor('2200', Number(code), BREAKDOWN_CODE_KEY),
          recordType: record.recordType,
          recordIndex: record.index,
          code,
          value: record.codes.get(code),
          specRef: { page: 27 },
        }),
      ),
  );
}

/** foreign.breakdown.orphan: a 2200 record for a code not written in the 2000 section (p.30). */
function breakdownOrphan(report: NormalizedReport): Issue[] {
  const written = new Set(foreignRecords(report).flatMap(record => [...record.codes.keys()]));
  return breakdownRecords(report)
    .filter(record => !written.has(breakdownCode(record)))
    .map(record =>
      breakdownIssue(
        'foreign.breakdown.orphan',
        record,
        BREAKDOWN_CODE_KEY,
        `The breakdown of code ${breakdownCode(record)} has no amount in the foreign appendix (foreignAppendix.amounts).`,
        { specRef: { page: 30 } },
      ),
    );
}

/** foreign.breakdown.countries.min: a breakdown without countries. */
function breakdownCountriesMin(report: NormalizedReport): Issue[] {
  return breakdownRecords(report)
    .filter(record => record.countries.length === 0)
    .map(record =>
      breakdownIssue(
        'foreign.breakdown.countries.min',
        record,
        COUNTRIES_KEY,
        `The breakdown of code ${breakdownCode(record)} has no countries.`,
        { specRef: { page: 31 } },
      ),
    );
}

/** foreign.breakdown.countries.max: more countries in a breakdown than one 2200 record holds (p.30). */
function breakdownCountriesMax(report: NormalizedReport): Issue[] {
  const max = report.layout.limits.countriesPerRecord;
  return breakdownRecords(report)
    .filter(record => record.countries.length > max)
    .map(record =>
      breakdownIssue(
        'foreign.breakdown.countries.max',
        record,
        COUNTRIES_KEY,
        `The breakdown of code ${breakdownCode(record)} has ${record.countries.length} countries; at most ${max} are allowed.`,
        { value: record.countries.length, specRef: { page: 30 } },
      ),
    );
}

/** Issues of `check` for every country entry of every 2200 record, at the entry's country. */
function countryIssues(
  report: NormalizedReport,
  check: (
    country: string,
    record: NormalizedRecord,
    index: number,
  ) => { ruleId: RuleId; message: string; page?: number } | undefined,
): Issue[] {
  return breakdownRecords(report).flatMap(record =>
    record.countries.flatMap(({ country }, index) => {
      const finding = check(country, record, index);
      return finding
        ? [
            breakdownIssue(finding.ruleId, record, countryEntryKey(index), finding.message, {
              value: country,
              ...(finding.page === undefined ? {} : { specRef: { page: finding.page } }),
            }),
          ]
        : [];
    }),
  );
}

/** foreign.breakdown.country.unknown: a country code not in countries.csv (p.32, 63–71). */
function breakdownCountryUnknown(report: NormalizedReport): Issue[] {
  return countryIssues(report, country =>
    report.layout.countries.has(country)
      ? undefined
      : {
          ruleId: 'foreign.breakdown.country.unknown',
          message: `${JSON.stringify(country)} is not a country code of tax year ${report.taxYear}.`,
          page: 32,
        },
  );
}

/** foreign.breakdown.country.unknownOnlyFor439: '-88' (country unknown) outside code 439 (p.32). */
function breakdownCountryUnknownOnlyFor439(report: NormalizedReport): Issue[] {
  return countryIssues(report, (country, record) =>
    country === UNKNOWN_COUNTRY && inputIndexOf(record) !== UNKNOWN_COUNTRY_CODE
      ? {
          ruleId: 'foreign.breakdown.country.unknownOnlyFor439',
          message: `Country ${UNKNOWN_COUNTRY} (unknown) is allowed only in the breakdown of code ${UNKNOWN_COUNTRY_CODE}, not ${breakdownCode(record)}.`,
          page: 32,
        }
      : undefined,
  );
}

/** foreign.breakdown.country.duplicate: a country listed again in the same breakdown. */
function breakdownCountryDuplicate(report: NormalizedReport): Issue[] {
  return countryIssues(report, (country, record, index) =>
    record.countries.slice(0, index).some(earlier => earlier.country === country)
      ? {
          ruleId: 'foreign.breakdown.country.duplicate',
          message: `Country ${country} appears more than once in the breakdown of code ${breakdownCode(record)}.`,
        }
      : undefined,
  );
}

/** The business rules of records 2000 and 2200, in catalogue order (SPEC §10.5). */
export const FOREIGN_RULES: readonly ReportRule[] = [
  otherIncomeDescription,
  refundAmount,
  breakdownRequired,
  breakdownOrphan,
  breakdownCountriesMin,
  breakdownCountriesMax,
  breakdownCountryUnknown,
  breakdownCountryUnknownOnlyFor439,
  breakdownCountryDuplicate,
];
