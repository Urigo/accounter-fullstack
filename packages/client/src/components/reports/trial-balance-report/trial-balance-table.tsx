import { ReactElement, useMemo } from 'react';
import { Table } from '@mantine/core';
import type { TrialBalanceReportQuery } from '../../../gql/graphql.js';
import { formatStringifyAmount } from '../../../helpers/index.js';
import type { TrialBalanceReportFilters } from './trial-balance-report-filters.js';
import { TrialBalanceReportGroup } from './trial-balance-report-group.js';
import type { ExtendedSortCode } from './trial-balance-report-sort-code.js';

function roundNearest100(num: number): number {
  return Math.floor(num / 100) * 100;
}

type Props = {
  businessTransactionsSum: Extract<
    TrialBalanceReportQuery['businessTransactionsSumFromLedgerRecords'],
    { businessTransactionsSum: unknown }
  >['businessTransactionsSum'];
  filter: TrialBalanceReportFilters;
  isAllOpened: boolean;
};

export const TrialBalanceTable = ({
  businessTransactionsSum,
  filter,
  isAllOpened,
}: Props): ReactElement => {
  const sortCodesGroups = useMemo(() => {
    const adjustedSortCodes: Record<
      number,
      {
        sortCodes: Record<number, ExtendedSortCode>;
        totalCredit: number;
        totalDebit: number;
        credit: number;
        debit: number;
        sum: number;
      }
    > = {};

    for (const record of businessTransactionsSum) {
      // use default group if no sort code
      record.business.sortCode ??= {
        id: -999,
        name: 'Misc',
      };
      // ignore if no total sum
      const sumIsZero =
        !record.total.raw || (record.total.raw < 0.001 && record.total.raw > -0.001);
      if (!filter.isShowZeroedAccounts && sumIsZero) {
        continue;
      }

      const groupCode = roundNearest100(record.business.sortCode.id);
      adjustedSortCodes[groupCode] ??= {
        sortCodes: {},
        totalCredit: 0,
        totalDebit: 0,
        credit: 0,
        debit: 0,
        sum: 0,
      };
      const group = adjustedSortCodes[groupCode];

      group.sortCodes[record.business.sortCode.id] ??= {
        ...record.business.sortCode,
        totalCredit: 0,
        totalDebit: 0,
        records: [],
        credit: 0,
        debit: 0,
        sum: 0,
      };
      const sortCode = group.sortCodes[record.business.sortCode.id];

      sortCode.totalCredit += record.credit.raw;
      sortCode.totalDebit += record.debit.raw;
      sortCode.sum += record.total.raw;
      group.totalCredit += record.credit.raw;
      group.totalDebit += record.debit.raw;
      group.sum += record.total.raw;

      if (record.total.raw > 0) {
        sortCode.credit += record.total.raw;
        group.credit += record.total.raw;
      } else {
        sortCode.debit += record.total.raw;
        group.debit += record.total.raw;
      }

      sortCode.records.push(record);
    }

    return adjustedSortCodes;
  }, [businessTransactionsSum, filter.isShowZeroedAccounts]);

  return (
    <Table highlightOnHover>
      <thead style={{ position: 'sticky', top: 0, zIndex: 20 }}>
        <tr className="bg-gray-300">
          <th>Sort Code</th>
          <th>Account</th>
          <th>Account Name</th>
          <th>Debit</th>
          <th>Credit</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        {Object.entries(sortCodesGroups).map(([group, data]) => (
          <TrialBalanceReportGroup
            key={group}
            data={data}
            group={group}
            filter={filter}
            isAllOpened={isAllOpened}
          />
        ))}
        <tr className="bg-gray-100">
          <td colSpan={2}>Report total:</td>
          <td />
          <td>
            (
            {formatStringifyAmount(
              Object.values(sortCodesGroups).reduce(
                (totalDebit, row) => totalDebit + row.totalDebit,
                0,
              ),
            )}
            )
          </td>
          <td>
            (
            {formatStringifyAmount(
              Object.values(sortCodesGroups).reduce(
                (totalCredit, row) => totalCredit + row.totalCredit,
                0,
              ),
            )}
            )
          </td>
          <td colSpan={1}>
            {formatStringifyAmount(
              Object.values(sortCodesGroups).reduce((total, row) => total + row.sum, 0),
            )}
          </td>
        </tr>
      </tbody>
    </Table>
  );
};
