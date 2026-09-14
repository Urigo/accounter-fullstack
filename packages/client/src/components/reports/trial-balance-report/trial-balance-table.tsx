import { useMemo, type ReactElement } from 'react';
import { TrialBalanceTableFieldsFragmentDoc } from '../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../gql/index.js';
import { formatStringifyAmount } from '../../../helpers/index.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table.js';
import { DownloadCSV } from './download-csv.js';
import type { TrialBalanceReportFilters } from './trial-balance-report-filters.js';
import { TrialBalanceReportGroup } from './trial-balance-report-group.js';
import type { ExtendedSortCode } from './trial-balance-report-sort-code.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment TrialBalanceTableFields on BusinessTransactionsSumFromLedgerRecordsSuccessfulResult {
    businessTransactionsSum {
      business {
        id
        name
        sortCode {
          id
          key
          name
        }
      }
      credit {
        formatted
        raw
      }
      debit {
        formatted
        raw
      }
      total {
        formatted
        raw
      }
    }
  }
`;

function roundNearest100(num: number): number {
  return Math.floor(num / 100) * 100;
}

export type SortCodeGroup = {
  sortCodes: Record<number, ExtendedSortCode>;
  totalCredit: number;
  totalDebit: number;
  credit: number;
  debit: number;
  sum: number;
};

type Props = {
  data: FragmentType<typeof TrialBalanceTableFieldsFragmentDoc>;
  filter: TrialBalanceReportFilters;
  isAllOpened: boolean;
};

export const TrialBalanceTable = ({ data, filter, isAllOpened }: Props): ReactElement => {
  const { businessTransactionsSum } = getFragmentData(TrialBalanceTableFieldsFragmentDoc, data);
  const sortCodesGroups = useMemo(() => {
    const adjustedSortCodes: Record<number, SortCodeGroup> = {};

    for (const record of businessTransactionsSum) {
      // use default group if no sort code
      record.business.sortCode ??= {
        id: '-999',
        key: -999,
        name: 'Misc',
      };
      // ignore if no total sum
      const sumIsZero =
        !record.total.raw || (record.total.raw < 0.001 && record.total.raw > -0.001);
      if (!filter.isShowZeroedAccounts && sumIsZero) {
        continue;
      }

      const groupCode = roundNearest100(record.business.sortCode.key);
      adjustedSortCodes[groupCode] ??= {
        sortCodes: {},
        totalCredit: 0,
        totalDebit: 0,
        credit: 0,
        debit: 0,
        sum: 0,
      };
      const group = adjustedSortCodes[groupCode];

      group.sortCodes[record.business.sortCode.key] ??= {
        ...record.business.sortCode,
        totalCredit: 0,
        totalDebit: 0,
        records: [],
        credit: 0,
        debit: 0,
        sum: 0,
      };
      const sortCode = group.sortCodes[record.business.sortCode.key];

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
    <Table>
      <TableHeader className="sticky top-0 z-20">
        <TableRow className="bg-gray-300">
          <TableHead>Sort Code</TableHead>
          <TableHead>Account</TableHead>
          <TableHead>Account Name</TableHead>
          <TableHead>Total Debit</TableHead>
          <TableHead>Total Credit</TableHead>
          <TableHead>Balance</TableHead>
          <TableHead>
            <DownloadCSV
              data={sortCodesGroups}
              fromDate={filter.fromDate ?? undefined}
              toDate={filter.toDate ?? undefined}
            />
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Object.entries(sortCodesGroups).map(([group, data]) => (
          <TrialBalanceReportGroup
            key={group}
            data={data}
            group={group}
            filter={filter}
            isAllOpened={isAllOpened}
          />
        ))}
        <TableRow className="bg-gray-100">
          <TableCell colSpan={2}>Report total:</TableCell>
          <TableCell />
          <TableCell>
            (
            {formatStringifyAmount(
              Object.values(sortCodesGroups).reduce(
                (totalDebit, row) => totalDebit + row.totalDebit,
                0,
              ),
            )}
            )
          </TableCell>
          <TableCell>
            (
            {formatStringifyAmount(
              Object.values(sortCodesGroups).reduce(
                (totalCredit, row) => totalCredit + row.totalCredit,
                0,
              ),
            )}
            )
          </TableCell>
          <TableCell colSpan={1}>
            {formatStringifyAmount(
              Object.values(sortCodesGroups).reduce((total, row) => total + row.sum, 0),
            )}
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
};
