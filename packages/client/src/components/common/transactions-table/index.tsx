import { ReactElement, useState } from 'react';
import { TransactionForTransactionsTableFieldsFragmentDoc } from '../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../gql/index.js';
import { ChargeNavigateButton, EditMiniButton, EditTransactionModal } from '../index.js';
import { InsertMiscExpenseModal } from '../modals/insert-misc-expense-modal.js';
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
    chargeId
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
    getFragmentData(TransactionForTransactionsTableFieldsFragmentDoc, rawTransaction),
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
                  <>
                    <EditMiniButton onClick={(): void => setEditTransactionId(transaction.id)} />
                    <InsertMiscExpenseModal transactionId={transaction.id} />
                  </>
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
