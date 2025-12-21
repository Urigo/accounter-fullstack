'use client';

import { useMemo } from 'react';
import { useQuery } from 'urql';
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table';
import {
  RecentBusinessIssuedDocumentsDocument,
  TableDocumentsRowFieldsFragmentDoc,
} from '../../../../gql/graphql.js';
import { getFragmentData } from '../../../../gql/index.js';
import { columns, type DocumentsTableRowType } from '../../../documents-table/columns.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../../ui/card.jsx';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../ui/table.jsx';

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
  const [{ data, fetching }] = useQuery({
    query: RecentBusinessIssuedDocumentsDocument,
    variables: {
      businessId,
      limit,
    },
  });

  const rows = useMemo(
    (): RowType[] =>
      data?.recentDocumentsByBusiness?.map(
        rawDocument => getFragmentData(TableDocumentsRowFieldsFragmentDoc, rawDocument) as RowType,
      ) ?? [],
    [data?.recentDocumentsByBusiness],
  );
  const limitedColumns = ['date', 'amount', 'vat', 'type', 'serial', 'description', 'file', 'edit'];
  const table = useReactTable<RowType>({
    data: rows,
    columns: columns.filter(
      column => column.id && limitedColumns.includes(column.id),
    ) as ColumnDef<RowType>[],
    getCoreRowModel: getCoreRowModel(),
    state: {},
  });

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
                table.getRowModel().rows.map(row => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && 'selected'}
                    className={
                      row.original.issuedDocumentInfo?.externalId &&
                      linkedDocumentIds.includes(row.original.issuedDocumentInfo.externalId)
                        ? 'bg-blue-100'
                        : ''
                    }
                  >
                    {row.getVisibleCells().map(cell => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
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
    </Card>
  );
}
