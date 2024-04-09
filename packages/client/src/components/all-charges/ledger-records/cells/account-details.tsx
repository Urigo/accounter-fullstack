import { ReactElement, useCallback } from 'react';
import { NavLink } from '@mantine/core';
import {
  ChargeFilter,
  LedgerRecordsAccountDetailsFieldsFragmentDoc,
} from '../../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../../gql/index.js';
import { useUrlQuery } from '../../../../hooks/use-url-query.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment LedgerRecordsAccountDetailsFields on LedgerRecord {
    id
    creditAccount1 {
      __typename
      id
      name
    }
    creditAccount2 {
      __typename
      id
      name
    }
    debitAccount1 {
      __typename
      id
      name
    }
    debitAccount2 {
      __typename
      id
      name
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
  diff?: FragmentType<typeof LedgerRecordsAccountDetailsFieldsFragmentDoc> | null;
  cred: boolean;
  first: boolean;
};

export const AccountDetails = ({ data, diff, cred, first }: Props): ReactElement => {
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
      return `/business-transactions?transactionsFilters=%257B%2522ownerIds%2522%253A%255B${
        encodedNewFilters.financialEntityIds
      }%255D%252C%2522businessIDs%2522%253A%255B%2522${encodeURIComponent(businessID)}%2522%255D${
        encodedNewFilters.fromDate
      }${encodedNewFilters.toDate}%257D`;
    },
    [encodedFilters],
  );

  const {
    creditAccount1: diffCreditAccount1,
    creditAccount2: diffCreditAccount2,
    debitAccount1: diffDebitAccount1,
    debitAccount2: diffDebitAccount2,
    creditAmount1: diffCreditAmount1,
    creditAmount2: diffCreditAmount2,
    debitAmount1: diffDebitAmount1,
    debitAmount2: diffDebitAmount2,
    localCurrencyCreditAmount1: diffLocalCurrencyCreditAmount1,
    localCurrencyCreditAmount2: diffLocalCurrencyCreditAmount2,
    localCurrencyDebitAmount1: diffLocalCurrencyDebitAmount1,
    localCurrencyDebitAmount2: diffLocalCurrencyDebitAmount2,
  } = getFragmentData(LedgerRecordsAccountDetailsFieldsFragmentDoc, diff) ?? {};

  const diffCreditAccount = cred
    ? first
      ? diffCreditAccount1
      : diffCreditAccount2
    : first
      ? diffDebitAccount1
      : diffDebitAccount2;

  const diffLocalAmount = cred
    ? first
      ? diffLocalCurrencyCreditAmount1
      : diffLocalCurrencyCreditAmount2
    : first
      ? diffLocalCurrencyDebitAmount1
      : diffLocalCurrencyDebitAmount2;

  const diffForeignAmount = cred
    ? first
      ? diffCreditAmount1
      : diffCreditAmount2
    : first
      ? diffDebitAmount1
      : diffDebitAmount2;

  const isAccountDiff = diff && diffCreditAccount?.id !== creditAccount?.id;
  const isLocalAmountDiff = diff && diffLocalAmount?.formatted !== localAmount?.formatted;
  const isForeignAmountDiff = diff && diffForeignAmount?.formatted !== foreignAmount?.formatted;

  return (
    <td>
      <div className="flex flex-col">
        {creditAccount && (
          <>
            <a href={getHref(creditAccount?.id)} target="_blank" rel="noreferrer">
              <NavLink
                label={creditAccount?.name}
                className={`[&>*>.mantine-NavLink-label]:font-semibold ${isAccountDiff ? 'line-through' : ''}`}
              />
            </a>
            {isAccountDiff && diffCreditAccount && (
              <div className="border-2 border-yellow-500 rounded-md">
                <a href={getHref(diffCreditAccount.id)} target="_blank" rel="noreferrer">
                  <NavLink
                    label={diffCreditAccount.name}
                    className="[&>*>.mantine-NavLink-label]:font-semibold"
                  />
                </a>
              </div>
            )}

            <div className="flex gap-2  items-center">
              {isForeign && (
                <p className={isForeignAmountDiff ? 'line-through' : ''}>
                  {foreignAmount.formatted}
                </p>
              )}
              {isForeignAmountDiff && diffForeignAmount && (
                <p className="border-2 border-yellow-500 rounded-md">
                  {diffForeignAmount.formatted}
                </p>
              )}
            </div>

            <div className="flex gap-2  items-center">
              {localAmount != null && (
                <p className={isLocalAmountDiff ? 'line-through' : ''}>{localAmount.formatted}</p>
              )}
              {isLocalAmountDiff && diffLocalAmount && (
                <p className="border-2 border-yellow-500 rounded-md">{diffLocalAmount.formatted}</p>
              )}
            </div>
          </>
        )}
      </div>
    </td>
  );
};
