import { ReactElement } from 'react';
import { AlertCircle } from 'lucide-react';
import { NavLink, Popover, Table, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  BusinessTripUncategorizedTransactionsFieldsFragment,
  BusinessTripUncategorizedTransactionsFieldsFragmentDoc,
  UncategorizedTransactionsTableAmountFieldsFragmentDoc,
} from '../../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../../gql/index.js';
import { formatStringifyAmount } from '../../../../helpers/index.js';
import { getChargeHref } from '../../../screens/charges/charge.js';
import {
  Account,
  Counterparty,
  DebitDate,
  Description,
  EventDate,
  SourceID,
} from '../../../transactions-table/cells-legacy/index.js';
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
      <Table highlightOnHover withBorder>
        <thead>
          <tr>
            <th>Event Date</th>
            <th>Debit Date</th>
            <th>Amount</th>
            <th />
            <th>Account</th>
            <th>Description</th>
            <th>Reference#</th>
            <th>Counterparty</th>
            <th />
          </tr>
        </thead>
        <tbody>
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
              <tr key={uncategorizedTransaction.transaction.id}>
                <EventDate data={uncategorizedTransaction.transaction} />
                <DebitDate data={uncategorizedTransaction.transaction} />
                <Amount data={uncategorizedTransaction} />
                <td>
                  <NavLink
                    label="To Charge"
                    className="[&>*>.mantine-NavLink-label]:font-semibold"
                    onClick={(event: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
                      event.stopPropagation();
                      window.open(
                        getChargeHref(uncategorizedTransaction.transaction.chargeId),
                        '_blank',
                        'noreferrer',
                      );
                    }}
                  />
                </td>
                <Account data={uncategorizedTransaction.transaction} />
                <Description data={uncategorizedTransaction.transaction} />
                <SourceID data={uncategorizedTransaction.transaction} />
                <Counterparty data={uncategorizedTransaction.transaction} />
                <td>
                  <CategorizeExpense
                    businessTripId={id}
                    transactionId={uncategorizedTransaction.transaction.id}
                    onChange={onChange}
                    defaultAmount={uncategorizedTransaction.transaction.amount.raw}
                  />
                </td>
              </tr>
            ))}
        </tbody>
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
    <td>
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
    </td>
  );
};

export const ErrorsPopover = ({ errors }: { errors: string[] }): ReactElement => {
  const [opened, { close, open }] = useDisclosure(false);
  return (
    <Popover width={200} position="bottom" shadow="md" opened={opened}>
      <Popover.Target>
        <AlertCircle onMouseEnter={open} onMouseLeave={close} />
      </Popover.Target>
      <Popover.Dropdown sx={{ pointerEvents: 'none' }} className="whitespace-normal text-red-500">
        {errors.map((error, i) => (
          <Text key={i} size="sm">
            {error}
          </Text>
        ))}
      </Popover.Dropdown>
    </Popover>
  );
};
