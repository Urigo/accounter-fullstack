import { Mark, Table } from '@mantine/core';
import { format } from 'date-fns';
import { useQuery } from 'urql';
import {
  BusinessTransactionsFilter,
  BusinessTransactionsInfoDocument,
  BusinessTransactionsInfoQuery,
} from '../../gql/graphql';
import { formatStringifyAmount } from '../../helpers';
import { AccounterLoader } from '../common';

/* GraphQL */ `
  query BusinessTransactionsInfo($filters: BusinessTransactionsFilter) {
    businessTransactionsFromLedgerRecords(filters: $filters) {
      ... on BusinessTransactionsFromLedgerRecordsSuccessfulResult {
        businessTransactions {
          amount {
            formatted
            raw
          }
          businessName
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
  businessName: string;
  filter?: BusinessTransactionsFilter;
}

export function BusinessExtendedInfo({ businessName, filter }: Props) {
  const [{ data, fetching }] = useQuery({
    query: BusinessTransactionsInfoDocument,
    variables: {
      filters: { ...filter, businessNames: [businessName] },
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

  const isEur = transactions.some(item => Boolean(item.eurAmount));
  const isUsd = transactions.some(item => Boolean(item.usdAmount));
  const isGbp = transactions.some(item => Boolean(item.gbpAmount));

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
              {isEur && <th>EUR Amount</th>}
              {isEur && <th>EUR Balance</th>}
              {isUsd && <th>USD Amount</th>}
              {isUsd && <th>USD Balance</th>}
              {isGbp && <th>GBP Amount</th>}
              {isGbp && <th>GBP Balance</th>}
            </tr>
          </thead>
          <tbody>
            {extendedTransactions.map((row, index) => (
              <tr key={index}>
                <td>{row.businessName}</td>
                <td>{row.invoiceDate ? format(new Date(row.invoiceDate), 'dd/MM/yy') : null}</td>
                <td>
                  {row.amount.raw && row.amount.raw !== 0 ? (
                    <Mark color={row.amount.raw > 0 ? 'green' : 'red'}>{row.amount.formatted}</Mark>
                  ) : (
                    row.amount.formatted
                  )}
                </td>
                <td>
                  {row.ilsBalance !== 0 ? (
                    <Mark color={row.ilsBalance > 0 ? 'green' : 'red'}>{`${row.ilsBalance.toFixed(
                      2,
                    )} ILS`}</Mark>
                  ) : (
                    `${formatStringifyAmount(row.ilsBalance)} ILS`
                  )}
                </td>
                {isEur && (
                  <td>
                    {row.eurAmount?.raw && row.eurAmount.raw !== 0 ? (
                      <Mark color={row.eurAmount.raw > 0 ? 'green' : 'red'}>
                        {row.eurAmount.formatted}
                      </Mark>
                    ) : (
                      row.eurAmount?.formatted
                    )}
                  </td>
                )}
                {isEur && (
                  <td>
                    {row.eurBalance !== 0 ? (
                      <Mark color={row.eurBalance > 0 ? 'green' : 'red'}>{`${row.eurBalance.toFixed(
                        2,
                      )} EUR`}</Mark>
                    ) : (
                      `${formatStringifyAmount(row.eurBalance)} EUR`
                    )}
                  </td>
                )}
                {isUsd && (
                  <td>
                    {row.usdAmount?.raw && row.usdAmount.raw !== 0 ? (
                      <Mark color={row.usdAmount.raw > 0 ? 'green' : 'red'}>
                        {row.usdAmount.formatted}
                      </Mark>
                    ) : (
                      row.usdAmount?.formatted
                    )}
                  </td>
                )}
                {isUsd && (
                  <td>
                    {row.usdBalance !== 0 ? (
                      <Mark color={row.usdBalance > 0 ? 'green' : 'red'}>{`${row.usdBalance.toFixed(
                        2,
                      )} USD`}</Mark>
                    ) : (
                      `${formatStringifyAmount(row.usdBalance)} USD`
                    )}
                  </td>
                )}
                {isGbp && (
                  <td>
                    {row.gbpAmount?.raw && row.gbpAmount.raw !== 0 ? (
                      <Mark color={row.gbpAmount.raw > 0 ? 'green' : 'red'}>
                        {row.gbpAmount.formatted}
                      </Mark>
                    ) : (
                      row.gbpAmount?.formatted
                    )}
                  </td>
                )}
                {isGbp && (
                  <td>
                    {row.gbpBalance !== 0 ? (
                      <Mark color={row.gbpBalance > 0 ? 'green' : 'red'}>{`${row.gbpBalance.toFixed(
                        2,
                      )} GBP`}</Mark>
                    ) : (
                      `${formatStringifyAmount(row.gbpBalance)} GBP`
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
