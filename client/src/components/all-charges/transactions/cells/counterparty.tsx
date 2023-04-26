import { useCallback } from 'react';
import { NavLink } from '@mantine/core';
import { FragmentType, getFragmentData } from '../../../../gql';
import { ChargeFilter, TransactionsTableEntityFieldsFragmentDoc } from '../../../../gql/graphql';
import { useUrlQuery } from '../../../../hooks/use-url-query';

/* GraphQL */ `
  fragment TransactionsTableEntityFields on Transaction {
    id
    counterparty {
      name
      id
    }
  }
`;

type Props = {
  data: FragmentType<typeof TransactionsTableEntityFieldsFragmentDoc>;
};

export const Counterparty = ({ data }: Props) => {
  const { get } = useUrlQuery();
  const { counterparty } = getFragmentData(TransactionsTableEntityFieldsFragmentDoc, data);
  const { name, id } = counterparty || {};

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
        financialEntityIds:
          currentFilters.byOwners && currentFilters.byOwners.length > 0
            ? `%2522${currentFilters.byOwners.join('%2522%252C%2522')}%2522`
            : '',
      };
      return `/business-transactions?transactionsFilters=%257B%2522financialEntityIds%2522%253A%255B${
        encodedNewFilters.financialEntityIds
      }%255D%252C%2522businessIDs%2522%253A%255B%2522${encodeURIComponent(businessID)}%2522%255D${
        encodedNewFilters.fromDate
      }${encodedNewFilters.toDate}%257D`;
    },
    [encodedFilters],
  );

  const content = <p>{name}</p>;

  return (
    <td>
      <div className="flex flex-wrap">
        {id && (
          <a href={getHref(id)} target="_blank" rel="noreferrer">
            <NavLink label={content} className="[&>*>.mantine-NavLink-label]:font-semibold" />
          </a>
        )}
      </div>
    </td>
  );
};
