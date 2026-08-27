import { useCallback, useEffect, useMemo, useState } from 'react';
import equal from 'deep-equal';
import { useTable, type ColumnVisibilityState, type SortingState } from '@tanstack/react-table';
import { tableFeaturesConfig } from '@/lib/table-features.js';
import {
  TableDocumentsRowFieldsFragmentDoc,
  type TableDocumentsRowFieldsFragment,
} from '../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../gql/index.js';
import { getDocumentsTableColumns, type DocumentsTableRowType } from './columns.js';

type UseDocumentsTableOptions = {
  documentsProps: FragmentType<typeof TableDocumentsRowFieldsFragmentDoc>[];
  onChange?: () => void;
  /** Called when removing a document emptied its charge and the server deleted the charge too. */
  onChargeDeleted?: (chargeId: string) => void;
  /** Restrict the table to these column ids, in the shared columns' order. Defaults to all of them. */
  columnIds?: string[];
  /** Include the actions-menu items that navigate to the document's charge. */
  withChargeLink?: boolean;
};

/**
 * Shared wiring for every documents table: fragment unmasking, `@defer` merging, row callbacks,
 * sorting / column-visibility state and the TanStack table instance.
 *
 * It is a hook rather than part of `DocumentsTable` so screens that host their own toolbar
 * (pagination, column-visibility menu) can reach the table instance those controls need.
 */
export function useDocumentsTable({
  documentsProps,
  onChange,
  onChargeDeleted,
  columnIds,
  withChargeLink = false,
}: UseDocumentsTableOptions) {
  const [editDocumentId, setEditDocumentId] = useState<string | undefined>(undefined);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>({});

  const incomingDocuments = useMemo(
    () =>
      documentsProps?.map(rawDocument =>
        getFragmentData(TableDocumentsRowFieldsFragmentDoc, rawDocument),
      ) ?? [],
    [documentsProps],
  );

  // The document row fields are fetched under a `@defer` fragment, so on a
  // refetch each document streams back id-first and its other fields (amount,
  // vat, …) arrive in later patches — the not-yet-arrived fields are absent from
  // the payload. Merge each incoming document's present fields over the version
  // currently shown (matched by id) so every cell keeps its value until the real
  // data replaces it, instead of the rows flashing empty while only the id is
  // present. Present values (including a legitimate `null`) are applied as they
  // arrive; only absent/`undefined` fields fall back to the previous value. Bail
  // out when nothing changed so we don't re-render (and "blink") on an identical
  // refetch.
  const [documents, setDocuments] = useState<TableDocumentsRowFieldsFragment[]>(incomingDocuments);
  useEffect(() => {
    setDocuments(prev => {
      const prevById = new Map(prev.map(document => [document.id, document]));
      const next = incomingDocuments.map(document => {
        const previous = prevById.get(document.id);
        if (!previous) {
          return document;
        }
        const merged: Record<string, unknown> = { ...previous };
        for (const [key, value] of Object.entries(document)) {
          if (value !== undefined) {
            merged[key] = value;
          }
        }
        return merged as TableDocumentsRowFieldsFragment;
      });
      return equal(prev, next) ? prev : next;
    });
  }, [incomingDocuments]);

  const data: DocumentsTableRowType[] = useMemo(
    () =>
      documents.map(document => ({
        ...document,
        editDocument: (): void => setEditDocumentId(document.id),
        onUpdate: onChange ?? ((): void => {}),
        onChargeDeleted,
      })),
    [documents, onChange, onChargeDeleted],
  );

  const tableColumns = useMemo(() => {
    const allColumns = getDocumentsTableColumns({ withChargeLink });
    return columnIds
      ? allColumns.filter(column => column.id && columnIds.includes(column.id))
      : allColumns;
  }, [columnIds, withChargeLink]);

  const table = useTable({
    features: tableFeaturesConfig,
    data,
    columns: tableColumns,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    state: {
      sorting,
      columnVisibility,
    },
  });

  const closeEditDocument = useCallback((): void => setEditDocumentId(undefined), []);

  return { table, editDocumentId, closeEditDocument };
}

export type DocumentsTableInstance = ReturnType<typeof useDocumentsTable>['table'];
