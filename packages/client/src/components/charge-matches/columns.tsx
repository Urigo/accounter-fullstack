import type { ColumnDef } from '@tanstack/react-table';
import type { ChargeType } from '@/helpers/index.js';
import { DataTableColumnHeader, Score } from '../common/index.js';
import { Checkbox } from '../ui/checkbox.js';
import { Business } from './cells/business.js';
import { DateCell } from './cells/date.js';
import { Tags } from './cells/tags.js';
import { TaxCategory } from './cells/tax-category.js';
import { TypeCell } from './cells/type.js';
import type { ChargeMatchRow } from './index.js';

export const columns: ColumnDef<ChargeMatchRow>[] = [
  {
    id: 'select',
    cell: ({ row }) => (
      <Checkbox
        checked={row.original.isSelected}
        onCheckedChange={value => {
          row.original.selectCharge(value ? row.original.id : null);
          return value;
        }}
        aria-label="Select charge"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'confidenceScore',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Score" />,
    cell: ({ row }) => {
      const confidenceScore = row.getValue<number>('confidenceScore');
      return <Score value={confidenceScore * 100} size="sm" />;
    },
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
    accessorKey: 'amountRaw',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Amount" />,
    cell: ({ row }) => {
      const amount = row.original.amountFormatted;
      return <p className="text-sm font-medium">{amount}</p>;
    },
  },
  {
    accessorKey: 'vatAmountRaw',
    header: ({ column }) => <DataTableColumnHeader column={column} title="VAT" />,
    cell: ({ row }) => {
      const vatAmount = row.original.vatAmountFormatted;
      return <p className="text-sm font-medium">{vatAmount}</p>;
    },
  },
  {
    accessorKey: 'businessName',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Main Business" />,
    cell: ({ row }) => (
      <Business
        business={{
          id: row.original.businessId,
          name: row.original.businessName,
        }}
      />
    ),
  },
  {
    accessorKey: 'description',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Description" />,
    cell: ({ row }) => {
      const description = row.getValue<string>('description');
      return <p className="text-sm font-medium max-w-100 whitespace-normal">{description}</p>;
    },
  },
  {
    accessorKey: 'tags',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Tags" />,
    cell: ({ row }) => <Tags tags={row.getValue('tags')} />,
    enableSorting: false,
  },
  {
    accessorKey: 'taxCategoryName',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Tax Category" />,
    cell: ({ row }) => (
      <TaxCategory
        taxCategory={{
          id: row.original.taxCategoryId,
          name: row.original.taxCategoryName,
        }}
      />
    ),
  },
];
