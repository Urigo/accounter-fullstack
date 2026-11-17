/** The rule catalogue (SPEC §10) as data: metadata only, implementations live in the stages. */
import { Opcn1214InternalError } from '../errors.js';
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

/** Every rule of SPEC §10, in catalogue order. */
export const RULES = [
  {
    id: 'struct.taxYear.unsupported',
    severity: 'error',
    source: 'derived',
    scope: 'input',
    description: 'taxYear is not one of supportedTaxYears().',
  },
  {
    id: 'input.shape',
    severity: 'error',
    source: 'derived',
    scope: 'input',
    description:
      'Wrong JavaScript type, missing required property, unknown property, null, or array too long.',
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
    description: 'A date is not a real calendar date in ISO YYYY-MM-DD form.',
  },
  {
    id: 'field.percentRange',
    severity: 'error',
    source: 'spec',
    scope: 'report',
    description: 'A percentage (percentX100, percentLiteral) is outside 1–100.',
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
      'A record out of the SPEC §3.3 order (the file must start with 1000), or a second 1000 before a 9999.',
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
      'A header field that is well-formed for its type but not a value the field can hold: flag or yes/no digits other than the ones written, a phone prefix outside the allowed list.',
  },
] as const satisfies readonly RuleMetaInput[];

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
