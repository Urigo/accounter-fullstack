import type { ReactElement } from 'react';
import { Currency } from '../../../gql/graphql.js';
import { formatAmountWithCurrency } from '../../../helpers/index.js';
import { cn } from '../../../lib/utils.js';
import { TableCell, TableRow } from '../../ui/table.js';
import { TrialBalanceReportFilters } from './trial-balance-report-filters.js';
import {
  TrialBalanceReportSortCode,
  type ExtendedSortCode,
} from './trial-balance-report-sort-code.js';

interface Props {
  data: {
    sortCodes: Record<number, ExtendedSortCode>;
    totalCredit: number;
    totalDebit: number;
    credit: number;
    debit: number;
    sum: number;
  };
  group: string;
  filter: TrialBalanceReportFilters;
  isAllOpened: boolean;
}

export const TrialBalanceReportGroup = ({
  group,
  data,
  filter,
  isAllOpened,
}: Props): ReactElement => {
  return (
    <>
      {Object.values(data.sortCodes)
        .sort((a, b) => a.key - b.key)
        .map((sortCode, i) => (
          <TrialBalanceReportSortCode
            key={`${sortCode.key} ${i}`}
            sortCode={sortCode}
            filter={filter}
            isAllOpened={isAllOpened}
          />
        ))}
      <TableRow key={'group' + group} className="bg-gray-100">
        <TableCell colSpan={2}>Group total:</TableCell>
        <TableCell colSpan={1}>{group.replaceAll('0', '*')}</TableCell>
        <TableCell colSpan={1}>
          {!!data.totalDebit && formatAmountWithCurrency(data.totalDebit, Currency.Ils)}
        </TableCell>
        <TableCell colSpan={1}>
          {!!data.totalCredit && formatAmountWithCurrency(data.totalCredit, Currency.Ils)}
        </TableCell>
        <TableCell colSpan={1}>
          <div
            className={cn(
              'font-bold',
              data.sum > 0 ? 'text-green-500' : data.sum < 0 ? 'text-red-500' : undefined,
            )}
          >
            {formatAmountWithCurrency(data.sum, Currency.Ils)}
          </div>
        </TableCell>
      </TableRow>
    </>
  );
};
