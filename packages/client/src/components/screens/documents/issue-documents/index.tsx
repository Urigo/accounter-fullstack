import { ReactElement, useContext, useEffect } from 'react';
import { useGetAllClients } from '../../../../hooks/use-get-all-clients.js';
import { FiltersContext } from '../../../../providers/filters-context.js';
import { AccounterLoader } from '../../../common/loader.js';
import { IssueDocumentsTable } from './issue-documents-table.js';

export const IssueDocuments = (): ReactElement => {
  const { setFiltersContext } = useContext(FiltersContext);
  const { clients, fetching } = useGetAllClients();

  useEffect(() => {
    if (!clients) {
      setFiltersContext(null);
    }
  }, [clients, setFiltersContext]);

  return fetching ? <AccounterLoader /> : <IssueDocumentsTable clientsData={clients ?? []} />;
};
