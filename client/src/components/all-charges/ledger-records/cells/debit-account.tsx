import { FragmentType, getFragmentData } from '../../../../gql';
import { LedgerRecordsDebitAccountFieldsFragmentDoc } from '../../../../gql/graphql';

/* GraphQL */ `
  fragment LedgerRecordsDebitAccountFields on LedgerRecord {
    id
    debitAccount1 {
      ... on NamedCounterparty {
        id
        name
      }
      ... on TaxCategory {
        id
        name
      }
    }
  }
`;

type Props = {
  data: FragmentType<typeof LedgerRecordsDebitAccountFieldsFragmentDoc>;
};

export const DebitAccount = ({ data }: Props) => {
  const { debitAccount1 } = getFragmentData(LedgerRecordsDebitAccountFieldsFragmentDoc, data);

  return <td>{debitAccount1?.name ?? 'Missing Account'}</td>;
};
