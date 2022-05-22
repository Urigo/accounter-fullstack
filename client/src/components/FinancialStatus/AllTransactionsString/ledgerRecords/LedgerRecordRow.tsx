import { FC } from 'react';
import gql from 'graphql-tag';
import { LedgerRecordsFragment } from '../../../../__generated__/types';

gql`
  fragment LedgerRecords on Charge {
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
  ledgerRecord: LedgerRecordsFragment['ledgerRecords']['0'];
};

export const LedgerRecordRow: FC<Props> = ({ ledgerRecord }) => {
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
