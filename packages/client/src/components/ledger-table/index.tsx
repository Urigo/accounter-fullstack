import { useMemo, useState, type ReactElement } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
import {
  TableLedgerRecordsFieldsFragmentDoc,
  type TableLedgerRecordsFieldsFragment,
} from '../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../gql/index.js';
import { EMPTY_UUID } from '../../helpers/consts.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table.js';
import { columns } from './columns.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment TableLedgerRecordsFields on Charge {
    id
    ledger {
      __typename
      records {
        id
        creditAccount1 {
          __typename
          id
          name
        }
        creditAccount2 {
          __typename
          id
          name
        }
        debitAccount1 {
          __typename
          id
          name
        }
        debitAccount2 {
          __typename
          id
          name
        }
        creditAmount1 {
          formatted
          currency
        }
        creditAmount2 {
          formatted
          currency
        }
        debitAmount1 {
          formatted
          currency
        }
        debitAmount2 {
          formatted
          currency
        }
        localCurrencyCreditAmount1 {
          formatted
          raw
        }
        localCurrencyCreditAmount2 {
          formatted
          raw
        }
        localCurrencyDebitAmount1 {
          formatted
          raw
        }
        localCurrencyDebitAmount2 {
          formatted
          raw
        }
        invoiceDate
        valueDate
        description
        reference
      }
      ... on Ledger @defer {
        validate {
          ... on LedgerValidation @defer {
            matches
            differences {
              id
              creditAccount1 {
                __typename
                id
                name
              }
              creditAccount2 {
                __typename
                id
                name
              }
              debitAccount1 {
                __typename
                id
                name
              }
              debitAccount2 {
                __typename
                id
                name
              }
              creditAmount1 {
                formatted
                currency
              }
              creditAmount2 {
                formatted
                currency
              }
              debitAmount1 {
                formatted
                currency
              }
              debitAmount2 {
                formatted
                currency
              }
              localCurrencyCreditAmount1 {
                formatted
                raw
              }
              localCurrencyCreditAmount2 {
                formatted
                raw
              }
              localCurrencyDebitAmount1 {
                formatted
                raw
              }
              localCurrencyDebitAmount2 {
                formatted
                raw
              }
              invoiceDate
              valueDate
              description
              reference
            }
          }
        }
      }
    }
  }
`;

function getRowColorByStatus(status?: 'New' | 'Diff' | 'Deleted'): string {
  let rowStyle = '';
  switch (status) {
    case 'New':
      rowStyle = 'bg-green-100/30';
      break;
    case 'Deleted':
      rowStyle = 'bg-red-100/30';
      break;
    case 'Diff':
      rowStyle = 'bg-yellow-100/30';
      break;
  }
  return rowStyle;
}

export type LedgerRecordRow = TableLedgerRecordsFieldsFragment['ledger']['records'][number] & {
  matchingStatus?: 'New' | 'Diff' | 'Deleted';
  diff?: TableLedgerRecordsFieldsFragment['ledger']['records'][number];
};

type Props = {
  ledgerFragment: FragmentType<typeof TableLedgerRecordsFieldsFragmentDoc>;
};

export const LedgerTable = ({ ledgerFragment }: Props): ReactElement => {
  const { ledger } = getFragmentData(TableLedgerRecordsFieldsFragmentDoc, ledgerFragment);
  const [sorting, setSorting] = useState<SortingState>([]);

  const data = useMemo(() => {
    const records: LedgerRecordRow[] = ledger.records.map(record => {
      const diff = ledger.validate?.differences?.find(diffRecord => diffRecord.id === record.id);
      return {
        ...record,
        matchingStatus:
          !ledger.validate?.matches || ledger.validate.matches?.includes(record.id)
            ? undefined
            : diff
              ? 'Diff'
              : 'Deleted',
        diff,
      };
    });
    const newRecords: LedgerRecordRow[] =
      ledger?.validate?.differences
        ?.filter(record => record.id === EMPTY_UUID)
        .map(record => ({
          ...record,
          matchingStatus: 'New',
        })) ?? [];
    records.push(...newRecords);
    return records;
  }, [ledger]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
    },
  });

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map(headerGroup => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map(header => (
              <TableHead key={header.id} colSpan={header.colSpan}>
                {header.isPlaceholder
                  ? null
                  : flexRender(header.column.columnDef.header, header.getContext())}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows?.length ? (
          table.getRowModel().rows.map(row => (
            <TableRow
              key={row.id}
              data-state={row.getIsSelected() && 'selected'}
              className={getRowColorByStatus(row.original.matchingStatus)}
            >
              {row.getVisibleCells().map(cell => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell colSpan={columns.length} className="h-24 text-center">
              No results.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
};
