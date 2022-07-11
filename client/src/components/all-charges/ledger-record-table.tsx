import { Badge } from '@mantine/core';
import gql from 'graphql-tag';
import { useState } from 'react';

import { TableLedgerRecordsFieldsFragment } from '../../__generated__/types';
import { EditMiniButton } from '../common';
import { PopUpDrawer } from '../common/drawer';
import { CreditAccount, Date, DebitAccount } from './ledger-records/cells';
import { EditLedgerRecord } from './ledger-records/edit-ledger-record';

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
      ...EditLedgerRecordsFields
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
  const [editLedgerId, setEditLedgerId] = useState<string | undefined>(undefined);
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
          <th>Edit</th>
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
            <td>
              <EditMiniButton onClick={() => setEditLedgerId(i.id)} />
            </td>
          </tr>
        ))}
      </tbody>
      <PopUpDrawer
        modalSize="40%"
        position="bottom"
        title={
          <div className="flex flex-row mx-3 pt-3 sm:text-1xl gap-10">
            <h1 className="sm:text-2xl font-small text-gray-900">Edit Ledger Record:</h1>
            <a href="/#" className="pt-1">
              ID: {editLedgerId}
            </a>
          </div>
        }
        content={
          ledgerRecords.some(r => r.id === editLedgerId) && (
            <EditLedgerRecord
              ledgerRecord={ledgerRecords.find(r => r.id === editLedgerId)!}
              onAccept={() => setEditLedgerId(undefined)}
              onCancel={() => setEditLedgerId(undefined)}
            />
          )
        }
        opened={!!editLedgerId}
        onClose={() => setEditLedgerId(undefined)}
      />
    </table>
  );
};
