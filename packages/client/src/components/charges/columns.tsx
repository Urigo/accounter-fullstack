// import { Check, Clock, X } from 'lucide-react';
import { PanelTopClose, PanelTopOpen } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import type { ChargeType } from '@/helpers/index.js';
import { DataTableColumnHeader, Tooltip, UpdateAccountantStatus } from '../common/index.js';
import { Button } from '../ui/button.js';
import { Checkbox } from '../ui/checkbox.js';
import { ChargeActionsMenu } from './charge-actions-menu.js';
import { Amount } from './new-cells/amount.js';
import { BusinessTrip } from './new-cells/business-trip.js';
import { Counterparty } from './new-cells/counterparty.js';
import { DateCell } from './new-cells/date.js';
import { Description } from './new-cells/description.js';
import { MoreInfo } from './new-cells/more-info.js';
import { Tags } from './new-cells/tags.js';
import { TaxCategory } from './new-cells/tax-category.js';
import { TypeCell } from './new-cells/type.js';
import { Vat } from './new-cells/vat.js';
import type { ChargeRow } from './new-charges-table.js';

export const columns: ColumnDef<ChargeRow>[] = [
  {
    id: 'select',
    header: ({ table }) => (
      <div className="flex flex-col gap-2">
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && 'indeterminate')
          }
          onCheckedChange={value => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
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
    cell: ({ row }) => <DateCell date={row.getValue<Date>('date')} />,
  },
  {
    accessorKey: 'amount.value',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Amount" />,
    cell: ({ row }) => (row.original.amount ? <Amount {...row.original.amount} /> : null),
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
