/**
 * One pass/fail case per rule (SPEC §13.4). Typed by RuleId, so a rule without a case is a type
 * error. Input fail cases are minimalInput() with one deliberate defect; file fail cases are the
 * `minimal` golden file, or a file generated from a valid input, with one deliberate defect.
 */
import { generate1214 } from '../../src/api/generate.js';
import { getLayout } from '../../src/layout/registry.js';
import type { CountryCode } from '../../src/model/codes.generated.js';
import type {
  PhonePrefix,
  Report1214Input,
  SecuritiesAppendix,
  Shareholder,
} from '../../src/model/input.js';
import type { ParseOptions } from '../../src/model/options.js';
import type { RuleId } from '../../src/validate/rules.js';
import {
  breakdownCountries,
  foreignAppendix,
  foreignAppendixWithBreakdown,
  improvements,
  minimalInput,
  otherTransactionsAppendix,
  rdInvestments,
  rdInvestmentsTotal,
  relatedCompanies,
  section6Appendices,
  section6Appendix,
  securitiesAppendix,
  withCheckDigit,
} from '../fixtures/builders.js';
import {
  dropLine,
  goldenBytes,
  goldenText,
  repeatLine,
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

/** A shareholder of `minimalInput()` with `idNumber` and `dividendRightsPercent` replaced. */
function shareholder(idNumber: string, dividendRightsPercent?: number): Shareholder {
  return { ...minimalInput().shareholders[0]!, idNumber, dividendRightsPercent };
}

/** minimalInput() with `count` shareholders, distinct IDs, none stating dividend rights. */
function withShareholderCount(count: number) {
  const shareholders = Array.from({ length: count }, (_, index) =>
    shareholder(withCheckDigit(10_000_000 + index)),
  );
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

/** Amounts for the first `count` codes of record 3060, each non-zero (all are written). */
function codeAmounts(count: number): SecuritiesAppendix['amounts'] {
  return Object.fromEntries(
    getLayout(2024)
      .records['3060'].codes.slice(0, count)
      .map((def, index) => [def.code, 100 + index]),
  );
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
  minimalInput({ declarations: { beneficiaryEnterprise: { noticeDate: '2024-05-14' } } });
/** minimalInput() with a special tax year. */
const specialYearInput = () =>
  minimalInput({ declarations: { specialYear: { balanceSheetDate: '2024-09-30' } } });

/** minimalInput() with code 420 of the foreign appendix broken down into `countries`. */
function withCountries(
  countries: Array<{ country: string; income: number }>,
  code: '420' | '439' = '420',
) {
  return minimalInput({
    foreignAppendix: foreignAppendixWithBreakdown(code, {
      countries: countries.map(({ country, income }) => ({
        country: country as CountryCode,
        income,
      })),
    }),
  });
}

/** Path of the breakdown of code 420. */
const BREAKDOWN_420 = 'foreignAppendix.countryBreakdown["420"]';

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

/**
 * A rule case run through generate1214Batch: issues come from the thrown Opcn1214ValidationError,
 * or from GenerateResult.warnings.
 */
interface BatchRuleCase extends CaseBase {
  kind: 'batch';
  fail(): unknown[];
  pass(): unknown[];
}

export type RuleCase = InputRuleCase | FileRuleCase | BatchRuleCase;

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
  'struct.batch.size': {
    kind: 'batch',
    fail: () => [],
    pass: () => [minimalInput()],
    path: '',
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
    pass: () => minimalInput({ company: { fileNumber: '18' } }),
    path: 'company.fileNumber',
  },
  'field.length': {
    kind: 'input',
    fail: () => minimalInput({ company: { registeredName: 'א'.repeat(51) } }),
    pass: () => minimalInput({ company: { registeredName: 'א'.repeat(50) } }),
    path: 'company.registeredName',
  },
  'field.checkDigit': {
    kind: 'input',
    // SHAAM's structure checker rejected 570000001 at CP-2 ("ספרת בקורת שגויה").
    fail: () => minimalInput({ company: { fileNumber: '570000001' } }),
    pass: () => minimalInput(),
    path: 'company.fileNumber',
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
  'main.withholdingFile.companyNumber': {
    kind: 'input',
    // shopcn rejected 940000003 for company 514000009 and accepted 951400001 (FIX-2, A-28).
    fail: () => minimalInput({ company: { withholdingFileNumber: '940000003' } }),
    pass: () => minimalInput({ company: { withholdingFileNumber: '951400001' } }),
    path: 'company.withholdingFileNumber',
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
  'main.beneficiaryEnterprise.noticeDateBeforeTaxYear': {
    kind: 'input',
    // shopcn: "הערך '14/05/2023' אינו תקין במילוי 'תאריך מפעל מוטב'" in tax year 2024 (FIX-3, A-33).
    fail: () =>
      minimalInput({ declarations: { beneficiaryEnterprise: { noticeDate: '2023-05-14' } } }),
    pass: () =>
      minimalInput({ declarations: { beneficiaryEnterprise: { noticeDate: '2024-05-14' } } }),
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
  'main.kibbutz.code226Other': {
    kind: 'input',
    fail: () => minimalInput({ declarations: { isKibbutz: true }, amounts: { '226': 9 } }),
    pass: () => minimalInput({ declarations: { isKibbutz: true }, amounts: { '226': 4 } }),
    path: 'amounts["226"]',
  },
  'main.reportablePositions.unexpected': {
    kind: 'input',
    fail: () => minimalInput({ declarations: { reportablePositions: [12] } }),
    pass: () =>
      minimalInput({ declarations: { tookReportablePosition: true, reportablePositions: [12] } }),
    path: 'declarations.reportablePositions',
  },
  'main.rd.records': {
    kind: 'input',
    fail: () => minimalInput({ amounts: { '165': 250_000 } }),
    pass: () =>
      minimalInput({ rdInvestments: rdInvestments(1), amounts: { '165': rdInvestmentsTotal(1) } }),
    path: 'amounts["165"]',
  },
  'main.rd.total': {
    kind: 'input',
    fail: () =>
      minimalInput({
        rdInvestments: rdInvestments(2),
        amounts: { '165': rdInvestmentsTotal(2) + 1 },
      }),
    pass: () =>
      minimalInput({ rdInvestments: rdInvestments(2), amounts: { '165': rdInvestmentsTotal(2) } }),
    path: 'amounts["165"]',
  },
  'main.cgUntransmitted.reason': {
    kind: 'input',
    fail: () => minimalInput({ capitalGainsSummary: { untransmittedCount: 2 } }),
    pass: () =>
      minimalInput({
        capitalGainsSummary: { untransmittedCount: 2, reasons: { over14Appendices: true } },
      }),
    path: 'capitalGainsSummary.reasons',
  },
  'main.cgUntransmitted.reasonWithoutCount': {
    kind: 'input',
    fail: () => minimalInput({ capitalGainsSummary: { reasons: { lossOrNoGain: true } } }),
    pass: () =>
      minimalInput({
        capitalGainsSummary: { untransmittedCount: 1, reasons: { lossOrNoGain: true } },
      }),
    path: 'capitalGainsSummary.untransmittedCount',
  },
  'main.capitalGains.flag': {
    kind: 'input',
    // 833 is derived as yes, so the explicit false exists only in the input (a normalizer notice).
    fail: () =>
      minimalInput({
        declarations: { hasCapitalGainsAppendix: false },
        capitalGains: [section6Appendix()],
      }),
    pass: () =>
      minimalInput({
        declarations: { hasCapitalGainsAppendix: true },
        capitalGains: [section6Appendix()],
      }),
    path: 'declarations.hasCapitalGainsAppendix',
  },
  'main.appendixTotal.min': {
    kind: 'input',
    // Transmitted: the foreign appendix (2000) and one 3063; plus one untransmitted: 3 in total.
    fail: () =>
      minimalInput({
        foreignAppendix: foreignAppendix(),
        capitalGains: [section6Appendix()],
        capitalGainsSummary: {
          totalAppendicesCount: 2,
          untransmittedCount: 1,
          reasons: { lossOrNoGain: true },
        },
      }),
    pass: () =>
      minimalInput({
        foreignAppendix: foreignAppendix(),
        capitalGains: [section6Appendix()],
        capitalGainsSummary: {
          totalAppendicesCount: 3,
          untransmittedCount: 1,
          reasons: { lossOrNoGain: true },
        },
      }),
    path: 'capitalGainsSummary.totalAppendicesCount',
  },
  'main.bankAccount.withNoBank': {
    kind: 'input',
    fail: () =>
      minimalInput({
        declarations: { noBankAccount: true },
        bankAccount: { bank: '12', branch: '345', account: '678' },
      }),
    pass: () => minimalInput({ bankAccount: { bank: '12', branch: '345', account: '678' } }),
    path: 'declarations.noBankAccount',
  },
  'main.qualifyingCompany.purchaseAmounts': {
    kind: 'input',
    fail: () => minimalInput({ qualifyingCompany: { purchased: true } }),
    pass: () => minimalInput({ qualifyingCompany: { purchased: true, foreignPurchaseAmount: 5 } }),
    path: 'qualifyingCompany.israeliPurchaseAmount',
  },
  'main.qualifyingCompany.amortizationAmount': {
    kind: 'input',
    fail: () => minimalInput({ qualifyingCompany: { amortizationClaimed: true } }),
    pass: () =>
      minimalInput({ qualifyingCompany: { amortizationClaimed: true, amortizationAmount: 0 } }),
    path: 'qualifyingCompany.amortizationAmount',
  },
  'main.attachments.code070': {
    kind: 'input',
    fail: () => minimalInput({ attachments: { donationReceiptsCount: 2 } }),
    pass: () =>
      minimalInput({ attachments: { donationReceiptsCount: 2 }, amounts: { '070': 500 } }),
    path: 'amounts["070"]',
  },
  'main.attachments.code010': {
    kind: 'input',
    fail: () => minimalInput({ attachments: { withholdingCertificatesCount: 3 } }),
    pass: () =>
      minimalInput({ attachments: { withholdingCertificatesCount: 3 }, amounts: { '010': 1200 } }),
    path: 'amounts["010"]',
  },
  'shareholders.dividendRights.total': {
    kind: 'input',
    fail: () =>
      minimalInput({
        shareholders: [shareholder('123456782', 50), shareholder('234567899', 49.99)],
      }),
    pass: () =>
      minimalInput({
        shareholders: [
          shareholder('123456782', 33.33),
          shareholder('234567899', 33.33),
          shareholder('345678916', 33.34),
        ],
      }),
    path: 'shareholders',
  },
  'shareholders.duplicateId': {
    kind: 'input',
    fail: () =>
      minimalInput({ shareholders: [shareholder('123456782', 50), shareholder('123456782', 50)] }),
    pass: () =>
      minimalInput({
        shareholders: [
          shareholder('999999964', 25),
          shareholder('999999964', 25),
          shareholder('999999998', 25),
          shareholder('999999998', 25),
        ],
      }),
    path: 'shareholders[1].idNumber',
  },
  'foreign.otherIncome.description': {
    kind: 'input',
    // A blank description is absent after normalization.
    fail: () =>
      minimalInput({ foreignAppendix: foreignAppendix({ otherTaxableIncomeDescription: ' ' }) }),
    pass: () => minimalInput({ foreignAppendix: foreignAppendix() }),
    path: 'foreignAppendix.otherTaxableIncomeDescription',
  },
  'foreign.refund.amount': {
    kind: 'input',
    fail: () =>
      minimalInput({
        foreignAppendix: { ...foreignAppendix(), taxRefundDeclarationAmount: undefined },
      }),
    pass: () => minimalInput({ foreignAppendix: foreignAppendix() }),
    path: 'foreignAppendix.taxRefundDeclarationAmount',
  },
  'foreign.breakdown.required': {
    kind: 'input',
    fail: () => minimalInput({ foreignAppendix: foreignAppendix({ amounts: { '420': 5000 } }) }),
    pass: () => minimalInput({ foreignAppendix: foreignAppendixWithBreakdown('420') }),
    path: BREAKDOWN_420,
  },
  'foreign.breakdown.orphan': {
    kind: 'input',
    fail: () =>
      minimalInput({
        foreignAppendix: {
          ...foreignAppendix(),
          countryBreakdown: { '420': { countries: breakdownCountries(1) } },
        },
      }),
    pass: () => minimalInput({ foreignAppendix: foreignAppendixWithBreakdown('420') }),
    path: BREAKDOWN_420,
  },
  'foreign.breakdown.countries.min': {
    kind: 'input',
    fail: () => withCountries([]),
    pass: () => withCountries(breakdownCountries(1)),
    path: `${BREAKDOWN_420}.countries`,
  },
  'foreign.breakdown.countries.max': {
    kind: 'input',
    fail: () => withCountries(breakdownCountries(11)),
    pass: () => withCountries(breakdownCountries(10)),
    path: `${BREAKDOWN_420}.countries`,
  },
  'foreign.breakdown.country.unknown': {
    kind: 'input',
    // '999' is a real code (the UN); '001' is not in countries.csv.
    fail: () => withCountries([{ country: '001', income: 5000 }]),
    pass: () => withCountries([{ country: '999', income: 5000 }]),
    path: `${BREAKDOWN_420}.countries[0].country`,
  },
  'foreign.breakdown.country.unknownOnlyFor439': {
    kind: 'input',
    fail: () => withCountries([{ country: '-88', income: 5000 }]),
    pass: () => withCountries([{ country: '-88', income: 5000 }], '439'),
    path: `${BREAKDOWN_420}.countries[0].country`,
  },
  'foreign.breakdown.country.duplicate': {
    kind: 'input',
    // '4' is written as '004', the same country.
    fail: () =>
      withCountries([
        { country: '004', income: 3000 },
        { country: '4', income: 2000 },
      ]),
    pass: () => withCountries(breakdownCountries(2)),
    path: `${BREAKDOWN_420}.countries[1].country`,
  },
  'cg.improvements.max': {
    kind: 'input',
    // Only five improvement slots exist (3077@247–416): a normalizer notice at the sixth.
    fail: () =>
      minimalInput({
        capitalGains: [otherTransactionsAppendix({ improvements: improvements(6) })],
      }),
    pass: () =>
      minimalInput({
        capitalGains: [otherTransactionsAppendix({ improvements: improvements(5) })],
      }),
    path: 'capitalGains[0].improvements[5]',
  },
  'cg.improvements.code50Amount': {
    kind: 'input',
    fail: () =>
      minimalInput({
        capitalGains: [
          otherTransactionsAppendix({
            improvements: [improvements(1)[0]!, { expense: 500, date: '2015-01-01' }],
          }),
        ],
      }),
    pass: () => minimalInput({ capitalGains: [otherTransactionsAppendix()] }),
    path: 'capitalGains[0].improvements[1].code50Amount',
  },
  'cg.improvements.expense': {
    kind: 'input',
    // shopcn: "חוסר התאמה בין הנתונים למספר יתרות השבחה" for an improvement with a depreciation but
    // no expense (FIX-3, A-32).
    fail: () =>
      minimalInput({
        capitalGains: [
          otherTransactionsAppendix({
            improvements: [
              improvements(1)[0]!,
              { accumulatedDepreciation: 3000.5, date: '2010-10-10', code50Amount: 2999.5 },
            ],
          }),
        ],
      }),
    pass: () => minimalInput({ capitalGains: [otherTransactionsAppendix()] }),
    path: 'capitalGains[0].improvements[1].expense',
  },
  'cg.virtualCurrency.wallet': {
    kind: 'file',
    // Line 3 is the 3077 record; 3077@489 is its first (and only) wallet address.
    fail: () =>
      generatedFile(minimalInput({ capitalGains: [otherTransactionsAppendix()] }), {
        line: 3,
        position: 489,
        value: ' '.repeat(150),
      }),
    pass: () => generatedFile(minimalInput({ capitalGains: [otherTransactionsAppendix()] })),
    path: 'capitalGains[0].walletAddresses',
  },
  'cg.codePairs.max': {
    kind: 'input',
    // shopcn: "לא ניתן למלא יותר מ 20 שדות" for a 3060 appendix with all 21 codes (FIX-2, A-30).
    fail: () => minimalInput({ capitalGains: [securitiesAppendix({ amounts: codeAmounts(21) })] }),
    pass: () => minimalInput({ capitalGains: [securitiesAppendix({ amounts: codeAmounts(20) })] }),
    path: 'capitalGains[0].amounts',
  },
  'struct.relatedCompanies.max': {
    kind: 'input',
    fail: () => minimalInput({ relatedCompanies: relatedCompanies(4) }),
    pass: () => minimalInput({ relatedCompanies: relatedCompanies(3) }),
    path: 'relatedCompanies',
  },
  'struct.shareholders.min': {
    kind: 'input',
    fail: () => minimalInput({ shareholders: [] }),
    pass: () =>
      minimalInput({ declarations: { isKibbutz: true }, amounts: { '226': 1 }, shareholders: [] }),
    path: 'shareholders',
  },
  'struct.shareholders.max': {
    kind: 'input',
    fail: () => withShareholderCount(100),
    pass: () => withShareholderCount(99),
    path: 'shareholders',
  },
  'struct.rdInvestments.max': {
    kind: 'input',
    fail: () =>
      minimalInput({ rdInvestments: rdInvestments(6), amounts: { '165': rdInvestmentsTotal(6) } }),
    pass: () =>
      minimalInput({ rdInvestments: rdInvestments(5), amounts: { '165': rdInvestmentsTotal(5) } }),
    path: 'rdInvestments',
  },
  'struct.capitalGains.max': {
    kind: 'input',
    fail: () => minimalInput({ capitalGains: section6Appendices(15) }),
    pass: () => minimalInput({ capitalGains: section6Appendices(14) }),
    path: 'capitalGains',
  },
  'main.bankAccount.format': {
    kind: 'input',
    fail: () => minimalInput({ bankAccount: { bank: '1', branch: '345', account: '678' } }),
    pass: () => minimalInput({ bankAccount: { bank: '12', branch: '345', account: '678' } }),
    path: 'bankAccount.bank',
  },
  'cg.investmentFund.value': {
    kind: 'input',
    fail: () =>
      minimalInput({ capitalGains: [securitiesAppendix({ gainFromInvestmentFund: true })] }),
    pass: () =>
      minimalInput({ capitalGains: [securitiesAppendix({ gainFromInvestmentFund: false })] }),
    path: 'capitalGains[0].gainFromInvestmentFund',
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
  'parse.occurrences': {
    kind: 'file',
    // related-and-rd holds the maximum of 3 related companies; a fourth one is counted at 9999@139.
    fail: () =>
      tamper(repeatLine(goldenText('related-and-rd'), 2), { line: 12, position: 139, value: '04' }),
    pass: () => goldenText('related-and-rd'),
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
  'parse.multipleReports': {
    kind: 'file',
    fail: () => goldenText('minimal').repeat(2),
    pass: () => minimalFile(),
    path: '',
  },
  'parse.numeric': {
    kind: 'file',
    fail: () => minimalFile({ line: 1, position: 137, value: 'X' }),
    // Another valid file number (the check digit is field.checkDigit's concern).
    pass: () => minimalFile({ line: 1, position: 137, value: '123456782' }),
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
  'parse.countrySection': {
    kind: 'file',
    // Line 4 is the 2200 record; 2200@187 is the affiliation of its first country entry.
    fail: () =>
      generatedFile(minimalInput({ foreignAppendix: foreignAppendixWithBreakdown('420') }), {
        line: 4,
        position: 187,
        value: '2',
      }),
    pass: () =>
      generatedFile(minimalInput({ foreignAppendix: foreignAppendixWithBreakdown('420') })),
    path: '',
  },
  'parse.derivedMismatch': {
    kind: 'file',
    // 1000@1029 = 1 (directors received an opinion) calls for code 273 = 1; the file has 9.
    fail: () => minimalFile({ line: 1, position: 1029, value: '1' }),
    pass: () => minimalFile(),
    path: '',
  },
};
