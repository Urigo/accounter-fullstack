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
          eurAmount {
            formatted
          }
          gbpAmount {
            formatted
          }
          usdAmount {
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

  const items =
    data?.businessTransactionsFromLedgerRecords.__typename === 'CommonError'
      ? []
      : data?.businessTransactionsFromLedgerRecords.businessTransactions ?? [];

  const isEur = items.some(item => Boolean(item.eurAmount));
  const isUsd = items.some(item => Boolean(item.usdAmount));
  const isGbp = items.some(item => Boolean(item.gbpAmount));

  return (
    <div className="flex flex-row gap-5">
      {isLoading ? (
        <AccounterLoader />
      ) : (
        <AccounterTable
          striped
          highlightOnHover
          stickyHeader
          items={items}
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
              title: 'EUR Amount',
              value: data => data.eurAmount?.formatted,
              disabled: !isEur,
            },
            {
              title: 'USD Amount',
              value: data => data.usdAmount?.formatted,
              disabled: !isUsd,
            },
            {
              title: 'GBP Amount',
              value: data => data.gbpAmount?.formatted,
              disabled: !isGbp,
            },
          ]}
        />
      )}
    </div>
  );
}
