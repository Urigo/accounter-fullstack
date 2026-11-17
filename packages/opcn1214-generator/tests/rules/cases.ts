/**
 * One pass/fail case per rule (SPEC §13.4). Typed by RuleId, so a rule without a case is a type
 * error. Fail cases are minimalInput() with one deliberate defect.
 */
import type { RuleId } from '../../src/validate/rules.js';
import { minimalInput } from '../fixtures/builders.js';

/** A rule case run through runPipeline (validate1214 from C6 on). */
export interface RuleCase {
  kind: 'input';
  fail(): unknown;
  pass(): unknown;
  /** Path the fail case's issue must carry. */
  path?: string;
}

export const RULE_CASES: { [K in RuleId]: RuleCase } = {
  'struct.taxYear.unsupported': {
    kind: 'input',
    fail: () => ({ ...minimalInput(), taxYear: 2023 }),
    pass: () => minimalInput({ taxYear: 2025 }),
    path: 'taxYear',
  },
  'field.required': {
    kind: 'input',
    fail: () => minimalInput({ company: { registeredName: undefined } }),
    pass: () => minimalInput(),
    path: 'company.registeredName',
  },
  'field.numeric': {
    kind: 'input',
    fail: () => minimalInput({ company: { fileNumber: '12a' } }),
    pass: () => minimalInput({ company: { fileNumber: '12' } }),
    path: 'company.fileNumber',
  },
  'field.length': {
    kind: 'input',
    fail: () => minimalInput({ company: { registeredName: 'א'.repeat(51) } }),
    pass: () => minimalInput({ company: { registeredName: 'א'.repeat(50) } }),
    path: 'company.registeredName',
  },
  'field.charset': {
    kind: 'input',
    fail: () => minimalInput({ company: { registeredName: 'חברה \u{1F600} בע"מ' } }),
    pass: () => minimalInput({ company: { registeredName: 'חברה – “בע״מ”' } }),
    path: 'company.registeredName',
  },
};
