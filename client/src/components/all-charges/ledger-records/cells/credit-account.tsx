import { ReactElement } from 'react';
import { LedgerRecordsCreditAccountFieldsFragmentDoc } from '../../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../../gql/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment LedgerRecordsCreditAccountFields on LedgerRecord {
    id
    creditAccount1 {
      id
      name
    }
  }
`;

type Props = {
  data: FragmentType<typeof LedgerRecordsCreditAccountFieldsFragmentDoc>;
};

export const CreditAccount = ({ data }: Props): ReactElement => {
  const { creditAccount1 } = getFragmentData(LedgerRecordsCreditAccountFieldsFragmentDoc, data);

  return <td>{creditAccount1?.name ?? 'Missing Account'}</td>;
};
