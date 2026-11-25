import type { Report1214ProfileInput } from '../../../../../gql/graphql.js';
import {
  digitsDescription,
  numberToText,
  parsed,
  parseError,
  parseOptionalCount,
  parseOptionalDigits,
  parseOptionalNumber,
  type ParseResult,
} from './form-values.js';

/**
 * The smaller profile blocks ("other details"): each is a handful of plain fields, so they share
 * one editor driven by the field lists below, and one conversion each way.
 */

export type OtherDetailsBlockKey =
  | 'attachments'
  | 'bankAccount'
  | 'otherTaxableIncome'
  | 'capitalGainsSummary'
  | 'qualifyingCompany';

/**
 * How a field is edited: `count` a non-negative integer, `number` any number, `digits` a digit
 * string of `digits[0]`–`digits[1]` digits, `text` free text, `yesNo` yes / no / not set and
 * `flag` a checkbox (unchecked is stored as not set).
 */
export type OtherDetailsFieldKind = 'count' | 'number' | 'digits' | 'text' | 'yesNo' | 'flag';

export type OtherDetailsField = {
  /** The member of the block, dotted for a nested object (`reasons.other`). */
  path: string;
  label: string;
  kind: OtherDetailsFieldKind;
  digits?: [number, number];
};

export type OtherDetailsBlock = {
  key: OtherDetailsBlockKey;
  title: string;
  description: string;
  fields: OtherDetailsField[];
  /** Every field is required once any is filled in (the bank account). */
  allOrNothing?: boolean;
};

/** Field texts by path. `yesNo` holds `yes` / `no` / ``, `flag` holds `true` / ``. */
export type OtherDetailsValues = Record<string, string>;

export const OTHER_DETAILS_BLOCKS: OtherDetailsBlock[] = [
  {
    key: 'attachments',
    title: 'Attachments',
    description: 'Numbers of certificates attached to the report (fields 954-959).',
    fields: [
      { path: 'donationReceiptsCount', label: 'Donation receipts (code 070)', kind: 'count' },
      {
        path: 'withholdingCertificatesCount',
        label: 'Withholding certificates (code 010)',
        kind: 'count',
      },
    ],
  },
  {
    key: 'bankAccount',
    title: 'Changed bank account',
    description:
      'Fill in only when the bank account for refunds changed (codes 277, 278, 280). Clear all three fields to keep the account on file.',
    allOrNothing: true,
    fields: [
      { path: 'bank', label: 'Bank', kind: 'digits', digits: [2, 2] },
      { path: 'branch', label: 'Branch', kind: 'digits', digits: [3, 3] },
      { path: 'account', label: 'Account', kind: 'digits', digits: [1, 9] },
    ],
  },
  {
    key: 'otherTaxableIncome',
    title: 'Other taxable income',
    description: 'Other taxable income in Israel and abroad (fields 887-953).',
    fields: [
      { path: 'source', label: 'Source', kind: 'text' },
      { path: 'amount', label: 'Amount', kind: 'number' },
      { path: 'ratePercent', label: 'Tax rate %', kind: 'number' },
    ],
  },
  {
    key: 'capitalGainsSummary',
    title: 'Capital-gains appendices',
    description:
      'Capital-gains appendices, and why any were not transmitted (fields 960-1017, 964-968).',
    fields: [
      { path: 'totalAppendicesCount', label: 'Appendices', kind: 'count' },
      { path: 'untransmittedCount', label: 'Not transmitted', kind: 'count' },
      { path: 'reasons.lossOrNoGain', label: 'Loss or no gain', kind: 'flag' },
      {
        path: 'reasons.overFiveImprovementBalances',
        label: 'Over five improvement balances',
        kind: 'flag',
      },
      { path: 'reasons.over14Appendices', label: 'Over 14 appendices', kind: 'flag' },
      { path: 'reasons.other', label: 'Other reason', kind: 'flag' },
      { path: 'reasons.otherText', label: 'Other reason (text)', kind: 'text' },
    ],
  },
  {
    key: 'qualifyingCompany',
    title: 'Qualifying company purchase',
    description: 'Purchase of a qualifying company (part A of the form, fields 1065-1102).',
    fields: [
      { path: 'purchased', label: 'Purchased a qualifying company', kind: 'yesNo' },
      { path: 'israeliPurchaseAmount', label: 'Israeli purchase amount', kind: 'number' },
      { path: 'foreignPurchaseAmount', label: 'Foreign purchase amount', kind: 'number' },
      { path: 'amortizationClaimed', label: 'Amortization claimed', kind: 'yesNo' },
      { path: 'amortizationAmount', label: 'Amortization amount', kind: 'number' },
    ],
  },
];

