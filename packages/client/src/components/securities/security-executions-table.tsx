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
              <TableCell className="whitespace-nowrap">{execution.netValue?.formatted}</TableCell>
              <TableCell className="whitespace-nowrap">
                {(execution.tradeCommission ?? execution.managementFees)?.formatted}
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {execution.israelTaxValue?.formatted}
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
