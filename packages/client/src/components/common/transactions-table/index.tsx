import { ReactElement, useState } from 'react';
import { FragmentOf, graphql, readFragment } from '../../../graphql.js';
import { ChargeNavigateButton, EditMiniButton, EditTransactionModal } from '../index.js';
import {
  Account,
  Amount,
  Counterparty,
  DebitDate,
  Description,
  EventDate,
  SourceID,
  TransactionsTableAccountFieldsFragmentDoc,
  TransactionsTableAmountFieldsFragmentDoc,
  TransactionsTableDebitDateFieldsFragmentDoc,
  TransactionsTableDescriptionFieldsFragmentDoc,
  TransactionsTableEntityFieldsFragmentDoc,
  TransactionsTableEventDateFieldsFragmentDoc,
  TransactionsTableSourceIdFieldsFragmentDoc,
} from './cells/index.js';

export const TransactionForTransactionsTableFieldsFragmentDoc = graphql(
  `
    fragment TransactionForTransactionsTableFields on Transaction {
      id
      chargeId
      ...TransactionsTableEventDateFields
      ...TransactionsTableDebitDateFields
      ...TransactionsTableAmountFields
      ...TransactionsTableAccountFields
      ...TransactionsTableDescriptionFields
      ...TransactionsTableSourceIDFields
      ...TransactionsTableEntityFields
    }
  `,
  [
    TransactionsTableEventDateFieldsFragmentDoc,
    TransactionsTableDebitDateFieldsFragmentDoc,
    TransactionsTableAmountFieldsFragmentDoc,
    TransactionsTableAccountFieldsFragmentDoc,
    TransactionsTableDescriptionFieldsFragmentDoc,
    TransactionsTableSourceIdFieldsFragmentDoc,
    TransactionsTableEntityFieldsFragmentDoc,
  ],
);

type Props = {
  transactionsProps: FragmentOf<typeof TransactionForTransactionsTableFieldsFragmentDoc>[];
  enableEdit?: boolean;
  enableChargeLink?: boolean;
  onChange?: () => void;
};

export const TransactionsTable = ({
  transactionsProps,
  onChange = (): void => void 0,
  enableEdit,
  enableChargeLink,
}: Props): ReactElement => {
  const transactions = transactionsProps.map(rawTransaction =>
    readFragment(TransactionForTransactionsTableFieldsFragmentDoc, rawTransaction),
  );
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
            <th>
              {enableEdit && !enableChargeLink && 'Edit'}
              {enableChargeLink && !enableEdit && 'Charge'}
            </th>
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
              <Counterparty data={transaction} enableEdit={enableEdit} onChange={onChange} />
              <td>
                {enableEdit && (
                  <EditMiniButton onClick={(): void => setEditTransactionId(transaction.id)} />
                )}
                {enableChargeLink && <ChargeNavigateButton chargeId={transaction.chargeId} />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {enableEdit && (
        <EditTransactionModal
          transactionID={editTransactionId}
          close={() => setEditTransactionId(undefined)}
          onChange={onChange}
        />
      )}
    </>
  );
};
