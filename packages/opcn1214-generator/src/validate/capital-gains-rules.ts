/**
 * Capital-gains appendix rules (SPEC §9.2 stage 4, §10.6): pure checks over the normalized 30xx
 * records, so they run on validated input and on parsed files alike. cg.improvements.max is a
 * normalizer notice (a sixth improvement has no field), not a rule over the records.
 */
import type { Primitive } from '../codec/types.js';
import { Opcn1214InternalError } from '../errors.js';
import { isCapitalGainsRecordType } from '../layout/capital-gains.js';
import type { RecordType } from '../layout/types.js';
import type { NormalizedRecord, NormalizedReport } from '../model/normalized.js';
import { walletAddressKey } from '../normalize/capital-gains/assets.js';
import {
  IMPROVEMENT_HEADER_MEMBERS,
  IMPROVEMENT_SLOTS,
  improvementCode,
  improvementKey,
} from '../normalize/capital-gains/other.js';
import { codeKey, inputIndexOf, pathFor } from '../normalize/paths.js';
import { makeIssue, type Issue } from './issue.js';

type ReportRule = (report: NormalizedReport) => Issue[];

/** The input member of an appendix's code map, for pathFor. */
const AMOUNTS_KEY = 'amounts';
/** The input member of the wallet addresses, for pathFor (record 3077). */
const WALLET_ADDRESSES_KEY = 'walletAddresses';
/** Code 071 "מטבע וירטואלי": 1 marks a virtual-currency transaction (p.57, p.59). */
const VIRTUAL_CURRENCY_CODE = '071';

/**
 * Code-amount pairs SHAAM's structure checker accepts in one 30xx record (SPEC §15 A-30): "לא ניתן
 * למלא יותר מ 20 שדות". Not in the PDF; only 3060 and 3065 have more codes (21).
 */
const MAX_CODE_PAIRS = 20;

function otherTransactionsRecords(report: NormalizedReport): NormalizedRecord[] {
  return report.records.filter(record => record.recordType === '3077');
}

/**
 * True for a non-zero number: an optional amount of 0 is absent in the file (SPEC §8.4), so input
 * and parsed files are judged alike.
 */
function hasAmount(value: Primitive): boolean {
  return typeof value === 'number' && value !== 0;
}

/** 30xx@145 "רווח מקרן השקעות" (yes/no). */
const INVESTMENT_FUND = 'gainFromInvestmentFund';

/**
 * The one value 30xx@145 may hold per record type (SPEC §15 A-8): the PDF lists only "2 - לא" for
 * 3060 (p.43) and 3065 (p.50), and only "1 – כן" for 3064 (p.48). Absent is always allowed.
 */
const INVESTMENT_FUND_VALUES: Readonly<Partial<Record<RecordType, boolean>>> = {
  '3060': false,
  '3064': true,
  '3065': false,
};

/**
 * cg.investmentFund.value: 30xx@145 holds the other yes/no value than the one the PDF allows for
 * its record type (INVESTMENT_FUND_VALUES). Located at the appendix's gainFromInvestmentFund.
 */
function investmentFundValue(report: NormalizedReport): Issue[] {
  return report.records.flatMap(record => {
    const allowed = INVESTMENT_FUND_VALUES[record.recordType];
    const value = record.values[INVESTMENT_FUND];
    if (allowed === undefined || value === undefined || value === allowed) {
      return [];
    }
    const field = report.layout.records[record.recordType].fields.find(
      def => def.key === INVESTMENT_FUND,
    );
    if (!field) {
      throw new Opcn1214InternalError(
        `Record ${record.recordType} has no field "${INVESTMENT_FUND}"`,
      );
    }
    const expected = allowed ? 'true (1) or absent' : 'false (2) or absent';
    return [
      makeIssue('cg.investmentFund.value', {
        message: `${INVESTMENT_FUND} (${record.recordType}@145) may only be ${allowed ? 'yes (1)' : 'no (2)'} in record ${record.recordType}, or absent.`,
        path: pathFor(record.recordType, inputIndexOf(record), INVESTMENT_FUND),
        recordType: record.recordType,
        recordIndex: record.index,
        field: { position: field.position, length: field.length, nameHe: field.nameHe },
        value,
        expected,
        specRef: { page: field.specPage },
      }),
    ];
  });
}

