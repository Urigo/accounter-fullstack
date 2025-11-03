import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { ChevronDown } from 'lucide-react';
import type { ChargeType } from '@/helpers/charges.js';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnFiltersState,
  type SortingState,
} from '@tanstack/react-table';
import { ChargeMatchesTableFieldsFragmentDoc } from '../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../gql/index.js';
import { MergeChargesButton } from '../common/index.js';
import { Button } from '../ui/button.js';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table.js';
import { columns } from './columns.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment ChargeMatchesTableFields on ChargeMatch {
    charge {
      id
      __typename
      minEventDate
      minDebitDate
      minDocumentsDate
      totalAmount {
        raw
        formatted
      }
      vat {
        raw
        formatted
      }
      counterparty {
        name
        id
      }
      userDescription
      tags {
        id
        name
        namePath
      }
      taxCategory {
        id
        name
      }
      #   ...ChargesTableRowFields
    }
    confidenceScore
  }
`;

export interface ChargeMatchRow {
  id: string;
  confidenceScore: number;
  type: ChargeType;
  date?: Date;
  amountRaw?: number;
  amountFormatted?: string;
  vatAmountRaw?: number;
  vatAmountFormatted?: string;
  businessId?: string;
  businessName?: string;
  description?: string;
  tags: Array<{
    id: string;
    name: string;
    namePath?: string[];
  }>;
  taxCategoryId?: string;
  taxCategoryName?: string;
  selectCharge: (id: string | null) => void;
  isSelected: boolean;
}

function convertChargeMatchFragmentToTableRow(
  data: FragmentType<typeof ChargeMatchesTableFieldsFragmentDoc>,
  selectCharge: (id: string | null) => void,
  selectedChargeId: string | null,
): ChargeMatchRow {
  const fragmentData = getFragmentData(ChargeMatchesTableFieldsFragmentDoc, data);
  const rawDate =
    fragmentData.charge.minDocumentsDate ||
    fragmentData.charge.minEventDate ||
    fragmentData.charge.minDebitDate ||
    undefined;
  return {
    id: fragmentData.charge.id,
    confidenceScore: fragmentData.confidenceScore,
    type: fragmentData.charge.__typename as ChargeType,
    date: rawDate ? new Date(rawDate) : undefined,
    amountRaw: fragmentData.charge.totalAmount?.raw,
    amountFormatted: fragmentData.charge.totalAmount?.formatted,
    vatAmountRaw: fragmentData.charge.vat?.raw,
    vatAmountFormatted: fragmentData.charge.vat?.formatted,
    businessId: fragmentData.charge.counterparty?.id,
    businessName: fragmentData.charge.counterparty?.name,
    description: fragmentData.charge.userDescription ?? undefined,
    tags: fragmentData.charge.tags.map(tag => ({
      id: tag.id,
      name: tag.name,
      namePath: tag.namePath ?? undefined,
    })),
    taxCategoryId: fragmentData.charge.taxCategory?.id,
    taxCategoryName: fragmentData.charge.taxCategory?.name,
    selectCharge,
    isSelected: fragmentData.charge.id === selectedChargeId,
  };
}

type Props = {
  originChargeId: string;
  chargesProps?: FragmentType<typeof ChargeMatchesTableFieldsFragmentDoc>[];
  onChange: () => void;
};

export const ChargeMatchesTable = ({
  originChargeId,
  chargesProps,
  onChange,
}: Props): ReactElement => {
  const [sorting, setSorting] = useState<SortingState>([
    {
      id: 'confidenceScore',
      desc: true,
    },
    {
      id: 'amountRaw',
      desc: true,
    },
  ]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [selectedChargeId, setSelectedChargeId] = useState<string | null>(null);
  const [mergeSelected, setMergeSelected] = useState<Array<{ id: string; onChange: () => void }>>([
    { id: originChargeId, onChange },
  ]);

  console.log('Updating merge selected charges:', mergeSelected);
  useEffect(() => {
    setMergeSelected(
      [originChargeId, ...(selectedChargeId ? [selectedChargeId] : [])].map(id => ({
        id,
        onChange,
      })),
    );
  }, [selectedChargeId, onChange, originChargeId]);

  const charges = useMemo(
    () =>
      chargesProps
        ?.map(rawCharge =>
          convertChargeMatchFragmentToTableRow(rawCharge, setSelectedChargeId, selectedChargeId),
        )
        .sort((a, b) => b.confidenceScore - a.confidenceScore) ?? [],
    [chargesProps, selectedChargeId],
  );

  const table = useReactTable({
    data: charges,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting,
      columnFilters,
    },
  });

  return (
    <div className="max-w-[90vw]">
      <div className="flex items-center py-4 gap-4">
        <MergeChargesButton selected={mergeSelected} resetMerge={() => setSelectedChargeId(null)} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild className="ml-auto">
            <Button variant="outline">
              Columns <ChevronDown />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {table
              .getAllColumns()
              .filter(column => column.getCanHide())
              .map(column => {
                return (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={value => column.toggleVisibility(!!value)}
                  >
                    {column.id}
                  </DropdownMenuCheckboxItem>
                );
              })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="overflow-hidden rounded-md border">
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
                <TableRow key={row.id}>
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
      </div>
    </div>
  );
};
