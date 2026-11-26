import { z } from 'zod';
import type { Report1214AmountOverrideInput } from '../../../../../gql/graphql.js';
import {
  addRowIssues,
  numberToText,
  parsed,
  parseError,
  parseOptionalNumber,
  type ParseResult,
} from './form-values.js';

/**
 * Code 165, the total of the R&D investments: the report computes it from the R&D investments
 * (the form's validation checks it equals their sum), so the editor never offers to override it.
 */
export const RD_TOTAL_CODE = '165';

/** An amount override while it is edited: the code and its amount as text. */
export type AmountOverrideDraft = { code: string; amount: string };

/** A record 1000 amount of the report, as the `amounts` field returns it. */
type ReportAmount = {
  code: string;
  label?: string | null;
  computedAmount?: number | null;
};

/** A row of the amounts editor: a computed code, an overridden one, or both. */
export type AmountEditorRow = {
  code: string;
  label: string | null;
  computedAmount: number | null;
  /** The override's amount text; `undefined` when the code has no override. */
  override: string | undefined;
  /** Code 165: computed from the R&D investments and not overridable here. */
  readOnly: boolean;
};

export function amountOverrideDraftsFromProfile(
  overrides: ReadonlyArray<{ code: string; amount: number }>,
): AmountOverrideDraft[] {
  return overrides
    .map(override => ({ code: override.code, amount: numberToText(override.amount) }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

/**
 * One row per code that is computed or overridden, sorted by code. The computed values and labels
 * come from the report; whether a code is overridden comes from the drafts, so the rows follow the
 * edits before they are saved.
 */
export function amountEditorRows(
  amounts: ReadonlyArray<ReportAmount>,
  drafts: ReadonlyArray<AmountOverrideDraft>,
): AmountEditorRow[] {
  const rows = new Map<string, AmountEditorRow>();
  for (const amount of amounts) {
    rows.set(amount.code, {
      code: amount.code,
      label: amount.label ?? null,
      computedAmount: amount.computedAmount ?? null,
      override: undefined,
      readOnly: amount.code === RD_TOTAL_CODE,
    });
  }
  for (const draft of drafts) {
    const row = rows.get(draft.code);
    rows.set(draft.code, {
      code: draft.code,
      label: row?.label ?? null,
      computedAmount: row?.computedAmount ?? null,
      override: draft.amount,
      readOnly: draft.code === RD_TOTAL_CODE,
    });
  }
  return [...rows.values()].sort((a, b) => a.code.localeCompare(b.code));
}

/**
 * Why `code` cannot get a new override, or `null` when it can. Codes the year's layout does not
 * take, or derives itself, are refused by the server, whose message names the code.
 */
export function newOverrideCodeError(
  code: string,
  drafts: ReadonlyArray<AmountOverrideDraft>,
): string | null {
  const trimmed = code.trim();
  if (!/^\d{3}$/.test(trimmed)) {
    return 'A record 1000 code is 3 digits, e.g. 018';
  }
  if (trimmed === RD_TOTAL_CODE) {
    return `Code ${RD_TOTAL_CODE} is the total of the R&D investments: edit the investments instead`;
  }
  if (drafts.some(draft => draft.code === trimmed)) {
    return `Code ${trimmed} already has an override`;
  }
  return null;
}

/** Adds an override for `code`, keeping the drafts sorted by code. */
export function addAmountOverrideDraft(
  drafts: ReadonlyArray<AmountOverrideDraft>,
  code: string,
  amount: string,
): AmountOverrideDraft[] {
  return [...drafts, { code: code.trim(), amount }].sort((a, b) => a.code.localeCompare(b.code));
}

/** Why an override amount cannot be saved, or `null`. Amounts may be negative; 0 is kept. */
export function overrideAmountError(amount: string): string | null {
  return parseOptionalNumber(amount) == null
    ? 'Enter the amount as a number, or remove the override'
    : null;
}

/**
 * The whole `amountOverrides` list to save, from the overrides only (never the computed values).
 * An amount of 0 is kept: it suppresses a code the report would otherwise fill in. An empty list
 * clears every override.
 */
export function buildAmountOverridesInput(
  drafts: ReadonlyArray<AmountOverrideDraft>,
): ParseResult<Report1214AmountOverrideInput[]> {
  const input: Report1214AmountOverrideInput[] = [];
  for (const draft of drafts) {
    const amount = parseOptionalNumber(draft.amount);
    if (amount == null) {
      return parseError(`Code ${draft.code}: ${overrideAmountError(draft.amount)}`);
    }
    input.push({ code: draft.code, amount });
  }
  return parsed(input);
}

/** The form state of the amounts editor: the overrides, sorted by code. */
export type AmountOverridesFormState = { overrides: AmountOverrideDraft[] };

/** Checks every override amount with {@link overrideAmountError}. */
export const amountOverridesFormSchema = z
  .object({ overrides: z.array(z.object({ code: z.string(), amount: z.string() })) })
  .superRefine((form, ctx) => {
    for (const [index, override] of form.overrides.entries()) {
      addRowIssues(ctx, 'overrides', index, {
        amount: overrideAmountError(override.amount) ?? undefined,
      });
    }
  });

/** Where an override for `code` goes in the sorted list. */
export function overrideInsertIndex(
  drafts: ReadonlyArray<AmountOverrideDraft>,
  code: string,
): number {
  const index = drafts.findIndex(draft => draft.code.localeCompare(code) > 0);
  return index === -1 ? drafts.length : index;
}
