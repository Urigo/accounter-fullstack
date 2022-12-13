import { FragmentType, getFragmentData } from '../../../../gql';
import { LedgerRecordsAccountDetailsFieldsFragmentDoc } from '../../../../gql/graphql';

/* TEMPORARY: this component is used for temporary reasons */

/* GraphQL */ `
  fragment LedgerRecordsAccountDetailsFields on LedgerRecord {
    id
    credit_account_1
    credit_account_2
    credit_amount_1
    credit_amount_2
    debit_account_1
    debit_account_2
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
      ? credit_account_1
      : credit_account_2
    : first
    ? debit_account_1
    : debit_account_2;

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

  return (
    <td>
      {isAccount && (
        <>
          <p>{creditAccount}</p>
          {isForeign && (
            <p>
              {foreignAmount} {currency}
            </p>
          )}
          {localAmount != null && <p>{localAmount} ILS</p>}
        </>
      )}
    </td>
  );
};
