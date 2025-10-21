import type { ReactElement } from 'react';
import { Text } from '@mantine/core';
import { Currency } from '../../../gql/graphql.js';
import { formatAmountWithCurrency } from '../../../helpers/index.js';
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
      <tr>
        <td colSpan={7}>
          <span className="font-bold">{sortCode.name}</span>
        </td>
      </tr>
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

      <tr className="bg-gray-100">
        {sortCode.records.length > 1 ? (
          <>
            <td colSpan={2}>Group total:</td>
            <td colSpan={1}>{sortCode.key}</td>
            <td colSpan={1}>
              {!!sortCode.totalDebit && formatAmountWithCurrency(sortCode.totalDebit, Currency.Ils)}
            </td>
            <td colSpan={1}>
              {!!sortCode.totalCredit &&
                formatAmountWithCurrency(sortCode.totalCredit, Currency.Ils)}
            </td>
            <td colSpan={1}>
              <Text c={sortCode.sum > 0 ? 'green' : sortCode.sum < 0 ? 'red' : undefined}>
                {formatAmountWithCurrency(sortCode.sum, Currency.Ils)}
              </Text>
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
            </td>
          </>
        ) : undefined}
      </tr>
    </>
  ) : null;
};
