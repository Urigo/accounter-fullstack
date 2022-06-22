import gql from 'graphql-tag';

import { LedgerRecordsFieldsFragment } from '../../../__generated__/types';

gql`
  fragment LedgerRecordsFields on Charge {
    ledgerRecords {
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
  }
`;

type Props = {
  ledgerRecord: LedgerRecordsFieldsFragment['ledgerRecords']['0'];
};

export const LedgerRecordRow = ({ ledgerRecord }: Props) => {
  return (
    <tr>
      <td>{ledgerRecord.creditAccount?.name}</td>
      <td>{ledgerRecord.debitAccount?.name}</td>
      <td>{ledgerRecord.localCurrencyAmount.formatted}</td>
      <td>{ledgerRecord.originalAmount.formatted}</td>
      <td>{ledgerRecord.date}</td>
      <td>{ledgerRecord.accountantApproval.approved}</td>
      <td>{ledgerRecord.hashavshevetId}</td>
      <td>{ledgerRecord.description}</td>
    </tr>
  );
};
