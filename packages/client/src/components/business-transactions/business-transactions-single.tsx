import { ReactElement, useContext, useEffect, useMemo, useState } from 'react';
import { useMatch } from 'react-router-dom';
import { useQuery } from 'urql';
import { Mark } from '@mantine/core';
import {
  BusinessTransactionsFilter,
  BusinessTransactionsSummeryDocument,
} from '../../gql/graphql.js';
import { useUrlQuery } from '../../hooks/use-url-query.js';
import { FiltersContext } from '../../providers/filters-context.js';
import { AccounterLoader, AccounterTable } from '../common/index.js';
import { BusinessExtendedInfo } from './business-extended-info.js';
import { BusinessTransactionsFilters } from './business-transactions-filters.js';

type Props = {
  businessId?: string;
};

export const BusinessTransactionsSingle = ({ businessId }: Props): ReactElement => {
  const match = useMatch('business-transactions/:businessId');
  const { get } = useUrlQuery();
  const { setFiltersContext } = useContext(FiltersContext);
  const id = businessId || match?.params.businessId;
  const [filter, setFilter] = useState<BusinessTransactionsFilter>(
    get('transactionsFilters')
      ? {
          ...(JSON.parse(
            decodeURIComponent(get('transactionsFilters') as string),
          ) as BusinessTransactionsFilter),
          businessIDs: id ? [id] : [],
        }
      : {
          businessIDs: id ? [id] : [],
        },
  );
  const [{ data, fetching }] = useQuery({
    query: BusinessTransactionsSummeryDocument,
    variables: {
      filters: filter,
    },
  });

  useEffect(() => {
    setFiltersContext(<BusinessTransactionsFilters filter={filter} setFilter={setFilter} />);
  }, [data, filter, setFiltersContext, setFilter]);

  const businessTransactionsSum = useMemo(() => {
    if (data?.businessTransactionsSumFromLedgerRecords.__typename === 'CommonError') {
      return [];
    }
    if (!data?.businessTransactionsSumFromLedgerRecords.businessTransactionsSum) {
      return [];
    }
    return data.businessTransactionsSumFromLedgerRecords.businessTransactionsSum.sort((a, b) =>
      a.business.name.localeCompare(b.business.name),
    );
  }, [data?.businessTransactionsSumFromLedgerRecords]);

  return fetching ? (
    <AccounterLoader />
  ) : (
    <AccounterTable
      moreInfo={(item): ReactElement => (
        <BusinessExtendedInfo businessID={item.business.id} filter={filter} />
      )}
      striped
      highlightOnHover
      stickyHeader
      items={businessTransactionsSum}
      columns={[
        {
          title: 'Business Name',
          value: data => data.business.name,
        },
        {
          title: 'Debit',
          value: data => data.debit.formatted,
          style: { whiteSpace: 'nowrap' },
        },
        {
          title: 'Credit',
          value: data => data.credit.formatted,
          style: { whiteSpace: 'nowrap' },
        },
        {
          title: 'Total',
          value: data =>
            data.total.raw && (data.total.raw < -0.0001 || data.total.raw > 0.0001) ? (
              <Mark color={data.total.raw > 0 ? 'green' : 'red'}>{data.total.formatted}</Mark>
            ) : (
              data.total.formatted
            ),
          style: { whiteSpace: 'nowrap' },
        },
        {
          title: 'EUR Debit',
          value: data => data.eurSum?.debit?.formatted,
          style: { whiteSpace: 'nowrap' },
        },
        {
          title: 'EUR Credit',
          value: data => data.eurSum?.credit?.formatted,
          style: { whiteSpace: 'nowrap' },
        },
        {
          title: 'EUR Total',
          value: data =>
            data.eurSum?.total?.raw &&
            (data.eurSum.total.raw < -0.0001 || data.eurSum.total.raw > 0.0001) ? (
              <Mark color={data.eurSum.total.raw > 0 ? 'green' : 'red'}>
                {data.eurSum.total.formatted}
              </Mark>
            ) : (
              data.eurSum?.total?.formatted
            ),
          style: { whiteSpace: 'nowrap' },
        },
        {
          title: 'USD Debit',
          value: data => data.usdSum?.debit?.formatted,
          style: { whiteSpace: 'nowrap' },
        },
        {
          title: 'USD Credit',
          value: data => data.usdSum?.credit?.formatted,
          style: { whiteSpace: 'nowrap' },
        },
        {
          title: 'USD Total',
          value: data =>
            data.usdSum?.total?.raw &&
            (data.usdSum.total.raw < -0.0001 || data.usdSum.total.raw > 0.0001) ? (
              <Mark color={data.usdSum.total.raw > 0 ? 'green' : 'red'}>
                {data.usdSum.total.formatted}
              </Mark>
            ) : (
              data.usdSum?.total?.formatted
            ),
          style: { whiteSpace: 'nowrap' },
        },
        {
          title: 'GBP Debit',
          value: data => data.gbpSum?.debit?.formatted,
          style: { whiteSpace: 'nowrap' },
        },
        {
          title: 'GBP Credit',
          value: data => data.gbpSum?.credit?.formatted,
          style: { whiteSpace: 'nowrap' },
        },
        {
          title: 'GBP Total',
          value: data =>
            data.gbpSum?.total?.raw &&
            (data.gbpSum.total.raw < -0.0001 || data.gbpSum.total.raw > 0.0001) ? (
              <Mark color={data.gbpSum.total.raw > 0 ? 'green' : 'red'}>
                {data.gbpSum.total.formatted}
              </Mark>
            ) : (
              data.gbpSum?.total?.formatted
            ),
          style: { whiteSpace: 'nowrap' },
        },
      ]}
    />
  );
};
