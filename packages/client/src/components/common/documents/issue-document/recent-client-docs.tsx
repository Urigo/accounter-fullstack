'use client';

import { useMemo } from 'react';
import { useQuery } from 'urql';
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import {
  RecentClientIssuedDocumentsDocument,
  TableDocumentsRowFieldsFragmentDoc,
} from '../../../../gql/graphql.js';
import { getFragmentData } from '../../../../gql/index.js';
import { columns, DocumentsTableRowType } from '../../../documents-table/columns.js';
import { Card, CardContent, CardHeader, CardTitle } from '../../../ui/card.js';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../ui/table.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query RecentClientIssuedDocuments($clientId: UUID!) {
    recentDocumentsByClient(clientId: $clientId) {
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

interface RecentClientDocsProps {
  clientId: string;
  linkedDocumentIds: string[];
}

export function RecentClientDocs({ clientId, linkedDocumentIds }: RecentClientDocsProps) {
  const [{ data, fetching }] = useQuery({
    query: RecentClientIssuedDocumentsDocument,
    variables: {
      clientId,
    },
  });

  const rows = useMemo(
    (): RowType[] =>
      data?.recentDocumentsByClient?.map(
        rawDocument => getFragmentData(TableDocumentsRowFieldsFragmentDoc, rawDocument) as RowType,
      ) ?? [],
    [data?.recentDocumentsByClient],
  );
  const limitedColumns = ['date', 'amount', 'vat', 'type', 'serial', 'file'];
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
                      linkedDocumentIds.includes(row.original.issuedDocumentInfo?.externalId ?? '')
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
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    No results.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
    // <CardContent className="space-y-4">
    //   {fetching ? (
    //     <div>Loading...</div>
    //   ) : (
    //     <>
    //       <div className="grid grid-cols-2 gap-4">
    //         <div className="space-y-2">
    //           <Label htmlFor="clientName">Client Name</Label>
    //           <Input
    //             id="clientName"
    //             value={client.name || ''}
    //             onChange={e => updateClient('name', e.target.value)}
    //             placeholder="Enter client name"
    //           />
    //         </div>
    //         <div className="space-y-2">
    //           <Label htmlFor="taxId">Tax ID</Label>
    //           <Input
    //             id="taxId"
    //             value={client.taxId || ''}
    //             onChange={e => updateClient('taxId', e.target.value)}
    //             placeholder="Tax identification number"
    //           />
    //         </div>
    //       </div>
    //       <div className="space-y-2">
    //         <Label htmlFor="emails">Email Addresses</Label>
    //         <Input
    //           id="emails"
    //           value={client.emails?.join(', ') || ''}
    //           onChange={e => updateEmails(e.target.value)}
    //           placeholder="email1@example.com, email2@example.com"
    //         />
    //       </div>
    //       <div className="grid grid-cols-2 gap-4">
    //         <div className="space-y-2">
    //           <Label htmlFor="phone">Phone</Label>
    //           <Input
    //             id="phone"
    //             value={client.phone || ''}
    //             onChange={e => updateClient('phone', e.target.value)}
    //             placeholder="Phone number"
    //           />
    //         </div>
    //         <div className="space-y-2">
    //           <Label htmlFor="mobile">Mobile</Label>
    //           <Input
    //             id="mobile"
    //             value={client.mobile || ''}
    //             onChange={e => updateClient('mobile', e.target.value)}
    //             placeholder="Mobile number"
    //           />
    //         </div>
    //       </div>
    //       <div className="space-y-2">
    //         <Label htmlFor="address">Address</Label>
    //         <Input
    //           id="address"
    //           value={client.address || ''}
    //           onChange={e => updateClient('address', e.target.value)}
    //           placeholder="Street address"
    //         />
    //       </div>
    //       <div className="grid grid-cols-3 gap-4">
    //         <div className="space-y-2">
    //           <Label htmlFor="city">City</Label>
    //           <Input
    //             id="city"
    //             value={client.city || ''}
    //             onChange={e => updateClient('city', e.target.value)}
    //             placeholder="City"
    //           />
    //         </div>
    //         <div className="space-y-2">
    //           <Label htmlFor="zip">ZIP Code</Label>
    //           <Input
    //             id="zip"
    //             value={client.zip || ''}
    //             onChange={e => updateClient('zip', e.target.value)}
    //             placeholder="ZIP code"
    //           />
    //         </div>
    //         <div className="space-y-2">
    //           <Label htmlFor="country">Country</Label>
    //           <Select
    //             value={client.country || ''}
    //             onValueChange={(value: GreenInvoiceCountry) => updateClient('country', value)}
    //           >
    //             <SelectTrigger>
    //               <SelectValue placeholder="Select country" />
    //             </SelectTrigger>
    //             <SelectContent>
    //               {countries.map(country => (
    //                 <SelectItem key={country.value} value={country.value}>
    //                   {country.label}
    //                 </SelectItem>
    //               ))}
    //             </SelectContent>
    //           </Select>
    //         </div>
    //       </div>
    //       {/* <div className="flex items-center space-x-2">
    //     <Checkbox
    //       id="self"
    //       checked={client.self || false}
    //       onCheckedChange={checked => updateClient('self', checked === true)}
    //     />
    //     <Label htmlFor="self">This is a self-invoice</Label>
    //   </div> */}
    //     </>
    //   )}
    // </CardContent>
  );
}
