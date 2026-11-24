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
