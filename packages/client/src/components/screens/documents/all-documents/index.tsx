import { useCallback, useContext, useEffect, useMemo, useState, type ReactElement } from 'react';
import { Loader2 } from 'lucide-react';
import { useQuery } from 'urql';
import {
  DocumentsScreenDocument,
  type DocumentsFilters as DocumentsFiltersType,
} from '../../../../gql/graphql.js';
import { useUrlQuery } from '../../../../hooks/use-url-query.js';
import { FiltersContext } from '../../../../providers/filters-context.js';
import {
  DataTablePagination,
  EditDocumentModal,
  UploadDocumentsModal,
} from '../../../common/index.js';
import { DocumentsDataTable, useDocumentsTable } from '../../../documents-table/index.js';
import { PageLayout } from '../../../layout/page-layout.js';
import { Button } from '../../../ui/button.js';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '../../../ui/dropdown-menu.js';
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
  const { setFiltersContext } = useContext(FiltersContext);

  const [{ data, fetching }, refetchDocuments] = useQuery({
    query: DocumentsScreenDocument,
    variables: {
      filters: filter ?? {},
    },
    pause: true,
  });

  // refetch documents on filter change
  useEffect(() => {
    if (filter) {
      refetchDocuments();
    }
  }, [filter, refetchDocuments]);

  const documentsProps = useMemo(() => data?.documentsByFilters ?? [], [data?.documentsByFilters]);

  // Stable identity: the hook memoizes its row data on it, so an inline arrow would rebuild every row
  // on every render.
  const onDocumentChange = useCallback(
    (): void => refetchDocuments({ requestPolicy: 'network-only' }),
    [refetchDocuments],
  );

  const { table, editDocumentId, closeEditDocument } = useDocumentsTable({
    documentsProps,
    onChange: onDocumentChange,
    withChargeLink: true,
  });

  // `useTable` hands back a fresh object on every render, so it must not be an effect dependency:
  // the effect would re-run on every render, and setting the filters context re-renders this
  // screen, looping forever ("Maximum update depth exceeded"). Depend instead on the pagination
  // primitives the bar actually reads.
  const { pageIndex, pageSize } = table.state.pagination;
  const pageCount = table.getPageCount();

  useEffect(() => {
    setFiltersContext(
      <div className="flex flex-row gap-x-5">
        <DataTablePagination table={table} />
        <DocumentsFilters filter={filter} setFilter={setFilter} initiallyOpened={!filter} />
      </div>,
    );
  }, [fetching, filter, setFiltersContext, setFilter, pageIndex, pageSize, pageCount]);

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
        onDone={closeEditDocument}
        onChange={onDocumentChange}
      />
      {fetching ? (
        <Loader2 className="h-10 w-10 animate-spin mr-2 self-center" />
      ) : (
        <DocumentsDataTable table={table} />
      )}
    </PageLayout>
  );
};
