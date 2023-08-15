import { FragmentType, getFragmentData } from '../../../../gql';
import { LedgerRecordsCreditAccountFieldsFragmentDoc } from '../../../../gql/graphql';

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

export const CreditAccount = ({ data }: Props) => {
  const { creditAccount1 } = getFragmentData(LedgerRecordsCreditAccountFieldsFragmentDoc, data);

  return <td>{creditAccount1?.name ?? 'Missing Account'}</td>;
};
