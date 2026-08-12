import { useMemo, type ReactElement, type ReactNode } from 'react';
import {
  ForeignSecuritiesChargeInfoFragmentDoc,
  TransactionForTransactionsTableFieldsFragmentDoc,
  type ForeignSecuritiesChargeInfoFragment,
} from '../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../gql/index.js';
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
    </div>
  );
};

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
  ) : null;
};
