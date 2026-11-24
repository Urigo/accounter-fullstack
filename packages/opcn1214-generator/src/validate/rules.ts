/** The rule catalogue (SPEC §10) as data: metadata only, implementations live in the stages. */
import { Opcn1214InternalError } from '../errors.js';
import { deepFreeze } from '../layout/freeze.js';
import type { RecordType } from '../layout/types.js';
import type { Severity } from './issue.js';

/** RuleMeta with a plain string id, so RULES can be checked without referring to RuleId. */
interface RuleMetaInput {
  id: string;
  severity: Severity;
  /** 'spec' = stated in the PDF; 'derived' = our consistency check. */
  source: 'spec' | 'derived';
  scope: RecordType | 'report' | 'input' | 'parse';
  description: string;
  specRef?: { page: number; note?: string };
}

/**
 * Every rule of SPEC §10, in catalogue order. Deep-frozen: the entries are the objects ruleMeta()
 * returns and issue severities come from them, so an edit in place would change validation for
 * the whole process.
 */
export const RULES = deepFreeze([
  {
    id: 'struct.taxYear.unsupported',
    severity: 'error',
    source: 'derived',
    scope: 'input',
    description: 'taxYear is not one of supportedTaxYears().',
  },
  {
    id: 'struct.taxYear.provisionalLayout',
    severity: 'warning',
    source: 'derived',
    scope: 'input',
    description:
      "taxYear has no SHAAM layout of its own yet and reuses an earlier year's layout (2025 → 2024, SPEC §14): the report is provisional.",
  },
  {
    id: 'input.shape',
    severity: 'error',
    source: 'derived',
    scope: 'input',
    description:
      'Wrong JavaScript type, missing required property, unknown property, null, array too long, or a date not in YYYY-MM-DD form.',
  },
  {
    id: 'input.unknownCode',
    severity: 'error',
    source: 'spec',
    scope: 'input',
    description:
      'A code-map key (amounts, foreignAppendix.amounts, capitalGains[i].amounts) that is not a code of that record for the tax year, or a foreignAppendix.countryBreakdown key that is not a per-country code of record 2000.',
    specRef: { page: 13 },
  },
  {
    id: 'input.derivedCode',
    severity: 'error',
    source: 'derived',
    scope: 'input',
    description:
      'A derived code (008, 028, 273, 277, 278, 280, 297) passed in a code map; the message names the input property that controls it.',
  },
  {
    id: 'struct.relatedCompanies.max',
    severity: 'error',
    source: 'spec',
    scope: '1010',
    description: 'More than 3 related companies.',
    specRef: { page: 2 },
  },
  {
    id: 'struct.shareholders.min',
    severity: 'error',
    source: 'spec',
    scope: '1020',
    description: 'No shareholders while declarations.isKibbutz is not true.',
    specRef: { page: 21 },
  },
  {
    id: 'struct.shareholders.max',
    severity: 'error',
    source: 'spec',
    scope: '1020',
    description: 'More than 99 shareholders.',
    specRef: { page: 21 },
  },
  {
    id: 'struct.rdInvestments.max',
    severity: 'error',
    source: 'spec',
    scope: '1030',
    description: 'More than 5 R&D investments.',
    specRef: { page: 2 },
  },
  {
    id: 'struct.capitalGains.max',
    severity: 'error',
    source: 'spec',
    scope: 'report',
    description:
      'More than 14 capital-gains appendices (records 30xx); report the excess on 1000@962 with reasons 964–967 instead.',
    specRef: { page: 32 },
  },
  {
    id: 'struct.mainCodePairs.max',
    severity: 'error',
    source: 'spec',
    scope: '1000',
    description: 'More than 61 code-amount pairs in record 1000 (after derivations).',
    specRef: { page: 13 },
  },
  {
    id: 'field.required',
    severity: 'error',
    source: 'spec',
    scope: 'report',
    description:
      'A field or code with required=yes is absent (for codes that are not zeroAllowed, 0 counts as absent); inside a repeated slot only when the slot is in use.',
  },
  {
    id: 'field.numeric',
    severity: 'error',
    source: 'spec',
    scope: 'report',
    description: 'A digit-string field (id9, shareholderId, digits) contains non-digits.',
  },
  {
    id: 'field.length',
    severity: 'error',
    source: 'spec',
    scope: 'report',
    description:
      'Normalized text longer than the field width, or a number with more digits than the width.',
  },
  {
    id: 'field.integer',
    severity: 'error',
    source: 'spec',
    scope: 'report',
    description:
      "An amount, amountX or num value is not an integer (with rounding 'halfUp', amounts are rounded instead).",
    specRef: { page: 13, note: 'no dots' },
  },
  {
    id: 'field.decimals',
    severity: 'error',
    source: 'spec',
    scope: 'report',
    description:
      'An amountX100, percentX100, percentLiteral or rateX100 value has more than 2 decimals.',
    specRef: { page: 10 },
  },
  {
    id: 'field.negative',
    severity: 'error',
    source: 'spec',
    scope: 'report',
    description: 'A number is negative (losses have their own codes).',
    specRef: { page: 13 },
  },
  {
    id: 'field.enum',
    severity: 'error',
    source: 'spec',
    scope: 'report',
    description:
      'An enum or rateX100 value is not one of the values of its field or code (the values of other kinds are documentation).',
  },
  {
    id: 'field.date',
    severity: 'error',
    source: 'spec',
    scope: 'report',
    description: 'A YYYY-MM-DD date is not a real calendar date (other forms are input.shape).',
  },
  {
    id: 'field.percentRange',
    severity: 'error',
    source: 'spec',
    scope: 'report',
    description:
      'A percentage (percentX100, percentLiteral) is outside 1–100, compared as written (rounded to hundredths).',
    specRef: { page: 10 },
  },
  {
    id: 'field.hebrewFirstLetter',
    severity: 'error',
    source: 'spec',
    scope: 'report',
    description: 'A hebrewText value does not start with a Hebrew letter (U+05D0–U+05EA).',
    specRef: { page: 9 },
  },
  {
    id: 'field.charset',
    severity: 'error',
    source: 'derived',
    scope: 'report',
    description:
      'A text value (after SPEC §4.3 normalization) contains a control character or a character not representable in windows-1255.',
  },
  {
    id: 'field.phonePrefix',
    severity: 'warning',
    source: 'spec',
    scope: 'report',
    description:
      'A phone or fax prefix is not in the allowed list: it is dropped (SHAAM deletes it); for the required 1000@493 the follow-up field.required is the error.',
    specRef: { page: 6 },
  },
  {
    id: 'field.phoneNumber',
    severity: 'error',
    source: 'derived',
    scope: 'report',
    description:
      'A phone or fax number is not exactly 7 digits (shorter numbers would be silently zero-padded).',
    specRef: { page: 6 },
  },
  {
    id: 'main.familyCompany.fileNumber',
    severity: 'error',
    source: 'spec',
    scope: '1000',
    description: 'A family company (836 marked) without the taxpayer file number (837).',
    specRef: { page: 7 },
  },
  {
    id: 'main.familyCompany.code080',
    severity: 'error',
    source: 'spec',
    scope: '1000',
    description: 'A family company (836 marked) without code 080 (0 allowed).',
    specRef: { page: 15 },
  },
  {
    id: 'main.houseCompany.code084',
    severity: 'error',
    source: 'spec',
    scope: '1000',
    description: 'A house company (846 marked) without code 084 (0 allowed).',
    specRef: { page: 15 },
  },
  {
    id: 'main.investmentLaw.flag',
    severity: 'error',
    source: 'spec',
    scope: '1000',
    description: 'Code 101 or 102 filled but 849 (capital investment law benefits) not marked.',
    specRef: { page: 8 },
  },
  {
    id: 'main.beneficiaryEnterprise.noticeDate',
    severity: 'error',
    source: 'spec',
    scope: '1000',
    description:
      '851 (beneficiary enterprise) marked without the notice date (852); guaranteed by the input type, checked for JS callers and parsed files.',
    specRef: { page: 8 },
  },
  {
    id: 'main.specialYear.balanceSheetDate',
    severity: 'error',
    source: 'spec',
    scope: '1000',
    description:
      '863 (special year) marked without the balance sheet date (864); guaranteed by the input type, checked for JS callers and parsed files.',
    specRef: { page: 8 },
  },
  {
    id: 'main.kibbutz.code226',
    severity: 'error',
    source: 'spec',
    scope: '1000',
    description: 'isKibbutz (877 marked) but code 226 not filled (SPEC §15 A-13).',
    specRef: { page: 9 },
  },
  {
    id: 'main.kibbutz.code226Other',
    severity: 'warning',
    source: 'derived',
    scope: '1000',
    description: 'Code 226 = 9 ("other cooperative, not kibbutz") while isKibbutz (877 marked).',
    specRef: { page: 18 },
  },
  {
    id: 'main.buildingIncome.code259',
    severity: 'error',
    source: 'spec',
    scope: '1000',
    description: 'hasBuildingIncome (884 = yes) without code 259.',
    specRef: { page: 9 },
  },
  {
    id: 'main.cgReasons.otherText',
    severity: 'error',
    source: 'spec',
    scope: '1000',
    description: 'Capital-gains reason "other" (967) marked without its text (968).',
    specRef: { page: 11 },
  },
  {
    id: 'main.reportablePositions.required',
    severity: 'error',
    source: 'spec',
    scope: '1000',
    description:
      'tookReportablePosition (1030 = yes) and no reportable position numbers (1034–1046).',
    specRef: { page: 11 },
  },
  {
    id: 'main.reportablePositions.max',
    severity: 'error',
    source: 'spec',
    scope: '1000',
    description: 'More than 5 reportable positions (only five fields exist, 1034–1046).',
    specRef: { page: 11 },
  },
  {
    id: 'main.reportablePositions.unexpected',
    severity: 'warning',
    source: 'derived',
    scope: '1000',
    description:
      'Non-zero reportable positions (1034–1046) given while tookReportablePosition (1030) is no.',
    specRef: { page: 11 },
  },
  {
    id: 'main.rd.records',
    severity: 'error',
    source: 'spec',
    scope: '1000',
    description: 'Code 165 > 0 but no R&D investment (1030) records.',
    specRef: { page: 17 },
  },
  {
    id: 'main.rd.total',
    severity: 'warning',
    source: 'derived',
    scope: '1000',
    description:
      'The R&D investment amounts (1030) do not add up to code 165 (absent is 0), compared in whole shekels.',
    specRef: { page: 17 },
  },
  {
    id: 'main.capitalGains.flag',
    severity: 'error',
    source: 'derived',
    scope: '1000',
    description:
      'declarations.hasCapitalGainsAppendix is false while capital-gains appendices exist, transmitted or not (833 is derived from them as yes).',
    specRef: { page: 7 },
  },
  {
    id: 'main.cgUntransmitted.reason',
    severity: 'warning',
    source: 'derived',
    scope: '1000',
    description:
      'capitalGainsSummary.untransmittedCount (962) > 0 and none of the reasons 964–967 marked.',
    specRef: { page: 10 },
  },
  {
    id: 'main.cgUntransmitted.reasonWithoutCount',
    severity: 'warning',
    source: 'derived',
    scope: '1000',
    description:
      'A reason 964–967 marked while capitalGainsSummary.untransmittedCount (962) is 0 or absent.',
    specRef: { page: 10 },
  },
  {
    id: 'main.appendixTotal.min',
    severity: 'warning',
    source: 'derived',
    scope: '1000',
    description:
      'capitalGainsSummary.totalAppendicesCount (960) is given (> 0) and lower than the transmitted appendices (2000 and 30xx records) plus capitalGainsSummary.untransmittedCount (962).',
    specRef: { page: 10 },
  },
  {
    id: 'main.bankAccount.withNoBank',
    severity: 'warning',
    source: 'derived',
    scope: '1000',
    description: 'noBankAccount (1064) marked while a bank account (codes 277/278/280) is given.',
    specRef: { page: 12 },
  },
  {
    id: 'main.bankAccount.format',
    severity: 'error',
    source: 'spec',
    scope: '1000',
    description:
      'bankAccount.bank is not exactly 2 digits, branch not exactly 3 digits, or account not 1–9 digits.',
    specRef: { page: 19 },
  },
  {
    id: 'main.qualifyingCompany.purchaseAmounts',
    severity: 'warning',
    source: 'derived',
    scope: '1000',
    description:
      'qualifyingCompany.purchased (1065 = yes) but neither purchase amount (1066, 1078) given.',
    specRef: { page: 12 },
  },
  {
    id: 'main.qualifyingCompany.amortizationAmount',
    severity: 'warning',
    source: 'derived',
    scope: '1000',
    description:
      'qualifyingCompany.amortizationClaimed (1090 = yes) but no amortization amount (1091; 0 counts as given).',
    specRef: { page: 12 },
  },
  {
    id: 'main.attachments.code070',
    severity: 'warning',
    source: 'derived',
    scope: '1000',
    description: 'attachments.donationReceiptsCount (954) > 0 but code 070 absent.',
    specRef: { page: 10 },
  },
  {
    id: 'main.attachments.code010',
    severity: 'warning',
    source: 'derived',
    scope: '1000',
    description: 'attachments.withholdingCertificatesCount (957) > 0 but code 010 absent.',
    specRef: { page: 10 },
  },
  {
    id: 'shareholders.dividendRights.total',
    severity: 'error',
    source: 'spec',
    scope: '1020',
    description:
      'At least one shareholder states dividendRightsPercent and the total is not 100.00 (computed in hundredths; SPEC §15 A-15).',
    specRef: { page: 23 },
  },
  {
    id: 'shareholders.duplicateId',
    severity: 'warning',
    source: 'derived',
    scope: '1020',
    description:
      'The same shareholder idNumber twice, compared zero-padded to 9 digits (999999964 and 999999998 excluded).',
  },
  {
    id: 'foreign.otherIncome.description',
    severity: 'error',
    source: 'spec',
    scope: '2000',
    description:
      'otherTaxableIncome (2000@187) > 0 without otherTaxableIncomeDescription (2000@137).',
    specRef: { page: 26 },
  },
  {
    id: 'foreign.refund.amount',
    severity: 'warning',
    source: 'derived',
    scope: '2000',
    description:
      'taxRefundDeclaration (2000@247) is yes without a taxRefundDeclarationAmount (2000@248) > 0; 0 is written as absent.',
    specRef: { page: 26 },
  },
  {
    id: 'foreign.breakdown.required',
    severity: 'error',
    source: 'spec',
    scope: '2000',
    description:
      'A per-country code written in the 2000 section (442 = 0 included) without a countryBreakdown entry (record 2200).',
    specRef: { page: 27 },
  },
  {
    id: 'foreign.breakdown.orphan',
    severity: 'error',
    source: 'spec',
    scope: '2200',
    description: 'A countryBreakdown entry for a code not written in the 2000 section.',
    specRef: { page: 30 },
  },
  {
    id: 'foreign.breakdown.countries.min',
    severity: 'error',
    source: 'derived',
    scope: '2200',
    description: 'A country breakdown with no countries.',
    specRef: { page: 31 },
  },
  {
    id: 'foreign.breakdown.countries.max',
    severity: 'error',
    source: 'spec',
    scope: '2200',
    description: 'More than 10 countries in one country breakdown.',
    specRef: { page: 30 },
  },
  {
    id: 'foreign.breakdown.country.unknown',
    severity: 'error',
    source: 'spec',
    scope: '2200',
    description: 'A country code that is not in the country table of the tax year (countries.csv).',
    specRef: { page: 32 },
  },
  {
    id: 'foreign.breakdown.country.unknownOnlyFor439',
    severity: 'error',
    source: 'spec',
    scope: '2200',
    description:
      'The country code -88 (country unknown) in the breakdown of a code other than 439.',
    specRef: { page: 32 },
  },
  {
    id: 'foreign.breakdown.country.duplicate',
    severity: 'error',
    source: 'spec',
    scope: '2200',
    description: 'The same country twice within one country breakdown.',
    specRef: { page: 30 },
  },
  {
    id: 'parse.empty',
    severity: 'error',
    source: 'derived',
    scope: 'parse',
    description: 'The file has no records.',
  },
  {
    id: 'parse.encoding',
    severity: 'error',
    source: 'derived',
    scope: 'parse',
    description:
      'Bytes that do not decode in the selected encoding (windows-1255, or UTF-8 when options.encoding says so).',
  },
  {
    id: 'parse.lineLength',
    severity: 'error',
    source: 'spec',
    scope: 'parse',
    description: 'A line whose length is not the record length of its record type.',
    specRef: { page: 2 },
  },
  {
    id: 'parse.formType',
    severity: 'error',
    source: 'spec',
    scope: 'parse',
    description: 'Positions 1–4 of a line are not 1214.',
    specRef: { page: 2 },
  },
  {
    id: 'parse.recordType',
    severity: 'error',
    source: 'spec',
    scope: 'parse',
    description: 'Positions 5–8 of a line are not a record type of the layout.',
    specRef: { page: 2 },
  },
  {
    id: 'parse.prefixFiller',
    severity: 'error',
    source: 'spec',
    scope: 'parse',
    description: 'Positions 9–136 of a line are not all 0.',
    specRef: { page: 2 },
  },
  {
    id: 'parse.order',
    severity: 'error',
    source: 'spec',
    scope: 'parse',
    description:
      'A record out of the SPEC §3.3 order (the file must start with 1000; a 2200 record must follow a 2000 record), a second 1000 before a 9999, or any record after the 9999 (a second 9999 too).',
  },
  {
    id: 'parse.control.missing',
    severity: 'error',
    source: 'spec',
    scope: 'parse',
    description: 'The report is not terminated by a 9999 control record.',
    specRef: { page: 59 },
  },
  {
    id: 'parse.control.counts',
    severity: 'error',
    source: 'spec',
    scope: 'parse',
    description: 'A count of the 9999 control record differs from the records present.',
    specRef: { page: 59 },
  },
  {
    id: 'parse.numeric',
    severity: 'error',
    source: 'spec',
    scope: 'parse',
    description: 'A non-digit in a numeric field or code value.',
    specRef: { page: 61 },
  },
  {
    id: 'parse.date',
    severity: 'error',
    source: 'spec',
    scope: 'parse',
    description: 'A date field that is not a valid DD/MM/YYYY date or all spaces.',
  },
  {
    id: 'parse.codeSection',
    severity: 'error',
    source: 'spec',
    scope: 'parse',
    description:
      'A code-amount section with an unknown code, a duplicate code, a truncated entry, or non-zero data after the last entry.',
    specRef: { page: 13 },
  },
  {
    id: 'parse.fieldValue',
    severity: 'error',
    source: 'spec',
    scope: 'parse',
    description:
      'A header field that is well-formed for its type but not a value the field can hold: flag or yes/no digits other than the ones written, a phone prefix outside the allowed list, a 2200 code (2200@137) that is not a per-country code of record 2000 or that an earlier 2200 record already has.',
  },
  {
    id: 'parse.countrySection',
    severity: 'error',
    source: 'spec',
    scope: 'parse',
    description:
      'A country-amount section (record 2200) with an affiliation other than 1, a malformed country code, a truncated entry, more than 10 entries, or non-zero data after the last entry.',
    specRef: { page: 31 },
  },
] as const satisfies readonly RuleMetaInput[]);

/** Stable rule ID (SPEC §10). */
export type RuleId = (typeof RULES)[number]['id'];

/** Metadata of one rule (SPEC §9.1). */
export type RuleMeta = Omit<RuleMetaInput, 'id'> & { id: RuleId };

const RULES_BY_ID: ReadonlyMap<RuleId, RuleMeta> = new Map(
  RULES.map((rule): [RuleId, RuleMeta] => [rule.id, rule]),
);

/** The catalogue entry of a rule. */
export function ruleMeta(id: RuleId): RuleMeta {
  const rule = RULES_BY_ID.get(id);
  if (!rule) {
    throw new Opcn1214InternalError(`Unknown rule ${id}`);
  }
  return rule;
}
