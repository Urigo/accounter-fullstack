import { ReactElement, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { useMatch } from 'react-router-dom';
import { useQuery } from 'urql';
import { Mark } from '@mantine/core';
import {
  BusinessTransactionsFilter,
  BusinessTransactionsSummeryDocument,
  BusinessTransactionsSummeryQuery,
  Currency,
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
        ...getCurrencyCells(Currency.Eur),
        ...getCurrencyCells(Currency.Usd),
        ...getCurrencyCells(Currency.Gbp),
      ]}
    />
  );
};

type BusinessTransactionsSum = Extract<
  BusinessTransactionsSummeryQuery['businessTransactionsSumFromLedgerRecords'],
  { businessTransactionsSum: unknown }
>['businessTransactionsSum'][number];

type CellInfo = {
  title: ReactNode;
  value: (data: BusinessTransactionsSum) => string | ReactNode;
  style?: React.CSSProperties;
};

function getCurrencyCells(currency: Currency): CellInfo[] {
  return [
    {
      title: `${currency} Debit`,
      value: data => data.foreignCurrenciesSum.find(c => c.currency === currency)?.debit?.formatted,
      style: { whiteSpace: 'nowrap' },
    },
    {
      title: `${currency} Credit`,
      value: data =>
        data.foreignCurrenciesSum.find(c => c.currency === currency)?.credit?.formatted,
      style: { whiteSpace: 'nowrap' },
    },
    {
      title: `${currency} Total`,
      value: (data): ReactNode => {
        const currencyData = data.foreignCurrenciesSum.find(c => c.currency === currency);
        return currencyData?.total?.raw &&
          (currencyData.total.raw < -0.0001 || currencyData.total.raw > 0.0001) ? (
          <Mark color={currencyData.total.raw > 0 ? 'green' : 'red'}>
            {currencyData.total.formatted}
          </Mark>
        ) : (
          currencyData?.total?.formatted
        );
      },
      style: { whiteSpace: 'nowrap' },
    },
  ];
}
