import { useMemo, type ReactNode } from 'react';
import {
  CreditcardBankChargeInfoFragmentDoc,
  TransactionForTransactionsTableFieldsFragmentDoc,
} from '../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../gql/index.js';
import { ChargeNavigateButton } from '../../common/index.js';
import {
  Account,
  Amount,
  Counterparty,
  DebitDate,
  Description,
  EventDate,
  SourceID,
} from '../../transactions-table/cells/index.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment CreditcardBankChargeInfo on Charge {
    id
    __typename
    ... on CreditcardBankCharge {
      creditCardTransactions {
        id
        ...TransactionForTransactionsTableFields
      }
    }
  }
`;

type Props = {
  chargeProps: FragmentType<typeof CreditcardBankChargeInfoFragmentDoc>;
};

export const CreditcardTransactionsInfo = ({ chargeProps }: Props): ReactNode => {
  const charge = getFragmentData(CreditcardBankChargeInfoFragmentDoc, chargeProps);
  const transactions = useMemo(() => {
    if (charge.__typename === 'CreditcardBankCharge' && charge.creditCardTransactions) {
      return charge.creditCardTransactions.map(rawTransaction =>
        getFragmentData(TransactionForTransactionsTableFieldsFragmentDoc, rawTransaction),
      );
    }
    return [];
  }, [charge]);

  return transactions.length ? (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Event Date</TableHead>
          <TableHead>Debit Date</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Account</TableHead>
          <TableHead>Description</TableHead>
          <TableHead>Reference#</TableHead>
          <TableHead>Counterparty</TableHead>
          <TableHead>Charge</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.map(transaction => {
          const extendedTransaction = {
            ...transaction,
            onUpdate: () => void 0,
            editTransaction: () => void 0,
            enableEdit: false,
            enableChargeLink: false,
          };
          return (
            <TableRow key={transaction.id}>
              <TableCell>
                <EventDate transaction={extendedTransaction} />
              </TableCell>
              <TableCell>
                <DebitDate transaction={extendedTransaction} />
              </TableCell>
              <TableCell>
                <Amount transaction={extendedTransaction} />
              </TableCell>
              <TableCell>
                <Account transaction={extendedTransaction} />
              </TableCell>
              <TableCell>
                <Description transaction={extendedTransaction} />
              </TableCell>
              <TableCell>
                <SourceID transaction={extendedTransaction} />
              </TableCell>
              <TableCell>
                <Counterparty transaction={extendedTransaction} />
              </TableCell>
              <TableCell>
                <ChargeNavigateButton chargeId={transaction.chargeId} />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  ) : null;
};
