import { useContext, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ArrowUpDown, Loader2 } from 'lucide-react';
import { useMutation, useQuery } from 'urql';
import { Image } from '@mantine/core';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  VisibilityState,
} from '@tanstack/react-table';
import {
  DocumentsFilters as DocumentsFiltersType,
  DocumentsScreenDocument,
  DocumentsScreenQuery,
  SuggestDocumentMatchingTransactionsDocument,
} from '../../gql/graphql.js';
import { useUpdateDocument } from '../../hooks/use-update-document.js';
import { useUrlQuery } from '../../hooks/use-url-query.js';
import { FiltersContext } from '../../providers/filters-context.js';
import {
  AccounterTable,
  DataTablePagination,
  PopUpModal,
  UploadDocumentsModal,
} from '../common/index.js';
import { PageLayout } from '../layout/page-layout.js';
import { Button } from '../ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog.js';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table.js';
import { DocumentsFilters } from './ documents-filters.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query DocumentsScreen($filters: DocumentsFilters!) {
    documentsByFilters(filters: $filters) {
      id
      image
      file
      charge {
        id
        userDescription
        __typename
        vat {
          formatted
          __typename
        }
        transactions {
          id
          eventDate
          sourceDescription
          effectiveDate
          amount {
            formatted
            __typename
          }
        }
      }
      __typename
      ... on FinancialDocument {
        creditor {
          id
          name
        }
        debtor {
          id
          name
        }
        vat {
          raw
          formatted
          currency
        }
        serialNumber
        date
        amount {
          raw
          formatted
          currency
        }
      }
    }
  }
`;

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation SuggestDocumentMatchingTransactions($documentId: UUID!) {
    suggestDocumentMatchingTransactions(documentId: $documentId) {
      id
      eventDate
      sourceDescription
      effectiveDate
      amount {
        formatted
      }
    }
  }
`;

export const columns: ColumnDef<DocumentsScreenQuery['documentsByFilters'][number]>[] = [
  {
    accessorKey: '__typename',
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
        <div className="text-left">Type</div>
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const { __typename } = row.original;
      return <div className="text-left font-medium">{__typename}</div>;
    },
  },
  {
    accessorKey: 'image',
    header: () => <div className="text-left">Image</div>,
    cell: ({ row }) => {
      const { image } = row.original;

      return (
        <div className="text-left font-medium">
          {image ? (
            <img alt="missing img" src={image?.toString()} height={80} width={80} />
          ) : (
            'No image'
          )}
        </div>
      );
    },
  },
  {
    accessorKey: 'file',
    header: () => <div className="text-left">File</div>,
    cell: ({ row }) => {
      const { file } = row.original;

      return (
        <div className="text-left font-medium">
          {file && (
            <Button variant="outline" size="sm" asChild>
              <a target="_blank" rel="noreferrer" href={file?.toString()}>
                Open
              </a>
            </Button>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: 'date',
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
        <div className="text-left">Date</div>
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      return 'date' in row.original && row.original.date ? (
        <div className="text-left font-medium">
          {format(new Date(row.original.date), 'dd/MM/yy')}
        </div>
      ) : null;
    },
  },
  {
    accessorKey: 'serialNumber',
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
        <div className="text-left">Serial Number</div>
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      return 'serialNumber' in row.original && row.original.serialNumber ? (
        <div className="text-left font-medium">{row.original.serialNumber}</div>
      ) : null;
    },
  },
  {
    accessorKey: 'vat.raw',
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
        <div className="text-left">VAT</div>
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      return 'vat' in row.original && row.original.vat?.formatted ? (
        <div className="text-left font-medium whitespace-nowrap">{row.original.vat.formatted}</div>
      ) : null;
    },
  },
  {
    accessorKey: 'amount.raw',
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
        <div className="text-left">Amount</div>
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      return 'amount' in row.original && row.original.amount?.formatted ? (
        <div className="text-left font-medium whitespace-nowrap">
          {row.original.amount.formatted}
        </div>
      ) : null;
    },
  },
  {
    accessorKey: 'creditor.name',
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
        <div className="text-left">Creditor</div>
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      return 'creditor' in row.original && row.original.creditor?.name ? (
        <div className="text-left font-medium whitespace-nowrap">{row.original.creditor.name}</div>
      ) : null;
    },
  },
  {
    accessorKey: 'debtor.name',
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
        <div className="text-left">Debtor</div>
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      return 'debtor' in row.original && row.original.debtor?.name ? (
        <div className="text-left font-medium whitespace-nowrap">{row.original.debtor.name}</div>
      ) : null;
    },
  },
  {
    accessorKey: 'charge.transactions[0].id',
    header: () => <div className="text-left">Related Transaction</div>,
    cell: ({ row }) => <TransactionCell row={row} />,
  },
];

