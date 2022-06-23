import { Badge } from '@mantine/core';
import gql from 'graphql-tag';

import { TableLedgerRecordsFieldsFragment } from '../../__generated__/types';
import { CreditAccount, Date, DebitAccount } from './ledger-records/cells';

gql`
  fragment TableLedgerRecordsFields on Charge {
    ledgerRecords {
      id
      ...LedgerRecordsDateFields
      ...LedgerRecordsCreditAccountFields
      ...LedgerRecordsDebitAccountFields
      # ...LedgerRecordsLocalAmountFields
      # ...LedgerRecordsOriginalAmountFields
      # ...LedgerRecordsDescriptionFields
      # ...LedgerRecordsAccountantApprovalFields
      # ...LedgerRecordsHashavshevetIdFields
      originalAmount {
        formatted
      }
      localCurrencyAmount {
        formatted
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
            <Date data={i} />
            <CreditAccount data={i} />
            <DebitAccount data={i} />
            {/* <LocalAmount data={i} /> */}
            <td>{i.localCurrencyAmount.formatted ?? 'Missing Amount'}</td>
            {/* <OriginalAmount data={i} /> */}
            <td>{i.originalAmount.formatted}</td>
            {/* <Description data={i} /> */}
            <td>{i.description}</td>
            {/* <AccountantApproval data={i} /> */}
            <td>
              {i.accountantApproval.approved == true ? <Badge color="green">YES</Badge> : <Badge color="red">NO</Badge>}
            </td>
            {/* <HashavshevetId data={i} /> */}
            <td>{i.hashavshevetId}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
