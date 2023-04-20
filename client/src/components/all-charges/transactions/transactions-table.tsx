import { useState } from 'react';
import { FragmentType, getFragmentData } from '../../../gql';
import { TableTransactionsFieldsFragmentDoc } from '../../../gql/graphql';
import { EditMiniButton, PopUpDrawer } from '../../common';
import { Account, Amount, BankID, Counterparty, DebitDate, Description, EventDate } from './cells';

// import { AccountantApproval, AccountDetails, GeneralDate } from './cells';
// import { DeleteLedgerRecordButton } from './delete-ledger-record-button';
// import { EditLedgerRecord } from './edit-ledger-record';

/* GraphQL */ `
  fragment TableTransactionsFields on Charge {
    transactions {
      id
      ...Transactions_EventDateFields
      ...Transactions_DebitDateFields
      ...Transactions_AmountFields
      ...Transactions_AccountFields
      ...Transactions_DescriptionFields
      ...Transactions_BankIDFields
      ...Transactions_EntityFields
    }
  }
`;

type Props = {
  transactionsProps: FragmentType<typeof TableTransactionsFieldsFragmentDoc>;
};

export const TransactionsTable = ({ transactionsProps }: Props) => {
  const { transactions } = getFragmentData(TableTransactionsFieldsFragmentDoc, transactionsProps);
  const [editTransactionId, setEditTransactionId] = useState<string | undefined>(undefined);
  return (
    <table style={{ width: '100%', height: '100%' }}>
      <thead>
        <tr>
          <th>Event Date</th>
          <th>Debit Date</th>
          <th>Amount</th>
          <th>Account</th>
          <th>Description</th>
          <th>Bank ID</th>
          <th>Counterparty</th>
          {/* <th>Activity Type</th> // TODO: implement */}
          <th>Edit</th>
        </tr>
      </thead>
      <tbody>
        {transactions.map(transaction => (
          <tr key={transaction.id}>
            <EventDate data={transaction} />
            <DebitDate data={transaction} />
            <Amount data={transaction} />
            <Account data={transaction} />
            <Description data={transaction} />
            <BankID data={transaction} />
            <Counterparty data={transaction} />
            <td>
              <EditMiniButton onClick={() => setEditTransactionId(transaction.id)} />
            </td>
          </tr>
        ))}
      </tbody>
      <PopUpDrawer
        modalSize="40%"
        position="bottom"
        title={
          <div className="flex flex-row mx-3 pt-3 sm:text-1xl gap-5">
            <h1 className="sm:text-2xl font-small text-gray-900">Edit Transaction:</h1>
            <a href="/#" className="pt-1">
              ID: {editTransactionId}
            </a>
            {/* {editTransactionId && <DeleteLedgerRecordButton ledgerRecordId={editTransactionId} />} */}
          </div>
        }
        opened={!!editTransactionId}
        onClose={() => setEditTransactionId(undefined)}
      >
        {/* {transactions.some(r => r.id === editTransactionId) ? (
          <EditLedgerRecord
            ledgerRecordProps={transactions.find(r => r.id === editTransactionId)!}
            onAccept={() => setEditTransactionId(undefined)}
            onCancel={() => setEditTransactionId(undefined)}
          />
        ) : undefined} */}
      </PopUpDrawer>
    </table>
  );
};
