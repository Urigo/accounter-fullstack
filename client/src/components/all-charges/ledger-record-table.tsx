import { TableLedgerRecordsFieldsFragment } from '../../__generated__/types';
import { Badge } from '@mantine/core';
import gql from 'graphql-tag';

gql`
  fragment TableLedgerRecordsFields on Charge {
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
  ledgerRecords: TableLedgerRecordsFieldsFragment['ledgerRecords'];
};

export const LedgerRecordTable = ({ ledgerRecords }: Props) => {
  return (
    <>
      <table style={{ width: '100%', height: '100%' }}>
        <thead>
          <tr>
            <th>Date</th>
            <th>Credit Account</th>
            <th>Debit Account</th>
            <th>Local Amount</th>
            <th>Original Amount</th>
            <th>Description</th>
            <th>Accountant Approval</th>
            <th>Hashavshevet ID</th>
          </tr>
        </thead>
        <tbody>
          {ledgerRecords.map(i => (
            <tr key={i.id}>
              <td>{i.date ?? 'Missing Data'}</td>
              <td>{i.creditAccount?.name ?? 'Missing Account'}</td>
              <td>{i.debitAccount?.name ?? 'Missing Account'}</td>
              <td>{i.localCurrencyAmount.formatted ?? 'Missing Amount'}</td>
              <td>{i.originalAmount.formatted}</td>
              <td>{i.description}</td>
              <td>
                {i.accountantApproval.approved == true ? (
                  <Badge color="green">YES</Badge>
                ) : (
                  <Badge color="red">NO</Badge>
                )}
              </td>
              <td>{i.hashavshevetId}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
};
