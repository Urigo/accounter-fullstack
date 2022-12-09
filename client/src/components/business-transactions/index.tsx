import { useState } from 'react';
import gql from 'graphql-tag';
import {
  BusinessTransactionsFilter,
  useBusinessTransactionsSummeryQuery,
} from '../../__generated__/types';
import { NavBar } from '../common';
import { AccounterTable } from '../common/accounter-table';
import { AccounterLoader } from '../common/loader';
import { BusinessExtendedInfo } from './business-extended-info';
import { BusinessTransactionsFilters } from './business-transactions-filters';

gql`
  query BusinessTransactionsSummery($filters: BusinessTransactionsFilter) {
    businessTransactionsSumFromLedgerRecords(filters: $filters) {
      ... on BusinessTransactionsSumFromLedgerRecordsSuccessfulResult {
        businessTransactionsSum {
          businessName
          credit {
            formatted
          }
          debit {
            formatted
          }
          foreign_credit
          foreign_debit
          foreign_total
          total {
            formatted
          }
        }
      }
      ... on CommonError {
        __typename
        message
      }
    }
  }
`;

export const BusinessTransactionsSummery = () => {
  const [filter, setFilter] = useState<BusinessTransactionsFilter>({});
  const { data, isLoading } = useBusinessTransactionsSummeryQuery({
    filters: filter,
  });

  if (isLoading) {
    return <AccounterLoader />;
  }

  return (
    <div className="text-gray-600 body-font">
      <div className="container md:px-5 px-2 md:py-12 py-2 mx-auto">
        <NavBar
          header="Business Transactions Summery"
          filters={<BusinessTransactionsFilters filter={filter} setFilter={setFilter} />}
        />
        <AccounterTable
          showButton={true}
          moreInfo={item => (
            <BusinessExtendedInfo businessName={item.businessName} filter={filter} />
          )}
          striped
          highlightOnHover
          stickyHeader
          items={
            data?.businessTransactionsSumFromLedgerRecords.__typename === 'CommonError'
              ? []
              : data?.businessTransactionsSumFromLedgerRecords.businessTransactionsSum ?? []
          }
          columns={[
            {
              title: 'Business Name',
              value: data => data.businessName,
            },
            {
              title: 'Credit',
              value: data => data.credit.formatted,
            },
            {
              title: 'Debit',
              value: data => data.debit.formatted,
            },
            {
              title: 'Total',
              value: data => data.total.formatted,
            },
            {
              title: 'Foreign Credit',
              value: data => data.foreign_credit,
            },
            {
              title: 'Foreign Debit',
              value: data => data.foreign_debit,
            },
            {
              title: 'Foreign Total',
              value: data => data.foreign_total,
            },
          ]}
        />
      </div>
    </div>
  );
};
