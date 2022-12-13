import { useState } from 'react';
import { FragmentType, getFragmentData } from '../../../gql';
import { TableLedgerRecordsFieldsFragmentDoc } from '../../../gql/graphql';
import { EditMiniButton } from '../../common';
import { PopUpDrawer } from '../../common/drawer';
import { AccountantApproval, AccountDetails, GeneralDate } from './cells';
import { DeleteLedgerRecordButton } from './delete-ledger-record-button';
import { EditLedgerRecord } from './edit-ledger-record';

/* GraphQL */ `
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
      ...LedgerRecordsAccountDetailsFields
      ...LedgerRecordsGeneralDateFields
      # ...EditLedgerRecordsFields
      ...EditDbLedgerRecordsFields
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
  ledgerRecordsProps: FragmentType<typeof TableLedgerRecordsFieldsFragmentDoc>;
};

export const LedgerRecordTable = ({ ledgerRecordsProps }: Props) => {
  const { ledgerRecords } = getFragmentData(
    TableLedgerRecordsFieldsFragmentDoc,
    ledgerRecordsProps,
  );
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
          <th>Debit Account1</th>
          <th>Credit Account2</th>
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
        {ledgerRecords.map(record => (
          <tr key={record.id}>
            {/* <Date data={record} /> */}
            <GeneralDate data={record} type={1} />
            <GeneralDate data={record} type={2} />
            <GeneralDate data={record} type={3} />
            {/* <CreditAccount data={record} />
            <DebitAccount data={record} /> */}
            {/* <LocalAmount data={record} /> */}
            <AccountDetails data={record} cred={true} first={true} />
            <AccountDetails data={record} cred={false} first={true} />
            <AccountDetails data={record} cred={true} first={false} />
            <AccountDetails data={record} cred={false} first={false} />
            {/* <td>{record.localCurrencyAmount.formatted ?? 'Missing Amount'}</td> */}
            {/* <OriginalAmount data={record} /> */}
            {/* <td>{record.originalAmount.formatted}</td> */}
            {/* <Description data={record} /> */}
            <td>{record.description}</td>
            <td>{record.reference_1}</td>
            <td>{record.reference_2}</td>
            {/* <AccountantApproval data={record} /> */}
            {/* <HashavshevetId data={record} /> */}
            <td>{record.movement_type}</td>
            <td>{record.hashavshevetId}</td>
            <AccountantApproval
              ledgerRecordId={record.id}
              approved={record.accountantApproval.approved}
            />
            <td>
              <EditMiniButton onClick={() => setEditLedgerId(record.id)} />
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
            ledgerRecordProps={ledgerRecords.find(r => r.id === editLedgerId)!}
            onAccept={() => setEditLedgerId(undefined)}
            onCancel={() => setEditLedgerId(undefined)}
          />
        ) : undefined}
      </PopUpDrawer>
    </table>
  );
};
