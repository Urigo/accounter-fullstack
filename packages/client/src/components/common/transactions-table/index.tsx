import { ReactElement, useState } from 'react';
import { TransactionForTransactionsTableFieldsFragmentDoc } from '../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../gql/index.js';
import { EditMiniButton, EditTransactionModal } from '../index.js';
import {
  Account,
  Amount,
  Counterparty,
  DebitDate,
  Description,
  EventDate,
  SourceID,
} from './cells/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment TransactionForTransactionsTableFields on Transaction {
    id
    ...TransactionsTableEventDateFields
    ...TransactionsTableDebitDateFields
    ...TransactionsTableAmountFields
    ...TransactionsTableAccountFields
    ...TransactionsTableDescriptionFields
    ...TransactionsTableSourceIDFields
    ...TransactionsTableEntityFields
  }
`;

type Props = {
  transactionsProps: FragmentType<typeof TransactionForTransactionsTableFieldsFragmentDoc>[];
  onChange?: () => void;
};

export const TransactionsTable = ({
  transactionsProps,
  onChange = (): void => void 0,
}: Props): ReactElement => {
  console.log('transactionsProps', transactionsProps);
  const transactions = transactionsProps.map(rawTransaction =>
    getFragmentData(TransactionForTransactionsTableFieldsFragmentDoc, rawTransaction),
  );
  console.log('transactions', transactions);
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
            <th>Edit</th>
          </tr>
        </thead>
        <tbody>
          {transactions?.map(transaction => (
            <tr key={transaction.id}>
              <EventDate data={transaction} />
              <DebitDate data={transaction} />
              <Amount data={transaction} />
              <Account data={transaction} />
              <Description data={transaction} />
              <SourceID data={transaction} />
              <Counterparty data={transaction} onChange={onChange} />
              <td>
                <EditMiniButton onClick={(): void => setEditTransactionId(transaction.id)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <EditTransactionModal
        transactionID={editTransactionId}
        close={() => setEditTransactionId(undefined)}
        onChange={onChange}
      />
    </>
  );
};
