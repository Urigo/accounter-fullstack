import { useCallback, useContext, useEffect, useMemo, useState, type ReactElement } from 'react';
import { useQuery } from 'urql';
import {
  DocumentsScreenDocument,
  type DocumentsFilters as DocumentsFiltersType,
} from '../../../../gql/graphql.js';
import { isObjectEmpty } from '../../../../helpers/form.js';
import { useUrlFilterState } from '../../../../hooks/use-url-filter-state.js';
import { FiltersContext } from '../../../../providers/filters-context.js';
import {
  DataTablePagination,
  EditDocumentModal,
  UploadDocumentsModal,
} from '../../../common/index.js';
import { useReconcileViewerRows } from '../../../documents-table/data-table.js';
import { DocumentsDataTable, usePaginatedDocumentsTable } from '../../../documents-table/index.js';
import { PageLayout } from '../../../layout/page-layout.js';
import { AccounterBarSpinner } from '../../../ui/accounter-spinner.js';
import { Button } from '../../../ui/button.js';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '../../../ui/dropdown-menu.js';
import { DOCUMENTS_FILTER_PARAM, documentsFilterUrlSchema } from './documents-filter-schema.js';
import { DocumentsFilters } from './documents-filters.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query DocumentsScreen($filters: DocumentsFilters!) {
    documentsByFilters(filters: $filters) {
      id
      ...TableDocumentsRowFields
    }
  }
`;

export const DocumentsReport = (): ReactElement => {
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [filter, setFilter] = useUrlFilterState<DocumentsFiltersType>(
    DOCUMENTS_FILTER_PARAM,
    documentsFilterUrlSchema,
  );
  // Nothing is fetched until a filter is applied — every filter the dialog applies carries at
  // least its date range, and an unfiltered query would load every document.
  const isFilterApplied = !isObjectEmpty(filter);
  const { setFiltersContext } = useContext(FiltersContext);

  const [{ data, fetching }, refetchDocuments] = useQuery({
    query: DocumentsScreenDocument,
    variables: {
      filters: filter,
    },
    pause: true,
  });

  // refetch documents on filter change
  useEffect(() => {
    if (isFilterApplied) {
      refetchDocuments();
    }
  }, [isFilterApplied, filter, refetchDocuments]);

  // Back to an entry with no filter (or "Clear"): don't keep showing the last filter's results.
  const documents = isFilterApplied ? data?.documentsByFilters : undefined;
  const documentsProps = useMemo(() => documents ?? [], [documents]);

  // Stable identity: the hook memoizes its row data on it, so an inline arrow would rebuild every row
  // on every render.
  const onDocumentChange = useCallback(
    (): void => refetchDocuments({ requestPolicy: 'network-only' }),
    [refetchDocuments],
  );

  const { table, editDocumentId, editSiblingIds, closeEditDocument, navigateEditDocument } =
    usePaginatedDocumentsTable({
      documentsProps,
      onChange: onDocumentChange,
      withChargeLink: true,
      withSelection: true,
      // This screen hosts a `DataTablePagination`, so it is one of the few documents tables that
      // opts into paging. 100 is the largest size that bar offers, so its size `Select` renders the
      // value rather than showing blank.
      pageSize: 100,
    });

  // `useTable` hands back a fresh object on every render, so it must not be an effect dependency:
  // the effect would re-run on every render, and setting the filters context re-renders this
  // screen, looping forever ("Maximum update depth exceeded"). Depend instead on the pagination
  // primitives the bar actually reads.
  // The table below is swapped for a spinner while fetching, so it remounts with nothing to compare
  // against; reconciling here, where the screen stays mounted, still sees a delete or a filter drop
  // the document shown. `null` while fetching: rows unknown, not emptied.
  useReconcileViewerRows(fetching ? null : table.getRowModel().rows.map(row => row.id));

  const { pageIndex, pageSize } = table.state.pagination;
  const pageCount = table.getPageCount();

  useEffect(() => {
    setFiltersContext(
      <div className="flex flex-row gap-x-5">
        <DataTablePagination table={table} />
        <DocumentsFilters
          filter={filter}
          setFilter={setFilter}
          initiallyOpened={!isFilterApplied}
        />
      </div>,
    );
  }, [
    fetching,
    filter,
    isFilterApplied,
    setFiltersContext,
    setFilter,
    pageIndex,
    pageSize,
    pageCount,
  ]);

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
      <UploadDocumentsModal
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
        onChange={refetchDocuments}
      />
      <EditDocumentModal
        documentId={editDocumentId}
        siblingIds={editSiblingIds}
        onNavigate={navigateEditDocument}
        onDone={closeEditDocument}
        onChange={onDocumentChange}
      />
      {fetching ? (
        <AccounterBarSpinner className="self-center" />
      ) : (
        <DocumentsDataTable table={table} />
      )}
    </PageLayout>
  );
};
