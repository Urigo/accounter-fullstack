import { ChevronDown, ChevronUp } from 'lucide-react';
import { ColumnDef } from '@tanstack/react-table';
import { TransactionForTransactionsTableFieldsFragment } from '../../gql/graphql.js';
import { ChargeNavigateButton, EditMiniButton, InsertMiscExpenseModal } from '../common/index.js';
import { Button } from '../ui/button.js';
import {
  Account,
  Amount,
  Counterparty,
  DebitDate,
  Description,
  EventDate,
  SourceID,
} from './cells/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment TransactionForTransactionsTableFields on Transaction {
    id
    chargeId
    eventDate
    effectiveDate
    sourceEffectiveDate
    amount {
      raw
      formatted
    }
    cryptoExchangeRate {
      rate
    }
    account {
      id
      __typename
      name
      type
    }
    sourceDescription
    referenceKey
    counterparty {
      name
      id
    }
    missingInfoSuggestions {
      business {
        id
        name
      }
    }
  }
`;

export type TransactionsTableRowType = TransactionForTransactionsTableFieldsFragment & {
  onUpdate: () => void;
  editTransaction: () => void;
  enableEdit?: boolean;
  enableChargeLink?: boolean;
};

export const columns: ColumnDef<TransactionsTableRowType>[] = [
  {
    accessorKey: 'counterparty.name',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          // onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Counterparty
          {column.getIsSorted() &&
            (column.getIsSorted() === 'asc' ? (
              <ChevronUp className="ml-2 h-4 w-4" />
            ) : (
              <ChevronDown className="ml-2 h-4 w-4" />
            ))}
        </Button>
      );
    },
    cell: ({ row }) => {
      return <Counterparty transaction={row.original} />;
    },
  },
  {
    accessorKey: 'eventDate',
    sortingFn: row => {
      return 'eventDate' in row.original && row.original.eventDate
        ? new Date(row.original.eventDate).getTime()
        : 0;
    },
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          // onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Event Date
          {column.getIsSorted() &&
            (column.getIsSorted() === 'asc' ? (
              <ChevronUp className="ml-2 h-4 w-4" />
            ) : (
              <ChevronDown className="ml-2 h-4 w-4" />
            ))}
        </Button>
      );
    },
    cell: ({ row }) => {
      return <EventDate transaction={row.original} />;
    },
  },
  {
    accessorKey: 'effectiveDate',
    sortingFn: row => {
      return 'effectiveDate' in row.original && row.original.effectiveDate
        ? new Date(row.original.effectiveDate).getTime()
        : 0;
    },
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          // onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Debit Date
          {column.getIsSorted() &&
            (column.getIsSorted() === 'asc' ? (
              <ChevronUp className="ml-2 h-4 w-4" />
            ) : (
              <ChevronDown className="ml-2 h-4 w-4" />
            ))}
        </Button>
      );
    },
    cell: ({ row }) => {
      return <DebitDate transaction={row.original} />;
    },
  },
  {
    accessorKey: 'amount.raw',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          // onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Amount
          {column.getIsSorted() &&
            (column.getIsSorted() === 'asc' ? (
              <ChevronUp className="ml-2 h-4 w-4" />
            ) : (
              <ChevronDown className="ml-2 h-4 w-4" />
            ))}
        </Button>
      );
    },
    cell: ({ row }) => {
      return <Amount transaction={row.original} />;
    },
  },
  {
    accessorKey: 'account.name',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          // onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Account
          {column.getIsSorted() &&
            (column.getIsSorted() === 'asc' ? (
              <ChevronUp className="ml-2 h-4 w-4" />
            ) : (
              <ChevronDown className="ml-2 h-4 w-4" />
            ))}
        </Button>
      );
    },
    cell: ({ row }) => {
      return <Account transaction={row.original} />;
    },
  },
  {
    accessorKey: 'sourceDescription',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          // onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Description
          {column.getIsSorted() &&
            (column.getIsSorted() === 'asc' ? (
              <ChevronUp className="ml-2 h-4 w-4" />
            ) : (
              <ChevronDown className="ml-2 h-4 w-4" />
            ))}
        </Button>
      );
    },
    cell: ({ row }) => {
      return <Description transaction={row.original} />;
    },
  },
  {
    accessorKey: 'referenceKey',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          // onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Reference#
          {column.getIsSorted() &&
            (column.getIsSorted() === 'asc' ? (
              <ChevronUp className="ml-2 h-4 w-4" />
            ) : (
              <ChevronDown className="ml-2 h-4 w-4" />
            ))}
        </Button>
      );
    },
    cell: ({ row }) => {
      return <SourceID transaction={row.original} />;
    },
  },
  {
    accessorKey: 'id',
    header: ({ table }) => {
      const rows = table.getCenterRows();
      if (!rows.length) return null;
      const row = rows[0];
      return (
        <div>
          {row.original.enableEdit && row.original.enableChargeLink
            ? 'Actions'
            : row.original.enableEdit
              ? 'Edit'
              : row.original.enableChargeLink
                ? 'Charge'
                : ''}
        </div>
      );
    },
    cell: ({ row }) => {
      if (row.original.enableEdit) {
        return (
          <>
            <EditMiniButton onClick={row.original.editTransaction} />
            <InsertMiscExpenseModal
              chargeId={row.original.chargeId}
              transactionId={row.original.id}
              onDone={row.original.onUpdate}
            />
          </>
        );
      }
      if (row.original.enableChargeLink) {
        return <ChargeNavigateButton chargeId={row.original.chargeId} />;
      }
      return null;
    },
  },
];
