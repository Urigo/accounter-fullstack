import { ArrowUpDown } from 'lucide-react';
import { ColumnDef } from '@tanstack/react-table';
import { Tag } from '../../gql/graphql.js';
import { Button } from '../ui/button';
import { TagActionsModal } from './tag-actions-modal';

export const columns: ColumnDef<Tag>[] = [
  {
    accessorKey: 'name',
    header: ({ column }): JSX.Element => {
      return (
        <Button
          variant="ghost"
          className="p-0"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Tag Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
  },
  {
    accessorKey: 'fullPath',
    header: 'Full Path',
    cell: ({ row }): JSX.Element => {
      const tag = row.original as Tag;
      const { fullPath } = tag;
      if (!fullPath) {
        return <div className="text-gray-400">No path</div>;
      }
      return <div className="text-gray-500">{String(fullPath)}</div>;
    },
  },
  {
    accessorKey: 'id',
    header: 'ID',
    cell: ({ row }): JSX.Element => {
      const tag = row.original as Tag;
      const { id } = tag;
      return <div className="text-gray-500">{String(id)}</div>;
    },
  },
  {
    accessorKey: 'namePath',
    header: 'Name Path',
    cell: ({ row }): JSX.Element => {
      const tag = row.original as Tag;
      const { namePath } = tag;
      return <div className="text-gray-500">{String(namePath)}</div>;
    },
  },
  {
    id: 'actions',
    header: 'Actions',
    cell: ({ row }): JSX.Element => {
      const tag = row.original;
      return <TagActionsModal tag={tag} />;
    },
  },
];
