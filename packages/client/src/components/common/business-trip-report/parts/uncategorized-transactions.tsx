import { ReactElement } from 'react';
import { Table } from '@mantine/core';
import { FragmentOf, graphql, readFragment } from '../../../../graphql.js';
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
} from '../../transactions-table/cells/index.js';
import { SelectTransactionCategory } from '../buttons/select-transaction-category.js';

export const BusinessTripUncategorizedTransactionsFieldsFragmentDoc = graphql(
  `
    fragment BusinessTripUncategorizedTransactionsFields on BusinessTrip {
      id
      uncategorizedTransactions {
        id
        eventDate
        ...TransactionsTableEventDateFields
        ...TransactionsTableDebitDateFields
        ...TransactionsTableAmountFields
        ...TransactionsTableAccountFields
        ...TransactionsTableDescriptionFields
        ...TransactionsTableSourceIDFields
        ...TransactionsTableEntityFields
      }
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

interface Props {
  data: FragmentOf<typeof BusinessTripUncategorizedTransactionsFieldsFragmentDoc>;
  onChange: () => void;
}

export const UncategorizedTransactions = ({ data, onChange }: Props): ReactElement => {
  const { uncategorizedTransactions, id } = readFragment(
    BusinessTripUncategorizedTransactionsFieldsFragmentDoc,
    data,
  );

  if (!uncategorizedTransactions?.length) {
    // eslint-disable-next-line react/jsx-no-useless-fragment
    return <></>;
  }

  return (
    <div className="flex flex-col gap-2 mt-5">
      <Table highlightOnHover withBorder>
        <thead>
          <tr>
            <th>Event Date</th>
            <th>Debit Date</th>
            <th>Amount</th>
            <th>Account</th>
            <th>Description</th>
            <th>Reference#</th>
            <th>Counterparty</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {uncategorizedTransactions
            ?.sort((a, b) => a.eventDate.localeCompare(b.eventDate))
            .map(transaction => (
              <tr key={transaction.id}>
                <EventDate data={transaction} />
                <DebitDate data={transaction} />
                <Amount data={transaction} />
                <Account data={transaction} />
                <Description data={transaction} />
                <SourceID data={transaction} />
                <Counterparty data={transaction} />
                <td>
                  <SelectTransactionCategory
                    businessTripId={id}
                    transactionId={transaction.id}
                    onChange={onChange}
                  />
                </td>
              </tr>
            ))}
        </tbody>
      </Table>
    </div>
  );
};
