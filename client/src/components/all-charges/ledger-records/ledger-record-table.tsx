import { useState } from 'react';
import gql from 'graphql-tag';
import { TableLedgerRecordsFieldsFragment } from '../../../__generated__/types';
import { EditMiniButton } from '../../common';
import { PopUpDrawer } from '../../common/drawer';
import { AccountantApproval, AccountDetails, GeneralDate } from './cells';
import { DeleteLedgerRecordButton } from './delete-ledger-record-button';
import { EditLedgerRecord } from './edit-ledger-record';

gql`
  fragment TableLedgerRecordsFields on Charge {
    ledgerRecords {
      id
      ...LedgerRecordsDateFields
      # ...LedgerRecordsCreditAccountFields
      # ...LedgerRecordsDebitAccountFields
      # ...LedgerRecordsLocalAmountFields
      # ...LedgerRecordsOriginalAmountFields
      # ...LedgerRecordsDescriptionFields
      # ...LedgerRecordsAccountantApprovalFields
      # ...LedgerRecordsHashavshevetIdFields
      ...LedgerRecordsAccountDetailsFields
      ...LedgerRecordsGeneralDateFields
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
      # TEMPORARY: next types used to show the DB current record, should be later removed
      reference_1
      reference_2
      movement_type
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
          {/* <th>Date</th> */}
          <th>Invoice Date</th>
          <th>Value Date</th>
          <th>Date3</th>
          {/* <th>Credit Account</th> */}
          {/* <th>Debit Account</th> */}
          <th>Credit Account1</th>
          <th>Credit Account2</th>
          <th>Debit Account1</th>
          <th>Debit Account2</th>
          {/* <th>Local Amount</th>
          <th>Original Amount</th> */}
          <th>Details</th>
          <th>Ref1</th>
          <th>Ref2</th>
          <th>Type</th>
          <th>Hashavshevet ID</th>
          <th>Accountant Approval</th>
          <th>Edit</th>
        </tr>
      </thead>
      <tbody>
        {ledgerRecords.map(i => (
          <tr key={i.id}>
            {/* <Date data={i} /> */}
            <GeneralDate data={i} type={1} />
            <GeneralDate data={i} type={2} />
            <GeneralDate data={i} type={3} />
            {/* <CreditAccount data={i} />
            <DebitAccount data={i} /> */}
            {/* <LocalAmount data={i} /> */}
            <AccountDetails data={i} cred={true} first={true} />
            <AccountDetails data={i} cred={false} first={true} />
            <AccountDetails data={i} cred={true} first={false} />
            <AccountDetails data={i} cred={false} first={false} />
            {/* <td>{i.localCurrencyAmount.formatted ?? 'Missing Amount'}</td> */}
            {/* <OriginalAmount data={i} /> */}
            {/* <td>{i.originalAmount.formatted}</td> */}
            {/* <Description data={i} /> */}
            <td>{i.description}</td>
            <td>{i.reference_1}</td>
            <td>{i.reference_2}</td>
            {/* <AccountantApproval data={i} /> */}
            {/* <HashavshevetId data={i} /> */}
            <td>{i.movement_type}</td>
            <td>{i.hashavshevetId}</td>
            <AccountantApproval ledgerRecordId={i.id} approved={i.accountantApproval.approved} />
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
          <div className="flex flex-row mx-3 pt-3 sm:text-1xl gap-5">
            <h1 className="sm:text-2xl font-small text-gray-900">Edit Ledger Record:</h1>
            <a href="/#" className="pt-1">
              ID: {editLedgerId}
            </a>
            {editLedgerId && <DeleteLedgerRecordButton ledgerRecordId={editLedgerId} />}
          </div>
        }
        opened={Boolean(editLedgerId)}
        onClose={() => setEditLedgerId(undefined)}
      >
        {ledgerRecords.some(r => r.id === editLedgerId) ? (
          <EditLedgerRecord
            ledgerRecord={ledgerRecords.find(r => r.id === editLedgerId)!}
            onAccept={() => setEditLedgerId(undefined)}
            onCancel={() => setEditLedgerId(undefined)}
          />
        ) : undefined}
      </PopUpDrawer>
    </table>
  );
};
