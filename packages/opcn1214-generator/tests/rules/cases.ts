/**
 * One pass/fail case per rule (SPEC §13.4). Typed by RuleId, so a rule without a case is a type
 * error. Input fail cases are minimalInput() with one deliberate defect; file fail cases are the
 * `minimal` golden file, or a file generated from a valid input, with one deliberate defect.
 */
import { generate1214 } from '../../src/api/generate.js';
import { getLayout } from '../../src/layout/registry.js';
import type { PhonePrefix, Report1214Input, Shareholder } from '../../src/model/input.js';
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

/** Input codes whose presence calls for other data in later rules (D4/D5); kept out of padding. */
const CONDITIONAL_CODES: ReadonlySet<string> = new Set(['010', '070', '080', '084', '165']);

/**
 * minimalInput() with plain amount codes (value 1) added until record 1000 holds `pairs`
 * code-amount pairs, the derived code 273 included.
 */
function withMainCodePairs(pairs: number) {
  const base = minimalInput();
  const present = Object.keys(base.amounts).length + 1; // + derived 273
  const extra = getLayout(2024)
    .records['1000'].codes.filter(
      def =>
        !def.derived &&
        def.kind === 'amount' &&
        def.required === 'no' &&
        !CONDITIONAL_CODES.has(def.code) &&
        !Object.hasOwn(base.amounts, def.code),
    )
    .slice(0, pairs - present)
    .map(def => [def.code, 1]);
  if (extra.length !== pairs - present) {
    throw new Error(`not enough plain codes for ${pairs} pairs`);
  }
  return minimalInput({ amounts: Object.fromEntries(extra) });
}

/** The file generate1214 writes for `input`, with `edit` applied to it. */
function generatedFile(input: Report1214Input, edit?: Tamper): string {
  const { text } = generate1214(input, { today: () => '2024-06-30' });
  return edit ? tamper(text, edit) : text;
}

/** minimalInput() with a family company and the code 080 it calls for. */
const familyCompanyInput = () =>
  minimalInput({
    declarations: { familyCompany: { representativeFileNumber: '300000007' } },
    amounts: { '080': 0 },
  });
/** minimalInput() with a beneficiary enterprise. */
const beneficiaryEnterpriseInput = () =>
  minimalInput({ declarations: { beneficiaryEnterprise: { noticeDate: '2023-05-14' } } });
/** minimalInput() with a special tax year. */
const specialYearInput = () =>
  minimalInput({ declarations: { specialYear: { balanceSheetDate: '2024-09-30' } } });

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
  'input.unknownCode': {
    kind: 'input',
    fail: () => ({ ...minimalInput(), amounts: { ...minimalInput().amounts, '999': 5 } }),
    pass: () => minimalInput({ amounts: { '299': 5 } }),
    path: 'amounts["999"]',
  },
  'input.derivedCode': {
    kind: 'input',
    fail: () => ({ ...minimalInput(), amounts: { ...minimalInput().amounts, '273': 1 } }),
    pass: () => minimalInput({ declarations: { directorsReceivedOpinion: true } }),
    path: 'amounts["273"]',
  },
  'struct.mainCodePairs.max': {
    kind: 'input',
    fail: () => withMainCodePairs(62),
    pass: () => withMainCodePairs(61),
    path: 'amounts',
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
  'main.familyCompany.fileNumber': {
    kind: 'file',
    // The input type requires the file number with the object; a file can leave 1000@837 empty.
    fail: () =>
      generatedFile(familyCompanyInput(), { line: 1, position: 837, value: '0'.repeat(9) }),
    pass: () => generatedFile(familyCompanyInput()),
    path: 'declarations.familyCompany.representativeFileNumber',
  },
  'main.familyCompany.code080': {
    kind: 'input',
    fail: () =>
      minimalInput({ declarations: { familyCompany: { representativeFileNumber: '300000007' } } }),
    pass: familyCompanyInput,
    path: 'amounts["080"]',
  },
  'main.houseCompany.code084': {
    kind: 'input',
    fail: () => minimalInput({ declarations: { isHouseCompany: true } }),
    pass: () => minimalInput({ declarations: { isHouseCompany: true }, amounts: { '084': 0 } }),
    path: 'amounts["084"]',
  },
  'main.investmentLaw.flag': {
    kind: 'input',
    fail: () => minimalInput({ amounts: { '101': 1 } }),
    pass: () =>
      minimalInput({
        declarations: { claimsCapitalInvestmentLawBenefits: true },
        amounts: { '101': 1 },
      }),
    path: 'declarations.claimsCapitalInvestmentLawBenefits',
  },
  'main.beneficiaryEnterprise.noticeDate': {
    kind: 'file',
    // 1000@852: the input type requires the date with the object.
    fail: () =>
      generatedFile(beneficiaryEnterpriseInput(), {
        line: 1,
        position: 852,
        value: ' '.repeat(10),
      }),
    pass: () => generatedFile(beneficiaryEnterpriseInput()),
    path: 'declarations.beneficiaryEnterprise.noticeDate',
  },
  'main.specialYear.balanceSheetDate': {
    kind: 'file',
    // 1000@864: the input type requires the date with the object.
    fail: () =>
      generatedFile(specialYearInput(), { line: 1, position: 864, value: ' '.repeat(10) }),
    pass: () => generatedFile(specialYearInput()),
    path: 'declarations.specialYear.balanceSheetDate',
  },
  'main.kibbutz.code226': {
    kind: 'input',
    fail: () => minimalInput({ declarations: { isKibbutz: true } }),
    pass: () => minimalInput({ declarations: { isKibbutz: true }, amounts: { '226': 1 } }),
    path: 'amounts["226"]',
  },
  'main.buildingIncome.code259': {
    kind: 'input',
    fail: () => minimalInput({ declarations: { hasBuildingIncome: true } }),
    pass: () => minimalInput({ declarations: { hasBuildingIncome: true }, amounts: { '259': 3 } }),
    path: 'amounts["259"]',
  },
  'main.cgReasons.otherText': {
    kind: 'input',
    fail: () =>
      minimalInput({ capitalGainsSummary: { untransmittedCount: 1, reasons: { other: true } } }),
    pass: () =>
      minimalInput({
        capitalGainsSummary: {
          untransmittedCount: 1,
          reasons: { other: true, otherText: 'העסקה בוטלה' },
        },
      }),
    path: 'capitalGainsSummary.reasons.otherText',
  },
  'main.reportablePositions.required': {
    kind: 'input',
    fail: () => minimalInput({ declarations: { tookReportablePosition: true } }),
    pass: () =>
      minimalInput({ declarations: { tookReportablePosition: true, reportablePositions: [12] } }),
    path: 'declarations.reportablePositions',
  },
  'main.reportablePositions.max': {
    kind: 'input',
    fail: () =>
      minimalInput({
        declarations: { tookReportablePosition: true, reportablePositions: [1, 2, 3, 4, 5, 6] },
      }),
    pass: () =>
      minimalInput({
        declarations: { tookReportablePosition: true, reportablePositions: [1, 2, 3, 4, 5] },
      }),
    path: 'declarations.reportablePositions[5]',
  },
  'main.bankAccount.format': {
    kind: 'input',
    fail: () => minimalInput({ bankAccount: { bank: '1', branch: '345', account: '678' } }),
    pass: () => minimalInput({ bankAccount: { bank: '12', branch: '345', account: '678' } }),
    path: 'bankAccount.bank',
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
