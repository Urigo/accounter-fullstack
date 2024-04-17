import { ReactElement, useState } from 'react';
import { TableTransactionsFieldsFragmentDoc } from '../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../gql/index.js';
import { EditMiniButton, EditTransactionModal } from '../../common/index.js';
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
  fragment TableTransactionsFields on Charge {
    id
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
  onChange: () => void;
};

export const TransactionsTable = ({ transactionsProps, onChange }: Props): ReactElement => {
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
