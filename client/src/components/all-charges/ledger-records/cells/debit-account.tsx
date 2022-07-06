import gql from 'graphql-tag';

import { LedgerRecordsDebitAccountFieldsFragment } from '../../../../__generated__/types';

gql`
  fragment LedgerRecordsDebitAccountFields on LedgerRecord {
    id
    debitAccount {
      name
    }
  }
`;

type Props = {
  data: LedgerRecordsDebitAccountFieldsFragment;
};

export const DebitAccount = ({ data }: Props) => {
  const { debitAccount } = data;

  return (
    <td>
      {debitAccount?.name ?? 'Missing Account'}
    </td>
  );
};
