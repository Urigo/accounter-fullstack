import { useState, type ReactElement } from 'react';
import { format } from 'date-fns';
import { ChevronsLeftRightEllipsis, ChevronsRightLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from 'urql';
import { ROUTES } from '@/router/routes.js';
import { Mark, Table, Tooltip } from '@mantine/core';
import {
  BusinessLedgerInfoDocument,
  Currency,
  type BusinessLedgerInfoQuery,
  type BusinessTransactionsFilter,
} from '../../gql/graphql.js';
import { FIAT_CURRENCIES, formatAmountWithCurrency } from '../../helpers/index.js';
import { AccounterLoader } from '../common/index.js';
import { Button } from '../ui/button.js';
import { DownloadCSV } from './download-csv.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query BusinessLedgerInfo($filters: BusinessTransactionsFilter) {
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
          reference
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

export type ExtendedLedger = Extract<
  BusinessLedgerInfoQuery['businessTransactionsFromLedgerRecords'],
  { __typename?: 'BusinessTransactionsFromLedgerRecordsSuccessfulResult' }
>['businessTransactions'][number] & {
  ilsBalance: number;
  [currencyBalance: string]: number;
};

interface Props {
  businessID: string;
  filter?: Pick<BusinessTransactionsFilter, 'fromDate' | 'ownerIds' | 'toDate'>;
}

export function BusinessExtendedInfo({ businessID, filter }: Props): ReactElement {
  const [isExtendAllCurrencies, setISExtendAllCurrencies] = useState(false);
  const { fromDate, ownerIds, toDate } = filter ?? {};
  const [{ data, fetching }] = useQuery({
    query: BusinessLedgerInfoDocument,
    variables: {
      filters: {
        fromDate,
        ownerIds,
        toDate,
        businessIDs: [businessID],
      },
    },
  });

  const ledgerRecords =
    data?.businessTransactionsFromLedgerRecords.__typename === 'CommonError'
      ? []
      : (data?.businessTransactionsFromLedgerRecords.businessTransactions.sort((a, b) =>
          a.invoiceDate > b.invoiceDate ? 1 : -1,
        ) ?? []);

  const extendedLedgerRecords: Array<ExtendedLedger> = [];
  for (let i = 0; i < ledgerRecords.length; i++) {
    const { __typename, ...coreRecord } = ledgerRecords[i];
    const ilsBalance =
      i === 0
        ? coreRecord.amount.raw
        : (extendedLedgerRecords[i - 1].ilsBalance ?? 0) + coreRecord.amount.raw;
    const foreignCurrenciesBalance: Record<string, number> = {};
    Object.values(Currency).map(currency => {
      if (currency !== Currency.Ils) {
        const key = `${currency.toLowerCase()}Balance`;
        foreignCurrenciesBalance[key] =
          i === 0
            ? ((coreRecord.foreignAmount?.currency === currency
                ? coreRecord.foreignAmount?.raw
                : 0) ?? 0)
            : (extendedLedgerRecords[i - 1]?.[key] ?? 0) +
              (coreRecord.foreignAmount?.currency === currency ? coreRecord.foreignAmount?.raw : 0);
      }
    });
    extendedLedgerRecords.push({
      ...coreRecord,
      ilsBalance,
      ...foreignCurrenciesBalance,
    } as (typeof extendedLedgerRecords)[number]);
  }

  const currencies = new Set(
    ledgerRecords.filter(t => t.foreignAmount?.currency).map(t => t.foreignAmount!.currency),
  );
  const isEur = isExtendAllCurrencies || currencies.has(Currency.Eur);
  const isUsd = isExtendAllCurrencies || currencies.has(Currency.Usd);
  const isGbp = isExtendAllCurrencies || currencies.has(Currency.Gbp);
  const isCad = isExtendAllCurrencies || currencies.has(Currency.Cad);
  const isJpy = isExtendAllCurrencies || currencies.has(Currency.Jpy);
  const isAud = isExtendAllCurrencies || currencies.has(Currency.Aud);
  const isSek = isExtendAllCurrencies || currencies.has(Currency.Sek);

  const businessName = ledgerRecords[0]?.business.name ?? 'unknown';

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
              {isCad && (
                <>
                  <th>CAD Amount</th>
                  <th>CAD Balance</th>
                </>
              )}
              {isJpy && (
                <>
                  <th>JPY Amount</th>
                  <th>JPY Balance</th>
                </>
              )}
              {isAud && (
                <>
                  <th>AUD Amount</th>
                  <th>AUD Balance</th>
                </>
              )}
              {isSek && (
                <>
                  <th>SEK Amount</th>
                  <th>SEK Balance</th>
                </>
              )}
              <th>
                <Tooltip label="Expand all currencies">
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-7.5"
                    onClick={(): void => setISExtendAllCurrencies(i => !i)}
                  >
                    {isExtendAllCurrencies ? (
                      <ChevronsRightLeft className="size-5" />
                    ) : (
                      <ChevronsLeftRightEllipsis className="size-5" />
                    )}
                  </Button>
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
              <th>Reference</th>
              <th>Details</th>
              <th>Counter Account</th>
              <th>
                <DownloadCSV
                  ledgerRecords={extendedLedgerRecords}
                  businessName={businessName}
                  fromDate={filter?.fromDate ?? undefined}
                  toDate={filter?.toDate ?? undefined}
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {extendedLedgerRecords.map((row, index) => (
              <tr
                key={index}
                className="cursor-pointer"
                onClick={event => {
                  event.stopPropagation();
                  window.open(ROUTES.CHARGES.DETAIL(row.chargeId), '_blank', 'noreferrer');
                }}
              >
                <td>
                  <Link
                    to={ROUTES.BUSINESSES.DETAIL(row.business.id)}
                    target="_blank"
                    rel="noreferrer"
                    onClick={event => event.stopPropagation()}
                    className="inline-flex items-center font-semibold"
                  >
                    {row.business.name}
                  </Link>
                </td>
                <td>{row.invoiceDate ? format(new Date(row.invoiceDate), 'dd/MM/yy') : null}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {row.amount && row.amount.raw !== 0 && (
                    <Mark color={row.amount.raw > 0 ? 'green' : 'red'}>{row.amount.formatted}</Mark>
                  )}
                </td>
                <td>
                  {row.ilsBalance === 0 ? (
                    formatAmountWithCurrency(row.ilsBalance, Currency.Ils)
                  ) : (
                    <Mark color={row.ilsBalance > 0 ? 'green' : 'red'}>
                      {formatAmountWithCurrency(row.ilsBalance, Currency.Ils)}
                    </Mark>
                  )}
                </td>
                {isEur && <CurrencyCells data={row} currency={Currency.Eur} />}
                {isUsd && <CurrencyCells data={row} currency={Currency.Usd} />}
                {isGbp && <CurrencyCells data={row} currency={Currency.Gbp} />}
                {isCad && <CurrencyCells data={row} currency={Currency.Cad} />}
                {isJpy && <CurrencyCells data={row} currency={Currency.Jpy} />}
                {isAud && <CurrencyCells data={row} currency={Currency.Aud} />}
                {isSek && <CurrencyCells data={row} currency={Currency.Sek} />}
                <td />
                {isExtendAllCurrencies && <ExtendedCurrencyCells data={row} />}
                <td>{row.reference}</td>
                <td>{row.details}</td>
                <td>
                  {row.counterAccount && (
                    <Link
                      to={ROUTES.BUSINESSES.DETAIL(row.counterAccount.id)}
                      target="_blank"
                      rel="noreferrer"
                      onClick={event => event.stopPropagation()}
                      className="inline-flex items-center font-semibold"
                    >
                      {row.counterAccount.name}
                    </Link>
                  )}
                </td>
                <td />
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
  data: ExtendedLedger;
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
            formatAmountWithCurrency(data[key], currency)
          ) : (
            <Mark color={data[key] > 0 ? 'green' : 'red'}>
              {formatAmountWithCurrency(data[key], currency)}
            </Mark>
          ))}
      </td>
    </>
  );
}

const currenciesToExtend = Object.values(Currency).filter(
  currency => !FIAT_CURRENCIES.includes(currency),
);

export function ExtendedCurrencyCells({ data }: { data: ExtendedLedger }): ReactElement {
  return (
    <>
      {currenciesToExtend.map(currency => (
        <CurrencyCells key={currency} currency={currency} data={data} />
      ))}
    </>
  );
}
