import { ChevronDown, ChevronUp } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import type { TableFeaturesConfig } from '@/lib/table-features.js';
import type { TableDocumentsRowFieldsFragment } from '../../gql/graphql.js';
import { Button } from '../ui/button.js';
import {
  Amount,
  Creditor,
  DateCell,
  Debtor,
  Description,
  Files,
  Remarks,
  Serial,
  TypeCell,
  Vat,
} from './cells/index.js';
import { DocumentActionsMenu } from './document-actions-menu.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment TableDocumentsRowFields on Document {
    id
    documentType
    image
    file
    description
    remarks
    charge {
      id
    }
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
      allocationNumber
      creditor {
        id
        name
      }
      debtor {
        id
        name
      }
      issuedDocumentInfo {
        id
        status
        originalDocument {
          income {
            description
          }
        }
      }
    }
  }
`;

export type DocumentsTableRowType = TableDocumentsRowFieldsFragment & {
  onUpdate: () => void;
  editDocument: () => void;
};

export interface DocumentsTableColumnsOptions {
  /** Include the menu items that navigate to the document's charge. */
  withChargeLink?: boolean;
}

/**
 * Build the shared documents-table columns. It is a factory rather than a constant because the
 * actions column takes per-host options; `columns` below is the default, option-less column set.
 */
export function getDocumentsTableColumns({
  withChargeLink = false,
}: DocumentsTableColumnsOptions = {}): ColumnDef<TableFeaturesConfig, DocumentsTableRowType>[] {
  return [
    {
      id: 'date',
      accessorKey: 'date',
      sortFn: row => {
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
      id: 'amount',
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
      id: 'vat',
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
      id: 'type',
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
        return (
          <TypeCell
            document={row.original}
            isOpen={
              'issuedDocumentInfo' in row.original &&
              row.original.issuedDocumentInfo?.status === 'OPEN'
            }
          />
        );
      },
    },
    {
      id: 'serial',
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
      id: 'description',
      accessorKey: 'description',
      header: 'Description',
      cell: ({ row }) => {
        return <Description document={row.original} />;
      },
    },
    {
      id: 'remarks',
      accessorKey: 'remarks',
      header: 'Remarks',
      cell: ({ row }) => {
        return <Remarks document={row.original} />;
      },
    },
    {
      id: 'creditor',
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
        return <Creditor document={row.original} onChange={row.original.onUpdate} />;
      },
    },
    {
      id: 'debtor',
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
        return <Debtor document={row.original} onChange={row.original.onUpdate} />;
      },
    },
    {
      id: 'file',
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
      id: 'actions',
      enableHiding: false,
      enableSorting: false,
      cell: ({ row }) => {
        return <DocumentActionsMenu document={row.original} withChargeLink={withChargeLink} />;
      },
    },
  ];
}

/** The default column set, used by hosts that need no per-host options. */
export const columns = getDocumentsTableColumns();