function readPath(source: unknown, path: string): unknown {
  let value = source;
  for (const part of path.split('.')) {
    if (value == null || typeof value !== 'object') {
      return undefined;
    }
    value = (value as Record<string, unknown>)[part];
  }
  return value;
}

function writePath(target: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let node = target;
  for (const part of parts.slice(0, -1)) {
    node[part] ??= {};
    node = node[part] as Record<string, unknown>;
  }
  node[parts.at(-1)!] = value;
}

function valueToText(kind: OtherDetailsFieldKind, value: unknown): string {
  if (value == null) {
    return '';
  }
  switch (kind) {
    case 'yesNo':
      return value === true ? 'yes' : value === false ? 'no' : '';
    case 'flag':
      return value === true ? 'true' : '';
    case 'count':
    case 'number':
      return typeof value === 'number' ? numberToText(value) : '';
    default:
      return typeof value === 'string' ? value : '';
  }
}

/** The field texts of a stored block; `null` (nothing stored) gives blank fields. */
export function otherDetailsValuesFromBlock(
  block: OtherDetailsBlock,
  stored: object | null | undefined,
): OtherDetailsValues {
  return Object.fromEntries(
    block.fields.map(field => [field.path, valueToText(field.kind, readPath(stored, field.path))]),
  );
}

type FieldParse = { ok: true; value: unknown } | { ok: false; error: string };

function parseField(field: OtherDetailsField, text: string): FieldParse {
  const invalid = (what: string): FieldParse => ({ ok: false, error: `${field.label}: ${what}` });
  switch (field.kind) {
    case 'count': {
      const value = parseOptionalCount(text);
      return value === undefined ? invalid('enter a whole number') : { ok: true, value };
    }
    case 'number': {
      const value = parseOptionalNumber(text);
      return value === undefined ? invalid('enter a number') : { ok: true, value };
    }
    case 'digits': {
      const [min, max] = field.digits ?? [1, 9];
      const value = parseOptionalDigits(text, min, max);
      return value === undefined ? invalid(digitsDescription(min, max)) : { ok: true, value };
    }
    case 'yesNo':
      return { ok: true, value: text === 'yes' ? true : text === 'no' ? false : null };
    case 'flag':
      return { ok: true, value: text === 'true' ? true : null };
    default: {
      const trimmed = text.trim();
      return { ok: true, value: trimmed === '' ? null : trimmed };
    }
  }
}

/**
 * The whole block to save. Unset fields are left out; a block with nothing set is `null`, which
 * clears it.
 */
export function otherDetailsBlockToInput<K extends OtherDetailsBlockKey>(
  block: OtherDetailsBlock & { key: K },
  values: OtherDetailsValues,
): ParseResult<Report1214ProfileInput[K]> {
  const input: Record<string, unknown> = {};
  let setCount = 0;
  for (const field of block.fields) {
    const result = parseField(field, values[field.path] ?? '');
    if (!result.ok) {
      return parseError(`${block.title}: ${result.error}`);
    }
    if (result.value != null) {
      writePath(input, field.path, result.value);
      setCount += 1;
    }
  }
  if (setCount === 0) {
    return parsed(null);
  }
  if (block.allOrNothing && setCount < block.fields.length) {
    return parseError(
      `${block.title}: fill in ${block.fields.map(field => field.label.toLowerCase()).join(', ')}, or clear them all`,
    );
  }
  return parsed(input as Report1214ProfileInput[K]);
}
