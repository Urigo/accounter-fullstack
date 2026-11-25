/**
 * One pass/fail case per rule (SPEC §13.4). Typed by RuleId, so a rule without a case is a type
 * error. Fail cases are minimalInput() with one deliberate defect.
 */
import type { PhonePrefix, Shareholder } from '../../src/model/input.js';
import type { RuleId } from '../../src/validate/rules.js';
import { minimalInput } from '../fixtures/builders.js';

/** minimalInput() with its single shareholder changed by `overrides`. */
function withShareholder(overrides: Partial<Shareholder>) {
  const shareholders = minimalInput().shareholders.map(shareholder => ({
    ...shareholder,
    ...overrides,
  }));
  return minimalInput({ shareholders });
}

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
  'struct.taxYear.provisionalLayout': {
    kind: 'input',
    fail: () => minimalInput({ taxYear: 2025 }),
    pass: () => minimalInput({ taxYear: 2024 }),
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
  'field.integer': {
    kind: 'input',
    fail: () => minimalInput({ amounts: { '081': 1.5 } }),
    pass: () => minimalInput({ amounts: { '081': 2 } }),
    path: 'amounts["081"]',
  },
  'field.decimals': {
    kind: 'input',
    fail: () => withShareholder({ dividendRightsPercent: 10.123 }),
    pass: () => withShareholder({ votingRightsPercent: 10.12 }),
    path: 'shareholders[0].dividendRightsPercent',
  },
  'field.negative': {
    kind: 'input',
    fail: () => minimalInput({ amounts: { '081': -1 } }),
    pass: () => minimalInput({ amounts: { '081': 1 } }),
    path: 'amounts["081"]',
  },
  'field.enum': {
    kind: 'input',
    fail: () => minimalInput({ amounts: { '014': 3 } }),
    pass: () => minimalInput({ amounts: { '014': 12 } }),
    path: 'amounts["014"]',
  },
  'field.date': {
    kind: 'input',
    fail: () => minimalInput({ meta: { saveDate: '2024-02-30' } }),
    pass: () => minimalInput({ meta: { saveDate: '2024-02-29' } }),
    path: 'meta.saveDate',
  },
  'field.percentRange': {
    kind: 'input',
    fail: () => withShareholder({ dividendRightsPercent: 100.01 }),
    pass: () => withShareholder({ dividendRightsPercent: 100 }),
    path: 'shareholders[0].dividendRightsPercent',
  },
  'field.hebrewFirstLetter': {
    kind: 'input',
    fail: () => withShareholder({ fullName: '1abc' }),
    pass: () => withShareholder({ fullName: 'ישראל Smith' }),
    path: 'shareholders[0].fullName',
  },
  'field.charset': {
    kind: 'input',
    fail: () => minimalInput({ company: { registeredName: 'חברה \u{1F600} בע"מ' } }),
    pass: () => minimalInput({ company: { registeredName: 'חברה – “בע״מ”' } }),
    path: 'company.registeredName',
  },
  'field.phonePrefix': {
    kind: 'input',
    // The schema (C5) accepts any string as a prefix, so the rule stays reachable.
    fail: () => minimalInput({ company: { phone: { prefix: '01' as PhonePrefix } } }),
    pass: () => minimalInput({ company: { fax: { prefix: '052', number: '7654321' } } }),
    path: 'company.phone.prefix',
  },
  'field.phoneNumber': {
    kind: 'input',
    fail: () => minimalInput({ company: { phone: { number: '123' } } }),
    pass: () => minimalInput({ company: { phone: { number: '1234567' } } }),
    path: 'company.phone.number',
  },
};
