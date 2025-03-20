import { ReactElement, useCallback } from 'react';
import { NavLink } from '@mantine/core';
import { ChargeFilter } from '../../../gql/graphql.js';
import { useUrlQuery } from '../../../hooks/use-url-query.js';

type Props = {
  account?: {
    name: string;
    id: string;
  } | null;
  diffAccount?: {
    name: string;
    id: string;
  } | null;
};

export const CounterpartyCell = ({ account, diffAccount }: Props): ReactElement => {
  const { get } = useUrlQuery();

  const creditAccount = account;

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
      return `/business-transactions?transactionsFilters=%257B%2522ownerIds%2522%253A%255B${
        encodedNewFilters.financialEntityIds
      }%255D%252C%2522businessIDs%2522%253A%255B%2522${encodeURIComponent(businessID)}%2522%255D${
        encodedNewFilters.fromDate
      }${encodedNewFilters.toDate}%257D`;
    },
    [encodedFilters],
  );

  const isAccountDiff = diffAccount && diffAccount?.id !== creditAccount?.id;

  return (
    <td>
      <div className="flex flex-col">
        {(creditAccount || isAccountDiff) && (
          <>
            {creditAccount && (
              <a href={getHref(creditAccount.id)} target="_blank" rel="noreferrer">
                <NavLink
                  label={creditAccount.name}
                  className={`[&>*>.mantine-NavLink-label]:font-semibold ${isAccountDiff ? 'line-through' : ''}`}
                />
              </a>
            )}
            {isAccountDiff && diffAccount && (
              <div className="border-2 border-yellow-500 rounded-md">
                <a href={getHref(diffAccount.id)} target="_blank" rel="noreferrer">
                  <NavLink
                    label={diffAccount.name}
                    className="[&>*>.mantine-NavLink-label]:font-semibold"
                  />
                </a>
              </div>
            )}
          </>
        )}
      </div>
    </td>
  );
};
