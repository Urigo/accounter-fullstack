import { ReactElement, useCallback } from 'react';
import { NavLink } from '@mantine/core';
import { ChargeFilter } from '../../gql/graphql.js';
import { useUrlQuery } from '../../hooks/use-url-query.js';

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

  const encodedFilters = get('chargesFilters');

  const getHref = useCallback(
    (businessID: string) => {
      let currentFilters: ChargeFilter = {};
      if (encodedFilters) {
        try {
          const decoded = decodeURIComponent(encodedFilters);
          const parsed = JSON.parse(decoded);
          currentFilters = parsed as ChargeFilter;
        } catch (error) {
          console.error('Failed to parse filters from URL:', error);
        }
      }

      const params = new URLSearchParams();
      const filterObject = {
        ownerIds: currentFilters.byOwners || [],
        businessIDs: [businessID],
        ...(currentFilters.fromDate && { fromDate: currentFilters.fromDate }),
        ...(currentFilters.toDate && { toDate: currentFilters.toDate }),
      };

      // Add it as a single encoded parameter
      params.append('transactionsFilters', JSON.stringify(filterObject));

      return `/business-transactions?${params.toString()}`;
    },
    [encodedFilters],
  );

  const isAccountDiff = diffAccount && diffAccount?.id !== account?.id;

  return (
    <td>
      <div className="flex flex-col">
        {(account || isAccountDiff) && (
          <>
            {account && (
              <a href={getHref(account.id)} target="_blank" rel="noreferrer">
                <NavLink
                  label={account.name}
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
