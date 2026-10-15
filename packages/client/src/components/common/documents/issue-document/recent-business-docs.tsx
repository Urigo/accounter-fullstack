'use client';

import { useMemo, useState } from 'react';
import { useQuery } from 'urql';
import { flexRender, useTable, type ColumnDef } from '@tanstack/react-table';
import { tableFeaturesConfig, type TableFeaturesConfig } from '@/lib/table-features.js';
import {
  RecentBusinessIssuedDocumentsDocument,
  TableDocumentsRowFieldsFragmentDoc,
} from '../../../../gql/graphql.js';
import { getFragmentData } from '../../../../gql/index.js';
import { columns, type DocumentsTableRowType } from '../../../documents-table/columns.js';
import { DocumentsTableRow, useReconcileViewerRows } from '../../../documents-table/data-table.js';
import { Card, CardContent, CardHeader, CardTitle } from '../../../ui/card.js';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../ui/table.js';
import { EditDocumentModal } from '../../index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query RecentBusinessIssuedDocuments($businessId: UUID!, $limit: Int) {
    recentDocumentsByBusiness(businessId: $businessId, limit: $limit) {
      id
      ... on FinancialDocument {
        issuedDocumentInfo {
          id
          status
          externalId
        }
      }
      ...TableDocumentsRowFields
    }
  }
`;

type RowType = DocumentsTableRowType & {
  issuedDocumentInfo?: {
    externalId?: string;
  };
};

interface RecentBusinessDocsProps {
  businessId: string;
  linkedDocumentIds: string[];
  limit?: number;
}

export function RecentBusinessDocs({
  businessId,
  linkedDocumentIds,
  limit,
}: RecentBusinessDocsProps) {
  /** The document in the edit sheet, and this table's row ids when it opened, for Save & next. */
  const [editing, setEditing] = useState<{ id: string; siblingIds?: string[] } | null>(null);
  const [{ data, fetching }] = useQuery({
    query: RecentBusinessIssuedDocumentsDocument,
    variables: {
      businessId,
      limit,
    },
  });

  const rows = useMemo(
    (): RowType[] =>
      data?.recentDocumentsByBusiness
        ?.map(rawDocument => {
          const doc = getFragmentData(TableDocumentsRowFieldsFragmentDoc, rawDocument);
          if (!doc) {
            return null;
          }
          return {
            ...(doc as RowType),
            onUpdate: () => {},
            editDocument: (siblingIds?: string[]) => setEditing({ id: doc.id, siblingIds }),
          };
        })
        .filter((row): row is RowType => !!row) ?? [],
    [data?.recentDocumentsByBusiness],
  );
  const limitedColumns = [
    'date',
    'amount',
    'vat',
    'type',
    'serial',
    'description',
    'remarks',
    'file',
    'actions',
  ];
  const table = useTable({
    features: tableFeaturesConfig,
    data: rows,
    columns: columns.filter(column => column.id && limitedColumns.includes(column.id)) as ColumnDef<
      TableFeaturesConfig,
      RowType
    >[],
    state: {},
  });
  // `null` while fetching: rows unknown, not emptied.
  useReconcileViewerRows(fetching ? null : table.getRowModel().rows.map(row => row.id));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Client Documents</CardTitle>
      </CardHeader>
      <CardContent>
        {fetching ? (
          <div>Loading...</div>
        ) : (
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
                table
                  .getRowModel()
                  .rows.map(row => (
                    <DocumentsTableRow
                      key={row.id}
                      row={row}
                      className={
                        row.original.issuedDocumentInfo?.externalId &&
                        linkedDocumentIds.includes(row.original.issuedDocumentInfo.externalId)
                          ? 'bg-blue-100'
                          : undefined
                      }
                    />
                  ))
              ) : (
                <TableRow>
                  <TableCell colSpan={table.options.columns.length} className="h-24 text-center">
                    No results.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <EditDocumentModal
        documentId={editing?.id}
        siblingIds={editing?.siblingIds}
        onNavigate={id => setEditing(prev => (prev ? { ...prev, id } : prev))}
        onDone={(): void => setEditing(null)}
        onChange={() => {}}
      />
    </Card>
  );
}
