import type { ReactElement } from 'react';
import { TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils.js';
import { Currency, LedgerValidationStatus, MissingChargeInfo } from '../../gql/graphql.js';
import {
  formatAmountWithCurrency,
  getChargeTypeColor,
  getChargeTypeIcon,
  getChargeTypeName,
  type ChargeType,
  type ChargeTypeColor,
} from '../../helpers/index.js';
import { relevantMissingInfo } from './charge-fields.js';

/**
 * Health of a single record field or count.
 *
 * `pending` covers a `@defer`red value that has not arrived yet (notably
 * `metadata.invalidLedger`), which must read as "not known" rather than "fine".
 */
export type IndicatorState = 'ok' | 'pending' | 'warning' | 'error';

const DOT_CLASS: Record<Exclude<IndicatorState, 'ok'>, string> = {
  pending: 'bg-muted-foreground/40 animate-pulse',
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
 * A displayed field that has no value.
 *
 * Deliberately quiet: the needs badge in the manage region carries the alarm for anything actually
 * missing, so repeating it per field would make a record read as full of errors when it is merely
 * incomplete. Was defined identically in two places before this.
 */
export function AbsentValue({ children }: { children: string }): ReactElement {
  return <span className="italic text-muted-foreground/70">{children}</span>;
}

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

/**
 * Complete literal class list per hue. Written out rather than assembled from the hue name because
 * Tailwind only ever sees literals in source — `bg-${color}-50` would compile to nothing, which is
 * precisely the failure this codebase spent a release with across its whole token layer.
 */
const TYPE_CHIP_CLASS: Record<ChargeTypeColor, string> = {
  indigo:
    'bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:ring-indigo-900',
  violet:
    'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-900',
  teal: 'bg-teal-50 text-teal-700 ring-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:ring-teal-900',
  cyan: 'bg-cyan-50 text-cyan-700 ring-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:ring-cyan-900',
  blue: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900',
  orange:
    'bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:ring-orange-900',
  fuchsia:
    'bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200 dark:bg-fuchsia-950/40 dark:text-fuchsia-300 dark:ring-fuchsia-900',
  slate:
    'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:ring-slate-700',
  purple:
    'bg-purple-50 text-purple-700 ring-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:ring-purple-900',
  sky: 'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-900',
  pink: 'bg-pink-50 text-pink-700 ring-pink-200 dark:bg-pink-950/40 dark:text-pink-300 dark:ring-pink-900',
};

/** The hue class list for a charge type. Exported for the palette invariant test. */
export function chargeTypeChipClass(type: ChargeType): string {
  return TYPE_CHIP_CLASS[getChargeTypeColor(type)];
}

/**
 * The record's type token: a tinted icon chip beside the full type name.
 *
 * The type is the key to interpreting every other field, so it reads as a name rather than hiding an
 * icon behind a tooltip. Colour makes it findable down a long list, and is never the only signal —
 * the name always reads, which matters both for colourblind users and for the eleven hues that are
 * only a step apart from each other.
 */
export function ChargeTypeBadge({
  type,
  className,
}: {
  type: ChargeType;
  className?: string;
}): ReactElement {
  return (
    <span className={cn('flex min-w-0 items-center gap-1.5', className)}>
      <span
        className={cn(
          'inline-flex size-6 shrink-0 items-center justify-center rounded-md ring-1 [&_svg]:size-3.5',
          chargeTypeChipClass(type),
        )}
      >
        {getChargeTypeIcon(type)}
      </span>
      <span className="truncate text-sm font-medium">{getChargeTypeName(type)}</span>
    </span>
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
  hint,
}: {
  label: string;
  count: number;
  state?: IndicatorState;
  /** Hover text. Supplements the accessible name below; never a substitute for it. */
  hint?: string;
}): ReactElement {
  return (
    <span
      title={hint}
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap text-xs',
        state === 'error'
          ? 'text-red-600 dark:text-red-400'
          : state === 'warning'
            ? 'text-amber-700 dark:text-amber-400'
            : 'text-muted-foreground',
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
