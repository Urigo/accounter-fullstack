import { useCallback, type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import type { ChargeFilter } from '../../gql/graphql.js';
import { useUrlQuery } from '../../hooks/use-url-query.js';
import { getBusinessTransactionsHref } from '../business-transactions/index.js';

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

      return getBusinessTransactionsHref({
        ownerIds: currentFilters.byOwners || [],
        businessIDs: [businessID],
        ...(currentFilters.fromDate && { fromDate: currentFilters.fromDate }),
        ...(currentFilters.toDate && { toDate: currentFilters.toDate }),
      });
    },
    [encodedFilters],
  );

  const isAccountDiff = diffAccount && diffAccount?.id !== account?.id;

  return (
    <div className="flex flex-col whitespace-normal">
      {(account || isAccountDiff) && (
        <>
          {account && (
            <Link
              to={getHref(account.id)}
              target="_blank"
              rel="noreferrer"
              onClick={event => event.stopPropagation()}
              className="inline-flex items-center font-semibold"
            >
              {account.name}
            </Link>
          )}
          {isAccountDiff && diffAccount && (
            <div className="border-2 border-yellow-500 rounded-md">
              <Link
                to={getHref(diffAccount.id)}
                target="_blank"
                rel="noreferrer"
                onClick={event => event.stopPropagation()}
                className="inline-flex items-center font-semibold"
              >
                {diffAccount.name}
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
};
