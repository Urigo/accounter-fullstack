import { ReactElement } from 'react';
import { Text } from '@mantine/core';
import { Currency } from '../../../gql/graphql.js';
import { currencyCodeToSymbol, formatStringifyAmount } from '../../../helpers/index.js';
import { ExtendedBusiness, TrialBalanceReportBusiness } from './trial-balance-report-account.js';
import { TrialBalanceReportFilters } from './trial-balance-report-filters.js';

export type ExtendedSortCode = {
  id: number;
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
            sortCodeId={sortCode.id}
            filter={filter}
            isAllOpened={isAllOpened}
          />
        ))}

      <tr className="bg-gray-100">
        {sortCode.records.length > 1 ? (
          <>
            <td colSpan={2}>Group total:</td>
            <td colSpan={1}>{sortCode.id}</td>
            <td colSpan={1}>
              {!!sortCode.totalDebit &&
                `${currencyCodeToSymbol(Currency.Ils)} ${formatStringifyAmount(sortCode.totalDebit)}`}
            </td>
            <td colSpan={1}>
              {!!sortCode.totalCredit &&
                `${currencyCodeToSymbol(Currency.Ils)} ${formatStringifyAmount(sortCode.totalCredit)}`}
            </td>
            <td colSpan={1}>
              <Text
                c={sortCode.sum > 0 ? 'green' : sortCode.sum < 0 ? 'red' : undefined}
              >{`${currencyCodeToSymbol(Currency.Ils)} ${formatStringifyAmount(sortCode.sum)}`}</Text>
              {!!sortCode.debit && (
                <>
                  <br />
                  Total Debit Balances:{' '}
                  {`${currencyCodeToSymbol(Currency.Ils)} ${formatStringifyAmount(sortCode.debit)}`}
                </>
              )}
              {!!sortCode.credit && (
                <>
                  <br />
                  Total Credit Balances:{' '}
                  {`${currencyCodeToSymbol(Currency.Ils)} ${formatStringifyAmount(sortCode.credit)}`}
                </>
              )}
            </td>
          </>
        ) : undefined}
      </tr>
    </>
  ) : null;
};
