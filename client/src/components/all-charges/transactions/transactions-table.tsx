import { useState } from 'react';
import { FragmentType, getFragmentData } from '../../../gql';
import { TableTransactionsFieldsFragmentDoc } from '../../../gql/graphql';
import { EditMiniButton, EditTransactionModal } from '../../common';
import {
  Account,
  Amount,
  Counterparty,
  DebitDate,
  Description,
  EventDate,
  SourceID,
} from './cells';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment TableTransactionsFields on Charge {
    transactions {
      id
      ...TransactionsTableEventDateFields
      ...TransactionsTableDebitDateFields
      ...TransactionsTableAmountFields
      ...TransactionsTableAccountFields
      ...TransactionsTableDescriptionFields
      ...TransactionsTableSourceIDFields
      ...TransactionsTableEntityFields
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
    <>
      <table className="w-full h-full">
        <thead>
          <tr>
            <th>Event Date</th>
            <th>Debit Date</th>
            <th>Amount</th>
            <th>Account</th>
            <th>Description</th>
            <th>Reference#</th>
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
              <SourceID data={transaction} />
              <Counterparty data={transaction} />
              <td>
                <EditMiniButton onClick={() => setEditTransactionId(transaction.id)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <EditTransactionModal
        transactionID={editTransactionId}
        setEditTransaction={setEditTransactionId}
      />
    </>
  );
};
