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
    id: 'field.charset',
    severity: 'error',
    source: 'derived',
    scope: 'report',
    description:
      'A text value (after SPEC §4.3 normalization) contains a control character or a character not representable in windows-1255.',
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
