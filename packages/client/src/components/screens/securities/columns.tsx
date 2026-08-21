import { Link } from 'react-router-dom';
import type { ColumnDef, Row } from '@tanstack/react-table';
import type { TableFeaturesConfig } from '@/lib/table-features.js';
import type { SecurityHoldingsScreenQuery } from '../../../gql/graphql.js';
import { ROUTES } from '../../../router/routes.js';
import { DataTableColumnHeader } from '../../common/data-table-column-header.js';
import { SecurityDescriptorBadges } from '../../securities/security-descriptor-badges.js';
import {
  formatSecurityDate,
  formatSecurityNumber,
} from '../../securities/security-executions-table.js';

export type SecurityHoldingRow = SecurityHoldingsScreenQuery['securityHoldings'][number];

type HoldingRow = Row<TableFeaturesConfig, SecurityHoldingRow>;

/** Everything the search box matches on, for one holding. */
export function holdingSearchFields(holding: SecurityHoldingRow): (string | null | undefined)[] {
  const { security } = holding;
  return [
    security.engName,
    security.hebName,
    security.symbol,
    security.isin,
    security.exchange,
    security.currencyCode,
    ...security.identifiers.map(identifier => identifier.value),
  ];
}

/** What a row is called: the English name where there is one, the ISIN otherwise. */
const displayName = (holding: SecurityHoldingRow): string =>
  holding.security.engName ?? holding.security.isin;

/**
 * Money columns sort on the raw number, with missing amounts last ascending. Deliberately
 * currency-blind: rows can be quoted in different trade currencies, so this orders magnitudes
 * rather than value. The currency badge is what lets a reader compare like with like.
 *
 * `?.raw` and not `.raw`: the amount is nullable — a security with no ingested executions has no
 * currency to report one in — while `FinancialAmount.raw` itself is non-null.
 */
const sortByAmount =
  (field: 'averageCost' | 'totalBought' | 'totalSold') => (a: HoldingRow, b: HoldingRow) =>
    (a.original.position[field]?.raw ?? -Infinity) - (b.original.position[field]?.raw ?? -Infinity);

/** TimelessDate is an ISO `YYYY-MM-DD` string, so lexical order is chronological. */
const sortByDate =
  (field: 'historyStartDate' | 'lastExecutionDate') => (a: HoldingRow, b: HoldingRow) =>
    (a.original.position[field] ?? '').localeCompare(b.original.position[field] ?? '');

export const columns: ColumnDef<TableFeaturesConfig, SecurityHoldingRow>[] = [
  {
    id: 'security',
    accessorFn: displayName,
    header: ({ column }) => <DataTableColumnHeader column={column} title="Security" />,
    cell: ({ row }) => {
      const { security } = row.original;
      return (
        // The security's business id is its own id, so this lands on its page — which is where
        // the full execution history lives.
        <Link
          to={ROUTES.BUSINESSES.DETAIL(security.id)}
          state={{ from: ROUTES.SECURITIES }}
          className="font-medium text-blue-600 hover:underline"
        >
          {displayName(row.original)}
          {security.symbol && <span className="text-gray-500"> ({security.symbol})</span>}
          {security.hebName && (
            <span className="block text-xs text-muted-foreground">{security.hebName}</span>
          )}
        </Link>
      );
    },
  },
  {
    id: 'isin',
    accessorFn: row => row.security.isin,
    header: ({ column }) => <DataTableColumnHeader column={column} title="ISIN" />,
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.security.isin}</span>,
  },
  {
    id: 'descriptors',
    header: 'Details',
    enableSorting: false,
    cell: ({ row }) => (
      <SecurityDescriptorBadges security={row.original.security} withIsin={false} />
    ),
  },
  {
    id: 'quantity',
    accessorFn: row => row.position.quantity,
    header: ({ column }) => <DataTableColumnHeader column={column} title="Current hold" />,
    // Quantities can be fractional for ETFs and mutual funds.
    cell: ({ row }) => (
      <span className="tabular-nums">
        {formatSecurityNumber(row.original.position.quantity, 4)}
      </span>
    ),
  },
  {
    id: 'averageCost',
    accessorFn: row => row.position.averageCost?.raw ?? null,
    header: ({ column }) => <DataTableColumnHeader column={column} title="Average cost" />,
    sortFn: sortByAmount('averageCost'),
    cell: ({ row }) => (
      <span className="whitespace-nowrap tabular-nums">
        {row.original.position.averageCost?.formatted ?? '—'}
      </span>
    ),
  },
  {
    id: 'totalBought',
    accessorFn: row => row.position.totalBought?.raw ?? null,
    header: ({ column }) => <DataTableColumnHeader column={column} title="Total bought" />,
    sortFn: sortByAmount('totalBought'),
    cell: ({ row }) => (
      <span className="whitespace-nowrap tabular-nums">
        {row.original.position.totalBought?.formatted ?? '—'}
      </span>
    ),
  },
  {
    id: 'totalSold',
    accessorFn: row => row.position.totalSold?.raw ?? null,
    header: ({ column }) => <DataTableColumnHeader column={column} title="Total sold" />,
    sortFn: sortByAmount('totalSold'),
    cell: ({ row }) => (
      <span className="whitespace-nowrap tabular-nums">
        {row.original.position.totalSold?.formatted ?? '—'}
      </span>
    ),
  },
  {
    id: 'lastExecutionDate',
    accessorFn: row => row.position.lastExecutionDate,
    header: ({ column }) => <DataTableColumnHeader column={column} title="Last execution" />,
    sortFn: sortByDate('lastExecutionDate'),
    cell: ({ row }) => (
      <span className="whitespace-nowrap">
        {formatSecurityDate(row.original.position.lastExecutionDate) || '—'}
      </span>
    ),
  },
  {
    id: 'historyStartDate',
    accessorFn: row => row.position.historyStartDate,
    header: ({ column }) => <DataTableColumnHeader column={column} title="History since" />,
    sortFn: sortByDate('historyStartDate'),
    cell: ({ row }) => (
      <span className="whitespace-nowrap">
        {formatSecurityDate(row.original.position.historyStartDate) || '—'}
      </span>
    ),
  },
];
