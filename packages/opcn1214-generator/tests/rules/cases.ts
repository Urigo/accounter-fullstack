/**
 * One pass/fail case per rule (SPEC §13.4). Typed by RuleId, so a rule without a case is a type
 * error. Input fail cases are minimalInput() with one deliberate defect; file fail cases are the
 * `minimal` golden file with one deliberate defect.
 */
import type { PhonePrefix, Shareholder } from '../../src/model/input.js';
import type { ParseOptions } from '../../src/model/options.js';
import type { RuleId } from '../../src/validate/rules.js';
import { minimalInput } from '../fixtures/builders.js';
import {
  dropLine,
  goldenBytes,
  goldenText,
  swapLines,
  tamper,
  type Tamper,
} from '../fixtures/files.js';

/** minimalInput() with its single shareholder changed by `overrides`. */
function withShareholder(overrides: Partial<Shareholder>) {
  const shareholders = minimalInput().shareholders.map(shareholder => ({
    ...shareholder,
    ...overrides,
  }));
  return minimalInput({ shareholders });
}

/** The `minimal` golden file text with one edit. */
function minimalFile(edit?: Tamper): string {
  const text = goldenText('minimal');
  return edit ? tamper(text, edit) : text;
}

/** The `minimal` golden file as UTF-8 bytes. */
function minimalUtf8(): Uint8Array {
  return new TextEncoder().encode(goldenText('minimal'));
}

const UTF8: ParseOptions = { encoding: 'utf-8' };
/** A byte that never occurs in UTF-8. */
const INVALID_UTF8_BYTE = 0xff;

interface CaseBase {
  /** Path the fail case's issue must carry. */
  path?: string;
}

/** A rule case run through runPipeline (validate1214 from C6 on). */
interface InputRuleCase extends CaseBase {
  kind: 'input';
  fail(): unknown;
  pass(): unknown;
}

/**
 * A rule case run through parse1214: issues come from ParseResult.issues, or from the thrown
 * Opcn1214ParseError for structural problems.
 */
interface FileRuleCase extends CaseBase {
  kind: 'file';
  fail(): string | Uint8Array;
  pass(): string | Uint8Array;
  options?: ParseOptions;
}

export type RuleCase = InputRuleCase | FileRuleCase;

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
  'input.shape': {
    kind: 'input',
    fail: () => ({ ...minimalInput(), company: { ...minimalInput().company, faxx: '1234567' } }),
    pass: () => minimalInput({ company: { email: undefined } }),
    path: 'company.faxx',
  },
  'field.required': {
    kind: 'input',
    // An absent required property is input.shape; empty after normalization is field.required.
    fail: () => minimalInput({ company: { registeredName: ' ' } }),
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
  'parse.empty': {
    kind: 'file',
    fail: () => '',
    pass: () => goldenBytes('minimal'),
  },
  'parse.encoding': {
    kind: 'file',
    // Line 1 is ASCII up to column 137, so byte 137 is column 137.
    fail: () => {
      const bytes = minimalUtf8();
      bytes[136] = INVALID_UTF8_BYTE;
      return bytes;
    },
    pass: minimalUtf8,
    options: UTF8,
    path: '',
  },
  'parse.lineLength': {
    kind: 'file',
    fail: () => minimalFile({ line: 3, position: 150, value: '', length: 1 }),
    pass: () => goldenText('minimal').replaceAll('\r\n', '\n'),
    path: '',
  },
  'parse.formType': {
    kind: 'file',
    fail: () => minimalFile({ line: 2, position: 1, value: '1215' }),
    pass: () => minimalFile(),
    path: '',
  },
  'parse.recordType': {
    kind: 'file',
    fail: () => minimalFile({ line: 2, position: 5, value: '1021' }),
    pass: () => minimalFile(),
    path: '',
  },
  'parse.prefixFiller': {
    kind: 'file',
    fail: () => minimalFile({ line: 2, position: 100, value: '1' }),
    pass: () => minimalFile(),
    path: '',
  },
  'parse.order': {
    kind: 'file',
    fail: () => swapLines(goldenText('minimal'), 2, 3),
    pass: () => minimalFile(),
    path: '',
  },
  'parse.control.missing': {
    kind: 'file',
    fail: () => dropLine(goldenText('minimal'), 3),
    pass: () => minimalFile(),
    path: '',
  },
  'parse.control.counts': {
    kind: 'file',
    // 9999@141: number of 1020 records.
    fail: () => minimalFile({ line: 3, position: 141, value: '02' }),
    pass: () => minimalFile(),
    path: '',
  },
  'parse.numeric': {
    kind: 'file',
    fail: () => minimalFile({ line: 1, position: 137, value: 'X' }),
    pass: () => minimalFile({ line: 1, position: 137, value: '0' }),
    path: 'company.fileNumber',
  },
  'parse.date': {
    kind: 'file',
    fail: () => minimalFile({ line: 1, position: 165, value: '30/02/2025' }),
    pass: () => minimalFile({ line: 1, position: 165, value: '28/02/2025' }),
    path: 'meta.saveDate',
  },
  'parse.codeSection': {
    kind: 'file',
    // 1000@2185: the code-amount section; 999 is not a code.
    fail: () => minimalFile({ line: 1, position: 2185, value: '999' }),
    pass: () => minimalFile(),
    path: '',
  },
  'parse.fieldValue': {
    kind: 'file',
    // 1000@878 is yes/no: written 1 or 2 (0 when absent).
    fail: () => minimalFile({ line: 1, position: 878, value: '3' }),
    pass: () => minimalFile({ line: 1, position: 878, value: '1' }),
    path: 'declarations.hasTaxPlanningAction',
  },
};
