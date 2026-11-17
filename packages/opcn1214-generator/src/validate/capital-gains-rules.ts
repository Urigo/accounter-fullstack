/**
 * Capital-gains appendix rules (SPEC §9.2 stage 4, §10.6): pure checks over the normalized 30xx
 * records, so they run on validated input and on parsed files alike. cg.improvements.max is a
 * normalizer notice (a sixth improvement has no field), not a rule over the records.
 */
import type { Primitive } from '../codec/types.js';
import { Opcn1214InternalError } from '../errors.js';
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

/** The input member of the wallet addresses, for pathFor (record 3077). */
const WALLET_ADDRESSES_KEY = 'walletAddresses';
/** Code 071 "מטבע וירטואלי": 1 marks a virtual-currency transaction (p.57, p.59). */
const VIRTUAL_CURRENCY_CODE = '071';

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
 * ("יש להכניס כתובת הארנק", p.57) in either slot (489, 639). Located at `walletAddresses`.
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
        [0, 1].every(slot => record.values[walletAddressKey(slot)] === undefined),
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

/** Stage-4 rules of the capital-gains appendices (SPEC §10.6). */
export const CAPITAL_GAINS_RULES: readonly ReportRule[] = [
  improvementCode50Amount,
  virtualCurrencyWallet,
];
