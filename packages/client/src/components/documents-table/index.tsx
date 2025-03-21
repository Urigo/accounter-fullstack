import { ReactElement, useMemo, useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from '@tanstack/react-table';
import {
  TableDocumentsFieldsFragmentDoc,
  TableDocumentsRowFieldsFragmentDoc,
} from '../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../gql/index.js';
import { EditDocumentModal } from '../common/index.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table.js';
import { columns, DocumentsTableRowType } from './columns.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment TableDocumentsFields on Charge {
    id
    additionalDocuments {
      id
      ...TableDocumentsRowFields
    }
  }
`;

type Props = {
  documentsProps: FragmentType<typeof TableDocumentsFieldsFragmentDoc>;
  onChange: () => void;
};

export const DocumentsTable = ({ documentsProps, onChange }: Props): ReactElement => {
  const { additionalDocuments: documents } = getFragmentData(
    TableDocumentsFieldsFragmentDoc,
    documentsProps,
  );
  const [editDocumentId, setEditDocumentId] = useState<string | undefined>(undefined);
  const [sorting, setSorting] = useState<SortingState>([]);

  const data: DocumentsTableRowType[] = useMemo(
    () =>
      documents?.map(document => ({
        ...getFragmentData(TableDocumentsRowFieldsFragmentDoc, document),
        editDocument: (): void => setEditDocumentId(document.id),
        onUpdate: onChange,
      })),
    [documents, onChange],
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
    },
  });

  return (
    <>
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
      <EditDocumentModal
        documentId={editDocumentId}
        onDone={(): void => setEditDocumentId(undefined)}
        onChange={onChange}
      />
    </>
  );
};
