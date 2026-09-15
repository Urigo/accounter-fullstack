import type { ReactElement } from 'react';
import { Currency } from '../../../gql/graphql.js';
import { formatAmountWithCurrency } from '../../../helpers/index.js';
import { TableCell, TableRow } from '../../ui/table.js';
import {
  TrialBalanceReportBusiness,
  type ExtendedBusiness,
} from './trial-balance-report-account.js';
import { TrialBalanceReportFilters } from './trial-balance-report-filters.js';

export type ExtendedSortCode = {
  key: number;
  name?: string | null;
  records: Array<ExtendedBusiness>;
  totalCredit: number;
  totalDebit: number;
  credit: number;
  debit: number;
  sum: number;
};

interface Props {
  sortCode: ExtendedSortCode;
  filter: TrialBalanceReportFilters;
  isAllOpened: boolean;
}

export const TrialBalanceReportSortCode = ({
  sortCode,
  filter,
  isAllOpened,
}: Props): ReactElement | null => {
  return sortCode.records.length > 0 ? (
    <>
      <TableRow>
        <TableCell colSpan={7}>
          <span className="font-bold">{sortCode.name}</span>
        </TableCell>
      </TableRow>
      {sortCode.records
        .sort((a, b) => a.business.name.localeCompare(b.business.name))
        .map(record => (
          <TrialBalanceReportBusiness
            key={record.business.id}
            record={record}
            sortCodeKey={sortCode.key}
            filter={filter}
            isAllOpened={isAllOpened}
          />
        ))}

      <TableRow className="bg-gray-100">
        {sortCode.records.length > 1 ? (
          <>
            <TableCell colSpan={2}>Group total:</TableCell>
            <TableCell colSpan={1}>{sortCode.key}</TableCell>
            <TableCell colSpan={1}>
              {!!sortCode.totalDebit && formatAmountWithCurrency(sortCode.totalDebit, Currency.Ils)}
            </TableCell>
            <TableCell colSpan={1}>
              {!!sortCode.totalCredit &&
                formatAmountWithCurrency(sortCode.totalCredit, Currency.Ils)}
            </TableCell>
            <TableCell colSpan={1}>
              <div
                className={
                  sortCode.sum > 0
                    ? 'text-green-500'
                    : sortCode.sum < 0
                      ? 'text-red-500'
                      : undefined
                }
              >
                {formatAmountWithCurrency(sortCode.sum, Currency.Ils)}
              </div>
              {!!sortCode.debit && (
                <>
                  <br />
                  Total Debit Balances: {formatAmountWithCurrency(sortCode.debit, Currency.Ils)}
                </>
              )}
              {!!sortCode.credit && (
                <>
                  <br />
                  Total Credit Balances: {formatAmountWithCurrency(sortCode.credit, Currency.Ils)}
                </>
              )}
            </TableCell>
          </>
        ) : undefined}
      </TableRow>
    </>
  ) : null;
};
