import { z } from 'zod';
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
  /** A short hint under the field. */
  hint?: string;
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
      {
        path: 'ratePercent',
        label: 'Tax rate %',
        kind: 'number',
        hint: 'Between 0 and 100, at most 2 decimals',
      },
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
  const invalid = (error: string): FieldParse => ({ ok: false, error });
  switch (field.kind) {
    case 'count': {
      const value = parseOptionalCount(text);
      return value === undefined ? invalid('Enter a whole number, 0 or more') : { ok: true, value };
    }
    case 'number': {
      const value = parseOptionalNumber(text);
      return value === undefined ? invalid('Enter a number') : { ok: true, value };
    }
    case 'digits': {
      const [min, max] = field.digits ?? [1, 9];
      const value = parseOptionalDigits(text, min, max);
      return value === undefined
        ? invalid(`Enter ${digitsDescription(min, max)}`)
        : { ok: true, value };
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
 * The errors of a block's fields, by path. In an all-or-nothing block (the bank account), the
 * blank fields are errors once any field is filled in.
 */
export function otherDetailsFieldErrors(
  block: OtherDetailsBlock,
  values: OtherDetailsValues,
): Record<string, string> {
  const errors: Record<string, string> = {};
  let setCount = 0;
  for (const field of block.fields) {
    const result = parseField(field, values[field.path] ?? '');
    if (!result.ok) {
      errors[field.path] = result.error;
    } else if (result.value != null) {
      setCount += 1;
    }
  }
  if (block.allOrNothing && setCount > 0) {
    for (const field of block.fields) {
      if (!(values[field.path] ?? '').trim() && !errors[field.path]) {
        errors[field.path] =
          `Required with the rest of the ${block.title.toLowerCase()}, or clear them all`;
      }
    }
  }
  return errors;
}

/**
 * The whole block to save. Unset fields are left out; a block with nothing set is `null`, which
 * clears it.
 */
export function otherDetailsBlockToInput<K extends OtherDetailsBlockKey>(
  block: OtherDetailsBlock & { key: K },
  values: OtherDetailsValues,
): ParseResult<Report1214ProfileInput[K]> {
  const errors = otherDetailsFieldErrors(block, values);
  const invalidField = block.fields.find(field => errors[field.path]);
  if (invalidField) {
    return parseError(`${block.title}: ${invalidField.label}: ${errors[invalidField.path]}`);
  }
  const input: Record<string, unknown> = {};
  for (const field of block.fields) {
    const result = parseField(field, values[field.path] ?? '');
    if (result.ok && result.value != null) {
      writePath(input, field.path, result.value);
    }
  }
  return parsed(Object.keys(input).length === 0 ? null : (input as Report1214ProfileInput[K]));
}

/** The form state of a block's react-hook-form editor: the field texts, in `block.fields` order. */
export type OtherDetailsFormState = { values: string[] };

export function otherDetailsFormFromBlock(
  block: OtherDetailsBlock,
  stored: object | null | undefined,
): OtherDetailsFormState {
  const values = otherDetailsValuesFromBlock(block, stored);
  return { values: block.fields.map(field => values[field.path] ?? '') };
}

export function otherDetailsValuesFromForm(
  block: OtherDetailsBlock,
  form: OtherDetailsFormState,
): OtherDetailsValues {
  return Object.fromEntries(
    block.fields.map((field, index) => [field.path, form.values[index] ?? '']),
  );
}

/** Validates a block's form with {@link otherDetailsFieldErrors}, each error on its field. */
export function otherDetailsFormSchema(block: OtherDetailsBlock) {
  return z.object({ values: z.array(z.string()) }).superRefine((form, ctx) => {
    const errors = otherDetailsFieldErrors(block, otherDetailsValuesFromForm(block, form));
    for (const [index, field] of block.fields.entries()) {
      const message = errors[field.path];
      if (message) {
        ctx.addIssue({ code: 'custom', path: ['values', index], message });
      }
    }
  });
}
