import { useContext, useEffect, type ReactElement } from 'react';
import { format, subMonths } from 'date-fns';
import { useQuery } from 'urql';
import { MonthlyDocumentsDraftsDocument } from '../../../../gql/graphql.js';
import type { TimelessDateString } from '../../../../helpers/dates.js';
import { FiltersContext } from '../../../../providers/filters-context.js';
import { AccounterLoader } from '../../../common/loader.js';
import { IssueDocumentsTable } from './issue-documents-table.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query MonthlyDocumentsDrafts($issueMonth: TimelessDate!) {
    clientMonthlyChargesDrafts(issueMonth: $issueMonth) {
      ...NewDocumentInfo
    }
  }
`;

export const IssueDocuments = (): ReactElement => {
  const { setFiltersContext } = useContext(FiltersContext);

  const [{ data, fetching }] = useQuery({
    query: MonthlyDocumentsDraftsDocument,
    variables: {
      issueMonth: format(subMonths(new Date(), 1), 'yyyy-MM-dd') as TimelessDateString,
    },
  });

  useEffect(() => {
    if (!data?.clientMonthlyChargesDrafts) {
      setFiltersContext(null);
    }
  }, [data, setFiltersContext]);

  return fetching ? (
    <AccounterLoader />
  ) : (
    <IssueDocumentsTable drafts={data?.clientMonthlyChargesDrafts ?? []} />
  );
};
