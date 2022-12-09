import gql from 'graphql-tag';
import {
  BusinessTransactionsFilter,
  useBusinessTransactionsInfoQuery,
} from '../../__generated__/types';
import { AccounterLoader, AccounterTable } from '../common';

gql`
  query BusinessTransactionsInfo($filters: BusinessTransactionsFilter) {
    businessTransactionsFromLedgerRecords(filters: $filters) {
      ... on BusinessTransactionsFromLedgerRecordsSuccessfulResult {
        businessTransactions {
          amount {
            formatted
          }
          businessName
          foreignAmount {
            formatted
          }
          invoiceDate
        }
      }
      ... on CommonError {
        __typename
        message
      }
    }
  }
`;

interface Props {
  businessName: string;
  filter?: BusinessTransactionsFilter;
}

export function BusinessExtendedInfo({ businessName, filter }: Props) {
  const { data, isLoading } = useBusinessTransactionsInfoQuery({
    filters: { ...filter, businessNames: [businessName] },
  });

  return (
    <div className="flex flex-row gap-5">
      {isLoading ? (
        <AccounterLoader />
      ) : (
        <AccounterTable
          striped
          highlightOnHover
          stickyHeader
          items={
            data?.businessTransactionsFromLedgerRecords.__typename === 'CommonError'
              ? []
              : data?.businessTransactionsFromLedgerRecords.businessTransactions ?? []
          }
          columns={[
            {
              title: 'Business Name',
              value: data => data.businessName,
            },
            {
              title: 'Date',
              value: data => data.invoiceDate,
            },
            {
              title: 'Amount',
              value: data => data.amount.formatted,
            },
            {
              title: 'Foreign Amount',
              value: data => data.foreignAmount?.formatted,
            },
          ]}
        />
      )}
    </div>
  );
}
