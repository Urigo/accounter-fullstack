import type { ReactElement } from 'react';
import { format } from 'date-fns';
import {
  SecurityExecutionFieldsFragmentDoc,
  type SecurityExecutionFieldsFragment,
} from '../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../gql/index.js';
import { ChargeNavigateButton } from '../common/buttons/charge-navigate-button.js';
import { Badge } from '../ui/badge.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment SecurityExecutionFields on SecurityExecution {
    id
    tradeDate
    valueDate
    settlementDate
    tradeType
    transactionType
    paymentType
    quantity
    tradePrice
    tradeGrossValue {
      formatted
    }
    netValue {
      formatted
    }
    tradeCommission {
      formatted
    }
    managementFees {
      formatted
    }
    israelTaxValue {
      raw
      formatted
    }
    foreignTaxValue {
      raw
      formatted
    }
    israelTaxValueByPayments {
      raw
      formatted
    }
    capitalTaxValue {
      raw
      formatted
    }
  }
`;

/** Shared by every cell below, so the formatter is built once rather than per row. */
const securityDecimalFormat = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 4,
});

/**
 * Quantities and prices arrive with four decimals, but nearly all of them are trailing zeros.
 * Keep up to four digits for the fractional ETF/mutual-fund values, drop whatever is only padding.
 */
export const formatSecurityDecimal = (value: number | null | undefined): string =>
  value == null ? '' : securityDecimalFormat.format(value);

/** `YYYY-MM-DD` and nothing else, as a `TimelessDate` field hands it over. */
const timelessDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Dates read `dd/MM/yyyy` across the app. `toLocaleDateString` followed the browser's locale
 * instead, so every securities table showed `m/d/yy` to anyone running en-US.
 *
 * Trade, value and settlement dates are `TimelessDate`s — a calendar day with no time of day —
 * and `new Date('2024-01-15')` would pin one to UTC midnight, which renders as the day before
 * anywhere west of Greenwich. Reorder those digits as text and keep `Date` for the timestamps.
 */
export const formatSecurityDate = (value: string | Date | null | undefined): string => {
  if (!value) return '';
  if (typeof value === 'string') {
    const timeless = timelessDatePattern.exec(value);
    if (timeless) {
      const [, year, month, day] = timeless;
      return `${day}/${month}/${year}`;
    }
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : format(date, 'dd/MM/yyyy');
};

/** The bank's enum values read better as words than as SCREAMING_SNAKE_CASE. */
export const humanizeSecurityEnum = (value: string): string =>
  value
    .toLowerCase()
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

type TaxAmount = { raw: number; formatted: string } | null | undefined;

/** Below this, a tax amount is the bank's zero padding rather than tax worth a line. */
const MIN_TAX_AMOUNT = 0.005;

export type SecurityTaxLine = {
  /** Which tax this is; null for the bank's Israeli tax figure. */
  label: string | null;
  formatted: string;
  /** The bank's Israeli tax figure shown under the per-kind amounts, which it does not add to. */
  secondary?: boolean;
};

/**
 * The tax lines of one execution. The bank reports the tax withheld from the cash leg per kind
 * (foreign, Israeli, capital) in the settlement currency, which is what the ledger books, and
 * separately an Israeli tax figure in the trade currency. Capital tax often restates the Israeli
 * tax, so it is listed only when it differs. The per-kind amounts lead; that figure follows when
 * it is non-zero, and stands alone, as it always did, on rows with no per-kind amount.
 */
export const securityTaxLines = (execution: {
  israelTaxValue?: TaxAmount;
  foreignTaxValue?: TaxAmount;
  israelTaxValueByPayments?: TaxAmount;
  capitalTaxValue?: TaxAmount;
}): SecurityTaxLine[] => {
  const isSignificant = (amount: TaxAmount): amount is NonNullable<TaxAmount> =>
    amount != null && Math.abs(amount.raw) >= MIN_TAX_AMOUNT;

  const capitalTax =
    execution.capitalTaxValue?.raw === execution.israelTaxValueByPayments?.raw
      ? null
      : execution.capitalTaxValue;
  const withheld: SecurityTaxLine[] = [
    { label: 'Foreign', amount: execution.foreignTaxValue },
    { label: 'Israel', amount: execution.israelTaxValueByPayments },
    { label: 'Capital', amount: capitalTax },
  ].flatMap(({ label, amount }) =>
    isSignificant(amount) ? [{ label, formatted: amount.formatted }] : [],
  );

  const israelTax = execution.israelTaxValue;
  if (!withheld.length) {
    return israelTax ? [{ label: null, formatted: israelTax.formatted }] : [];
  }
  return isSignificant(israelTax)
    ? [...withheld, { label: null, formatted: israelTax.formatted, secondary: true }]
    : withheld;
};

export type SecurityExecutionRow = {
  execution: FragmentType<typeof SecurityExecutionFieldsFragmentDoc>;
  /** The charge behind this execution's cash movement, when one was matched. */
  chargeId?: string | null;
};

interface Props {
  rows: readonly SecurityExecutionRow[];
  /** Adds the column linking each execution to its charge. */
  withChargeLink?: boolean;
}

/**
 * One row per executed action, shared by a charge's securities panel and a security's own
 * page so the two always read the same.
 */
export function SecurityExecutionsTable({ rows, withChargeLink }: Props): ReactElement {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Trade Date</TableHead>
          <TableHead>Value Date</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Quantity</TableHead>
          <TableHead>Price</TableHead>
          <TableHead>Gross Value</TableHead>
          <TableHead>Net Value</TableHead>
          <TableHead>Commission</TableHead>
          <TableHead>Tax</TableHead>
          {withChargeLink && <TableHead>Charge</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(row => {
          const execution: SecurityExecutionFieldsFragment = getFragmentData(
            SecurityExecutionFieldsFragmentDoc,
            row.execution,
          );
          return (
            <TableRow key={execution.id}>
              <TableCell className="whitespace-nowrap">
                {formatSecurityDate(execution.tradeDate)}
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {formatSecurityDate(execution.valueDate ?? execution.settlementDate)}
              </TableCell>
              <TableCell>
                <div className="flex flex-row flex-wrap items-center gap-1">
                  <Badge variant="secondary">{humanizeSecurityEnum(execution.tradeType)}</Badge>
                  {execution.transactionType !== execution.tradeType && (
                    <Badge variant="outline">
                      {humanizeSecurityEnum(execution.transactionType)}
                    </Badge>
                  )}
                  {execution.paymentType && (
                    <Badge variant="outline">{humanizeSecurityEnum(execution.paymentType)}</Badge>
                  )}
                </div>
              </TableCell>
              {/* Quantities can be fractional for ETFs and mutual funds. */}
              <TableCell>{formatSecurityDecimal(execution.quantity)}</TableCell>
              <TableCell>{formatSecurityDecimal(execution.tradePrice)}</TableCell>
              {/* A stock distribution's value is its gross value; its net value is only the commission. */}
              <TableCell className="whitespace-nowrap">
                {execution.tradeGrossValue?.formatted}
              </TableCell>
              <TableCell className="whitespace-nowrap">{execution.netValue?.formatted}</TableCell>
              <TableCell className="whitespace-nowrap">
                {(execution.tradeCommission ?? execution.managementFees)?.formatted}
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {securityTaxLines(execution).map(line => (
                  <div
                    key={line.label ?? 'israel-tax'}
                    className={line.secondary ? 'text-xs text-gray-500' : undefined}
                    title={line.label ? undefined : 'Israeli tax as the bank reports it'}
                  >
                    {line.label && <span className="text-gray-500">{line.label} </span>}
                    {line.formatted}
                  </div>
                ))}
              </TableCell>
              {withChargeLink && (
                <TableCell>
                  {row.chargeId ? (
                    <ChargeNavigateButton chargeId={row.chargeId} />
                  ) : (
                    // No cash movement was matched — the trade has no charge to open.
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </TableCell>
              )}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
