import { useCallback } from 'react';
import { NavLink } from '@mantine/core';
import { FragmentType, getFragmentData } from '../../../../gql';
import {
  ChargeFilter,
  LedgerRecordsAccountDetailsFieldsFragmentDoc,
} from '../../../../gql/graphql';
import { useUrlQuery } from '../../../../hooks/use-url-query';

/* TEMPORARY: this component is used for temporary reasons */

/* GraphQL */ `
  fragment LedgerRecordsAccountDetailsFields on LedgerRecord {
    id
    creditAccount1 {
      __typename
      ... on TaxCategory {
        id
        name
      }
      ... on NamedCounterparty {
        id
        name
      }
    }
    creditAccount2 {
      __typename
      ... on TaxCategory {
        id
        name
      }
      ... on NamedCounterparty {
        id
        name
      }
    }
    debitAccount1 {
      __typename
      ... on TaxCategory {
        id
        name
      }
      ... on NamedCounterparty {
        id
        name
      }
    }
    debitAccount2 {
      __typename
      ... on TaxCategory {
        id
        name
      }
      ... on NamedCounterparty {
        id
        name
      }
    }
    creditAmount1 {
      formatted
      currency
    }
    creditAmount2 {
      formatted
      currency
    }
    debitAmount1 {
      formatted
      currency
    }
    debitAmount2 {
      formatted
      currency
    }
    localCurrencyCreditAmount1 {
      formatted
    }
    localCurrencyCreditAmount2 {
      formatted
    }
    localCurrencyDebitAmount1 {
      formatted
    }
    localCurrencyDebitAmount2 {
      formatted
    }
  }
`;

type Props = {
  data: FragmentType<typeof LedgerRecordsAccountDetailsFieldsFragmentDoc>;
  cred: boolean;
  first: boolean;
};

export const AccountDetails = ({ data, cred, first }: Props) => {
  const { get } = useUrlQuery();
  const {
    creditAccount1,
    creditAccount2,
    debitAccount1,
    debitAccount2,
    creditAmount1,
    creditAmount2,
    debitAmount1,
    debitAmount2,
    localCurrencyCreditAmount1,
    localCurrencyCreditAmount2,
    localCurrencyDebitAmount1,
    localCurrencyDebitAmount2,
  } = getFragmentData(LedgerRecordsAccountDetailsFieldsFragmentDoc, data);

  const creditAccount = cred
    ? first
      ? creditAccount1
      : creditAccount2
    : first
    ? debitAccount1
    : debitAccount2;

  const localAmount = cred
    ? first
      ? localCurrencyCreditAmount1
      : localCurrencyCreditAmount2
    : first
    ? localCurrencyDebitAmount1
    : localCurrencyDebitAmount2;

  const foreignAmount = cred
    ? first
      ? creditAmount1
      : creditAmount2
    : first
    ? debitAmount1
    : debitAmount2;

  const isForeign = foreignAmount != null && foreignAmount.currency !== 'ILS';

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

  return (
    <td>
      {creditAccount && (
        <>
          {creditAccount.__typename === 'NamedCounterparty' ? (
            <a href={getHref(creditAccount?.id)} target="_blank" rel="noreferrer">
              <NavLink
                label={creditAccount?.name}
                className="[&>*>.mantine-NavLink-label]:font-semibold"
              />
            </a>
          ) : (
            <NavLink
              label={creditAccount?.name}
              className="[&>*>.mantine-NavLink-label]:font-semibold"
              disabled
            />
          )}
          {isForeign && <p>{foreignAmount.formatted}</p>}
          {localAmount != null && <p>{localAmount.formatted}</p>}
        </>
      )}
    </td>
  );
};
