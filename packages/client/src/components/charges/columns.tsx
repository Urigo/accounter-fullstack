// import { Check, Clock, X } from 'lucide-react';
import { PanelTopClose, PanelTopOpen } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import type { ChargeType } from '@/helpers/index.js';
import type { TableFeaturesConfig } from '@/lib/table-features.js';
import { DataTableColumnHeader, Tooltip, UpdateAccountantStatus } from '../common/index.js';
import { Button } from '../ui/button.js';
import { Checkbox } from '../ui/checkbox.js';
import type { DateProps } from './cells/date.js';
import {
  Amount,
  BusinessTrip,
  Counterparty,
  DateCell,
  Description,
  MoreInfo,
  Tags,
  TaxCategory,
  TypeCell,
  Vat,
} from './cells/index.js';
import { ChargeActionsMenu } from './charge-actions-menu.js';
import { ChargesBatchActionsMenu } from './charges-batch-actions-menu.js';
import type { ChargeRow } from './charges-table.js';

export const columns: ColumnDef<TableFeaturesConfig, ChargeRow>[] = [
  {
    id: 'select',
    header: ({ table }) => (
      <div className="flex flex-row gap-1 items-center">
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && 'indeterminate')
          }
          onCheckedChange={value => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
        <ChargesBatchActionsMenu table={table} />
      </div>
    ),
    cell: ({ row }) => (
      <div className="flex flex-col gap-2 items-center">
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={value => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
        <UpdateAccountantStatus
          chargeId={row.original.id}
          value={row.original.accountantApproval}
          onChange={row.original.onChange}
          // Once the accountant status is set, the charge is handled — collapse its detail panel so
          // the table returns to the next charge that still needs attention.
          onStatusChange={() => row.toggleExpanded(false)}
        />
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'type',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Type" />,
    cell: ({ row }) => <TypeCell type={row.getValue<ChargeType>('type')} />,
  },
  {
    accessorKey: 'date',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
    cell: ({ row }) => <DateCell {...row.getValue<DateProps>('date')} />,
  },
  {
    accessorKey: 'amount.value',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Amount" />,
    cell: ({ row }) => <Amount amount={row.original.amount} />,
    // Sort by absolute amount so charges are ordered by magnitude regardless of income/expense sign.
    sortFn: (rowA, rowB) => {
      const a = Math.abs(rowA.original.amount?.value ?? 0);
      const b = Math.abs(rowB.original.amount?.value ?? 0);
      return a - b;
    },
  },
  {
    accessorKey: 'vat.value',
    header: ({ column }) => <DataTableColumnHeader column={column} title="VAT" />,
    cell: ({ row }) => <Vat {...row.original.vat} />,
  },
  {
    accessorKey: 'counterparty.counterparty.name',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Counterparty" />,
    cell: ({ row }) =>
      row.original.counterparty ? <Counterparty {...row.original.counterparty} /> : null,
  },
  {
    accessorKey: 'description.value',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Description" />,
    cell: ({ row }) => (
      <Description {...row.original.description} onChange={row.original.onChange} />
    ),
  },
  {
    accessorKey: 'tags',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Tags" />,
    cell: ({ row }) => <Tags {...row.original.tags} onChange={row.original.onChange} />,
    enableSorting: false,
  },
  {
    accessorKey: 'taxCategory.taxCategory.name',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Tax Category" />,
    cell: ({ row }) =>
      row.original.taxCategory ? <TaxCategory {...row.original.taxCategory} /> : null,
  },
  {
    accessorKey: 'businessTrip.name',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Business Trip" />,
    cell: ({ row }) =>
      row.original.businessTrip ? <BusinessTrip {...row.original.businessTrip} /> : null,
  },
  {
    accessorKey: 'moreInfo',
    header: ({ column }) => <DataTableColumnHeader column={column} title="More Info" />,
    cell: ({ row }) => <MoreInfo {...row.original.moreInfo} />,
    enableSorting: false,
  },
  {
    accessorKey: 'extension',
    header: ({ column }) => <DataTableColumnHeader column={column} title="" />,
    cell: ({ row }) => {
      const isExpanded = row.getIsExpanded();
      return (
        <div className="flex flex-col gap-2 items-center">
          <ChargeActionsMenu
            chargeId={row.original.id}
            chargeType={row.original.type}
            onChange={row.original.onChange}
            onDelete={row.original.onDelete}
            isIncome={(row.original.amount?.value ?? 0) > 0}
          />
          <Tooltip content="Expand info">
            <Button
              variant={isExpanded ? 'default' : 'outline'}
              onClick={event => {
                event.stopPropagation();
                row.toggleExpanded();
              }}
              className="size-7.5"
            >
              {isExpanded ? (
                <PanelTopClose className="size-5" />
              ) : (
                <PanelTopOpen className="size-5" />
              )}
            </Button>
          </Tooltip>
        </div>
      );
    },
    enableSorting: false,
  },
];
