import { useMemo, useState, type ReactElement } from 'react';
import { ChevronDownIcon, ChevronUpIcon, PanelTopClose, PanelTopOpen } from 'lucide-react';
import { Paper } from '@mantine/core';
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getSortedRowModel,
  useReactTable,
  type ExpandedState,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table';
import {
  VatReportIncomeFieldsFragmentDoc,
  VatReportIncomeRowFieldsFragmentDoc,
} from '../../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../../gql/index.js';
import { ChargeExtendedInfo } from '../../../charges/charge-extended-info.js';
import { Button } from '../../../ui/button.js';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../ui/table.js';
import { columns, type IncomeTableRowType } from './columns.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment VatReportIncomeFields on VatReportResult {
    income {
      ...VatReportIncomeRowFields
      taxReducedLocalAmount {
        raw
      }
    }
  }
`;

interface Props {
  data?: FragmentType<typeof VatReportIncomeFieldsFragmentDoc>;
  toggleMergeCharge: (chargeId: string) => void;
  mergeSelectedCharges: string[];
}

export const IncomeTable = ({
  data,
  toggleMergeCharge,
  mergeSelectedCharges,
}: Props): ReactElement => {
  const { income } = getFragmentData(VatReportIncomeFieldsFragmentDoc, data) ?? { income: [] };
  const [isOpened, setIsOpened] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [expanded, setExpanded] = useState<ExpandedState>({});

  const tableData: IncomeTableRowType[] = useMemo(() => {
    let incomeCumulativeAmount = 0;

    return income.map(item => {
      incomeCumulativeAmount += item.taxReducedLocalAmount?.raw ?? 0;
      return {
        data: item,
        toggleMergeCharge,
        mergeSelectedCharges,
        cumulativeAmount: incomeCumulativeAmount,
      };
    });
  }, [income, toggleMergeCharge, mergeSelectedCharges]);

  const table = useReactTable({
    data: tableData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onExpandedChange: setExpanded,
    getExpandedRowModel: getExpandedRowModel(),
    state: {
      sorting,
      columnVisibility,
      expanded,
    },
  });

  return (
    <>
      <span className="text-lg font-semibold whitespace-nowrap flex flex-row gap-4">
        <Button
          variant="outline"
          size="icon"
          className="size-7.5"
          onClick={(): void => setIsOpened(i => !i)}
        >
          {isOpened ? <PanelTopClose className="size-5" /> : <PanelTopOpen className="size-5" />}
        </Button>
        Income
      </span>
      {isOpened && (
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <TableHead key={header.id} colSpan={header.colSpan}>
                    {header.isPlaceholder ? null : (
                      <Button
                        variant="ghost"
                        onClick={header.column.getToggleSortingHandler()}
                        className="h-auto p-0 hover:bg-transparent"
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {{
                          asc: <ChevronUpIcon className="size-5" />,
                          desc: <ChevronDownIcon className="size-5" />,
                        }[header.column.getIsSorted() as string] ?? null}
                      </Button>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map(row => {
                const income = getFragmentData(
                  VatReportIncomeRowFieldsFragmentDoc,
                  row.original.data,
                );
                return (
                  <>
                    <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
                      {row.getVisibleCells().map(cell => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                    {row.getIsExpanded() && (
                      <TableRow key={`${row.id}-expanded`}>
                        <TableCell colSpan={columns.length}>
                          <Paper style={{ width: '100%' }} withBorder shadow="lg">
                            <ChargeExtendedInfo chargeID={income.chargeId} fetching={!!income} />
                          </Paper>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </>
  );
};
