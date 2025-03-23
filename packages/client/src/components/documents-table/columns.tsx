import { ChevronDown, ChevronUp } from 'lucide-react';
import { ColumnDef } from '@tanstack/react-table';
import { TableDocumentsRowFieldsFragment } from '../../gql/graphql.js';
import { EditMiniButton } from '../common/index.js';
import { Button } from '../ui/button.js';
import {
  Amount,
  Creditor,
  DateCell,
  Debtor,
  Files,
  Serial,
  TypeCell,
  Vat,
} from './cells-new/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment TableDocumentsRowFields on Document {
    id
    documentType
    image
    file
    ... on FinancialDocument {
      amount {
        raw
        formatted
        currency
      }
      missingInfoSuggestions {
        amount {
          raw
          formatted
          currency
        }
        isIncome
        counterparty {
          id
          name
        }
        owner {
          id
          name
        }
      }
      date
      vat {
        raw
        formatted
        currency
      }
      serialNumber
      creditor {
        id
        name
      }
      debtor {
        id
        name
      }
    }
    ...DocumentsTableAmountFields
    ...DocumentsDateFields
    ...DocumentsTableVatFields
    ...DocumentTypeFields
    ...DocumentSerialFields
    ...DocumentsTableCreditorFields
    ...DocumentsTableDebtorFields
    ...DocumentFilesFields
  }
`;

export type DocumentsTableRowType = TableDocumentsRowFieldsFragment & {
  onUpdate: () => void;
  editDocument: () => void;
};

export const columns: ColumnDef<DocumentsTableRowType>[] = [
  {
    accessorKey: 'date',
    sortingFn: row => {
      return 'date' in row.original && row.original.date
        ? new Date(row.original.date).getTime()
        : 0;
    },
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Date
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
      return <DateCell document={row.original} />;
    },
  },
  {
    accessorKey: 'amount.raw',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
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
      return <Amount document={row.original} />;
    },
  },
  {
    accessorKey: 'vat.raw',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          VAT
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
      return <Vat document={row.original} />;
    },
  },
  {
    accessorKey: 'documentType',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Type
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
      return <TypeCell document={row.original} />;
    },
  },
  {
    accessorKey: 'serialNumber',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Serial
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
      return <Serial document={row.original} />;
    },
  },
  {
    accessorKey: 'creditor.name',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Creditor
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
      return <Creditor document={row.original} />;
    },
  },
  {
    accessorKey: 'debtor.name',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Debtor
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
      return <Debtor document={row.original} />;
    },
  },
  {
    accessorKey: 'file',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          files
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
      return <Files document={row.original} />;
    },
  },
  {
    accessorKey: 'id',
    header: 'Edit',
    cell: ({ row }) => {
      return <EditMiniButton onClick={row.original.editDocument} tooltip="Edit Document" />;
    },
  },
];
