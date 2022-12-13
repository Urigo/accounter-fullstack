import { FragmentType, getFragmentData } from '../../../../gql';
import { LedgerRecordsFragmentDoc } from '../../../../gql/graphql';

/* GraphQL */ `
  fragment LedgerRecords on LedgerRecord {
    id
    date
    originalAmount {
      formatted
    }
    localCurrencyAmount {
      formatted
    }
    creditAccount {
      name
    }
    debitAccount {
      name
    }
    accountantApproval {
      approved
    }
    description
    hashavshevetId
  }
`;

type Props = {
  data: FragmentType<typeof LedgerRecordsFragmentDoc>;
};

export const LedgerRecordRow = ({ data }: Props) => {
  const ledgerRecord = getFragmentData(LedgerRecordsFragmentDoc, data);
  return (
    <tr>
      <td>{ledgerRecord.creditAccount?.name}</td>
      <td>{ledgerRecord.debitAccount?.name}</td>
      <td>{ledgerRecord.localCurrencyAmount.formatted}</td>
      <td>{ledgerRecord.originalAmount.formatted}</td>
      <td>{ledgerRecord.date}</td>
      <td>{ledgerRecord.accountantApproval.approved && 'V'}</td>
      <td>{ledgerRecord.hashavshevetId}</td>
      <td>{ledgerRecord.description}</td>
    </tr>
  );
};
