import { ReactElement } from 'react';
import { LedgerRecordsDebitAccountFieldsFragmentDoc } from '../../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../../gql/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment LedgerRecordsDebitAccountFields on LedgerRecord {
    id
    debitAccount1 {
      id
      name
    }
  }
`;

type Props = {
  data: FragmentType<typeof LedgerRecordsDebitAccountFieldsFragmentDoc>;
};

export const DebitAccount = ({ data }: Props): ReactElement => {
  const { debitAccount1 } = getFragmentData(LedgerRecordsDebitAccountFieldsFragmentDoc, data);

  return <td>{debitAccount1?.name ?? 'Missing Account'}</td>;
};
