import { ChevronsLeftRightEllipsis, ChevronsRightLeft } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { Currency } from '../../gql/graphql.js';
import { FIAT_CURRENCIES } from '../../helpers/index.js';
import { DataTableColumnHeader } from '../common/index.js';
import { Button } from '../ui/button.js';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip.js';
import type { ExtendedLedger } from './business-extended-info.js';
import { AmountCell } from './cells/amount-cell.js';
import { BalanceCell } from './cells/balance-cell.js';
import { BusinessNameCell } from './cells/business-name-cell.js';
import { CounterAccountCell } from './cells/counter-account-cell.js';
import { CurrencyAmountCell } from './cells/currency-amount-cell.js';
import { CurrencyBalanceCell } from './cells/currency-balance-cell.js';
import { DateCell } from './cells/date-cell.js';

interface GetColumnsOptions {
  activeCurrencies: Set<Currency>;
  isExtendAllCurrencies: boolean;
  toggleAllCurrencies: () => void;
  onDownloadCSV: () => void;
}

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
 * Generate currency-specific columns (Amount + Balance) for each active currency
 */
export const getCurrencyColumns = (
  currencies: Set<Currency>,
  isExtendAllCurrencies: boolean,
): ColumnDef<ExtendedLedger>[] => {
  const currenciesToShow = isExtendAllCurrencies ? Object.values(Currency) : Array.from(currencies);

  // Filter out ILS as it's already in base columns
  const foreignCurrencies = currenciesToShow.filter(currency => currency !== Currency.Ils);

  // Sort to show FIAT currencies first, then crypto
  const sortedCurrencies = foreignCurrencies.sort((a, b) => {
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
    },
    {
      id: `${currency.toLowerCase()}Balance`,
      accessorFn: row => row[`${currency.toLowerCase()}Balance`] ?? null,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={`${currency} Balance`} />
      ),
      cell: ({ row }) => <CurrencyBalanceCell row={row.original} currency={currency} />,
      sortingFn: 'basic',
    },
  ]);
};

/**
 * Special columns for actions and controls
 */
export const getSpecialColumns = (
  toggleAllCurrencies: () => void,
  isExtendAllCurrencies: boolean,
): ColumnDef<ExtendedLedger>[] => [
  {
    id: 'currencyToggle',
    header: () => (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline" size="icon" className="size-7.5" onClick={toggleAllCurrencies}>
            {isExtendAllCurrencies ? (
              <ChevronsRightLeft className="size-5" />
            ) : (
              <ChevronsLeftRightEllipsis className="size-5" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{isExtendAllCurrencies ? 'Hide' : 'Show'} all currencies</p>
        </TooltipContent>
      </Tooltip>
    ),
    cell: () => null,
    enableSorting: false,
    enableHiding: false,
  },
];

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
export const getAllColumns = ({
  activeCurrencies,
  isExtendAllCurrencies,
  toggleAllCurrencies,
}: GetColumnsOptions): ColumnDef<ExtendedLedger>[] => {
  return [
    ...getBaseColumns(),
    ...getCurrencyColumns(activeCurrencies, isExtendAllCurrencies),
    ...getSpecialColumns(toggleAllCurrencies, isExtendAllCurrencies),
    ...getEndColumns(),
  ];
};
