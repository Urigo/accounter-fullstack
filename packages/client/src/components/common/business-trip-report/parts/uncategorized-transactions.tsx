import type { ReactElement } from 'react';
import { AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/router/routes.js';
import {
  BusinessTripUncategorizedTransactionsFieldsFragmentDoc,
  UncategorizedTransactionsTableAmountFieldsFragmentDoc,
  type BusinessTripUncategorizedTransactionsFieldsFragment,
} from '../../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../../gql/index.js';
import { formatStringifyAmount } from '../../../../helpers/index.js';
import {
  Account,
  Counterparty,
  DebitDate,
  Description,
  EventDate,
  SourceID,
} from '../../../transactions-table/cells-legacy/index.js';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../ui/table.js';
import { Tooltip } from '../../tooltip.js';
import { CategorizeExpense } from '../buttons/categorize-expense.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment BusinessTripUncategorizedTransactionsFields on BusinessTrip {
    id
    uncategorizedTransactions {
      transaction {
        id
        eventDate
        chargeId
        amount {
          raw
        }
        ...TransactionsTableEventDateFields
        ...TransactionsTableDebitDateFields
        ...TransactionsTableAccountFields
        ...TransactionsTableDescriptionFields
        ...TransactionsTableSourceIDFields
        ...TransactionsTableEntityFields
      }
      ...UncategorizedTransactionsTableAmountFields
    }
  }
`;

interface Props {
  data: FragmentType<typeof BusinessTripUncategorizedTransactionsFieldsFragmentDoc>;
  onChange: () => void;
}

export const UncategorizedTransactions = ({ data, onChange }: Props): ReactElement => {
  const { uncategorizedTransactions, id } = getFragmentData(
    BusinessTripUncategorizedTransactionsFieldsFragmentDoc,
    data,
  );

  if (!uncategorizedTransactions?.length) {
    // eslint-disable-next-line react/jsx-no-useless-fragment
    return <></>;
  }

  return (
    <div className="flex flex-col gap-2 mt-5">
      <Table className="border">
        <TableHeader>
          <TableRow>
            <TableHead>Event Date</TableHead>
            <TableHead>Debit Date</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead />
            <TableHead>Account</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Reference#</TableHead>
            <TableHead>Counterparty</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {(
            uncategorizedTransactions as Array<
              Exclude<
                BusinessTripUncategorizedTransactionsFieldsFragment['uncategorizedTransactions'][number],
                null
              >
            >
          )
            .sort((a, b) => a.transaction.eventDate.localeCompare(b.transaction.eventDate))
            .map(uncategorizedTransaction => (
              <TableRow key={uncategorizedTransaction.transaction.id}>
                <EventDate data={uncategorizedTransaction.transaction} />
                <DebitDate data={uncategorizedTransaction.transaction} />
                <Amount data={uncategorizedTransaction} />
                <TableCell>
                  <Link
                    to={ROUTES.CHARGES.DETAIL(uncategorizedTransaction.transaction.chargeId)}
                    target="_blank"
                    rel="noreferrer"
                    onClick={event => event.stopPropagation()}
                    className="inline-flex items-center font-semibold"
                  >
                    To Charge
                  </Link>
                </TableCell>
                <Account data={uncategorizedTransaction.transaction} />
                <Description data={uncategorizedTransaction.transaction} />
                <SourceID data={uncategorizedTransaction.transaction} />
                <Counterparty data={uncategorizedTransaction.transaction} />
                <TableCell>
                  <CategorizeExpense
                    businessTripId={id}
                    transactionId={uncategorizedTransaction.transaction.id}
                    onChange={onChange}
                    defaultAmount={uncategorizedTransaction.transaction.amount.raw}
                  />
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </div>
  );
};

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment UncategorizedTransactionsTableAmountFields on UncategorizedTransaction {
    transaction {
      id
      amount {
        raw
        formatted
      }
      cryptoExchangeRate {
        rate
      }
    }
    categorizedAmount {
      raw
      formatted
    }
    errors
  }
`;

type AmountProps = {
  data: FragmentType<typeof UncategorizedTransactionsTableAmountFieldsFragmentDoc>;
};

export const Amount = ({ data }: AmountProps): ReactElement => {
  const { transaction, categorizedAmount, errors } = getFragmentData(
    UncategorizedTransactionsTableAmountFieldsFragmentDoc,
    data,
  );
  const amount = 'amount' in transaction ? transaction.amount : undefined;

  const categorizedAmountDiff =
    amount?.raw !== categorizedAmount.raw && categorizedAmount.raw !== 0;

  return (
    <TableCell>
      <div
        className="flex flex-col whitespace-nowrap"
        style={{
          color: Number(amount?.raw) > 0 ? 'green' : 'red',
        }}
      >
        <div className="flex gap-1">
          {amount?.formatted}
          {errors.length > 0 && <ErrorsPopover errors={errors} />}
        </div>
        {categorizedAmountDiff && (
          <div className="text-gray-500 ml-2">{categorizedAmount.formatted} categorized </div>
        )}
        {transaction.cryptoExchangeRate && (
          <div className="text-gray-500 ml-2">
            {`(Rate: ${transaction.cryptoExchangeRate.rate})`}
            <br />
            {amount?.raw
              ? `${formatStringifyAmount(amount.raw * transaction.cryptoExchangeRate.rate)}$`
              : null}
          </div>
        )}
      </div>
    </TableCell>
  );
};

export const ErrorsPopover = ({ errors }: { errors: string[] }): ReactElement => (
  // Was a Mantine `Popover` held open by mouseenter/mouseleave with `pointerEvents: 'none'` on
  // the dropdown — a tooltip in all but name. It is one now, so the hand-rolled open state and
  // the two handlers go away and it picks up the keyboard and touch behaviour Radix provides.
  <Tooltip
    side="bottom"
    className="max-w-50 whitespace-normal text-red-500"
    content={
      <ul>
        {errors.map((error, i) => (
          <li key={i} className="text-sm">
            {error}
          </li>
        ))}
      </ul>
    }
  >
    <AlertCircle />
  </Tooltip>
);
