import type { ReactElement } from 'react';
import { TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils.js';
import { Currency, LedgerValidationStatus, MissingChargeInfo } from '../../gql/graphql.js';
import { formatAmountWithCurrency, type ChargeType } from '../../helpers/index.js';
import { relevantMissingInfo } from './charge-fields.js';

/**
 * Health of a single record field or count.
 *
 * `pending` covers a `@defer`red value that has not arrived yet (notably
 * `metadata.invalidLedger`), which must read as "not known" rather than "fine".
 */
export type IndicatorState = 'ok' | 'pending' | 'warning' | 'error';

const DOT_CLASS: Record<Exclude<IndicatorState, 'ok'>, string> = {
  pending: 'bg-gray-300 dark:bg-gray-600 animate-pulse',
  warning: 'bg-amber-500 dark:bg-amber-400',
  error: 'bg-red-500 dark:bg-red-400',
};

/** Human wording for an indicator, used as the accessible name so state is never color-only. */
const STATE_LABEL: Record<IndicatorState, string> = {
  ok: 'ok',
  pending: 'checking',
  warning: 'has differences',
  error: 'has issues',
};

/**
 * Replaces Mantine's `Indicator`. Two differences that matter: `ok` renders nothing (so a healthy
 * record is visually quiet), and every non-ok state contributes text to its container's accessible
 * name — the old corner dot conveyed validation state by color alone.
 */
export function StatusDot({
  state,
  className,
}: {
  state: IndicatorState;
  className?: string;
}): ReactElement | null {
  if (state === 'ok') {
    return null;
  }
  return (
    <span
      aria-hidden
      className={cn('inline-block size-2 shrink-0 rounded-full', DOT_CLASS[state], className)}
    />
  );
}

/** Maps `metadata.invalidLedger` — absent while deferred — onto an indicator state. */
export function ledgerState(invalidLedger: LedgerValidationStatus | undefined): IndicatorState {
  switch (invalidLedger) {
    case undefined:
      return 'pending';
    case LedgerValidationStatus.Valid:
      return 'ok';
    case LedgerValidationStatus.Diff:
      return 'warning';
    case LedgerValidationStatus.Invalid:
      return 'error';
  }
}

/**
 * Maps `CreditcardBankCharge.validCreditCardAmount` onto an indicator state. Only that type
 * validates its amount; every other type passes `undefined` for `shouldValidate` and gets `ok`.
 */
export function amountState(shouldValidate: boolean, isValid: boolean | undefined): IndicatorState {
  if (!shouldValidate) {
    return 'ok';
  }
  if (isValid === undefined) {
    return 'pending';
  }
  return isValid ? 'ok' : 'error';
}

/**
 * One count from the record's health region — `⬤ 4 ledger`. The dot and the count share a single
 * accessible name so a screen reader hears "ledger 4, has differences" rather than just "4".
 */
export function CountChip({
  label,
  count,
  state = 'ok',
}: {
  label: string;
  count: number;
  state?: IndicatorState;
}): ReactElement {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap text-xs',
        state === 'error'
          ? 'text-red-600 dark:text-red-400'
          : state === 'warning'
            ? 'text-amber-700 dark:text-amber-400'
            : 'text-gray-600 dark:text-gray-400',
      )}
      aria-label={`${label} ${count}${state === 'ok' ? '' : `, ${STATE_LABEL[state]}`}`}
    >
      <StatusDot state={state} />
      <span aria-hidden className="tabular-nums font-medium">
        {count}
      </span>
      <span aria-hidden>{label}</span>
    </span>
  );
}

/** Human wording for each missing-info kind, for the needs badge's accessible name. */
const MISSING_INFO_LABEL: Record<MissingChargeInfo, string> = {
  [MissingChargeInfo.Counterparty]: 'counterparty',
  [MissingChargeInfo.Description]: 'description',
  [MissingChargeInfo.Documents]: 'documents',
  [MissingChargeInfo.Tags]: 'tags',
  [MissingChargeInfo.TaxCategory]: 'tax category',
  [MissingChargeInfo.Transactions]: 'transactions',
  [MissingChargeInfo.Vat]: 'VAT',
};

/**
 * Row-level roll-up of what a charge is missing, sitting in the record's manage region so a single
 * column answers "what needs work" down a long list. Renders nothing when the charge is complete.
 *
 * Counts only missing info the record actually displays (see `relevantMissingInfo`) — otherwise a
 * type would advertise a need for a field it never shows.
 */
export function NeedsBadge({
  type,
  missingInfo,
}: {
  type: ChargeType;
  missingInfo: readonly MissingChargeInfo[] | undefined;
}): ReactElement | null {
  const relevant = relevantMissingInfo(type, missingInfo);
  if (relevant.length === 0) {
    return null;
  }
  const names = relevant.map(info => MISSING_INFO_LABEL[info]).join(', ');
  return (
    <span
      className="inline-flex items-center gap-0.5 rounded-md border border-amber-300 bg-amber-50 px-1 py-0.5 text-xs font-medium text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
      title={`Missing: ${names}`}
      aria-label={`${relevant.length} detail${relevant.length === 1 ? '' : 's'} missing: ${names}`}
    >
      <TriangleAlert aria-hidden className="size-3" />
      <span aria-hidden className="tabular-nums">
        {relevant.length}
      </span>
    </span>
  );
}

/**
 * A signed money value. `tabular-nums` is the point: it is what lets amounts line up down the
 * record list, which a plain table cell never did.
 */
export function AmountText({
  value,
  currency,
  className,
}: {
  value: number;
  currency: Currency;
  className?: string;
}): ReactElement {
  return (
    <span
      className={cn(
        'whitespace-nowrap tabular-nums font-medium',
        value > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
        className,
      )}
    >
      {formatAmountWithCurrency(value, currency)}
    </span>
  );
}

/**
 * VAT alongside its own health. Keeps the two local consistency checks the old `Vat` cell made —
 * a missing VAT on an ILS charge, and a VAT whose sign disagrees with the charge amount.
 */
export function vatState({
  value,
  currency,
  amountValue,
  isMissingInfo,
}: {
  value: number | undefined;
  currency: Currency | undefined;
  amountValue: number | undefined;
  isMissingInfo: boolean;
}): IndicatorState {
  if (isMissingInfo) {
    return 'error';
  }
  const localCurrencyButNoVat = value == null && currency === Currency.Ils;
  const signDisagreesWithAmount =
    ((value ?? 0) > 0 && (amountValue ?? 0) < 0) || ((value ?? 0) < 0 && (amountValue ?? 0) > 0);
  return localCurrencyButNoVat || signDisagreesWithAmount ? 'error' : 'ok';
}
