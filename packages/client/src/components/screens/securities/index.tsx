import { useContext, useEffect, useMemo, useState, type ReactElement } from 'react';
import { CandlestickChart, Search } from 'lucide-react';
import { useQuery } from 'urql';
import { flexRender, useTable } from '@tanstack/react-table';
import { tableFeaturesConfig } from '@/lib/table-features.js';
import { SecurityHoldingsScreenDocument } from '../../../gql/graphql.js';
import { FiltersContext } from '../../../providers/filters-context.js';
import { DataTablePagination, TableSkeleton } from '../../common/index.js';
import { PageLayout } from '../../layout/page-layout.js';
import { Alert, AlertDescription, AlertTitle } from '../../ui/alert.js';
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '../../ui/empty.js';
import { InputGroup, InputGroupAddon, InputGroupInput } from '../../ui/input-group.js';
import { Label } from '../../ui/label.js';
import { Spinner } from '../../ui/spinner.js';
import { Switch } from '../../ui/switch.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table.js';
import { columns, holdingSearchFields } from './columns.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query SecurityHoldingsScreen($includeClosed: Boolean!) {
    securityHoldings(includeClosed: $includeClosed) {
      id
      security {
        id
        isin
        symbol
        engName
        hebName
        currencyCode
        exchange
        ...SecurityDescriptorFields
        identifiers {
          id
          type
          value
        }
      }
      position {
        id
        quantity
        averageCost {
          raw
          formatted
        }
        totalBought {
          raw
          formatted
        }
        totalSold {
          raw
          formatted
        }
        historyStartDate
        lastExecutionDate
      }
    }
  }
`;

export const Securities = (): ReactElement => {
  const [includeClosed, setIncludeClosed] = useState(false);
  const [search, setSearch] = useState('');
  const [{ data, fetching, error }] = useQuery({
    query: SecurityHoldingsScreenDocument,
    variables: { includeClosed },
  });
  const { setFiltersContext } = useContext(FiltersContext);

  const holdings = useMemo(() => data?.securityHoldings ?? [], [data?.securityHoldings]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) {
      return holdings;
    }
    return holdings.filter(holding =>
      holdingSearchFields(holding).some(field => field?.toLowerCase().includes(needle)),
    );
  }, [holdings, search]);

  const table = useTable({
    features: tableFeaturesConfig,
    data: filtered,
    columns,
    getRowId: row => row.id,
    initialState: {
      // The biggest live positions first — the reason to open this screen.
      sorting: [{ id: 'quantity', desc: true }],
      pagination: { pageIndex: 0, pageSize: 100 },
    },
  });

  // `useTable` hands back a fresh object on every render and `getPageOptions()` a fresh array, so
  // neither can be an effect dependency: the effect would re-run on every render, and setting the
  // filters context re-renders this screen, looping forever ("Maximum update depth exceeded").
  // The pagination bar only reads these primitives, so depend on them instead.
  const { pageIndex, pageSize } = table.state.pagination;
  const pageCount = table.getPageCount();

  useEffect(() => {
    setFiltersContext(
      <div className="flex items-center justify-end gap-10 space-x-2 py-4">
        <DataTablePagination table={table} />
      </div>,
    );
  }, [setFiltersContext, pageIndex, pageSize, pageCount]);

  return (
    <PageLayout
      title={`Securities (${filtered.length})`}
      description="What you hold, added up from the scraped executions"
      headerActions={
        <div className="flex flex-row flex-wrap items-center gap-4">
          {fetching && <Spinner />}
          <InputGroup className="max-w-xs">
            <InputGroupInput
              placeholder="Search name, symbol, ISIN..."
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                // Narrowing the set would otherwise strand the reader on a page that no
                // longer exists.
                table.setPageIndex(0);
              }}
              className="ps-10"
            />
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
          </InputGroup>
          <div className="flex flex-row items-center gap-2">
            <Switch
              id="include-closed"
              checked={includeClosed}
              onCheckedChange={checked => {
                setIncludeClosed(checked);
                table.setPageIndex(0);
              }}
            />
            <Label htmlFor="include-closed" className="whitespace-nowrap">
              Show closed positions
            </Label>
          </div>
        </div>
      }
    >
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load securities</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      ) : fetching ? (
        <div className="rounded-md border p-4">
          <TableSkeleton columns={columns.length} rows={10} />
        </div>
      ) : holdings.length === 0 ? (
        <Empty className="py-8 sm:py-12">
          <EmptyMedia>
            <CandlestickChart className="size-8 sm:size-10 text-muted-foreground" />
          </EmptyMedia>
          <EmptyTitle>{includeClosed ? 'No securities yet' : 'No open positions'}</EmptyTitle>
          <EmptyDescription>
            {includeClosed
              ? 'Securities appear here once trades naming them have been ingested.'
              : 'Nothing is currently held. Turn on "Show closed positions" to see securities that were sold out.'}
          </EmptyDescription>
        </Empty>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map(headerGroup => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map(header => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="text-center py-8">
                      No securities match this search
                    </TableCell>
                  </TableRow>
                ) : (
                  table.getRowModel().rows.map(row => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map(cell => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {/* The same caveat the security page states per security, said once for the screen. */}
          <p className="text-xs text-gray-400">
            Holdings are added up from the scraped executions, not read from a balance the bank
            reports. Anything held before a security&apos;s first scraped trade is therefore not
            counted, and a change in units with no execution behind it — a split, say — is
            invisible. Amounts are in each security&apos;s own trade currency and are never
            converted, so they do not compare across currencies.
          </p>
        </div>
      )}
    </PageLayout>
  );
};
