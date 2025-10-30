import { ArrowDown, ArrowUp, ChevronsUpDown, EyeOff, LinkIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.js';
import type { BillingCycle, SubscriptionPlan } from '@/gql/graphql.js';
import type { TimelessDateString } from '@/helpers/dates.js';
import { cn } from '@/lib/utils.js';
import type { Column, ColumnDef } from '@tanstack/react-table';
import { ModifyContractDialog } from '../clients/contracts/modify-contract-dialog.js';
import { Badge } from '../ui/badge.js';
import { Button } from '../ui/button.js';
import { Checkbox } from '../ui/checkbox.js';
import { Client, DateCell } from './cells/index.js';
import type { ContractRow } from './index.js';

interface DataTableColumnHeaderProps<TData, TValue> extends React.HTMLAttributes<HTMLDivElement> {
  column: Column<TData, TValue>;
  title: string;
}
export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    return <div className={cn(className)}>{title}</div>;
  }
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="data-[state=open]:bg-accent -ml-3 h-8">
            <span>{title}</span>
            {column.getIsSorted() === 'desc' ? (
              <ArrowDown />
            ) : column.getIsSorted() === 'asc' ? (
              <ArrowUp />
            ) : (
              <ChevronsUpDown />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => column.toggleSorting(false)}>
            <ArrowUp />
            Asc
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => column.toggleSorting(true)}>
            <ArrowDown />
            Desc
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => column.toggleVisibility(false)}>
            <EyeOff />
            Hide
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export const columns: ColumnDef<ContractRow>[] = [
  {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && 'indeterminate')
        }
        onCheckedChange={value => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={value => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'isActive',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Is Active" />,
    cell: ({ row }) => {
      const isActive = row.getValue<boolean>('isActive');
      return isActive ? (
        <Badge variant="default">Active</Badge>
      ) : (
        <Badge variant="destructive">Inactive</Badge>
      );
    },
  },
  {
    accessorKey: 'client.name',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Client" />,
    cell: ({ row }) => {
      return <Client id={row.original.client.id} name={row.original.client.name} />;
    },
  },
  {
    accessorKey: 'startDate',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Start" />,
    cell: ({ row }) => <DateCell timelessDate={row.getValue<TimelessDateString>('startDate')} />,
  },
  {
    accessorKey: 'endDate',
    header: ({ column }) => <DataTableColumnHeader column={column} title="End" />,
    cell: ({ row }) => <DateCell timelessDate={row.getValue<TimelessDateString>('endDate')} />,
  },
  {
    accessorKey: 'purchaseOrder',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Purchase Order" />,
    cell: ({ row }) => (
      <div className="flex flex-row gap-2 items-center">
        <span className="text-sm font-medium">{row.getValue<string>('purchaseOrder')}</span>
        {row.getValue<string>('msCloud') && (
          <Link to={row.getValue<string>('msCloud')} target="_blank" rel="noreferrer">
            <Button variant="link" size="sm" className="p-0" disabled>
              <LinkIcon className="size-4" />
            </Button>
          </Link>
        )}
      </div>
    ),
  },
  {
    accessorKey: 'product',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Product" />,
    cell: ({ row }) => <p className="text-sm font-medium">{row.getValue<string>('product')}</p>,
  },
  {
    accessorKey: 'plan',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Subscription Plan" />,
    cell: ({ row }) => (
      <p className="text-sm font-medium">{row.getValue<SubscriptionPlan>('plan')}</p>
    ),
  },
  {
    accessorKey: 'billingCycle',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Billing Cycle" />,
    cell: ({ row }) => (
      <p className="text-sm font-medium">{row.getValue<BillingCycle>('billingCycle')}</p>
    ),
  },
  {
    accessorKey: 'amount.raw',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Amount" />,
    cell: ({ row }) => <p className="text-sm font-medium">{row.original.amount.formatted}</p>,
  },
  {
    accessorKey: 'operationsLimit',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Operations Limit" />,
    cell: ({ row }) => {
      const operationsLimit = row.getValue<number>('operationsLimit');
      if (!operationsLimit) {
        return null;
      }
      return <p className="text-sm font-medium">{operationsLimit}</p>;
    },
  },
  {
    accessorKey: 'edit',
    header: '',
    cell: ({ row }) => (
      <ModifyContractDialog
        clientId={row.original.client.id}
        contractId={row.original.id}
        // onDone={refetch}
      />
    ),
    enableSorting: false,
  },
];
