import { ReactElement, useState } from 'react';
import { format } from 'date-fns';
import { ChevronsLeftRightEllipsis, ChevronsRightLeft } from 'lucide-react';
import { useQuery } from 'urql';
import { ActionIcon, Mark, NavLink, Table, Tooltip } from '@mantine/core';
import {
  BusinessTransactionsFilter,
  BusinessTransactionsInfoDocument,
  BusinessTransactionsInfoQuery,
  Currency,
} from '../../gql/graphql.js';
import { currencyCodeToSymbol, formatStringifyAmount } from '../../helpers/index.js';
import { AccounterLoader } from '../common/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query BusinessTransactionsInfo($filters: BusinessTransactionsFilter) {
    businessTransactionsFromLedgerRecords(filters: $filters) {
      ... on BusinessTransactionsFromLedgerRecordsSuccessfulResult {
        businessTransactions {
          amount {
            formatted
            raw
          }
          business {
            id
            name
          }
          foreignAmount {
            formatted
            raw
            currency
          }
          invoiceDate
          reference1
          reference2
          details
          counterAccount {
            __typename
            id
            name
          }
          chargeId
        }
      }
      ... on CommonError {
        __typename
        message
      }
    }
  }
`;

type ExtendedTransaction = Extract<
  BusinessTransactionsInfoQuery['businessTransactionsFromLedgerRecords'],
  { __typename?: 'BusinessTransactionsFromLedgerRecordsSuccessfulResult' }
>['businessTransactions'][number] & {
  ilsBalance: number;
  [currencyBalance: string]: number;
};

interface Props {
  businessID: string;
  filter?: BusinessTransactionsFilter;
}

export function BusinessExtendedInfo({ businessID, filter }: Props): ReactElement {
  const [isExtendAllCurrencies, setISExtendAllCurrencies] = useState(false);
  const { fromDate, ownerIds, toDate } = filter ?? {};
  const [{ data, fetching }] = useQuery({
    query: BusinessTransactionsInfoDocument,
    variables: {
      filters: {
        fromDate,
        ownerIds,
        toDate,
        businessIDs: [businessID],
      },
    },
  });

  const transactions =
    data?.businessTransactionsFromLedgerRecords.__typename === 'CommonError'
      ? []
      : (data?.businessTransactionsFromLedgerRecords.businessTransactions.sort((a, b) =>
          a.invoiceDate > b.invoiceDate ? 1 : -1,
        ) ?? []);

  const extendedTransactions: Array<ExtendedTransaction> = [];
  for (let i = 0; i < transactions.length; i++) {
    const { __typename, ...coreTransaction } = transactions[i];
    const ilsBalance =
      i === 0
        ? coreTransaction.amount.raw
        : (extendedTransactions[i - 1].ilsBalance ?? 0) + coreTransaction.amount.raw;
    const foreignCurrenciesBalance: Record<string, number> = {};
    Object.values(Currency).map(currency => {
      if (currency !== Currency.Ils) {
        const key = `${currency.toLowerCase()}Balance`;
        foreignCurrenciesBalance[key] =
          i === 0
            ? ((coreTransaction.foreignAmount?.currency === currency
                ? coreTransaction.foreignAmount?.raw
                : 0) ?? 0)
            : (extendedTransactions[i - 1]?.[key] ?? 0) +
              (coreTransaction.foreignAmount?.currency === currency
                ? coreTransaction.foreignAmount?.raw
                : 0);
      }
    });
    extendedTransactions.push({
      ...coreTransaction,
      ilsBalance,
      ...foreignCurrenciesBalance,
    } as (typeof extendedTransactions)[number]);
  }

  const isEur =
    isExtendAllCurrencies ||
    transactions.some(item => item.foreignAmount?.currency === Currency.Eur);
  const isUsd =
    isExtendAllCurrencies ||
    transactions.some(item => item.foreignAmount?.currency === Currency.Usd);
  const isGbp =
    isExtendAllCurrencies ||
    transactions.some(item => item.foreignAmount?.currency === Currency.Gbp);

  console.log(extendedTransactions);

  return (
    <div className="flex flex-row gap-5">
      {fetching ? (
        <AccounterLoader />
      ) : (
        <Table striped highlightOnHover>
          <thead style={{ position: 'sticky', top: 0, zIndex: 20 }}>
            <tr className="px-10 py-10 title-font tracking-wider font-medium text-gray-900 text-sm bg-gray-100 rounded-tl rounded-bl">
              <th>Business Name</th>
              <th>Date</th>
              <th>Amount</th>
              <th>Amount Balance</th>
              {isEur && (
                <>
                  <th>EUR Amount</th>
                  <th>EUR Balance</th>
                </>
              )}
              {isUsd && (
                <>
                  <th>USD Amount</th>
                  <th>USD Balance</th>
                </>
              )}
              {isGbp && (
                <>
                  <th>GBP Amount</th>
                  <th>GBP Balance</th>
                </>
              )}
              <th>
                <Tooltip label="Expand all currencies">
                  <ActionIcon
                    variant="default"
                    onClick={(): void => setISExtendAllCurrencies(i => !i)}
                    size={30}
                  >
                    {isExtendAllCurrencies ? (
                      <ChevronsRightLeft size={20} />
                    ) : (
                      <ChevronsLeftRightEllipsis size={20} />
                    )}
                  </ActionIcon>
                </Tooltip>
              </th>
              {isExtendAllCurrencies && (
                <>
                  {currenciesToExtend.map(currency => (
                    <>
                      <th>{currency} Amount</th>
                      <th>{currency} Balance</th>
                    </>
                  ))}
                </>
              )}
              <th>Reference1</th>
              <th>Reference2</th>
              <th>Details</th>
              <th>Counter Account</th>
            </tr>
          </thead>
          <tbody>
            {extendedTransactions.map((row, index) => (
              <tr
                key={index}
                onClick={event => {
                  event.stopPropagation();
                  window.open(`/charges/${row.chargeId}`, '_blank', 'noreferrer');
                }}
              >
                <td>{row.business.name}</td>
                <td>{row.invoiceDate ? format(new Date(row.invoiceDate), 'dd/MM/yy') : null}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {row.amount && row.amount.raw !== 0 && (
                    <Mark color={row.amount.raw > 0 ? 'green' : 'red'}>{row.amount.formatted}</Mark>
                  )}
                </td>
                <td>
                  {row.ilsBalance === 0 ? (
                    `${currencyCodeToSymbol(Currency.Ils)} ${formatStringifyAmount(row.ilsBalance)}`
                  ) : (
                    <Mark
                      color={row.ilsBalance > 0 ? 'green' : 'red'}
                    >{`${currencyCodeToSymbol(Currency.Ils)} ${formatStringifyAmount(row.ilsBalance)}`}</Mark>
                  )}
                </td>
                {isEur && <CurrencyCells data={row} currency={Currency.Eur} />}
                {isUsd && <CurrencyCells data={row} currency={Currency.Usd} />}
                {isGbp && <CurrencyCells data={row} currency={Currency.Gbp} />}
                <td />
                {isExtendAllCurrencies && <ExtendedCurrencyCells data={row} />}
                <td>{row.reference1}</td>
                <td>{row.reference2}</td>
                <td>{row.details}</td>
                <td>
                  {row.counterAccount && (
                    <a
                      href={`/business-transactions/${row.counterAccount?.id}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={event => event.stopPropagation()}
                    >
                      <NavLink
                        label={row.counterAccount?.name}
                        className="[&>*>.mantine-NavLink-label]:font-semibold"
                      />
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}

