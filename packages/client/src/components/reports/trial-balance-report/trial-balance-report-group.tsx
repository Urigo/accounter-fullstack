import { ReactElement } from 'react';
import { Text } from '@mantine/core';
import { Currency } from '../../../gql/graphql.js';
import { currencyCodeToSymbol, formatStringifyAmount } from '../../../helpers/index.js';
import { TrialBalanceReportFilters } from './trial-balance-report-filters.js';
import { ExtendedSortCode, TrialBalanceReportSortCode } from './trial-balance-report-sort-code.js';

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
        .sort((a, b) => a.id - b.id)
        .map((sortCode, i) => (
          <TrialBalanceReportSortCode
            key={`${sortCode.id} ${i}`}
            sortCode={sortCode}
            filter={filter}
            isAllOpened={isAllOpened}
          />
        ))}
      <tr key={'group' + group} className="bg-gray-100">
        <td colSpan={2}>Group total:</td>
        <td colSpan={1}>{group.replaceAll('0', '*')}</td>
        <td colSpan={1}>
          {!!data.totalDebit &&
            `${currencyCodeToSymbol(Currency.Ils)} ${formatStringifyAmount(data.totalDebit)}`}
        </td>
        <td colSpan={1}>
          {!!data.totalCredit &&
            `${currencyCodeToSymbol(Currency.Ils)} ${formatStringifyAmount(data.totalCredit)}`}
        </td>
        <td colSpan={1}>
          <Text fw={700} c={data.sum > 0 ? 'green' : data.sum < 0 ? 'red' : undefined}>
            {`${currencyCodeToSymbol(Currency.Ils)} ${formatStringifyAmount(data.sum)}`}
          </Text>
        </td>
      </tr>
    </>
  );
};
