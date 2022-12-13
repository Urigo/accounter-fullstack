/* eslint-disable @graphql-eslint/no-unused-fragments */
import { FragmentType, getFragmentData } from '../../../../gql';
import { LedgerRecordsCreditAccountFieldsFragmentDoc } from '../../../../gql/graphql';

/* GraphQL */ `
  fragment LedgerRecordsCreditAccountFields on LedgerRecord {
    id
    creditAccount {
      name
    }
  }
`;

type Props = {
  data: FragmentType<typeof LedgerRecordsCreditAccountFieldsFragmentDoc>;
};

export const CreditAccount = ({ data }: Props) => {
  const { creditAccount } = getFragmentData(LedgerRecordsCreditAccountFieldsFragmentDoc, data);

  return <td>{creditAccount?.name ?? 'Missing Account'}</td>;
};
