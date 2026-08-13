import { useMemo, type ReactElement, type ReactNode } from 'react';
import {
  ForeignSecuritiesChargeInfoFragmentDoc,
  TransactionForTransactionsTableFieldsFragmentDoc,
  type ForeignSecuritiesChargeInfoFragment,
} from '../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../gql/index.js';
import { formatStringifyAmount } from '../../../helpers/numbers.js';
import {
  Account,
  Amount,
  DebitDate,
  Description,
  EventDate,
  SourceID,
} from '../../transactions-table/cells/index.js';
import { Badge } from '../../ui/badge.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment ForeignSecuritiesChargeInfo on Charge {
    id
    __typename
    ... on ForeignSecuritiesCharge {
      securities {
        id
        securityKey
        details {
          id
          engName
          hebName
          symbol
          itemType
          stockType
          exchange
          currencyCode
          isEtf
          isForeign
          asOfDate
        }
        transactions {
          id
          ...TransactionForTransactionsTableFields
        }
        executions {
          id
          tradeDate
          valueDate
          settlementDate
          tradeType
          transactionType
          quantity
          tradePrice
          netValueTradeCurrency
          netValueNis
          tradeCurrency
          tradeCommissionValueTradeCurrency
          managementFeesValueTradeCurrency
          israelTaxValue
          paymentType
        }
      }
    }
  }
`;

type ChargeSecurity = Extract<
  ForeignSecuritiesChargeInfoFragment,
  { __typename: 'ForeignSecuritiesCharge' }
>['securities'][number];

type Props = {
  chargeProps: FragmentType<typeof ForeignSecuritiesChargeInfoFragmentDoc>;
};

export const ForeignSecuritiesInfo = ({ chargeProps }: Props): ReactNode => {
  const charge = getFragmentData(ForeignSecuritiesChargeInfoFragmentDoc, chargeProps);

  // The fragment sits on the Charge interface, so narrow before reading the field.
  const securities = useMemo(
    () => (charge.__typename === 'ForeignSecuritiesCharge' ? charge.securities : []),
    [charge],
  );

  return securities.length ? (
    <div className="flex flex-col gap-6">
      {securities.map(security => (
        <SecuritySection key={security.id} security={security} />
      ))}
    </div>
  ) : null;
};

const SecuritySection = ({ security }: { security: ChargeSecurity }): ReactElement => {
  const { details } = security;

  return (
    <div className="flex flex-col gap-2">
      {details ? (
        <div className="flex flex-col gap-1">
          <div className="text-lg font-semibold">
            {details.engName}
            {details.symbol && <span className="text-gray-500"> ({details.symbol})</span>}
          </div>
          <div className="text-sm text-gray-500">{details.hebName}</div>
          <div className="flex flex-row flex-wrap items-center gap-2">
            {details.exchange && <Badge variant="secondary">{details.exchange}</Badge>}
            <Badge variant="secondary">{details.currencyCode}</Badge>
            <Badge variant="outline">{details.itemType}</Badge>
            {details.stockType && <Badge variant="outline">{details.stockType}</Badge>}
            {details.isEtf && <Badge variant="outline">ETF</Badge>}
            {details.isForeign && <Badge variant="outline">Foreign</Badge>}
          </div>
          <div className="text-xs text-gray-400">
            Key {security.securityKey} · reference data as of{' '}
            {new Date(details.asOfDate).toLocaleDateString()}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <div className="text-lg font-semibold">Security {security.securityKey}</div>
          <div className="text-sm text-gray-500">
            Not found in the ingested securities list — the reference list may be out of date.
          </div>
        </div>
      )}
      <SecurityTransactionsTable transactions={security.transactions} />
      <SecurityExecutionsTable executions={security.executions} />
    </div>
  );
};

const TableSection = ({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}): ReactElement => (
  <div className="flex flex-col gap-1">
    <div className="text-sm font-medium text-gray-500">{title}</div>
    {children}
  </div>
);

const SecurityTransactionsTable = ({
  transactions,
}: {
  transactions: ChargeSecurity['transactions'];
}): ReactNode => {
  const rows = useMemo(
    () =>
      transactions.map(transaction =>
        getFragmentData(TransactionForTransactionsTableFieldsFragmentDoc, transaction),
      ),
    [transactions],
  );

  return rows.length ? (
    <TableSection title="Bank transactions">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Event Date</TableHead>
            <TableHead>Debit Date</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Account</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Reference#</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(transaction => {
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
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableSection>
  ) : null;
};

/** Numerics arrive as decimal strings (Postgres numeric); format without re-rounding blindly. */
const formatNumeric = (value: string | null | undefined, digits = 2): string => {
  if (value == null) {
    return '';
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? value : formatStringifyAmount(parsed, digits);
};

const formatDate = (value: string | Date | null | undefined): string =>
  value ? new Date(value).toLocaleDateString() : '';

const SecurityExecutionsTable = ({
  executions,
}: {
  executions: ChargeSecurity['executions'];
}): ReactNode =>
  executions.length ? (
    <TableSection title="Portfolio activity">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Trade Date</TableHead>
            <TableHead>Value Date</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Quantity</TableHead>
            <TableHead>Price</TableHead>
            <TableHead>Net Value</TableHead>
            <TableHead>Commission</TableHead>
            <TableHead>Tax</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {executions.map(execution => (
            <TableRow key={execution.id}>
              <TableCell>{formatDate(execution.tradeDate)}</TableCell>
              <TableCell>{formatDate(execution.valueDate ?? execution.settlementDate)}</TableCell>
              <TableCell>
                <div className="flex flex-row flex-wrap items-center gap-1">
                  <Badge variant="secondary">{execution.tradeType}</Badge>
                  {execution.transactionType !== execution.tradeType && (
                    <Badge variant="outline">{execution.transactionType}</Badge>
                  )}
                  {execution.paymentType && (
                    <Badge variant="outline">{execution.paymentType}</Badge>
                  )}
                </div>
              </TableCell>
              {/* Quantities can be fractional for ETFs and mutual funds. */}
              <TableCell>{formatNumeric(execution.quantity, 4)}</TableCell>
              <TableCell>{formatNumeric(execution.tradePrice, 4)}</TableCell>
              <TableCell className="whitespace-nowrap">
                {formatNumeric(execution.netValueTradeCurrency ?? execution.netValueNis)}{' '}
                <span className="text-gray-500">
                  {execution.netValueTradeCurrency ? (execution.tradeCurrency ?? '') : 'ILS'}
                </span>
              </TableCell>
              <TableCell>
                {formatNumeric(
                  execution.tradeCommissionValueTradeCurrency ??
                    execution.managementFeesValueTradeCurrency,
                )}
              </TableCell>
              <TableCell>{formatNumeric(execution.israelTaxValue)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableSection>
  ) : null;
