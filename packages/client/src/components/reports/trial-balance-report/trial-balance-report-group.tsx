import type { ReactElement } from 'react';
import { Text } from '@mantine/core';
import { Currency } from '../../../gql/graphql.js';
import { formatAmountWithCurrency } from '../../../helpers/index.js';
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
      <tr key={'group' + group} className="bg-gray-100">
        <td colSpan={2}>Group total:</td>
        <td colSpan={1}>{group.replaceAll('0', '*')}</td>
        <td colSpan={1}>
          {!!data.totalDebit && formatAmountWithCurrency(data.totalDebit, Currency.Ils)}
        </td>
        <td colSpan={1}>
          {!!data.totalCredit && formatAmountWithCurrency(data.totalCredit, Currency.Ils)}
        </td>
        <td colSpan={1}>
          <Text fw={700} c={data.sum > 0 ? 'green' : data.sum < 0 ? 'red' : undefined}>
            {formatAmountWithCurrency(data.sum, Currency.Ils)}
          </Text>
        </td>
      </tr>
    </>
  );
};
