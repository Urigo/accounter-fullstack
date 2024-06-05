import { ReactElement, useCallback, useMemo } from 'react';
import { Indicator, NavLink } from '@mantine/core';
import { FragmentOf, graphql, readFragment } from '../../../graphql.js';
import { useUrlQuery } from '../../../hooks/use-url-query.js';
import type { ChargeFilter } from '../index.js';

export const AllChargesEntityFieldsFragmentDoc = graphql(`
  fragment AllChargesEntityFields on Charge {
    __typename
    id
    counterparty {
      name
      id
    }
    ... on Charge {
      validationData {
        missingInfo
      }
    }
  }
`);

type Props = {
  data: FragmentOf<typeof AllChargesEntityFieldsFragmentDoc>;
};

export const Counterparty = ({ data }: Props): ReactElement => {
  const { get } = useUrlQuery();
  const { counterparty, validationData, __typename } = readFragment(
    AllChargesEntityFieldsFragmentDoc,
    data,
  );

  const shouldHaveCounterparty = useMemo((): boolean => {
    switch (__typename) {
      case 'BusinessTripCharge':
      case 'DividendCharge':
      case 'ConversionCharge':
      case 'SalaryCharge':
      case 'InternalTransferCharge':
        return false;
      default:
        return true;
    }
  }, [__typename]);

  const isError = useMemo(
    () => shouldHaveCounterparty && validationData?.missingInfo?.includes('COUNTERPARTY'),
    [shouldHaveCounterparty, validationData?.missingInfo],
  );
  const { name, id } = counterparty ?? { name: 'Missing', id: undefined };

  const encodedFilters = get('chargesFilters');

  const getHref = useCallback(
    (businessID: string) => {
      const currentFilters = encodedFilters
        ? (JSON.parse(decodeURIComponent(encodedFilters as string)) as ChargeFilter)
        : {};

      const encodedNewFilters = {
        fromDate: currentFilters.fromDate
          ? `%252C%2522fromDate%2522%253A%2522${currentFilters.fromDate}%2522`
          : '',
        toDate: currentFilters.toDate
          ? `%252C%2522toDate%2522%253A%2522${currentFilters.toDate}%2522`
          : '',
        ownerIds:
          currentFilters.byOwners && currentFilters.byOwners.length > 0
            ? `%2522${currentFilters.byOwners.join('%2522%252C%2522')}%2522`
            : '',
      };
      return `/business-transactions?transactionsFilters=%257B%2522ownerIds%2522%253A%255B${
        encodedNewFilters.ownerIds
      }%255D%252C%2522businessIDs%2522%253A%255B%2522${encodeURIComponent(businessID)}%2522%255D${
        encodedNewFilters.fromDate
      }${encodedNewFilters.toDate}%257D`;
    },
    [encodedFilters],
  );

  return (
    <td>
      <div className="flex flex-wrap">
        <Indicator inline size={12} disabled={!isError} color="red" zIndex="auto">
          {!isError && id && (
            <a
              href={getHref(id)}
              target="_blank"
              rel="noreferrer"
              onClick={event => event.stopPropagation()}
            >
              <NavLink label={name} className="[&>*>.mantine-NavLink-label]:font-semibold" />
            </a>
          )}
          {isError && name}
        </Indicator>
      </div>
    </td>
  );
};
