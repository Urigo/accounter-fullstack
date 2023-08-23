import { ReactElement, useCallback } from 'react';
import { NavLink } from '@mantine/core';
import { ChargeFilter, TransactionsTableEntityFieldsFragmentDoc } from '../../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../../gql/index.js';
import { useUpdateTransaction } from '../../../../hooks/use-update-transaction';
import { useUrlQuery } from '../../../../hooks/use-url-query';
import { ConfirmMiniButton } from '../../../common';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment TransactionsTableEntityFields on Transaction {
    id
    counterparty {
      name
      id
    }
    missingInfoSuggestions {
      business {
        id
        name
      }
    }
  }
`;

type Props = {
  data: FragmentType<typeof TransactionsTableEntityFieldsFragmentDoc>;
};

export function Counterparty({ data }: Props): ReactElement {
  const { get } = useUrlQuery();
  const {
    counterparty,
    missingInfoSuggestions,
    id: transactionId,
  } = getFragmentData(TransactionsTableEntityFieldsFragmentDoc, data);

  const hasAlternative = !!missingInfoSuggestions?.business;
  const alternativeName = hasAlternative ? missingInfoSuggestions?.business?.name : 'Missing';
  const alternativeId = hasAlternative ? missingInfoSuggestions?.business?.id : null;

  const name = counterparty?.name ?? alternativeName;
  const id = counterparty?.id ?? alternativeId;

  const { updateTransaction, fetching } = useUpdateTransaction();
  const updateBusiness = useCallback(
    (counterpartyId: string) => {
      updateTransaction({
        transactionId,
        fields: {
          counterpartyId,
        },
      });
    },
    [transactionId, updateTransaction],
  );

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

  const content = (
    <p style={hasAlternative ? { backgroundColor: 'rgb(236, 207, 57)' } : {}}>{name}</p>
  );

  return (
    <td>
      <div className="flex flex-wrap">
        {id && (
          <>
            <a href={getHref(id)} target="_blank" rel="noreferrer">
              <NavLink label={content} className="[&>*>.mantine-NavLink-label]:font-semibold" />
            </a>
            {hasAlternative && (
              <ConfirmMiniButton
                onClick={(): void => updateBusiness(missingInfoSuggestions.business.id)}
                disabled={fetching}
              />
            )}
          </>
        )}
      </div>
    </td>
  );
}
