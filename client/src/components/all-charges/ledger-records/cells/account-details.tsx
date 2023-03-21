import { useCallback } from 'react';
import { NavLink } from '@mantine/core';
import { FragmentType, getFragmentData } from '../../../../gql';
import {
  ChargeFilter,
  LedgerRecordsAccountDetailsFieldsFragmentDoc,
} from '../../../../gql/graphql';
import { formatStringifyAmount } from '../../../../helpers';
import { useUrlQuery } from '../../../../hooks/use-url-query';

/* TEMPORARY: this component is used for temporary reasons */

/* GraphQL */ `
  fragment LedgerRecordsAccountDetailsFields on LedgerRecord {
    id
    credit_account_1 {
      id
      name
    }
    credit_account_2 {
      id
      name
    }
    credit_amount_1
    credit_amount_2
    debit_account_1 {
      id
      name
    }
    debit_account_2 {
      id
      name
    }
    debit_amount_1
    debit_amount_2
    foreign_credit_amount_1
    foreign_credit_amount_2
    foreign_debit_amount_1
    foreign_debit_amount_2
    currency
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
    credit_account_1,
    credit_account_2,
    credit_amount_1,
    credit_amount_2,
    debit_account_1,
    debit_account_2,
    debit_amount_1,
    debit_amount_2,
    foreign_credit_amount_1,
    foreign_credit_amount_2,
    foreign_debit_amount_1,
    foreign_debit_amount_2,
    currency,
  } = getFragmentData(LedgerRecordsAccountDetailsFieldsFragmentDoc, data);

  const creditAccount = cred
    ? first
      ? credit_account_1?.name
      : credit_account_2?.name
    : first
    ? debit_account_1?.name
    : debit_account_2?.name;

  const foreignAmount = cred
    ? first
      ? foreign_credit_amount_1
      : foreign_credit_amount_2
    : first
    ? foreign_debit_amount_1
    : foreign_debit_amount_2;

  const localAmount = cred
    ? first
      ? credit_amount_1
      : credit_amount_2
    : first
    ? debit_amount_1
    : debit_amount_2;

  const isAccount = creditAccount || Number(localAmount) > 0 || Number(foreignAmount) > 0;
  const isForeign = foreignAmount != null && currency && currency !== 'ILS';

  const encodedFilters = get('chargesFilters');

  const getHref = useCallback(
    (businessName: string) => {
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
      }%255D%252C%2522businessNames%2522%253A%255B%2522${encodeURIComponent(
        businessName,
      )}%2522%255D${encodedNewFilters.fromDate}${encodedNewFilters.toDate}%257D`;
    },
    [encodedFilters],
  );

  return (
    <td>
      {isAccount && (
        <>
          <a href={getHref(creditAccount as string)} target="_blank" rel="noreferrer">
            <NavLink label={creditAccount} className="[&>*>.mantine-NavLink-label]:font-semibold" />
          </a>
          {isForeign && (
            <p>
              {formatStringifyAmount(foreignAmount)} {currency}
            </p>
          )}
          {localAmount != null && <p>{formatStringifyAmount(localAmount)} ILS</p>}
        </>
      )}
    </td>
  );
};