/**
 * cg.improvements.code50Amount: every improvement slot in use (any header member or its code
 * 501–505 has a value) should have a code-50 amount, and a code-50 amount should come with an
 * expense or an accumulated depreciation (p.58). Located at the improvement's code50Amount.
 */
function improvementCode50Amount(report: NormalizedReport): Issue[] {
  return otherTransactionsRecords(report).flatMap(record =>
    Array.from({ length: IMPROVEMENT_SLOTS }, (_, slot): Issue[] => {
      const code = improvementCode(slot);
      const amount = record.codes.get(code);
      const member = (name: (typeof IMPROVEMENT_HEADER_MEMBERS)[number]) =>
        record.values[improvementKey(slot, name)];
      const used =
        amount !== undefined || IMPROVEMENT_HEADER_MEMBERS.some(name => member(name) !== undefined);
      let message: string | undefined;
      if (used && amount === undefined) {
        message = `Improvement ${slot + 1} has no code-50 amount (code ${code}).`;
      } else if (
        amount !== undefined &&
        !hasAmount(member('expense')) &&
        !hasAmount(member('accumulatedDepreciation'))
      ) {
        message = `Improvement ${slot + 1} has a code-50 amount (code ${code}) but neither an expense nor an accumulated depreciation.`;
      }
      if (message === undefined) {
        return [];
      }
      return [
        makeIssue('cg.improvements.code50Amount', {
          message,
          path: pathFor(record.recordType, inputIndexOf(record), codeKey(code)),
          recordType: record.recordType,
          recordIndex: record.index,
          code,
          ...(amount === undefined ? {} : { value: amount }),
          specRef: { page: 58 },
        }),
      ];
    }).flat(),
  );
}

/**
 * cg.virtualCurrency.wallet: a 3077 appendix with code 071 = 1 needs a virtual wallet address
 * in its first slot, 489 ("יש להכניס כתובת הארנק", p.57); the second slot, 639, is only for
 * "another one" and does not satisfy it. Located at `walletAddresses`.
 */
function virtualCurrencyWallet(report: NormalizedReport): Issue[] {
  const field = report.layout.records['3077'].fields.find(def => def.key === walletAddressKey(0));
  if (!field) {
    throw new Opcn1214InternalError(`Record 3077 has no field "${walletAddressKey(0)}"`);
  }
  return otherTransactionsRecords(report)
    .filter(
      record =>
        record.codes.get(VIRTUAL_CURRENCY_CODE) === 1 &&
        record.values[walletAddressKey(0)] === undefined,
    )
    .map(record =>
      makeIssue('cg.virtualCurrency.wallet', {
        message: `Code ${VIRTUAL_CURRENCY_CODE} = 1 (virtual currency) requires a wallet address.`,
        path: pathFor(record.recordType, inputIndexOf(record), WALLET_ADDRESSES_KEY),
        recordType: record.recordType,
        recordIndex: record.index,
        field: { position: field.position, length: field.length, nameHe: field.nameHe },
        specRef: { page: field.specPage },
      }),
    );
}

/**
 * cg.codePairs.max: at most 20 code-amount pairs written in one capital-gains appendix (SPEC §15
 * A-30, found on shopcn). `codes` holds what is written: zero codes that are not zeroAllowed were
 * omitted while normalizing. Located at the appendix's amounts.
 */
function codePairsMax(report: NormalizedReport): Issue[] {
  return report.records
    .filter(record => isCapitalGainsRecordType(record.recordType))
    .filter(record => record.codes.size > MAX_CODE_PAIRS)
    .map(record =>
      makeIssue('cg.codePairs.max', {
        message: `Capital-gains appendix ${record.recordType} has ${record.codes.size} code-amount pairs; SHAAM accepts at most ${MAX_CODE_PAIRS} in one appendix.`,
        path: pathFor(record.recordType, inputIndexOf(record), AMOUNTS_KEY),
        recordType: record.recordType,
        recordIndex: record.index,
        value: record.codes.size,
        expected: `at most ${MAX_CODE_PAIRS}`,
        specRef: { page: report.layout.records[record.recordType].codes[0]?.specPage ?? 32 },
      }),
    );
}

/** Stage-4 rules of the capital-gains appendices (SPEC §10.6). */
export const CAPITAL_GAINS_RULES: readonly ReportRule[] = [
  investmentFundValue,
  codePairsMax,
  improvementCode50Amount,
  virtualCurrencyWallet,
];
