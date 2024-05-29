import { ReactElement } from 'react';
import { format } from 'date-fns';
import { useQuery } from 'urql';
import { Mark, NavLink, Table } from '@mantine/core';
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
          eurAmount {
            formatted
            raw
          }
          gbpAmount {
            formatted
            raw
          }
          usdAmount {
            formatted
            raw
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

interface Props {
  businessID: string;
  filter?: BusinessTransactionsFilter;
}

export function BusinessExtendedInfo({ businessID, filter }: Props): ReactElement {
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
      : data?.businessTransactionsFromLedgerRecords.businessTransactions ?? [];

  const extendedTransactions: Array<
    Extract<
      BusinessTransactionsInfoQuery['businessTransactionsFromLedgerRecords'],
      { __typename?: 'BusinessTransactionsFromLedgerRecordsSuccessfulResult' }
    >['businessTransactions'][number] & {
      ilsBalance: number;
      eurBalance: number;
      gbpBalance: number;
      usdBalance: number;
    }
  > = [];
  for (let i = 0; i < transactions.length; i++) {
    extendedTransactions.push({
      ...transactions[i],
      ilsBalance:
        i === 0
          ? transactions[i].amount.raw
          : (extendedTransactions[i - 1].ilsBalance ?? 0) + transactions[i].amount.raw,
      eurBalance:
        i === 0
          ? transactions[i].eurAmount?.raw ?? 0
          : (extendedTransactions[i - 1].eurBalance ?? 0) + (transactions[i].eurAmount?.raw ?? 0),
      gbpBalance:
        i === 0
          ? transactions[i].gbpAmount?.raw ?? 0
          : (extendedTransactions[i - 1].gbpBalance ?? 0) + (transactions[i].gbpAmount?.raw ?? 0),
      usdBalance:
        i === 0
          ? transactions[i].usdAmount?.raw ?? 0
          : (extendedTransactions[i - 1].usdBalance ?? 0) + (transactions[i].usdAmount?.raw ?? 0),
    });
  }

  const isEur = transactions.some(item => item.eurAmount);
  const isUsd = transactions.some(item => item.usdAmount);
  const isGbp = transactions.some(item => item.gbpAmount);

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
                {isEur && (
                  <>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {!!row.eurAmount && row.eurAmount.raw !== 0 && (
                        <Mark color={row.eurAmount.raw > 0 ? 'green' : 'red'}>
                          {row.eurAmount.formatted}
                        </Mark>
                      )}
                    </td>
                    <td>
                      {(row.eurAmount?.raw ?? 0) !== 0 &&
                        (row.eurBalance === 0 ? (
                          `${currencyCodeToSymbol(Currency.Eur)} ${formatStringifyAmount(row.eurBalance)}`
                        ) : (
                          <Mark
                            color={row.eurBalance > 0 ? 'green' : 'red'}
                          >{`${currencyCodeToSymbol(Currency.Eur)} ${formatStringifyAmount(row.eurBalance)}`}</Mark>
                        ))}
                    </td>
                  </>
                )}
                {isUsd && (
                  <>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {!!row.usdAmount && (row.usdAmount?.raw ?? 0) !== 0 && (
                        <Mark color={row.usdAmount.raw > 0 ? 'green' : 'red'}>
                          {row.usdAmount.formatted}
                        </Mark>
                      )}
                    </td>
                    <td>
                      {row.usdAmount?.raw !== 0 &&
                        (row.usdBalance === 0 ? (
                          `${currencyCodeToSymbol(Currency.Usd)} ${formatStringifyAmount(row.usdBalance)}`
                        ) : (
                          <Mark
                            color={row.usdBalance > 0 ? 'green' : 'red'}
                          >{`${currencyCodeToSymbol(Currency.Usd)}  ${formatStringifyAmount(row.usdBalance)}`}</Mark>
                        ))}
                    </td>
                  </>
                )}
                {isGbp && (
                  <>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {!!row.gbpAmount && row.gbpAmount.raw !== 0 && (
                        <Mark color={row.gbpAmount.raw > 0 ? 'green' : 'red'}>
                          {row.gbpAmount.formatted}
                        </Mark>
                      )}
                    </td>
                    <td>
                      {row.gbpAmount?.raw !== 0 &&
                        (row.gbpBalance === 0 ? (
                          `${currencyCodeToSymbol(Currency.Gbp)} ${formatStringifyAmount(row.gbpBalance)}`
                        ) : (
                          <Mark
                            color={row.gbpBalance > 0 ? 'green' : 'red'}
                          >{`${currencyCodeToSymbol(Currency.Gbp)} ${formatStringifyAmount(row.gbpBalance)}`}</Mark>
                        ))}
                    </td>
                  </>
                )}
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
