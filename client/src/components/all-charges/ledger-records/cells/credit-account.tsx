import gql from 'graphql-tag';
import { LedgerRecordsCreditAccountFieldsFragment } from '../../../../__generated__/types';

gql`
  fragment LedgerRecordsCreditAccountFields on LedgerRecord {
    id
    creditAccount {
      name
    }
  }
`;

type Props = {
  data: LedgerRecordsCreditAccountFieldsFragment;
};

export const CreditAccount = ({ data }: Props) => {
  const { creditAccount } = data;

  return <td>{creditAccount?.name ?? 'Missing Account'}</td>;
};
