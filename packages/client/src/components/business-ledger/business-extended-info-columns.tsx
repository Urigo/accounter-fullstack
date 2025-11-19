import type { ColumnDef } from '@tanstack/react-table';
import { Currency } from '../../gql/graphql.js';
import { FIAT_CURRENCIES } from '../../helpers/index.js';
import { DataTableColumnHeader } from '../common/index.js';
import type { ExtendedLedger } from './business-extended-info.js';
import { AmountCell } from './cells/amount-cell.js';
import { BalanceCell } from './cells/balance-cell.js';
import { BusinessNameCell } from './cells/business-name-cell.js';
import { CounterAccountCell } from './cells/counter-account-cell.js';
import { CurrencyAmountCell } from './cells/currency-amount-cell.js';
import { CurrencyBalanceCell } from './cells/currency-balance-cell.js';
import { DateCell } from './cells/date-cell.js';

/**
 * Base columns that are always visible
 */
export const getBaseColumns = (): ColumnDef<ExtendedLedger>[] => [
  {
    accessorKey: 'business.name',
    id: 'businessName',
    header: 'Business Name',
    cell: ({ row }) => <BusinessNameCell business={row.original.business} />,
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'invoiceDate',
    id: 'date',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
    cell: ({ row }) => <DateCell date={row.original.invoiceDate} />,
    sortingFn: 'datetime',
  },
  {
    accessorKey: 'amount.raw',
    id: 'amount',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Amount" />,
    cell: ({ row }) => <AmountCell amount={row.original.amount} />,
    sortingFn: 'basic',
  },
  {
    accessorKey: 'ilsBalance',
    id: 'ilsBalance',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Amount Balance" />,
    cell: ({ row }) => <BalanceCell balance={row.original.ilsBalance} currency={Currency.Ils} />,
    sortingFn: 'basic',
  },
];

/**
 * Generate currency-specific columns (Amount + Balance) for all currencies
 * Columns for inactive currencies will be hidden via initialState
 */
export const getCurrencyColumns = (): ColumnDef<ExtendedLedger>[] => {
  // Generate columns for ALL currencies
  const allCurrencies = Object.values(Currency).filter(currency => currency !== Currency.Ils);

  // Sort to show FIAT currencies first, then crypto
  const sortedCurrencies = allCurrencies.sort((a, b) => {
    const aIsFiat = FIAT_CURRENCIES.includes(a);
    const bIsFiat = FIAT_CURRENCIES.includes(b);
    if (aIsFiat && !bIsFiat) return -1;
    if (!aIsFiat && bIsFiat) return 1;
    return a.localeCompare(b);
  });

  return sortedCurrencies.flatMap(currency => [
    {
      id: `${currency.toLowerCase()}Amount`,
      accessorFn: row => (row.foreignAmount?.currency === currency ? row.foreignAmount.raw : null),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={`${currency} Amount`} />
      ),
      cell: ({ row }) => <CurrencyAmountCell row={row.original} currency={currency} />,
      sortingFn: 'basic',
      // Mark as hideable so users can toggle via column visibility
      enableHiding: true,
    },
    {
      id: `${currency.toLowerCase()}Balance`,
      accessorFn: row => row[`${currency.toLowerCase()}Balance`] ?? null,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={`${currency} Balance`} />
      ),
      cell: ({ row }) => <CurrencyBalanceCell row={row.original} currency={currency} />,
      sortingFn: 'basic',
      // Mark as hideable so users can toggle via column visibility
      enableHiding: true,
    },
  ]);
};

/**
 * End columns that appear after all currency columns
 */
export const getEndColumns = (): ColumnDef<ExtendedLedger>[] => [
  {
    accessorKey: 'reference',
    id: 'reference',
    header: 'Reference',
    cell: ({ row }) => <p className="text-sm whitespace-nowrap">{row.original.reference ?? ''}</p>,
    enableSorting: false,
  },
  {
    accessorKey: 'details',
    id: 'details',
    header: 'Details',
    cell: ({ row }) => <p className="text-sm whitespace-nowrap">{row.original.details ?? ''}</p>,
    enableSorting: false,
  },
  {
    accessorKey: 'counterAccount.name',
    id: 'counterAccount',
    header: 'Counter Account',
    cell: ({ row }) => <CounterAccountCell counterAccount={row.original.counterAccount} />,
    enableSorting: false,
  },
];

/**
 * Generate all columns for the business ledger table
 */
export const getAllColumns = (): ColumnDef<ExtendedLedger>[] => {
  return [...getBaseColumns(), ...getCurrencyColumns(), ...getEndColumns()];
};

/**
 * Get initial column visibility state
 * Hides currency columns that are not in the active currencies set
 */
export const getInitialColumnVisibility = (
  activeCurrencies: Set<Currency>,
): Record<string, boolean> => {
  const visibility: Record<string, boolean> = {};

  // Hide all currency columns that are not active
  for (const currency of Object.values(Currency).filter(c => c !== Currency.Ils)) {
    const isActive = activeCurrencies.has(currency);
    const amountKey = `${currency.toLowerCase()}Amount`;
    const balanceKey = `${currency.toLowerCase()}Balance`;

    // Only set to false (hidden) if not active
    // Omitting means visible by default
    if (!isActive) {
      visibility[amountKey] = false;
      visibility[balanceKey] = false;
    }
  }

  return visibility;
};