export function CurrencyCells({
  currency,
  data,
}: {
  currency: Currency;
  data: ExtendedTransaction;
}): ReactElement {
  const foreignAmount =
    data.foreignAmount && data.foreignAmount.currency === currency ? data.foreignAmount : null;
  const key = `${currency.toLowerCase()}Balance`;
  return (
    <>
      <td style={{ whiteSpace: 'nowrap' }}>
        {!!foreignAmount && foreignAmount.raw !== 0 && (
          <Mark color={foreignAmount.raw > 0 ? 'green' : 'red'}>{foreignAmount.formatted}</Mark>
        )}
      </td>
      <td>
        {(data[key] ?? 0) !== 0 &&
          (data[key] === 0 ? (
            `${currencyCodeToSymbol(currency)} ${formatStringifyAmount(data[key])}`
          ) : (
            <Mark
              color={data[key] > 0 ? 'green' : 'red'}
            >{`${currencyCodeToSymbol(currency)} ${formatStringifyAmount(data[key])}`}</Mark>
          ))}
      </td>
    </>
  );
}

const currenciesToExtend = Object.values(Currency).filter(
  currency => ![Currency.Ils, Currency.Eur, Currency.Usd, Currency.Gbp].includes(currency),
);

export function ExtendedCurrencyCells({ data }: { data: ExtendedTransaction }): ReactElement {
  return (
    <>
      {currenciesToExtend.map(currency => (
        <CurrencyCells key={currency} currency={currency} data={data} />
      ))}
    </>
  );
}