export const DocumentsReport = () => {
  const [openedImage, setOpenedImage] = useState<string | null>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const { get } = useUrlQuery();
  const uriFilters = get('documentsFilters');
  const initialFilters = useMemo(() => {
    if (uriFilters) {
      try {
        return JSON.parse(decodeURIComponent(uriFilters)) as DocumentsFiltersType;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {
        return undefined;
      }
    }
    return undefined;
  }, [uriFilters]);
  const [filter, setFilter] = useState<DocumentsFiltersType | undefined>(initialFilters);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const { setFiltersContext } = useContext(FiltersContext);

  const [{ data, fetching }, refetchDocuments] = useQuery({
    query: DocumentsScreenDocument,
    variables: {
      filters: filter ?? {},
    },
    pause: true,
  });

  // refetch charges on filter change
  useEffect(() => {
    if (filter) {
      refetchDocuments();
    }
  }, [filter, refetchDocuments]);

  const table = useReactTable({
    data: data?.documentsByFilters ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    state: {
      sorting,
      columnVisibility,
    },
  });

  const currentPage = table.getState().pagination.pageIndex;

  useEffect(() => {
    setFiltersContext(
      <div className="flex flex-row gap-x-5">
        <DataTablePagination table={table} />
        <DocumentsFilters filter={filter} setFilter={setFilter} initiallyOpened={!filter} />
      </div>,
    );
  }, [table, fetching, filter, setFiltersContext, setFilter, initialFilters, currentPage]);

  return (
    <PageLayout
      title="Documents"
      description="All documents"
      headerActions={
        <div className="flex items-center py-4 gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="ml-auto">Columns</Button>
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
          <Button onClick={() => setUploadModalOpen(true)}>Upload Documents</Button>
        </div>
      }
    >
      {fetching ? (
        <Loader2 className="h-10 w-10 animate-spin mr-2 self-center" />
      ) : (
        <>
          <UploadDocumentsModal
            open={uploadModalOpen}
            onOpenChange={setUploadModalOpen}
            onChange={refetchDocuments}
          />
          {openedImage && (
            <PopUpModal
              modalSize="45%"
              content={<Image src={openedImage} />}
              opened={!!openedImage}
              onClose={(): void => setOpenedImage(null)}
            />
          )}
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map(headerGroup => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map(header => {
                    return (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map(row => (
                  <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
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
        </>
      )}
    </PageLayout>
  );
};

type SuggestedMatch = {
  id: string;
  eventDate?: string | null;
  effectiveDate?: string | null;
  sourceDescription?: string | null;
  amount?: { formatted?: string | null } | null;
};

const SuggestedMatchesDialog = ({
  open,
  onOpenChange,
  matches,
  onSelectMatch,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matches: SuggestedMatch[];
  onSelectMatch: (matchId: string) => void;
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>AI Suggested Matches</DialogTitle>
          <DialogDescription>Select a transaction to link with this document</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {matches.map(match => (
            <div key={match.id} className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-1">
                <div className="font-medium">{match.sourceDescription}</div>
                <div className="text-sm text-gray-500">
                  {match.eventDate && `Created: ${format(new Date(match.eventDate), 'dd/MM/yy')}`}
                  {match.effectiveDate &&
                    ` • Effective: ${format(new Date(match.effectiveDate), 'dd/MM/yy')}`}
                </div>
                <div className="text-sm font-medium">{match.amount?.formatted}</div>
              </div>
              <Button variant="outline" onClick={() => onSelectMatch(match.id)}>
                Select
              </Button>
            </div>
          ))}
          {matches.length === 0 && (
            <div className="text-center py-4 text-gray-500">No matches found</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

const TransactionCell = ({
  row,
}: {
  row: {
    original: DocumentsScreenQuery['documentsByFilters'][number];
  };
}) => {
  const [{ fetching }, suggestMatches] = useMutation(SuggestDocumentMatchingTransactionsDocument);
  const { updateDocument } = useUpdateDocument();
  const [suggestedMatches, setSuggestedMatches] = useState<SuggestedMatch[]>([]);
  const [showMatchesDialog, setShowMatchesDialog] = useState(false);

  const handleMatchWithAI = async () => {
    const result = await suggestMatches({ documentId: row.original.id });
    if (result.data?.suggestDocumentMatchingTransactions) {
      setSuggestedMatches(result.data.suggestDocumentMatchingTransactions as SuggestedMatch[]);
      setShowMatchesDialog(true);
    }
  };

  const handleSelectMatch = async (matchId: string) => {
    // Update the document with the selected match's charge ID
    const result = await updateDocument({
      documentId: row.original.id,
      fields: {
        chargeId: matchId,
      },
    });

    if (result && 'message' in result) {
      // TODO: Show error toast
      console.error('Failed to update document:', result.message);
    } else {
      setShowMatchesDialog(false);
      setSuggestedMatches([]);
    }
  };

  return (
    <>
      {row.original.charge?.transactions?.[0]?.id ? (
        <AccounterTable
          items={row.original.charge?.transactions ?? []}
          columns={[
            {
              title: 'Transaction Amount',
              value: transaction => transaction?.amount.formatted,
            },
            {
              title: 'Transaction Created At',
              value: transaction =>
                transaction?.eventDate ? format(new Date(transaction.eventDate), 'dd/MM/yy') : null,
            },
            {
              title: 'Transaction Effective Date',
              value: transaction =>
                transaction?.effectiveDate
                  ? format(new Date(transaction.effectiveDate), 'dd/MM/yy')
                  : null,
            },
            {
              title: 'Transaction Description',
              value: transaction => transaction?.sourceDescription,
            },
          ]}
        />
      ) : (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleMatchWithAI} disabled={fetching}>
            {fetching ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Match with AI
          </Button>
          No Related Transaction
        </div>
      )}
      <SuggestedMatchesDialog
        open={showMatchesDialog}
        onOpenChange={setShowMatchesDialog}
        matches={suggestedMatches}
        onSelectMatch={handleSelectMatch}
      />
    </>
  );
};
