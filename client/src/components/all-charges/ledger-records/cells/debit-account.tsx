/* eslint-disable @graphql-eslint/no-unused-fragments */
import { FragmentType, getFragmentData } from '../../../../gql';
import { LedgerRecordsDebitAccountFieldsFragmentDoc } from '../../../../gql/graphql';

/* GraphQL */ `
  fragment LedgerRecordsDebitAccountFields on LedgerRecord {
    id
    debitAccount {
      name
    }
  }
`;

type Props = {
  data: FragmentType<typeof LedgerRecordsDebitAccountFieldsFragmentDoc>;
};

export const DebitAccount = ({ data }: Props) => {
  const { debitAccount } = getFragmentData(LedgerRecordsDebitAccountFieldsFragmentDoc, data);

  return <td>{debitAccount?.name ?? 'Missing Account'}</td>;
};
