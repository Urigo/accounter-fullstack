import { ReactElement, useContext, useEffect } from 'react';
import { useGetOpenContracts } from '../../../../hooks/use-get-all-contracts.js';
import { FiltersContext } from '../../../../providers/filters-context.js';
import { AccounterLoader } from '../../../common/loader.js';
import { IssueDocumentsTable } from './issue-documents-table.js';

export const IssueDocuments = (): ReactElement => {
  const { setFiltersContext } = useContext(FiltersContext);
  const { openContracts, fetching } = useGetOpenContracts();

  useEffect(() => {
    if (!openContracts) {
      setFiltersContext(null);
    }
  }, [openContracts, setFiltersContext]);

  return fetching ? <AccounterLoader /> : <IssueDocumentsTable contracts={openContracts ?? []} />;
};
