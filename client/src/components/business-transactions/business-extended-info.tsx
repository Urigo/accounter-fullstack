import { Mark } from '@mantine/core';
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
            raw
          }
          businessName
          eurAmount {
            formatted
            raw
          }
          gbpAmount {
            formatted
            raw
          }
          usdAmount {
            formatted
            raw
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
              value: data =>
                data.amount.raw && data.amount.raw !== 0 ? (
                  <Mark color={data.amount.raw > 0 ? 'green' : 'red'}>{data.amount.formatted}</Mark>
                ) : (
                  data.amount.formatted
                ),
            },
            {
              title: 'EUR Amount',
              value: data =>
                data.eurAmount?.raw && data.eurAmount.raw !== 0 ? (
                  <Mark color={data.eurAmount.raw > 0 ? 'green' : 'red'}>
                    {data.eurAmount.formatted}
                  </Mark>
                ) : (
                  data.eurAmount?.formatted
                ),
              disabled: !isEur,
            },
            {
              title: 'USD Amount',
              value: data =>
                data.usdAmount?.raw && data.usdAmount.raw !== 0 ? (
                  <Mark color={data.usdAmount.raw > 0 ? 'green' : 'red'}>
                    {data.usdAmount.formatted}
                  </Mark>
                ) : (
                  data.usdAmount?.formatted
                ),
              disabled: !isUsd,
            },
            {
              title: 'GBP Amount',
              value: data =>
                data.gbpAmount?.raw && data.gbpAmount.raw !== 0 ? (
                  <Mark color={data.gbpAmount.raw > 0 ? 'green' : 'red'}>
                    {data.gbpAmount.formatted}
                  </Mark>
                ) : (
                  data.gbpAmount?.formatted
                ),
              disabled: !isGbp,
            },
          ]}
        />
      )}
    </div>
  );
}
